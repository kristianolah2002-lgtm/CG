-- ================================================================
-- CapturaGo — Security & bug-fix patch
-- Run ONCE in Supabase → SQL Editor → New query → paste → Run.
-- Safe on your existing database: it never deletes your data,
-- and it is safe to run again if needed.
--
-- Fixes:
--  1. Ratings never updated (trigger was blocked by security rules)
--  2. Creators could give themselves "featured", "verified",
--     a 5.0 rating or fake view counts
--  3. Anyone could post unlimited anonymous reviews, review
--     themselves, or post reviews in someone else's name
--  4. Users could upload files into other users' folders,
--     upload any file type, any size
--  5. One account could create unlimited listings
--  6. No length limits on messages/reviews (spam risk)
--  7. Creators' private emails were readable by any visitor
--  8. Reviewers' emails were readable by any visitor
--  9. Creators could rewrite the text of clients' inquiries
-- ================================================================

-- ── 0. Make sure every column the website uses exists ──────────
ALTER TABLE photographers ADD COLUMN IF NOT EXISTS services         TEXT[]  DEFAULT '{}';
ALTER TABLE photographers ADD COLUMN IF NOT EXISTS vibes            TEXT[]  DEFAULT '{}';
ALTER TABLE photographers ADD COLUMN IF NOT EXISTS level            TEXT    DEFAULT 'semipro';
ALTER TABLE photographers ADD COLUMN IF NOT EXISTS languages        TEXT;
ALTER TABLE photographers ADD COLUMN IF NOT EXISTS local_spots      JSONB   DEFAULT '[]';
ALTER TABLE photographers ADD COLUMN IF NOT EXISTS travel_available BOOLEAN DEFAULT FALSE;
ALTER TABLE photographers ADD COLUMN IF NOT EXISTS available        BOOLEAN DEFAULT TRUE;
ALTER TABLE photographers ADD COLUMN IF NOT EXISTS featured         BOOLEAN DEFAULT FALSE;
ALTER TABLE photographers ADD COLUMN IF NOT EXISTS packages         JSONB   DEFAULT '[]';
ALTER TABLE photographers ADD COLUMN IF NOT EXISTS payouts_enabled  BOOLEAN DEFAULT FALSE;
ALTER TABLE photographers ADD COLUMN IF NOT EXISTS boosted_until    TIMESTAMPTZ;
ALTER TABLE photographers ADD COLUMN IF NOT EXISTS stripe_account_id TEXT;
ALTER TABLE photographers ADD COLUMN IF NOT EXISTS occasions        TEXT[]  DEFAULT '{}';
ALTER TABLE photographers ADD COLUMN IF NOT EXISTS drone_certified  BOOLEAN DEFAULT FALSE;

-- "verified" must be a number 0–3 (older schema used true/false)
DO $$
BEGIN
  IF (SELECT data_type FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'photographers'
        AND column_name = 'verified') = 'boolean' THEN
    ALTER TABLE photographers ALTER COLUMN verified DROP DEFAULT;
    ALTER TABLE photographers ALTER COLUMN verified TYPE INTEGER
      USING (CASE WHEN verified THEN 1 ELSE 0 END);
    ALTER TABLE photographers ALTER COLUMN verified SET DEFAULT 0;
  END IF;
END $$;

-- ── 1. Rating trigger must run with elevated rights ────────────
CREATE OR REPLACE FUNCTION recalculate_rating()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_id UUID;
BEGIN
  target_id := COALESCE(NEW.photographer_id, OLD.photographer_id);
  UPDATE photographers
  SET rating = COALESCE((SELECT ROUND(AVG(rating)::NUMERIC, 1)
                         FROM reviews WHERE photographer_id = target_id), 5.0),
      reviews_count = (SELECT COUNT(*) FROM reviews WHERE photographer_id = target_id)
  WHERE id = target_id;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION increment_views(photographer_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE photographers SET views_count = views_count + 1
  WHERE id = increment_views.photographer_id;
END;
$$;

-- ── 2. Protect admin-only columns ──────────────────────────────
-- Users may write only these columns. rating, reviews_count,
-- views_count, verified, featured can only be changed by you
-- (in the Supabase dashboard) or by the triggers above.
REVOKE INSERT, UPDATE ON photographers FROM anon, authenticated;

GRANT INSERT (user_id, name, city, coords, email, languages, type, services,
              vibes, specialties, level, description, tags, local_spots,
              portfolio_url, cover_image_url, price, available, travel_available, packages,
              occasions, drone_certified)
  ON photographers TO authenticated;

GRANT UPDATE (name, city, coords, email, languages, type, services,
              vibes, specialties, level, description, tags, local_spots,
              portfolio_url, cover_image_url, price, available, travel_available, packages,
              occasions, drone_certified)
  ON photographers TO authenticated;

-- ── 3. One listing per account ─────────────────────────────────
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS one_listing_per_user ON photographers (user_id);
EXCEPTION WHEN unique_violation THEN
  RAISE NOTICE 'Some accounts already have more than one listing. Delete the extra test listings in Table Editor → photographers, then run this file again.';
END $$;

-- ── 4. Reviews: signed-in users only, one per creator, no self-reviews
DROP POLICY IF EXISTS "anyone_insert_review" ON reviews;
DROP POLICY IF EXISTS "anyone insert review" ON reviews;
DROP POLICY IF EXISTS "signed_in_insert_review" ON reviews;

CREATE POLICY "signed_in_insert_review"
  ON reviews FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND auth.uid() = user_id
    AND photographer_id NOT IN (SELECT id FROM photographers WHERE user_id = auth.uid())
  );

DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS one_review_per_user_per_creator
    ON reviews (user_id, photographer_id);
EXCEPTION WHEN unique_violation THEN
  RAISE NOTICE 'Duplicate test reviews exist — delete them in Table Editor → reviews, then run again.';
END $$;

-- ── 5. Length limits (anti-spam) ───────────────────────────────
DO $$
BEGIN
  ALTER TABLE reviews   ADD CONSTRAINT review_comment_len  CHECK (char_length(coalesce(comment, '')) <= 1000) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$
BEGIN
  ALTER TABLE inquiries ADD CONSTRAINT inquiry_message_len CHECK (char_length(message) BETWEEN 5 AND 3000) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$
BEGIN
  ALTER TABLE photographers ADD CONSTRAINT description_len CHECK (char_length(coalesce(description, '')) <= 600) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 6. Storage: own folder only, images only, max 5 MB ─────────
UPDATE storage.buckets
SET file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']
WHERE id = 'photographer-covers';

DROP POLICY IF EXISTS "authed_upload_cover" ON storage.objects;
DROP POLICY IF EXISTS "authed upload cover" ON storage.objects;
CREATE POLICY "authed_upload_cover"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'photographer-covers'
    AND auth.uid() IS NOT NULL
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- ── 7. Hide creators' private emails from the public ───────────
-- Visitors may read every listing column EXCEPT email. The edge
-- function that sends notification emails uses the service role,
-- which is unaffected.
REVOKE SELECT ON photographers FROM anon, authenticated;
GRANT SELECT (id, user_id, name, city, coords, languages, type, services,
              vibes, specialties, level, description, tags, local_spots,
              portfolio_url, cover_image_url, price, available,
              travel_available, rating, reviews_count, views_count,
              verified, featured, created_at, updated_at,
              packages, payouts_enabled, boosted_until,
              occasions, drone_certified)
  ON photographers TO anon, authenticated;

-- A creator can still read THEIR OWN email (dashboard), nobody else's.
CREATE OR REPLACE FUNCTION my_listing_email()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email FROM photographers WHERE user_id = auth.uid() LIMIT 1;
$$;
REVOKE ALL ON FUNCTION my_listing_email() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION my_listing_email() TO authenticated;

-- ── 8. Hide reviewers' emails from the public ──────────────────
REVOKE SELECT ON reviews FROM anon, authenticated;
GRANT SELECT (id, photographer_id, user_id, reviewer_name, rating, comment, created_at)
  ON reviews TO anon, authenticated;

-- ── 9. Creators may only mark inquiries as read ────────────────
REVOKE UPDATE ON inquiries FROM anon, authenticated;
GRANT UPDATE (read) ON inquiries TO authenticated;

-- ================================================================
-- Done. You should see "Success. No rows returned."
-- ================================================================
