-- ================================================================
-- CapturaGo — COMPLETE DATABASE (the only SQL file you need)
-- Supabase → SQL Editor → New query → paste ALL of this → Run.
-- Safe to run on a new or an existing database, and to run again
-- any time. It never deletes your data.
-- Replaces schema.sql, security-patch.sql and payments-patch.sql.
-- ================================================================

-- ################ PART 1 — Tables ################
-- ================================================================
-- CapturaGo — Complete Database Schema
-- ─────────────────────────────────────────────────────────────────
-- HOW TO USE:
-- 1. Go to supabase.com → your project → SQL Editor
-- 2. Click "New query"
-- 3. Paste this entire file
-- 4. Click "Run" (green button, top right)
-- ================================================================

-- ── PHOTOGRAPHERS (= creators) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS photographers (
  id               UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          UUID        REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Profile
  name             TEXT        NOT NULL,
  city             TEXT        NOT NULL,
  coords           JSONB,                          -- { lat, lon }
  email            TEXT        NOT NULL,
  languages        TEXT,

  -- Creator type
  type             TEXT,                           -- primary type
  services         TEXT[]      DEFAULT '{}',       -- ['photo','video','edit','guide']
  vibes            TEXT[]      DEFAULT '{}',       -- ['moody','airy','film','cinematic']
  specialties      TEXT,
  level            TEXT        DEFAULT 'semipro',  -- enthusiast | semipro | pro

  -- Content
  description      TEXT,
  tags             TEXT[]      DEFAULT '{}',
  local_spots      JSONB       DEFAULT '[]',       -- [{name, desc}]

  -- Links & media
  portfolio_url    TEXT,
  cover_image_url  TEXT,

  -- Pricing
  price            TEXT        DEFAULT 'mid',      -- budget | mid | premium

  -- Availability
  available        BOOLEAN     DEFAULT TRUE,
  travel_available BOOLEAN     DEFAULT FALSE,

  -- Stats (auto-updated by triggers)
  rating           NUMERIC(3,1) DEFAULT 5.0,
  reviews_count    INTEGER     DEFAULT 0,
  views_count      INTEGER     DEFAULT 0,

  -- Admin
  verified         INTEGER     DEFAULT 0,          -- 0=none 1=email 2=portfolio 3=identity
  featured         BOOLEAN     DEFAULT FALSE,

  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ── REVIEWS ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reviews (
  id               UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  photographer_id  UUID        REFERENCES photographers(id) ON DELETE CASCADE,
  user_id          UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewer_name    TEXT        NOT NULL,
  reviewer_email   TEXT,
  rating           INTEGER     NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment          TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ── FAVORITES ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS favorites (
  id               UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  photographer_id  UUID        REFERENCES photographers(id) ON DELETE CASCADE NOT NULL,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, photographer_id)
);

-- ── INQUIRIES ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inquiries (
  id               UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  photographer_id  UUID        REFERENCES photographers(id) ON DELETE CASCADE,
  sender_name      TEXT        NOT NULL,
  sender_email     TEXT        NOT NULL,
  shoot_type       TEXT,
  shoot_date       DATE,
  message          TEXT        NOT NULL,
  read             BOOLEAN     DEFAULT FALSE,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- INDEXES (make searches fast)
-- ================================================================
CREATE INDEX IF NOT EXISTS idx_photo_city     ON photographers USING gin(to_tsvector('simple', city));
CREATE INDEX IF NOT EXISTS idx_photo_services ON photographers USING gin(services);
CREATE INDEX IF NOT EXISTS idx_photo_vibes    ON photographers USING gin(vibes);
CREATE INDEX IF NOT EXISTS idx_photo_price    ON photographers (price);
CREATE INDEX IF NOT EXISTS idx_photo_featured ON photographers (featured);
CREATE INDEX IF NOT EXISTS idx_photo_avail    ON photographers (available);
CREATE INDEX IF NOT EXISTS idx_reviews_photo  ON reviews (photographer_id);
CREATE INDEX IF NOT EXISTS idx_inq_photo      ON inquiries (photographer_id);
CREATE INDEX IF NOT EXISTS idx_fav_user       ON favorites (user_id);

-- ================================================================
-- TRIGGERS
-- ================================================================

-- Auto-update updated_at on any row change
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at ON photographers;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON photographers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-recalculate rating after every review insert/delete
CREATE OR REPLACE FUNCTION recalculate_rating()
RETURNS TRIGGER AS $$
DECLARE
  target_id UUID;
BEGIN
  target_id := COALESCE(NEW.photographer_id, OLD.photographer_id);
  UPDATE photographers
  SET
    rating        = COALESCE(
                      (SELECT ROUND(AVG(rating)::NUMERIC, 1)
                       FROM reviews WHERE photographer_id = target_id),
                      5.0),
    reviews_count = (SELECT COUNT(*) FROM reviews WHERE photographer_id = target_id)
  WHERE id = target_id;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS after_review_change ON reviews;
CREATE TRIGGER after_review_change
  AFTER INSERT OR DELETE ON reviews
  FOR EACH ROW EXECUTE FUNCTION recalculate_rating();

-- Safe view counter (bypasses RLS, no auth needed)
CREATE OR REPLACE FUNCTION increment_views(photographer_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE photographers
  SET views_count = views_count + 1
  WHERE id = photographer_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================================================
-- ROW LEVEL SECURITY
-- ================================================================
ALTER TABLE photographers ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews        ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites      ENABLE ROW LEVEL SECURITY;
ALTER TABLE inquiries      ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if re-running this script
DROP POLICY IF EXISTS "public_read_photographers"    ON photographers;
DROP POLICY IF EXISTS "authed_insert_photographer"   ON photographers;
DROP POLICY IF EXISTS "owner_update_photographer"    ON photographers;
DROP POLICY IF EXISTS "owner_delete_photographer"    ON photographers;
DROP POLICY IF EXISTS "public_read_reviews"          ON reviews;
DROP POLICY IF EXISTS "anyone_insert_review"         ON reviews;
DROP POLICY IF EXISTS "user_delete_review"           ON reviews;
DROP POLICY IF EXISTS "user_read_favorites"          ON favorites;
DROP POLICY IF EXISTS "user_insert_favorite"         ON favorites;
DROP POLICY IF EXISTS "user_delete_favorite"         ON favorites;
DROP POLICY IF EXISTS "anyone_send_inquiry"          ON inquiries;
DROP POLICY IF EXISTS "photographer_read_inquiries"  ON inquiries;
DROP POLICY IF EXISTS "photographer_mark_read"       ON inquiries;

-- PHOTOGRAPHERS
CREATE POLICY "public_read_photographers"
  ON photographers FOR SELECT USING (true);

CREATE POLICY "authed_insert_photographer"
  ON photographers FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

CREATE POLICY "owner_update_photographer"
  ON photographers FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "owner_delete_photographer"
  ON photographers FOR DELETE
  USING (auth.uid() = user_id);

-- REVIEWS
CREATE POLICY "public_read_reviews"
  ON reviews FOR SELECT USING (true);

CREATE POLICY "anyone_insert_review"
  ON reviews FOR INSERT WITH CHECK (true);

CREATE POLICY "user_delete_review"
  ON reviews FOR DELETE USING (auth.uid() = user_id);

-- FAVORITES
CREATE POLICY "user_read_favorites"
  ON favorites FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "user_insert_favorite"
  ON favorites FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_delete_favorite"
  ON favorites FOR DELETE USING (auth.uid() = user_id);

-- INQUIRIES
CREATE POLICY "anyone_send_inquiry"
  ON inquiries FOR INSERT WITH CHECK (true);

CREATE POLICY "photographer_read_inquiries"
  ON inquiries FOR SELECT
  USING (photographer_id IN (
    SELECT id FROM photographers WHERE user_id = auth.uid()
  ));

CREATE POLICY "photographer_mark_read"
  ON inquiries FOR UPDATE
  USING (photographer_id IN (
    SELECT id FROM photographers WHERE user_id = auth.uid()
  ));

-- ================================================================
-- STORAGE BUCKET
-- ================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('photographer-covers', 'photographer-covers', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "public_read_covers"   ON storage.objects;
DROP POLICY IF EXISTS "authed_upload_cover"  ON storage.objects;
DROP POLICY IF EXISTS "owner_update_cover"   ON storage.objects;
DROP POLICY IF EXISTS "owner_delete_cover"   ON storage.objects;

CREATE POLICY "public_read_covers"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'photographer-covers');

CREATE POLICY "authed_upload_cover"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'photographer-covers' AND auth.uid() IS NOT NULL);

CREATE POLICY "owner_update_cover"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'photographer-covers'
    AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "owner_delete_cover"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'photographer-covers'
    AND auth.uid()::text = (storage.foldername(name))[1]);

-- ================================================================
-- DONE — your database is ready
-- ================================================================

-- ################ PART 2 — Security ################
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
              portfolio_url, cover_image_url, price, available, travel_available, packages)
  ON photographers TO authenticated;

GRANT UPDATE (name, city, coords, email, languages, type, services,
              vibes, specialties, level, description, tags, local_spots,
              portfolio_url, cover_image_url, price, available, travel_available, packages)
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
              packages, payouts_enabled, boosted_until)
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

-- ################ PART 3 — Payments ################
-- ================================================================
-- CapturaGo — Payments, bookings, boosts & AI patch
-- Run in Supabase → SQL Editor AFTER schema.sql and security-patch.sql.
-- Safe to run more than once. Never deletes data.
-- ================================================================

-- ── 1. New listing columns ─────────────────────────────────────
ALTER TABLE photographers ADD COLUMN IF NOT EXISTS packages          JSONB       DEFAULT '[]';
ALTER TABLE photographers ADD COLUMN IF NOT EXISTS stripe_account_id TEXT;
ALTER TABLE photographers ADD COLUMN IF NOT EXISTS payouts_enabled   BOOLEAN     DEFAULT FALSE;
ALTER TABLE photographers ADD COLUMN IF NOT EXISTS boosted_until     TIMESTAMPTZ;

DO $$ BEGIN
  ALTER TABLE photographers ADD CONSTRAINT packages_shape
    CHECK (jsonb_typeof(packages) = 'array' AND jsonb_array_length(packages) <= 5) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Public columns (email and stripe_account_id stay private)
REVOKE SELECT ON photographers FROM anon, authenticated;
GRANT SELECT (id, user_id, name, city, coords, languages, type, services,
              vibes, specialties, level, description, tags, local_spots,
              portfolio_url, cover_image_url, price, available,
              travel_available, rating, reviews_count, views_count,
              verified, featured, created_at, updated_at,
              packages, payouts_enabled, boosted_until)
  ON photographers TO anon, authenticated;

-- Creators may write their packages — but never payouts_enabled,
-- boosted_until or stripe_account_id (only the server sets those).
REVOKE INSERT, UPDATE ON photographers FROM anon, authenticated;
GRANT INSERT (user_id, name, city, coords, email, languages, type, services,
              vibes, specialties, level, description, tags, local_spots,
              portfolio_url, cover_image_url, price, available,
              travel_available, packages)
  ON photographers TO authenticated;
GRANT UPDATE (name, city, coords, email, languages, type, services,
              vibes, specialties, level, description, tags, local_spots,
              portfolio_url, cover_image_url, price, available,
              travel_available, packages)
  ON photographers TO authenticated;

-- ── 2. Bookings ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bookings (
  id                          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  photographer_id             UUID        REFERENCES photographers(id) ON DELETE SET NULL,
  creator_user_id             UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  creator_stripe_account_id   TEXT,
  client_user_id              UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  client_name                 TEXT,
  client_email                TEXT,
  package_id                  TEXT,
  package_name                TEXT,
  package_minutes             INTEGER,
  shoot_date                  DATE        NOT NULL,
  note                        TEXT        CHECK (char_length(coalesce(note, '')) <= 1000),
  currency                    TEXT        NOT NULL DEFAULT 'eur',
  price_cents                 INTEGER     NOT NULL CHECK (price_cents > 0),
  client_fee_cents            INTEGER     NOT NULL DEFAULT 0 CHECK (client_fee_cents >= 0),
  creator_fee_cents           INTEGER     NOT NULL DEFAULT 0 CHECK (creator_fee_cents >= 0),
  total_cents                 INTEGER     NOT NULL CHECK (total_cents > 0),
  status                      TEXT        NOT NULL DEFAULT 'pending_payment'
                              CHECK (status IN ('pending_payment','paid','confirmed','completed',
                                                'declined','cancelled','refunded','expired','disputed')),
  stripe_checkout_session_id  TEXT,
  stripe_payment_intent_id    TEXT,
  stripe_transfer_id          TEXT,
  stripe_refund_id            TEXT,
  created_at                  TIMESTAMPTZ DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bookings_client  ON bookings (client_user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_creator ON bookings (creator_user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_session ON bookings (stripe_checkout_session_id);

DROP TRIGGER IF EXISTS bookings_updated_at ON bookings;
CREATE TRIGGER bookings_updated_at BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "parties_read_booking" ON bookings;
CREATE POLICY "parties_read_booking" ON bookings FOR SELECT
  USING (auth.uid() = client_user_id OR auth.uid() = creator_user_id);

-- Browsers can only READ their own bookings. Every change goes
-- through the server functions (which use the service role).
REVOKE ALL ON bookings FROM anon, authenticated;
GRANT SELECT (id, photographer_id, creator_user_id, client_user_id, client_name,
              client_email, package_id, package_name, package_minutes, shoot_date,
              note, currency, price_cents, client_fee_cents, creator_fee_cents,
              total_cents, status, created_at, updated_at)
  ON bookings TO authenticated;

-- A creator can't delete their listing while money is in flight.
CREATE OR REPLACE FUNCTION prevent_delete_with_active_bookings()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM bookings
             WHERE photographer_id = OLD.id
               AND status IN ('paid', 'confirmed', 'disputed')) THEN
    RAISE EXCEPTION 'You have active bookings. Complete or cancel them before deleting your listing.'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN OLD;
END $$;
DROP TRIGGER IF EXISTS block_delete_active_bookings ON photographers;
CREATE TRIGGER block_delete_active_bookings BEFORE DELETE ON photographers
  FOR EACH ROW EXECUTE FUNCTION prevent_delete_with_active_bookings();

-- ── 3. Server-only tables ──────────────────────────────────────
-- Stripe webhook idempotency (each event processed exactly once)
CREATE TABLE IF NOT EXISTS stripe_events (
  id          TEXT PRIMARY KEY,
  type        TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE stripe_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON stripe_events FROM anon, authenticated;

-- AI search rate limiting (stores a salted hash, never the raw IP)
CREATE TABLE IF NOT EXISTS ai_requests (
  id          BIGSERIAL PRIMARY KEY,
  ip_hash     TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ai_requests_ip ON ai_requests (ip_hash, created_at);
ALTER TABLE ai_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ai_requests FROM anon, authenticated;
DO $$ BEGIN
  REVOKE ALL ON SEQUENCE ai_requests_id_seq FROM anon, authenticated;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ================================================================
-- Done. You should see "Success. No rows returned."
-- ================================================================

-- ################################################################
-- PART 4 — Growth: occasions, new creator types, remote delivery
-- (final permissions for the whole database live in this part)
-- ################################################################

-- ── Listings: occasions + drone certificate ───────────────────
ALTER TABLE photographers ADD COLUMN IF NOT EXISTS occasions        TEXT[]  DEFAULT '{}';
ALTER TABLE photographers ADD COLUMN IF NOT EXISTS drone_certified  BOOLEAN DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_photographers_occasions ON photographers USING GIN (occasions);
CREATE INDEX IF NOT EXISTS idx_photographers_services  ON photographers USING GIN (services);
CREATE INDEX IF NOT EXISTS idx_photographers_vibes     ON photographers USING GIN (vibes);

-- ── Bookings: remote delivery ─────────────────────────────────
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS booking_type       TEXT        NOT NULL DEFAULT 'session';
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS client_files_url   TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS delivery_url       TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS delivered_at       TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS revisions_allowed  INTEGER     NOT NULL DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS revisions_used     INTEGER     NOT NULL DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS last_revision_note TEXT;

ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
ALTER TABLE bookings ADD  CONSTRAINT bookings_status_check
  CHECK (status IN ('pending_payment','paid','confirmed','delivered','completed',
                    'declined','cancelled','refunded','expired','disputed'));
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_type_check;
ALTER TABLE bookings ADD  CONSTRAINT bookings_type_check CHECK (booking_type IN ('session','delivery'));
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_revisions_check;
ALTER TABLE bookings ADD  CONSTRAINT bookings_revisions_check
  CHECK (revisions_allowed BETWEEN 0 AND 5 AND revisions_used BETWEEN 0 AND revisions_allowed);
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_urls_check;
ALTER TABLE bookings ADD  CONSTRAINT bookings_urls_check
  CHECK ((client_files_url IS NULL OR (client_files_url ~ '^https://' AND char_length(client_files_url) <= 500))
     AND (delivery_url     IS NULL OR (delivery_url     ~ '^https://' AND char_length(delivery_url)     <= 500))
     AND char_length(coalesce(last_revision_note, '')) <= 1000);

-- Money in flight also includes delivered-but-not-approved work
CREATE OR REPLACE FUNCTION prevent_delete_with_active_bookings()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM bookings
             WHERE photographer_id = OLD.id
               AND status IN ('paid', 'confirmed', 'delivered', 'disputed')) THEN
    RAISE EXCEPTION 'You have active bookings. Complete or cancel them before deleting your listing.'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN OLD;
END $$;

-- ── Drone rules: region (public) + numbers (private) ──────────
ALTER TABLE photographers ADD COLUMN IF NOT EXISTS drone_region TEXT;
ALTER TABLE photographers ADD COLUMN IF NOT EXISTS drone_info   JSONB;
ALTER TABLE photographers DROP CONSTRAINT IF EXISTS drone_region_check;
ALTER TABLE photographers ADD  CONSTRAINT drone_region_check
  CHECK ((drone_region IS NULL OR drone_region IN ('easa','faa','other'))
     AND (drone_info IS NULL OR (jsonb_typeof(drone_info) = 'object' AND char_length(drone_info::text) <= 600)));

-- A creator can read back their OWN drone numbers (dashboard), nobody else's.
CREATE OR REPLACE FUNCTION my_drone_info()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object('region', drone_region, 'info', drone_info)
  FROM photographers WHERE user_id = auth.uid() LIMIT 1;
$$;
REVOKE ALL ON FUNCTION my_drone_info() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION my_drone_info() TO authenticated;

-- ── FINAL permissions (authoritative) ─────────────────────────
REVOKE SELECT, INSERT, UPDATE ON photographers FROM anon, authenticated;
GRANT SELECT (id, user_id, name, city, coords, languages, type, services,
              vibes, specialties, level, description, tags, local_spots,
              portfolio_url, cover_image_url, price, available,
              travel_available, rating, reviews_count, views_count,
              verified, featured, created_at, updated_at,
              packages, payouts_enabled, boosted_until, occasions, drone_certified,
              drone_region)
  ON photographers TO anon, authenticated;
GRANT INSERT (user_id, name, city, coords, email, languages, type, services,
              vibes, specialties, level, description, tags, local_spots,
              portfolio_url, cover_image_url, price, available,
              travel_available, packages, occasions, drone_certified,
              drone_region, drone_info)
  ON photographers TO authenticated;
GRANT UPDATE (name, city, coords, email, languages, type, services,
              vibes, specialties, level, description, tags, local_spots,
              portfolio_url, cover_image_url, price, available,
              travel_available, packages, occasions, drone_certified,
              drone_region, drone_info)
  ON photographers TO authenticated;

REVOKE ALL ON bookings FROM anon, authenticated;
GRANT SELECT (id, photographer_id, creator_user_id, client_user_id, client_name,
              client_email, package_id, package_name, package_minutes, shoot_date,
              note, currency, price_cents, client_fee_cents, creator_fee_cents,
              total_cents, status, created_at, updated_at,
              booking_type, client_files_url, delivery_url, delivered_at,
              revisions_allowed, revisions_used, last_revision_note)
  ON bookings TO authenticated;



-- ################################################################
-- PART 5 — Operations: automatic jobs, admin panel, moderation
-- ################################################################

-- Admins (add yourself once — see SETUP-PAYMENTS-AND-AI.md, Part 9)
CREATE TABLE IF NOT EXISTS admins (
  user_id     UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON admins FROM anon, authenticated;

-- Log of automatic job runs (shown in the admin panel)
CREATE TABLE IF NOT EXISTS job_runs (
  id           BIGSERIAL PRIMARY KEY,
  started_at   TIMESTAMPTZ DEFAULT NOW(),
  finished_at  TIMESTAMPTZ,
  summary      JSONB,
  error        TEXT
);
ALTER TABLE job_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON job_runs FROM anon, authenticated;
DO $$ BEGIN REVOKE ALL ON SEQUENCE job_runs_id_seq FROM anon, authenticated; EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- Boost purchases (revenue reporting)
CREATE TABLE IF NOT EXISTS boost_purchases (
  id                 BIGSERIAL PRIMARY KEY,
  photographer_id    UUID REFERENCES photographers(id) ON DELETE SET NULL,
  days               INTEGER NOT NULL,
  amount_cents       INTEGER NOT NULL DEFAULT 0,
  stripe_session_id  TEXT UNIQUE,
  created_at         TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE boost_purchases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON boost_purchases FROM anon, authenticated;
DO $$ BEGIN REVOKE ALL ON SEQUENCE boost_purchases_id_seq FROM anon, authenticated; EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- Bookings: when it was paid + which reminder emails were already sent
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS paid_at  TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS notices  JSONB NOT NULL DEFAULT '{}';
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings (status);

-- Moderation: listings hidden by an admin are invisible to everyone except their owner
ALTER TABLE photographers ADD COLUMN IF NOT EXISTS hidden BOOLEAN NOT NULL DEFAULT FALSE;
DROP POLICY IF EXISTS "public_read_photographers" ON photographers;
DROP POLICY IF EXISTS "public_read_visible_photographers" ON photographers;
CREATE POLICY "public_read_visible_photographers" ON photographers FOR SELECT
  USING (hidden IS NOT TRUE OR auth.uid() = user_id);

-- ================================================================
-- Done. You should see "Success. No rows returned."
-- ================================================================
-- ################################################################
-- PART 6 — Private messages (website + app)
-- Only the two people in a conversation can read it. Messages are
-- encrypted in transit (HTTPS) and at rest (Supabase disk encryption).
-- CapturaGo staff only see a conversation after one of the two
-- REPORTS it (admin panel → Reports).
-- ################################################################

CREATE TABLE IF NOT EXISTS conversations (
  id               UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  photographer_id  UUID        NOT NULL REFERENCES photographers(id) ON DELETE CASCADE,
  client_user_id   UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  creator_user_id  UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_name      TEXT        NOT NULL DEFAULT 'Traveller',
  last_message_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_message     TEXT,
  last_sender_id   UUID,
  client_read_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  creator_read_at  TIMESTAMPTZ NOT NULL DEFAULT 'epoch',
  blocked_by       UUID,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT conversation_two_people CHECK (client_user_id <> creator_user_id),
  CONSTRAINT one_conversation_per_pair UNIQUE (photographer_id, client_user_id)
);
CREATE INDEX IF NOT EXISTS idx_conv_client  ON conversations (client_user_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_conv_creator ON conversations (creator_user_id, last_message_at DESC);

CREATE TABLE IF NOT EXISTS messages (
  id               UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id  UUID        NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id        UUID        NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  body             TEXT        NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT message_body_len CHECK (char_length(btrim(body)) BETWEEN 1 AND 2000)
);
CREATE INDEX IF NOT EXISTS idx_messages_conv   ON messages (conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages (sender_id, created_at);

CREATE TABLE IF NOT EXISTS message_reports (
  id               UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id  UUID        NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  reporter_id      UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  reason           TEXT        NOT NULL CHECK (char_length(reason) BETWEEN 3 AND 500),
  status           TEXT        NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_reports_status ON message_reports (status, created_at DESC);

-- Security: participants only. Nobody writes conversations directly —
-- only through the functions below. Messages: sender is always you.
ALTER TABLE conversations   ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages        ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON conversations, messages, message_reports FROM anon, authenticated;
GRANT SELECT ON conversations TO authenticated;
GRANT SELECT ON messages TO authenticated;
GRANT INSERT (conversation_id, body) ON messages TO authenticated;

DROP POLICY IF EXISTS "participants_read_conversation" ON conversations;
CREATE POLICY "participants_read_conversation" ON conversations FOR SELECT
  USING (auth.uid() = client_user_id OR auth.uid() = creator_user_id);

DROP POLICY IF EXISTS "participants_read_messages" ON messages;
CREATE POLICY "participants_read_messages" ON messages FOR SELECT
  USING (EXISTS (SELECT 1 FROM conversations c WHERE c.id = conversation_id
                 AND (auth.uid() = c.client_user_id OR auth.uid() = c.creator_user_id)));

DROP POLICY IF EXISTS "participants_send_messages" ON messages;
CREATE POLICY "participants_send_messages" ON messages FOR INSERT
  WITH CHECK (sender_id = auth.uid()
    AND EXISTS (SELECT 1 FROM conversations c WHERE c.id = conversation_id
                AND (auth.uid() = c.client_user_id OR auth.uid() = c.creator_user_id)
                AND c.blocked_by IS NULL));

-- Anti-spam: max 20 messages a minute per person
CREATE OR REPLACE FUNCTION messages_rate_limit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.body := btrim(NEW.body);
  NEW.created_at := NOW();
  IF (SELECT count(*) FROM messages WHERE sender_id = NEW.sender_id
      AND created_at > NOW() - INTERVAL '1 minute') >= 20 THEN
    RAISE EXCEPTION 'You''re sending messages very fast. Please wait a minute.' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS messages_rate_limit ON messages;
CREATE TRIGGER messages_rate_limit BEFORE INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION messages_rate_limit();

-- Keep the inbox preview + "read" marker of the sender up to date
CREATE OR REPLACE FUNCTION messages_after_insert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE conversations SET
    last_message_at = NEW.created_at,
    last_message    = left(NEW.body, 140),
    last_sender_id  = NEW.sender_id,
    client_read_at  = CASE WHEN NEW.sender_id = client_user_id  THEN NEW.created_at ELSE client_read_at END,
    creator_read_at = CASE WHEN NEW.sender_id = creator_user_id THEN NEW.created_at ELSE creator_read_at END
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS messages_after_insert ON messages;
CREATE TRIGGER messages_after_insert AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION messages_after_insert();

-- Start (or reopen) a conversation with a creator. Returns its id.
CREATE OR REPLACE FUNCTION start_conversation(p_photographer_id UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  me UUID := auth.uid();
  owner UUID;
  conv UUID;
  nm TEXT;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Please sign in first.' USING ERRCODE = 'P0001'; END IF;
  SELECT user_id INTO owner FROM photographers WHERE id = p_photographer_id AND hidden IS NOT TRUE;
  IF owner IS NULL THEN RAISE EXCEPTION 'This creator is not available.' USING ERRCODE = 'P0001'; END IF;
  IF owner = me THEN RAISE EXCEPTION 'That''s your own listing.' USING ERRCODE = 'P0001'; END IF;
  SELECT id INTO conv FROM conversations WHERE photographer_id = p_photographer_id AND client_user_id = me;
  IF conv IS NOT NULL THEN RETURN conv; END IF;
  IF (SELECT count(*) FROM conversations WHERE client_user_id = me
      AND created_at > NOW() - INTERVAL '1 day') >= 20 THEN
    RAISE EXCEPTION 'You''ve started a lot of conversations today. Please try again tomorrow.' USING ERRCODE = 'P0001';
  END IF;
  SELECT left(coalesce(nullif(btrim(raw_user_meta_data->>'full_name'), ''), split_part(email, '@', 1), 'Traveller'), 80)
    INTO nm FROM auth.users WHERE id = me;
  INSERT INTO conversations (photographer_id, client_user_id, creator_user_id, client_name)
  VALUES (p_photographer_id, me, owner, coalesce(nm, 'Traveller'))
  ON CONFLICT (photographer_id, client_user_id) DO NOTHING
  RETURNING id INTO conv;
  IF conv IS NULL THEN
    SELECT id INTO conv FROM conversations WHERE photographer_id = p_photographer_id AND client_user_id = me;
  END IF;
  RETURN conv;
END $$;

-- Open the conversation that belongs to a booking (either side may call it)
CREATE OR REPLACE FUNCTION booking_conversation(p_booking_id UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  me UUID := auth.uid();
  b RECORD;
  conv UUID;
BEGIN
  SELECT photographer_id, client_user_id, creator_user_id, client_name INTO b FROM bookings WHERE id = p_booking_id;
  IF b IS NULL OR me IS NULL OR me NOT IN (b.client_user_id, b.creator_user_id)
     OR b.photographer_id IS NULL OR b.client_user_id IS NULL OR b.creator_user_id IS NULL THEN
    RAISE EXCEPTION 'This booking can''t be messaged.' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO conversations (photographer_id, client_user_id, creator_user_id, client_name)
  VALUES (b.photographer_id, b.client_user_id, b.creator_user_id, left(coalesce(nullif(btrim(b.client_name), ''), 'Traveller'), 80))
  ON CONFLICT (photographer_id, client_user_id) DO NOTHING
  RETURNING id INTO conv;
  IF conv IS NULL THEN
    SELECT id INTO conv FROM conversations WHERE photographer_id = b.photographer_id AND client_user_id = b.client_user_id;
  END IF;
  RETURN conv;
END $$;

CREATE OR REPLACE FUNCTION mark_conversation_read(p_conversation_id UUID)
RETURNS VOID LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE conversations SET
    client_read_at  = CASE WHEN client_user_id  = auth.uid() THEN NOW() ELSE client_read_at END,
    creator_read_at = CASE WHEN creator_user_id = auth.uid() THEN NOW() ELSE creator_read_at END
  WHERE id = p_conversation_id AND auth.uid() IN (client_user_id, creator_user_id);
$$;

-- Block / unblock. Only the person who blocked can unblock.
CREATE OR REPLACE FUNCTION set_conversation_blocked(p_conversation_id UUID, p_blocked BOOLEAN)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_blocked THEN
    UPDATE conversations SET blocked_by = auth.uid()
    WHERE id = p_conversation_id AND auth.uid() IN (client_user_id, creator_user_id) AND blocked_by IS NULL;
  ELSE
    UPDATE conversations SET blocked_by = NULL
    WHERE id = p_conversation_id AND blocked_by = auth.uid();
  END IF;
END $$;

CREATE OR REPLACE FUNCTION report_conversation(p_conversation_id UUID, p_reason TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM conversations WHERE id = p_conversation_id
                 AND auth.uid() IN (client_user_id, creator_user_id)) THEN
    RAISE EXCEPTION 'Conversation not found.' USING ERRCODE = 'P0001';
  END IF;
  IF (SELECT count(*) FROM message_reports WHERE reporter_id = auth.uid()
      AND created_at > NOW() - INTERVAL '1 day') >= 10 THEN
    RAISE EXCEPTION 'Thanks — we already have your reports and will review them.' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO message_reports (conversation_id, reporter_id, reason)
  VALUES (p_conversation_id, auth.uid(), left(btrim(coalesce(p_reason, '')), 500));
END $$;

REVOKE ALL ON FUNCTION start_conversation(UUID), booking_conversation(UUID), mark_conversation_read(UUID),
  set_conversation_blocked(UUID, BOOLEAN), report_conversation(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION start_conversation(UUID), booking_conversation(UUID), mark_conversation_read(UUID),
  set_conversation_blocked(UUID, BOOLEAN), report_conversation(UUID, TEXT) TO authenticated;
REVOKE ALL ON FUNCTION messages_rate_limit(), messages_after_insert() FROM PUBLIC, anon, authenticated;

-- When we last emailed each side about unread messages (one email per unread streak; set by the hourly job)
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS client_notified_at  TIMESTAMPTZ;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS creator_notified_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_conv_last_message ON conversations (last_message_at);

-- Live updates (new messages appear instantly). Skipped if Realtime isn't available.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'messages') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE messages;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'conversations') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
    END IF;
  END IF;
END $$;

-- ================================================================
-- Done. You should see "Success. No rows returned."
-- ================================================================

-- ################################################################
-- PART 7 — Portfolio gallery, booking link, availability & instant
-- booking, verified reviews, photo delivery, message translation
-- ################################################################

-- ── Portfolio gallery (up to 30 photos, https links into storage) ──
ALTER TABLE photographers ADD COLUMN IF NOT EXISTS gallery JSONB NOT NULL DEFAULT '[]';
CREATE OR REPLACE FUNCTION gallery_is_valid(g JSONB)
RETURNS BOOLEAN LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_typeof(g) = 'array'
     AND jsonb_array_length(g) <= 30
     AND NOT EXISTS (
       SELECT 1 FROM jsonb_array_elements(g) e
       WHERE jsonb_typeof(e) <> 'object'
          OR coalesce(e->>'url', '') !~ '^https://'
          OR char_length(e->>'url') > 500
          OR (e ? 'thumb' AND (coalesce(e->>'thumb', '') !~ '^https://' OR char_length(e->>'thumb') > 500))
     );
$$;
ALTER TABLE photographers DROP CONSTRAINT IF EXISTS gallery_check;
ALTER TABLE photographers ADD  CONSTRAINT gallery_check CHECK (gallery_is_valid(gallery));

-- ── Personal booking link: capturago.com/c/<handle> ──
ALTER TABLE photographers ADD COLUMN IF NOT EXISTS handle TEXT;
ALTER TABLE photographers DROP CONSTRAINT IF EXISTS handle_check;
ALTER TABLE photographers ADD  CONSTRAINT handle_check
  CHECK (handle IS NULL OR handle ~ '^[a-z0-9]([a-z0-9-]{1,28})[a-z0-9]$');
CREATE UNIQUE INDEX IF NOT EXISTS photographers_handle_unique ON photographers (lower(handle));

-- ── Availability & instant booking ──
ALTER TABLE photographers ADD COLUMN IF NOT EXISTS unavailable_dates DATE[]  NOT NULL DEFAULT '{}';
ALTER TABLE photographers ADD COLUMN IF NOT EXISTS max_per_day       INTEGER NOT NULL DEFAULT 1;
ALTER TABLE photographers ADD COLUMN IF NOT EXISTS instant_book      BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE photographers DROP CONSTRAINT IF EXISTS availability_check;
ALTER TABLE photographers ADD  CONSTRAINT availability_check
  CHECK (coalesce(cardinality(unavailable_dates), 0) <= 400 AND max_per_day BETWEEN 1 AND 6);

-- Days a creator can't take another in-person session: days off + days already fully booked.
-- Public on purpose (the booking calendar needs it); it never reveals who booked.
CREATE OR REPLACE FUNCTION creator_busy_dates(p_photographer_id UUID)
RETURNS SETOF DATE LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT d FROM (
    SELECT unnest(unavailable_dates) AS d FROM photographers WHERE id = p_photographer_id
    UNION
    SELECT b.shoot_date FROM bookings b JOIN photographers p ON p.id = b.photographer_id
    WHERE b.photographer_id = p_photographer_id
      AND b.booking_type = 'session'
      AND (b.status IN ('paid', 'confirmed') OR (b.status = 'pending_payment' AND b.created_at > NOW() - INTERVAL '30 minutes'))
    GROUP BY b.shoot_date, p.max_per_day
    HAVING count(*) >= p.max_per_day
  ) x
  WHERE d >= CURRENT_DATE AND d <= CURRENT_DATE + 400
  ORDER BY d;
$$;
REVOKE ALL ON FUNCTION creator_busy_dates(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION creator_busy_dates(UUID) TO anon, authenticated;

-- ── Bookings: time of day, booked via the creator's own link, photos sent ──
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS time_slot       TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS via_link        BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS photos_ready_at TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS completed_at    TIMESTAMPTZ;
-- When a booking is completed (start of the 90-day photo download window)
CREATE OR REPLACE FUNCTION bookings_set_completed_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN NEW.completed_at := NOW(); END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS bookings_set_completed_at ON bookings;
CREATE TRIGGER bookings_set_completed_at BEFORE UPDATE ON bookings FOR EACH ROW EXECUTE FUNCTION bookings_set_completed_at();
UPDATE bookings SET completed_at = updated_at WHERE status = 'completed' AND completed_at IS NULL;
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_time_slot_check;
ALTER TABLE bookings ADD  CONSTRAINT bookings_time_slot_check
  CHECK (time_slot IS NULL OR time_slot IN ('sunrise', 'morning', 'midday', 'afternoon', 'golden_hour', 'evening', 'flexible'));

-- ── Verified reviews: only after a COMPLETED booking with that creator ──
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS one_review_per_booking ON reviews (booking_id) WHERE booking_id IS NOT NULL;
-- Visitors may see WHICH reviews come from a real booking (the "Verified booking" label)
REVOKE SELECT ON reviews FROM anon, authenticated;
GRANT SELECT (id, photographer_id, user_id, reviewer_name, rating, comment, created_at, booking_id)
  ON reviews TO anon, authenticated;

CREATE OR REPLACE FUNCTION can_review_booking(p_booking_id UUID, p_photographer_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM bookings
                 WHERE id = p_booking_id AND photographer_id = p_photographer_id
                   AND client_user_id = auth.uid() AND status = 'completed');
$$;
REVOKE ALL ON FUNCTION can_review_booking(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION can_review_booking(UUID, UUID) TO authenticated;

DROP POLICY IF EXISTS "signed_in_insert_review" ON reviews;
DROP POLICY IF EXISTS "verified_booking_insert_review" ON reviews;
CREATE POLICY "verified_booking_insert_review" ON reviews FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id
              AND booking_id IS NOT NULL AND can_review_booking(booking_id, photographer_id));

-- Reviews: the name shown is always the booking's name (no impersonation)
CREATE OR REPLACE FUNCTION reviews_set_name()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.booking_id IS NOT NULL THEN
    SELECT left(coalesce(nullif(btrim(client_name), ''), NEW.reviewer_name), 80) INTO NEW.reviewer_name FROM bookings WHERE id = NEW.booking_id;
  END IF;
  NEW.comment := nullif(btrim(coalesce(NEW.comment, '')), '');
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS reviews_set_name ON reviews;
CREATE TRIGGER reviews_set_name BEFORE INSERT ON reviews FOR EACH ROW EXECUTE FUNCTION reviews_set_name();

-- ── Photo delivery: private storage, visible only to the two people of the booking ──
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('deliveries', 'deliveries', false, 15728640, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 15728640,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

CREATE TABLE IF NOT EXISTS booking_photos (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id  UUID        NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  path        TEXT        NOT NULL UNIQUE,
  width       INTEGER,
  height      INTEGER,
  favorite    BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT booking_photos_path_check CHECK (path ~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]{1,80}$' AND split_part(path, '/', 1) = booking_id::text),
  CONSTRAINT booking_photos_size_check CHECK ((width IS NULL OR width BETWEEN 1 AND 20000) AND (height IS NULL OR height BETWEEN 1 AND 20000))
);
CREATE INDEX IF NOT EXISTS idx_booking_photos_booking ON booking_photos (booking_id, created_at);

-- Who may do what with a booking's photos (SECURITY DEFINER so it works inside storage rules too)
CREATE OR REPLACE FUNCTION booking_role(p_booking_id UUID)
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN auth.uid() IS NULL THEN NULL
              WHEN creator_user_id = auth.uid() THEN 'creator'
              WHEN client_user_id  = auth.uid() THEN 'client' END
  FROM bookings WHERE id = p_booking_id;
$$;
CREATE OR REPLACE FUNCTION booking_status(p_booking_id UUID)
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT status FROM bookings WHERE id = p_booking_id;
$$;
-- The creator may remove photos while working, and for 30 days after the booking is completed (to fix mistakes)
CREATE OR REPLACE FUNCTION booking_photos_removable(p_booking_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(bool_or(status IN ('confirmed', 'delivered')
                          OR (status = 'completed' AND completed_at > now() - interval '30 days')), false)
  FROM bookings WHERE id = p_booking_id;
$$;
CREATE OR REPLACE FUNCTION uuid_or_null(t TEXT)
RETURNS UUID LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN RETURN t::uuid; EXCEPTION WHEN others THEN RETURN NULL; END $$;
REVOKE ALL ON FUNCTION booking_role(UUID), booking_status(UUID), booking_photos_removable(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION booking_role(UUID), booking_status(UUID), booking_photos_removable(UUID) TO authenticated;

ALTER TABLE booking_photos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON booking_photos FROM anon, authenticated;
GRANT SELECT, DELETE ON booking_photos TO authenticated;
GRANT INSERT (booking_id, path, width, height) ON booking_photos TO authenticated;
GRANT UPDATE (favorite) ON booking_photos TO authenticated;

DROP POLICY IF EXISTS "parties_read_photos" ON booking_photos;
CREATE POLICY "parties_read_photos" ON booking_photos FOR SELECT
  USING (booking_role(booking_id) IS NOT NULL);
DROP POLICY IF EXISTS "creator_add_photos" ON booking_photos;
CREATE POLICY "creator_add_photos" ON booking_photos FOR INSERT
  WITH CHECK (booking_role(booking_id) = 'creator' AND booking_status(booking_id) IN ('confirmed', 'delivered', 'completed'));
DROP POLICY IF EXISTS "creator_remove_photos" ON booking_photos;
CREATE POLICY "creator_remove_photos" ON booking_photos FOR DELETE
  USING (booking_role(booking_id) = 'creator' AND booking_photos_removable(booking_id));
DROP POLICY IF EXISTS "client_favourite_photos" ON booking_photos;
CREATE POLICY "client_favourite_photos" ON booking_photos FOR UPDATE
  USING (booking_role(booking_id) = 'client') WITH CHECK (booking_role(booking_id) = 'client');

-- Max 300 photos per booking
CREATE OR REPLACE FUNCTION booking_photos_limit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (SELECT count(*) FROM booking_photos WHERE booking_id = NEW.booking_id) >= 300 THEN
    RAISE EXCEPTION 'A booking can have up to 300 photos.' USING ERRCODE = 'P0001';
  END IF;
  NEW.favorite := FALSE;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS booking_photos_limit ON booking_photos;
CREATE TRIGGER booking_photos_limit BEFORE INSERT ON booking_photos FOR EACH ROW EXECUTE FUNCTION booking_photos_limit();
REVOKE ALL ON FUNCTION booking_photos_limit(), reviews_set_name() FROM PUBLIC, anon, authenticated;

-- Storage rules for the private 'deliveries' bucket: files live in <booking id>/<file>
DROP POLICY IF EXISTS "deliveries_read" ON storage.objects;
CREATE POLICY "deliveries_read" ON storage.objects FOR SELECT
  USING (bucket_id = 'deliveries' AND booking_role(uuid_or_null((storage.foldername(name))[1])) IS NOT NULL);
DROP POLICY IF EXISTS "deliveries_upload" ON storage.objects;
CREATE POLICY "deliveries_upload" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'deliveries'
              AND booking_role(uuid_or_null((storage.foldername(name))[1])) = 'creator'
              AND booking_status(uuid_or_null((storage.foldername(name))[1])) IN ('confirmed', 'delivered', 'completed'));
DROP POLICY IF EXISTS "deliveries_delete" ON storage.objects;
CREATE POLICY "deliveries_delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'deliveries'
         AND booking_role(uuid_or_null((storage.foldername(name))[1])) = 'creator'
         AND booking_photos_removable(uuid_or_null((storage.foldername(name))[1])));

-- ── Message translations (cached; written only by the server) ──
CREATE TABLE IF NOT EXISTS message_translations (
  message_id    UUID        NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  lang          TEXT        NOT NULL CHECK (lang ~ '^[a-z]{2}$'),
  body          TEXT        NOT NULL CHECK (char_length(body) <= 4000),
  requested_by  UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (message_id, lang)
);
CREATE INDEX IF NOT EXISTS idx_translations_user ON message_translations (requested_by, created_at);
ALTER TABLE message_translations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON message_translations FROM anon, authenticated;

-- ── FINAL permissions for listings (authoritative; replaces the lists in Part 4) ──
REVOKE SELECT, INSERT, UPDATE ON photographers FROM anon, authenticated;
GRANT SELECT (id, user_id, name, city, coords, languages, type, services,
              vibes, specialties, level, description, tags, local_spots,
              portfolio_url, cover_image_url, price, available,
              travel_available, rating, reviews_count, views_count,
              verified, featured, created_at, updated_at,
              packages, payouts_enabled, boosted_until, occasions, drone_certified,
              drone_region, gallery, handle, unavailable_dates, max_per_day, instant_book)
  ON photographers TO anon, authenticated;
GRANT INSERT (user_id, name, city, coords, email, languages, type, services,
              vibes, specialties, level, description, tags, local_spots,
              portfolio_url, cover_image_url, price, available,
              travel_available, packages, occasions, drone_certified,
              drone_region, drone_info, gallery, handle, unavailable_dates, max_per_day, instant_book)
  ON photographers TO authenticated;
GRANT UPDATE (name, city, coords, email, languages, type, services,
              vibes, specialties, level, description, tags, local_spots,
              portfolio_url, cover_image_url, price, available,
              travel_available, packages, occasions, drone_certified,
              drone_region, drone_info, gallery, handle, unavailable_dates, max_per_day, instant_book)
  ON photographers TO authenticated;

REVOKE ALL ON bookings FROM anon, authenticated;
GRANT SELECT (id, photographer_id, creator_user_id, client_user_id, client_name,
              client_email, package_id, package_name, package_minutes, shoot_date,
              note, currency, price_cents, client_fee_cents, creator_fee_cents,
              total_cents, status, created_at, updated_at,
              booking_type, client_files_url, delivery_url, delivered_at,
              revisions_allowed, revisions_used, last_revision_note,
              time_slot, via_link, photos_ready_at, completed_at)
  ON bookings TO authenticated;

-- ================================================================
-- Done. You should see "Success. No rows returned."
-- ================================================================

-- ################################################################
-- PART 8 — Trust & planning: report a listing, search insights,
-- "notify me" for empty cities, trip planner, reschedule, shoot plan
-- (shot list, meeting point, surprise), review photos, gallery
-- share links. Safe to re-run.
-- ################################################################

-- City key used everywhere for matching ("Lisbon, Portugal" → "lisbon")
CREATE OR REPLACE FUNCTION city_key(t TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT nullif(regexp_replace(lower(btrim(split_part(coalesce(t, ''), ',', 1))), '\s+', ' ', 'g'), '');
$$;

-- A listing's services (old listings only have "type")
CREATE OR REPLACE FUNCTION listing_services(p_services TEXT[], p_type TEXT)
RETURNS TEXT[] LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN coalesce(cardinality(p_services), 0) > 0 THEN p_services WHEN p_type IS NOT NULL THEN ARRAY[p_type] ELSE '{}'::TEXT[] END;
$$;

-- ── 1. Report a listing or one of its photos (App Store / Google Play require this) ──
CREATE TABLE IF NOT EXISTS listing_reports (
  id               UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  photographer_id  UUID        NOT NULL REFERENCES photographers(id) ON DELETE CASCADE,
  reporter_id      UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  reason           TEXT        NOT NULL CHECK (reason IN ('fake', 'stolen_photos', 'inappropriate', 'scam', 'other')),
  details          TEXT        CHECK (char_length(coalesce(details, '')) <= 1000),
  photo_url        TEXT        CHECK (photo_url IS NULL OR (photo_url ~ '^https://' AND char_length(photo_url) <= 500)),
  status           TEXT        NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_listing_reports_status ON listing_reports (status, created_at DESC);
ALTER TABLE listing_reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON listing_reports FROM anon, authenticated;

CREATE OR REPLACE FUNCTION report_listing(p_photographer_id UUID, p_reason TEXT, p_details TEXT DEFAULT NULL, p_photo_url TEXT DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me UUID := auth.uid(); owner UUID;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Please sign in to report a profile.' USING ERRCODE = 'P0001'; END IF;
  SELECT user_id INTO owner FROM photographers WHERE id = p_photographer_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'This profile no longer exists.' USING ERRCODE = 'P0001'; END IF;
  IF owner = me THEN RAISE EXCEPTION 'You can''t report your own profile.' USING ERRCODE = 'P0001'; END IF;
  IF p_reason IS NULL OR p_reason NOT IN ('fake', 'stolen_photos', 'inappropriate', 'scam', 'other') THEN
    RAISE EXCEPTION 'Please choose a reason.' USING ERRCODE = 'P0001';
  END IF;
  IF p_photo_url IS NOT NULL AND (p_photo_url !~ '^https://' OR char_length(p_photo_url) > 500) THEN
    RAISE EXCEPTION 'Invalid photo.' USING ERRCODE = 'P0001';
  END IF;
  IF (SELECT count(*) FROM listing_reports WHERE reporter_id = me AND created_at > NOW() - INTERVAL '1 day') >= 10 THEN
    RAISE EXCEPTION 'Thanks — we already have your reports and will review them.' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (SELECT 1 FROM listing_reports WHERE reporter_id = me AND photographer_id = p_photographer_id
             AND status = 'open' AND coalesce(photo_url, '') = coalesce(p_photo_url, '')) THEN
    RETURN; -- already reported and still open: nothing to add
  END IF;
  INSERT INTO listing_reports (photographer_id, reporter_id, reason, details, photo_url)
  VALUES (p_photographer_id, me, p_reason, nullif(left(btrim(coalesce(p_details, '')), 1000), ''), p_photo_url);
END $$;
REVOKE ALL ON FUNCTION report_listing(UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION report_listing(UUID, TEXT, TEXT, TEXT) TO authenticated;

-- ── 2. Anonymous search insights (no names, no emails, no IP addresses) ──
CREATE TABLE IF NOT EXISTS search_events (
  id          BIGSERIAL   PRIMARY KEY,
  kind        TEXT        NOT NULL CHECK (kind IN ('search', 'profile_view', 'book_start', 'trip_search')),
  city        TEXT        CHECK (char_length(coalesce(city, '')) <= 80),
  service     TEXT        CHECK (char_length(coalesce(service, '')) <= 40),
  results     INTEGER     CHECK (results IS NULL OR results BETWEEN 0 AND 100000),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_search_events_time ON search_events (created_at);
ALTER TABLE search_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON search_events FROM anon, authenticated;
DO $$ BEGIN REVOKE ALL ON SEQUENCE search_events_id_seq FROM anon, authenticated; EXCEPTION WHEN undefined_table THEN NULL; END $$;

CREATE OR REPLACE FUNCTION log_search_event(p_kind TEXT, p_city TEXT DEFAULT NULL, p_service TEXT DEFAULT NULL, p_results INTEGER DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_kind IS NULL OR p_kind NOT IN ('search', 'profile_view', 'book_start', 'trip_search') THEN RETURN; END IF;
  -- flood protection: at most 600 events a minute in total
  IF (SELECT count(*) FROM search_events WHERE created_at > NOW() - INTERVAL '1 minute') >= 600 THEN RETURN; END IF;
  INSERT INTO search_events (kind, city, service, results)
  VALUES (p_kind, left(city_key(p_city), 80),
          CASE WHEN p_service ~ '^[a-z_]{2,40}$' THEN p_service END,
          CASE WHEN p_results BETWEEN 0 AND 100000 THEN p_results END);
END $$;
REVOKE ALL ON FUNCTION log_search_event(TEXT, TEXT, TEXT, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION log_search_event(TEXT, TEXT, TEXT, INTEGER) TO anon, authenticated;

-- ── 3. "Notify me when a creator joins <city>" (signed-in users; one email, then done) ──
CREATE TABLE IF NOT EXISTS city_alerts (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  city_key     TEXT        NOT NULL CHECK (char_length(city_key) BETWEEN 2 AND 80),
  city_label   TEXT        NOT NULL CHECK (char_length(city_label) BETWEEN 2 AND 80),
  service      TEXT        CHECK (service IS NULL OR service ~ '^[a-z_]{2,40}$'),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notified_at  TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS city_alerts_one_per_city ON city_alerts (user_id, city_key, coalesce(service, ''));
CREATE INDEX IF NOT EXISTS idx_city_alerts_pending ON city_alerts (created_at) WHERE notified_at IS NULL;
ALTER TABLE city_alerts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON city_alerts FROM anon, authenticated;
GRANT SELECT (id, city_label, service, created_at, notified_at), DELETE ON city_alerts TO authenticated;
DROP POLICY IF EXISTS "own_city_alerts_read" ON city_alerts;
CREATE POLICY "own_city_alerts_read" ON city_alerts FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "own_city_alerts_delete" ON city_alerts;
CREATE POLICY "own_city_alerts_delete" ON city_alerts FOR DELETE USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION create_city_alert(p_city TEXT, p_service TEXT DEFAULT NULL)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me UUID := auth.uid(); k TEXT := city_key(p_city); lbl TEXT := left(btrim(regexp_replace(coalesce(p_city, ''), '\s+', ' ', 'g')), 80);
        svc TEXT := CASE WHEN p_service ~ '^[a-z_]{2,40}$' THEN p_service END; aid UUID;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Please sign in to get notified.' USING ERRCODE = 'P0001'; END IF;
  IF k IS NULL OR char_length(k) < 2 OR char_length(lbl) < 2 THEN RAISE EXCEPTION 'Please enter a city.' USING ERRCODE = 'P0001'; END IF;
  IF (SELECT count(*) FROM city_alerts WHERE user_id = me AND notified_at IS NULL) >= 20 THEN
    RAISE EXCEPTION 'You already follow 20 cities. Remove one in your dashboard first.' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO city_alerts (user_id, city_key, city_label, service) VALUES (me, left(k, 80), lbl, svc)
  ON CONFLICT (user_id, city_key, coalesce(service, '')) DO UPDATE SET notified_at = NULL, created_at = NOW(), city_label = EXCLUDED.city_label
  RETURNING id INTO aid;
  RETURN aid;
END $$;
REVOKE ALL ON FUNCTION create_city_alert(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION create_city_alert(TEXT, TEXT) TO authenticated;

-- For the hourly job: alerts that now have a matching creator (server only)
CREATE OR REPLACE FUNCTION due_city_alerts(p_limit INTEGER DEFAULT 100)
RETURNS TABLE (alert_id UUID, user_id UUID, city_label TEXT, service TEXT, photographer_id UUID, photographer_name TEXT, photographer_handle TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT ON (a.id) a.id, a.user_id, a.city_label, a.service, p.id, p.name, p.handle
  FROM city_alerts a
  JOIN photographers p ON city_key(p.city) = a.city_key
   AND p.hidden IS NOT TRUE AND p.created_at > a.created_at AND p.user_id <> a.user_id
   AND (a.service IS NULL OR a.service = ANY(listing_services(p.services, p.type)))
  WHERE a.notified_at IS NULL
  ORDER BY a.id, p.created_at
  LIMIT greatest(1, least(coalesce(p_limit, 100), 500));
$$;
REVOKE ALL ON FUNCTION due_city_alerts(INTEGER) FROM PUBLIC, anon, authenticated;

-- ── 4. Trip planner: creators in a city who are free on at least one day of a date range ──
CREATE OR REPLACE FUNCTION available_creators(p_city TEXT, p_from DATE, p_to DATE)
RETURNS TABLE (photographer_id UUID, free_days INTEGER, first_free DATE)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE f DATE := greatest(coalesce(p_from, CURRENT_DATE + 1), CURRENT_DATE + 1); t DATE := coalesce(p_to, p_from);  -- bookings start tomorrow
        needle TEXT := nullif(replace(replace(lower(btrim(coalesce(p_city, ''))), '%', ''), '_', ''), '');
BEGIN
  IF t IS NULL OR t < f THEN RAISE EXCEPTION 'Choose dates from tomorrow on.' USING ERRCODE = 'P0001'; END IF;
  IF t - f > 30 THEN RAISE EXCEPTION 'Choose up to 31 days at a time.' USING ERRCODE = 'P0001'; END IF;
  IF t > CURRENT_DATE + 365 THEN RAISE EXCEPTION 'Choose dates within the next 12 months.' USING ERRCODE = 'P0001'; END IF;
  RETURN QUERY
  WITH cand AS (
    SELECT p.id, p.unavailable_dates, p.max_per_day FROM photographers p
    WHERE p.hidden IS NOT TRUE AND p.available IS NOT FALSE
      AND listing_services(p.services, p.type) && ARRAY['photo', 'video', 'phone', 'event', 'drone', 'guide']
      AND (needle IS NULL OR city_key(p.city) = city_key(needle) OR lower(p.city) LIKE '%' || needle || '%')
  ), booked AS (
    SELECT b.photographer_id AS pid, b.shoot_date AS d, count(*) AS n FROM bookings b
    WHERE b.photographer_id IN (SELECT id FROM cand) AND b.booking_type = 'session' AND b.shoot_date BETWEEN f AND t
      AND (b.status IN ('paid', 'confirmed') OR (b.status = 'pending_payment' AND b.created_at > NOW() - INTERVAL '30 minutes'))
    GROUP BY 1, 2
  )
  SELECT c.id, count(*)::INTEGER, min(dd.d)::DATE
  FROM cand c
  CROSS JOIN (SELECT generate_series(f, t, INTERVAL '1 day')::DATE AS d) dd
  LEFT JOIN booked k ON k.pid = c.id AND k.d = dd.d
  WHERE NOT (dd.d = ANY(coalesce(c.unavailable_dates, '{}'))) AND coalesce(k.n, 0) < c.max_per_day
  GROUP BY c.id
  LIMIT 500;
END $$;
REVOKE ALL ON FUNCTION available_creators(TEXT, DATE, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION available_creators(TEXT, DATE, DATE) TO anon, authenticated;

-- ── 5. Bookings: reschedule proposals, no-show reports, shoot plan, surprise mode ──
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS proposed_date    DATE;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS proposed_slot    TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS proposed_by      UUID;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS proposed_reason  TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS proposed_at      TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS reschedules      INTEGER NOT NULL DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS dispute_reason   TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS dispute_note     TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS shot_list        TEXT[]  NOT NULL DEFAULT '{}';
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS ref_links        TEXT[]  NOT NULL DEFAULT '{}';
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS meeting_point    TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS meeting_time     TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS surprise         BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_plan_check;
ALTER TABLE bookings ADD  CONSTRAINT bookings_plan_check CHECK (
      (proposed_slot IS NULL OR proposed_slot IN ('sunrise', 'morning', 'midday', 'afternoon', 'golden_hour', 'evening', 'flexible'))
  AND (proposed_reason IS NULL OR proposed_reason IN ('weather', 'other'))
  AND reschedules BETWEEN 0 AND 10
  AND (dispute_reason IS NULL OR dispute_reason IN ('no_show', 'quality', 'photos_late', 'other'))
  AND char_length(coalesce(dispute_note, '')) <= 1000
  AND coalesce(cardinality(shot_list), 0) <= 20
  AND coalesce(cardinality(ref_links), 0) <= 6
  AND char_length(coalesce(meeting_point, '')) <= 300
  AND (meeting_time IS NULL OR meeting_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'));
GRANT SELECT (proposed_date, proposed_slot, proposed_by, proposed_reason, proposed_at, reschedules,
              dispute_reason, dispute_note, shot_list, ref_links, meeting_point, meeting_time, surprise)
  ON bookings TO authenticated;

-- ── 6. Reviews with up to 3 photos (picked by the traveller from their gallery) ──
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS photos JSONB NOT NULL DEFAULT '[]';
CREATE OR REPLACE FUNCTION review_photos_valid(g JSONB)
RETURNS BOOLEAN LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_typeof(g) = 'array' AND jsonb_array_length(g) <= 3
     AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(g) e
                     WHERE jsonb_typeof(e) <> 'string' OR (e #>> '{}') !~ '^https://' OR char_length(e #>> '{}') > 500);
$$;
ALTER TABLE reviews DROP CONSTRAINT IF EXISTS review_photos_check;
ALTER TABLE reviews ADD  CONSTRAINT review_photos_check CHECK (review_photos_valid(photos));
GRANT SELECT (photos) ON reviews TO anon, authenticated;

-- ── 7. Share a delivered gallery with friends: view-only link that expires ──
CREATE OR REPLACE FUNCTION client_sees_photos(p_booking_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(bool_or(CASE WHEN booking_type = 'delivery'
                                THEN status IN ('delivered', 'completed') OR revisions_used > 0
                                ELSE photos_ready_at IS NOT NULL OR status = 'completed' END), false)
  FROM bookings WHERE id = p_booking_id;
$$;
REVOKE ALL ON FUNCTION client_sees_photos(UUID) FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS gallery_shares (
  token       TEXT        PRIMARY KEY CHECK (token ~ '^[0-9a-f]{64}$'),
  booking_id  UUID        NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  created_by  UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at  TIMESTAMPTZ NOT NULL,
  favorites_only BOOLEAN  NOT NULL DEFAULT FALSE,
  views       INTEGER     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_gallery_shares_booking ON gallery_shares (booking_id);
ALTER TABLE gallery_shares ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON gallery_shares FROM anon, authenticated;
GRANT SELECT (token, booking_id, expires_at, favorites_only, views, created_at), DELETE ON gallery_shares TO authenticated;
DROP POLICY IF EXISTS "own_shares_read" ON gallery_shares;
CREATE POLICY "own_shares_read" ON gallery_shares FOR SELECT USING (created_by = auth.uid());
DROP POLICY IF EXISTS "own_shares_delete" ON gallery_shares;
CREATE POLICY "own_shares_delete" ON gallery_shares FOR DELETE USING (created_by = auth.uid());

DROP FUNCTION IF EXISTS create_gallery_share(UUID, INTEGER);
CREATE OR REPLACE FUNCTION create_gallery_share(p_booking_id UUID, p_days INTEGER DEFAULT 7, p_favorites_only BOOLEAN DEFAULT FALSE)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me UUID := auth.uid(); tok TEXT;
BEGIN
  IF me IS NULL OR NOT EXISTS (SELECT 1 FROM bookings WHERE id = p_booking_id AND client_user_id = me) THEN
    RAISE EXCEPTION 'Only the traveller of this booking can share the gallery.' USING ERRCODE = 'P0001';
  END IF;
  IF NOT client_sees_photos(p_booking_id) OR NOT EXISTS (SELECT 1 FROM booking_photos WHERE booking_id = p_booking_id) THEN
    RAISE EXCEPTION 'There are no photos to share yet.' USING ERRCODE = 'P0001';
  END IF;
  IF coalesce(p_favorites_only, false) AND NOT EXISTS (SELECT 1 FROM booking_photos WHERE booking_id = p_booking_id AND favorite) THEN
    RAISE EXCEPTION 'Mark some favourites first (tap ♡ on a photo).' USING ERRCODE = 'P0001';
  END IF;
  IF (SELECT count(*) FROM gallery_shares WHERE booking_id = p_booking_id AND expires_at > NOW()) >= 5 THEN
    RAISE EXCEPTION 'You already have 5 active share links. Turn one off first.' USING ERRCODE = 'P0001';
  END IF;
  tok := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  INSERT INTO gallery_shares (token, booking_id, created_by, expires_at, favorites_only)
  VALUES (tok, p_booking_id, me, NOW() + make_interval(days => greatest(1, least(coalesce(p_days, 7), 30))), coalesce(p_favorites_only, false));
  RETURN tok;
END $$;
REVOKE ALL ON FUNCTION create_gallery_share(UUID, INTEGER, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION create_gallery_share(UUID, INTEGER, BOOLEAN) TO authenticated;

-- ── 8. Admin insights (server only — the admin panel reads it through the admin function) ──
CREATE OR REPLACE FUNCTION admin_insights(p_days INTEGER DEFAULT 30)
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH w AS (SELECT NOW() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 365))) AS since),
  ev AS (SELECT e.* FROM search_events e, w WHERE e.created_at >= w.since),
  creators AS (SELECT city_key(city) AS k, count(*) AS n FROM photographers WHERE hidden IS NOT TRUE GROUP BY 1),
  searches AS (SELECT city AS k, count(*) AS n, count(*) FILTER (WHERE results = 0) AS zero
               FROM ev WHERE kind IN ('search', 'trip_search') AND city IS NOT NULL GROUP BY 1),
  alerts AS (SELECT city_key AS k, count(*) AS n FROM city_alerts WHERE notified_at IS NULL GROUP BY 1)
  SELECT jsonb_build_object(
    'days', greatest(1, least(coalesce(p_days, 30), 365)),
    'funnel', jsonb_build_object(
      'searches',      (SELECT count(*) FROM ev WHERE kind IN ('search', 'trip_search')),
      'zero_results',  (SELECT count(*) FROM ev WHERE kind IN ('search', 'trip_search') AND results = 0),
      'profile_views', (SELECT count(*) FROM ev WHERE kind = 'profile_view'),
      'book_starts',   (SELECT count(*) FROM ev WHERE kind = 'book_start'),
      'conversations', (SELECT count(*) FROM conversations, w WHERE conversations.created_at >= w.since),
      'paid_bookings', (SELECT count(*) FROM bookings, w WHERE bookings.paid_at >= w.since),
      'completed',     (SELECT count(*) FROM bookings, w WHERE bookings.completed_at >= w.since)),
    'unmet', coalesce((SELECT jsonb_agg(x ORDER BY x.n DESC) FROM (
        SELECT city, service, count(*) AS n FROM ev
        WHERE kind IN ('search', 'trip_search') AND results = 0 AND city IS NOT NULL
        GROUP BY city, service ORDER BY count(*) DESC LIMIT 15) x), '[]'::jsonb),
    'cities', coalesce((SELECT jsonb_agg(x ORDER BY x.searches DESC, x.creators DESC) FROM (
        SELECT coalesce(s.k, c.k) AS city, coalesce(s.n, 0) AS searches, coalesce(s.zero, 0) AS zero,
               coalesce(c.n, 0) AS creators, coalesce(a.n, 0) AS waiting
        FROM searches s FULL JOIN creators c ON c.k = s.k LEFT JOIN alerts a ON a.k = coalesce(s.k, c.k)
        WHERE coalesce(s.k, c.k) IS NOT NULL
        ORDER BY coalesce(s.n, 0) DESC, coalesce(c.n, 0) DESC LIMIT 25) x), '[]'::jsonb),
    'open_listing_reports', (SELECT count(*) FROM listing_reports WHERE status = 'open'),
    'waiting_alerts', (SELECT count(*) FROM city_alerts WHERE notified_at IS NULL));
$$;
REVOKE ALL ON FUNCTION admin_insights(INTEGER) FROM PUBLIC, anon, authenticated;

-- ================================================================
-- Done. You should see "Success. No rows returned."
-- ================================================================

-- ################################################################
-- PART 9 — Founding creators per city, live city pages, share-link
-- insights. Safe to re-run.
-- ################################################################

-- ── 1. Cities where we recruit "founding creators" (set by the admin only) ──
CREATE TABLE IF NOT EXISTS founding_cities (
  city_key    TEXT        PRIMARY KEY CHECK (city_key ~ '^[^,]{2,60}$' AND city_key = lower(city_key)),
  city_label  TEXT        NOT NULL CHECK (char_length(city_label) BETWEEN 2 AND 60),
  slots       INTEGER     NOT NULL DEFAULT 10 CHECK (slots BETWEEN 1 AND 100),
  perk_days   INTEGER     NOT NULL DEFAULT 90 CHECK (perk_days BETWEEN 0 AND 365),
  active      BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE founding_cities ADD COLUMN IF NOT EXISTS invited_at TIMESTAMPTZ;   -- last "Email creators in this city"
ALTER TABLE founding_cities ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON founding_cities FROM anon, authenticated;

-- One founding spot per person, ever (deleting and re-creating a listing never gives a second free boost)
CREATE TABLE IF NOT EXISTS founding_claims (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID        NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  photographer_id UUID        REFERENCES photographers(id) ON DELETE SET NULL,
  city_key        TEXT        NOT NULL REFERENCES founding_cities(city_key) ON UPDATE CASCADE,
  boost_until     TIMESTAMPTZ,
  claimed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at      TIMESTAMPTZ,
  revoked_reason  TEXT        CHECK (char_length(coalesce(revoked_reason, '')) <= 300)
);
CREATE INDEX IF NOT EXISTS idx_founding_claims_city ON founding_claims (city_key) WHERE revoked_at IS NULL;
ALTER TABLE founding_claims ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON founding_claims FROM anon, authenticated;

-- Shown as a badge. Only the server writes these (they are not in the INSERT / UPDATE grants).
ALTER TABLE photographers ADD COLUMN IF NOT EXISTS founding_city TEXT;
ALTER TABLE photographers ADD COLUMN IF NOT EXISTS founding_at   TIMESTAMPTZ;
GRANT SELECT (founding_city, founding_at) ON photographers TO anon, authenticated;

-- Spots taken in a city = active claims whose listing still exists
CREATE OR REPLACE FUNCTION founding_taken(p_key TEXT)
RETURNS INTEGER LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*)::int FROM founding_claims WHERE city_key = p_key AND revoked_at IS NULL AND photographer_id IS NOT NULL;
$$;
REVOKE ALL ON FUNCTION founding_taken(TEXT) FROM PUBLIC, anon, authenticated;

-- What a listing still needs before it can take a founding spot (same list in the website and the app)
CREATE OR REPLACE FUNCTION founding_missing(p photographers)
RETURNS TEXT[] LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT array_remove(ARRAY[
    CASE WHEN coalesce(btrim(p.cover_image_url), '') = '' THEN 'cover' END,
    CASE WHEN CASE WHEN jsonb_typeof(p.gallery) = 'array' THEN jsonb_array_length(p.gallery) ELSE 0 END < 3 THEN 'photos' END,
    CASE WHEN CASE WHEN jsonb_typeof(p.packages) = 'array' THEN jsonb_array_length(p.packages) ELSE 0 END < 1 THEN 'package' END,
    CASE WHEN char_length(btrim(coalesce(p.description, ''))) < 80 THEN 'description' END,
    CASE WHEN p.hidden IS TRUE THEN 'hidden' END
  ], NULL);
$$;
REVOKE ALL ON FUNCTION founding_missing(photographers) FROM PUBLIC, anon, authenticated;

-- Open cities for everyone (homepage, city pages, the app)
CREATE OR REPLACE FUNCTION founding_cities_public()
RETURNS TABLE (city_key TEXT, city_label TEXT, slots INTEGER, spots_left INTEGER, perk_days INTEGER)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT f.city_key, f.city_label, f.slots, greatest(f.slots - founding_taken(f.city_key), 0), f.perk_days
  FROM founding_cities f WHERE f.active
  ORDER BY greatest(f.slots - founding_taken(f.city_key), 0) DESC, f.city_label
  LIMIT 50;
$$;
REVOKE ALL ON FUNCTION founding_cities_public() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION founding_cities_public() TO anon, authenticated;

-- The signed-in creator's situation: is their city open, how many spots are left, what's missing, already a founder?
CREATE OR REPLACE FUNCTION founding_status()
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  me UUID := auth.uid();
  p photographers;
  c founding_claims;
  f founding_cities;
  k TEXT;
  taken INTEGER := 0;
BEGIN
  IF me IS NULL THEN RETURN jsonb_build_object('listing', false); END IF;
  SELECT * INTO p FROM photographers WHERE user_id = me;
  IF NOT FOUND THEN RETURN jsonb_build_object('listing', false); END IF;
  SELECT * INTO c FROM founding_claims WHERE user_id = me;
  k := city_key(p.city);
  SELECT * INTO f FROM founding_cities WHERE city_key = k AND active;
  IF f.city_key IS NOT NULL THEN taken := founding_taken(k); END IF;
  RETURN jsonb_build_object(
    'listing', true,
    'claimed', c.id IS NOT NULL AND c.revoked_at IS NULL,
    'revoked', c.revoked_at IS NOT NULL,
    'used',    c.id IS NOT NULL,
    'founding_city', p.founding_city,
    'boost_until', c.boost_until,
    'open',    f.city_key IS NOT NULL,
    'city',    coalesce(f.city_label, initcap(k)),
    'slots',   coalesce(f.slots, 0),
    'spots_left', CASE WHEN f.city_key IS NULL THEN 0 ELSE greatest(f.slots - taken, 0) END,
    'perk_days', coalesce(f.perk_days, 0),
    'missing', to_jsonb(founding_missing(p)));
END $$;
REVOKE ALL ON FUNCTION founding_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION founding_status() TO authenticated;

-- Take a founding spot. All rules are checked here, under a per-city lock (no over-booking of spots).
CREATE OR REPLACE FUNCTION claim_founding_spot()
RETURNS JSONB LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  me UUID := auth.uid();
  p photographers;
  c founding_claims;
  f founding_cities;
  k TEXT;
  miss TEXT[];
  until TIMESTAMPTZ;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Please sign in.' USING ERRCODE = '42501'; END IF;
  SELECT * INTO p FROM photographers WHERE user_id = me FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Create your listing first.' USING ERRCODE = 'P0001'; END IF;
  SELECT * INTO c FROM founding_claims WHERE user_id = me;
  IF c.id IS NOT NULL THEN
    IF c.revoked_at IS NOT NULL THEN RAISE EXCEPTION 'Your founding spot was removed. Please contact hello@capturago.com.' USING ERRCODE = 'P0001'; END IF;
    IF c.photographer_id IS NULL THEN RAISE EXCEPTION 'You already used your founding spot with an earlier listing.' USING ERRCODE = 'P0001'; END IF;
    RETURN founding_status();   -- already a founder: nothing changes
  END IF;
  k := city_key(p.city);
  IF k IS NULL THEN RAISE EXCEPTION 'Add your city to your listing first.' USING ERRCODE = 'P0001'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('founding:' || k));
  SELECT * INTO f FROM founding_cities WHERE city_key = k AND active;
  IF NOT FOUND THEN RAISE EXCEPTION 'There are no founding spots in your city right now.' USING ERRCODE = 'P0001'; END IF;
  miss := founding_missing(p);
  IF cardinality(miss) > 0 THEN
    RAISE EXCEPTION 'Finish your listing first: %.', array_to_string(ARRAY(SELECT CASE m
      WHEN 'cover' THEN 'a cover photo' WHEN 'photos' THEN 'at least 3 portfolio photos' WHEN 'package' THEN 'a package with a price'
      WHEN 'description' THEN 'a description of at least 80 characters' ELSE 'a listing that is visible' END FROM unnest(miss) m), ', ')
      USING ERRCODE = 'P0001';
  END IF;
  IF founding_taken(k) >= f.slots THEN RAISE EXCEPTION 'All founding spots in % are taken.', f.city_label USING ERRCODE = 'P0001'; END IF;
  until := CASE WHEN f.perk_days > 0 THEN greatest(coalesce(p.boosted_until, NOW()), NOW()) + make_interval(days => f.perk_days) END;
  INSERT INTO founding_claims (user_id, photographer_id, city_key, boost_until) VALUES (me, p.id, k, until);
  UPDATE photographers SET founding_city = f.city_label, founding_at = NOW(),
         boosted_until = coalesce(until, boosted_until)
   WHERE id = p.id;
  RETURN founding_status();
END $$;
REVOKE ALL ON FUNCTION claim_founding_spot() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION claim_founding_spot() TO authenticated;

-- Admin (server only, through the admin function): open / change a city, see founders, remove a spot
CREATE OR REPLACE FUNCTION admin_founding_save(p_city TEXT, p_slots INTEGER, p_perk_days INTEGER, p_active BOOLEAN)
RETURNS founding_cities LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE k TEXT := city_key(p_city); lbl TEXT := left(regexp_replace(btrim(split_part(coalesce(p_city, ''), ',', 1)), '\s+', ' ', 'g'), 60); r founding_cities;
BEGIN
  IF k IS NULL OR char_length(k) < 2 OR char_length(k) > 60 THEN RAISE EXCEPTION 'Enter a city name.' USING ERRCODE = 'P0001'; END IF;
  INSERT INTO founding_cities (city_key, city_label, slots, perk_days, active)
  VALUES (k, lbl, greatest(1, least(coalesce(p_slots, 10), 100)), greatest(0, least(coalesce(p_perk_days, 90), 365)), coalesce(p_active, true))
  ON CONFLICT (city_key) DO UPDATE SET city_label = EXCLUDED.city_label, slots = EXCLUDED.slots, perk_days = EXCLUDED.perk_days,
    active = EXCLUDED.active, updated_at = NOW()
  RETURNING * INTO r;
  RETURN r;
END $$;
REVOKE ALL ON FUNCTION admin_founding_save(TEXT, INTEGER, INTEGER, BOOLEAN) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION admin_founding_overview()
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'cities', coalesce((SELECT jsonb_agg(jsonb_build_object('city_key', f.city_key, 'city_label', f.city_label, 'slots', f.slots,
        'perk_days', f.perk_days, 'active', f.active, 'taken', founding_taken(f.city_key), 'invited_at', f.invited_at,
        'listed', (SELECT count(*) FROM photographers p WHERE city_key(p.city) = f.city_key AND p.hidden IS NOT TRUE)) ORDER BY f.active DESC, f.city_label)
      FROM founding_cities f), '[]'::jsonb),
    'claims', coalesce((SELECT jsonb_agg(jsonb_build_object('id', c.id, 'city_key', c.city_key, 'claimed_at', c.claimed_at,
        'revoked_at', c.revoked_at, 'revoked_reason', c.revoked_reason, 'boost_until', c.boost_until,
        'photographer_id', p.id, 'name', p.name, 'city', p.city, 'handle', p.handle, 'email', p.email) ORDER BY c.claimed_at DESC)
      FROM (SELECT * FROM founding_claims ORDER BY claimed_at DESC LIMIT 500) c LEFT JOIN photographers p ON p.id = c.photographer_id), '[]'::jsonb));
$$;
REVOKE ALL ON FUNCTION admin_founding_overview() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION admin_founding_revoke(p_claim_id UUID, p_reason TEXT DEFAULT NULL)
RETURNS BOOLEAN LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE c founding_claims;
BEGIN
  UPDATE founding_claims SET revoked_at = NOW(), revoked_reason = nullif(left(btrim(coalesce(p_reason, '')), 300), '')
   WHERE id = p_claim_id AND revoked_at IS NULL RETURNING * INTO c;
  IF c.id IS NULL THEN RETURN FALSE; END IF;
  -- the badge goes; a free boost that is still running ends now (a boost bought on top of it is kept)
  UPDATE photographers SET founding_city = NULL, founding_at = NULL,
         boosted_until = CASE WHEN c.boost_until IS NOT NULL AND boosted_until = c.boost_until THEN NOW() ELSE boosted_until END
   WHERE id = c.photographer_id;
  RETURN TRUE;
END $$;
REVOKE ALL ON FUNCTION admin_founding_revoke(UUID, TEXT) FROM PUBLIC, anon, authenticated;

-- Invite the creators who are already listed in a city (the admin presses "Email creators"; at most once a week per city)
CREATE OR REPLACE FUNCTION admin_founding_invitees(p_key TEXT)
RETURNS TABLE (name TEXT, email TEXT, handle TEXT) LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE founding_cities SET invited_at = NOW()
   WHERE city_key = p_key AND active AND (invited_at IS NULL OR invited_at < NOW() - INTERVAL '7 days');
  IF NOT FOUND THEN RETURN; END IF;
  RETURN QUERY
    SELECT p.name, p.email, p.handle FROM photographers p
    WHERE city_key(p.city) = p_key AND p.hidden IS NOT TRUE AND p.founding_at IS NULL AND coalesce(p.email, '') <> ''
      AND NOT EXISTS (SELECT 1 FROM founding_claims c WHERE c.user_id = p.user_id)
    ORDER BY p.created_at LIMIT 300;
END $$;
REVOKE ALL ON FUNCTION admin_founding_invitees(TEXT) FROM PUBLIC, anon, authenticated;

-- ── 2. Share links and city pages as a marketing channel (anonymous counts only) ──
ALTER TABLE search_events DROP CONSTRAINT IF EXISTS search_events_kind_check;
ALTER TABLE search_events ADD CONSTRAINT search_events_kind_check
  CHECK (kind IN ('search', 'profile_view', 'book_start', 'trip_search', 'share_view', 'share_click', 'city_page'));

CREATE OR REPLACE FUNCTION log_search_event(p_kind TEXT, p_city TEXT DEFAULT NULL, p_service TEXT DEFAULT NULL, p_results INTEGER DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_kind IS NULL OR p_kind NOT IN ('search', 'profile_view', 'book_start', 'trip_search', 'share_view', 'share_click', 'city_page') THEN RETURN; END IF;
  -- flood protection: at most 600 events a minute in total
  IF (SELECT count(*) FROM search_events WHERE created_at > NOW() - INTERVAL '1 minute') >= 600 THEN RETURN; END IF;
  INSERT INTO search_events (kind, city, service, results)
  VALUES (p_kind, left(city_key(p_city), 80),
          CASE WHEN p_service ~ '^[a-z_]{2,40}$' THEN p_service END,
          CASE WHEN p_results BETWEEN 0 AND 100000 THEN p_results END);
END $$;
REVOKE ALL ON FUNCTION log_search_event(TEXT, TEXT, TEXT, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION log_search_event(TEXT, TEXT, TEXT, INTEGER) TO anon, authenticated;

-- Admin insights now also count share-link views/clicks, city page views and founding spots
CREATE OR REPLACE FUNCTION admin_insights(p_days INTEGER DEFAULT 30)
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH w AS (SELECT NOW() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 365))) AS since),
  ev AS (SELECT e.* FROM search_events e, w WHERE e.created_at >= w.since),
  creators AS (SELECT city_key(city) AS k, count(*) AS n FROM photographers WHERE hidden IS NOT TRUE GROUP BY 1),
  searches AS (SELECT city AS k, count(*) AS n, count(*) FILTER (WHERE results = 0) AS zero
               FROM ev WHERE kind IN ('search', 'trip_search') AND city IS NOT NULL GROUP BY 1),
  alerts AS (SELECT city_key AS k, count(*) AS n FROM city_alerts WHERE notified_at IS NULL GROUP BY 1)
  SELECT jsonb_build_object(
    'days', greatest(1, least(coalesce(p_days, 30), 365)),
    'funnel', jsonb_build_object(
      'searches',      (SELECT count(*) FROM ev WHERE kind IN ('search', 'trip_search')),
      'zero_results',  (SELECT count(*) FROM ev WHERE kind IN ('search', 'trip_search') AND results = 0),
      'profile_views', (SELECT count(*) FROM ev WHERE kind = 'profile_view'),
      'book_starts',   (SELECT count(*) FROM ev WHERE kind = 'book_start'),
      'conversations', (SELECT count(*) FROM conversations, w WHERE conversations.created_at >= w.since),
      'paid_bookings', (SELECT count(*) FROM bookings, w WHERE bookings.paid_at >= w.since),
      'completed',     (SELECT count(*) FROM bookings, w WHERE bookings.completed_at >= w.since)),
    'growth', jsonb_build_object(
      'share_views',  (SELECT count(*) FROM ev WHERE kind = 'share_view'),
      'share_clicks', (SELECT count(*) FROM ev WHERE kind = 'share_click'),
      'city_pages',   (SELECT count(*) FROM ev WHERE kind = 'city_page'),
      'founders',     (SELECT count(*) FROM founding_claims WHERE revoked_at IS NULL AND photographer_id IS NOT NULL),
      'founding_open',(SELECT coalesce(sum(greatest(slots - founding_taken(city_key), 0)), 0) FROM founding_cities WHERE active)),
    'unmet', coalesce((SELECT jsonb_agg(x ORDER BY x.n DESC) FROM (
        SELECT city, service, count(*) AS n FROM ev
        WHERE kind IN ('search', 'trip_search') AND results = 0 AND city IS NOT NULL
        GROUP BY city, service ORDER BY count(*) DESC LIMIT 15) x), '[]'::jsonb),
    'cities', coalesce((SELECT jsonb_agg(x ORDER BY x.searches DESC, x.creators DESC) FROM (
        SELECT coalesce(s.k, c.k) AS city, coalesce(s.n, 0) AS searches, coalesce(s.zero, 0) AS zero,
               coalesce(c.n, 0) AS creators, coalesce(a.n, 0) AS waiting,
               EXISTS (SELECT 1 FROM founding_cities f WHERE f.city_key = coalesce(s.k, c.k) AND f.active) AS founding
        FROM searches s FULL JOIN creators c ON c.k = s.k LEFT JOIN alerts a ON a.k = coalesce(s.k, c.k)
        WHERE coalesce(s.k, c.k) IS NOT NULL
        ORDER BY coalesce(s.n, 0) DESC, coalesce(c.n, 0) DESC LIMIT 25) x), '[]'::jsonb),
    'open_listing_reports', (SELECT count(*) FROM listing_reports WHERE status = 'open'),
    'waiting_alerts', (SELECT count(*) FROM city_alerts WHERE notified_at IS NULL));
$$;
REVOKE ALL ON FUNCTION admin_insights(INTEGER) FROM PUBLIC, anon, authenticated;

-- ================================================================
-- Done. You should see "Success. No rows returned."
-- ================================================================

-- ################################################################
-- PART 10 — Reply time badge, quick replies, "waiting for your reply"
-- reminders, review requests, "a year ago" emails with one-click
-- unsubscribe. Safe to re-run.
-- ################################################################

-- ── 1. Reply time: the typical time a creator needs to answer a traveller (computed by the server only) ──
ALTER TABLE photographers ADD COLUMN IF NOT EXISTS reply_minutes INTEGER;   -- median, NULL until there are 3 answers
ALTER TABLE photographers ADD COLUMN IF NOT EXISTS reply_samples INTEGER NOT NULL DEFAULT 0;
GRANT SELECT (reply_minutes, reply_samples) ON photographers TO anon, authenticated;

-- A "question" = a traveller message that starts a wait (first message, or the first one after the creator spoke).
-- Answer time = until the creator's next message. Unanswered for 48 hours counts as 48 hours; younger open questions
-- are left out until they are answered or reach 48 hours. Last 90 days, blocked chats ignored. Message times are set
-- by the database (nobody can choose them), so the badge can't be faked.
CREATE OR REPLACE FUNCTION refresh_reply_stats()
RETURNS INTEGER LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE changed INTEGER;
BEGIN
  WITH m AS (
    SELECT x.id, x.conversation_id, x.sender_id, x.created_at, c.client_user_id, c.creator_user_id, c.photographer_id,
           lag(x.sender_id) OVER (PARTITION BY x.conversation_id ORDER BY x.created_at, x.id) AS prev_sender
    FROM messages x JOIN conversations c ON c.id = x.conversation_id
    WHERE x.created_at > NOW() - INTERVAL '90 days' AND c.blocked_by IS NULL
  ),
  asks AS (
    SELECT m.conversation_id, m.photographer_id, m.creator_user_id, m.created_at,
           (SELECT min(y.created_at) FROM messages y WHERE y.conversation_id = m.conversation_id
              AND y.sender_id = m.creator_user_id AND y.created_at > m.created_at) AS answered_at
    FROM m WHERE m.sender_id = m.client_user_id AND (m.prev_sender IS NULL OR m.prev_sender = m.creator_user_id)
  ),
  waits AS (
    SELECT photographer_id, least(extract(epoch FROM (coalesce(answered_at, NOW()) - created_at)) / 60.0, 2880) AS mins
    FROM asks WHERE answered_at IS NOT NULL OR created_at < NOW() - INTERVAL '48 hours'
  ),
  stats AS (
    SELECT photographer_id, count(*)::int AS n, percentile_cont(0.5) WITHIN GROUP (ORDER BY mins) AS med FROM waits GROUP BY 1
  ),
  target AS (
    SELECT p.id, coalesce(s.n, 0) AS n, CASE WHEN s.n >= 3 THEN greatest(1, round(s.med))::int END AS mins
    FROM photographers p LEFT JOIN stats s ON s.photographer_id = p.id
  )
  UPDATE photographers p SET reply_samples = t.n, reply_minutes = t.mins
  FROM target t
  WHERE t.id = p.id AND (p.reply_samples IS DISTINCT FROM t.n OR p.reply_minutes IS DISTINCT FROM t.mins);
  GET DIAGNOSTICS changed = ROW_COUNT;
  RETURN changed;
END $$;
REVOKE ALL ON FUNCTION refresh_reply_stats() FROM PUBLIC, anon, authenticated;

-- "Traveller is waiting for your reply" reminder (one per waiting period)
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS creator_nudged_at TIMESTAMPTZ;

-- ── 2. Quick replies: your own saved messages (only you can see or change them) ──
CREATE TABLE IF NOT EXISTS reply_templates (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID        NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title       TEXT        NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 40),
  body        TEXT        NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 1000),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_reply_templates_user ON reply_templates (user_id, created_at);
ALTER TABLE reply_templates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON reply_templates FROM anon, authenticated;
GRANT SELECT (id, title, body, created_at, updated_at) ON reply_templates TO authenticated;
GRANT INSERT (title, body) ON reply_templates TO authenticated;
GRANT UPDATE (title, body) ON reply_templates TO authenticated;
GRANT DELETE ON reply_templates TO authenticated;
DROP POLICY IF EXISTS "own_templates_read" ON reply_templates;
CREATE POLICY "own_templates_read" ON reply_templates FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "own_templates_add" ON reply_templates;
CREATE POLICY "own_templates_add" ON reply_templates FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "own_templates_change" ON reply_templates;
CREATE POLICY "own_templates_change" ON reply_templates FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "own_templates_delete" ON reply_templates;
CREATE POLICY "own_templates_delete" ON reply_templates FOR DELETE USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION reply_templates_guard()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.title := btrim(NEW.title);
  NEW.body := btrim(NEW.body);
  IF TG_OP = 'INSERT' THEN
    IF (SELECT count(*) FROM reply_templates WHERE user_id = NEW.user_id) >= 20 THEN
      RAISE EXCEPTION 'You can save up to 20 quick replies.' USING ERRCODE = 'P0001';
    END IF;
  ELSE
    NEW.user_id := OLD.user_id;
    NEW.created_at := OLD.created_at;
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS reply_templates_guard ON reply_templates;
CREATE TRIGGER reply_templates_guard BEFORE INSERT OR UPDATE ON reply_templates FOR EACH ROW EXECUTE FUNCTION reply_templates_guard();

-- ── 3. Optional emails (review reminder, "a year ago") — on by default, off with one click ──
CREATE TABLE IF NOT EXISTS email_prefs (
  user_id            UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tips               BOOLEAN     NOT NULL DEFAULT TRUE,
  unsubscribe_token  UUID        NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE email_prefs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON email_prefs FROM anon, authenticated;

CREATE OR REPLACE FUNCTION my_email_prefs()
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object('tips', coalesce((SELECT tips FROM email_prefs WHERE user_id = auth.uid()), true));
$$;
REVOKE ALL ON FUNCTION my_email_prefs() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION my_email_prefs() TO authenticated;

CREATE OR REPLACE FUNCTION set_email_tips(p_on BOOLEAN)
RETURNS BOOLEAN LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Please sign in.' USING ERRCODE = '42501'; END IF;
  INSERT INTO email_prefs (user_id, tips) VALUES (auth.uid(), coalesce(p_on, true))
  ON CONFLICT (user_id) DO UPDATE SET tips = EXCLUDED.tips, updated_at = NOW();
  RETURN coalesce(p_on, true);
END $$;
REVOKE ALL ON FUNCTION set_email_tips(BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION set_email_tips(BOOLEAN) TO authenticated;

-- One-click unsubscribe from the link in the email (no sign-in). Says only whether the link worked.
CREATE OR REPLACE FUNCTION email_unsubscribe(p_token TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_token IS NULL OR p_token !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN RETURN FALSE; END IF;
  UPDATE email_prefs SET tips = FALSE, updated_at = NOW() WHERE unsubscribe_token = p_token::uuid;
  RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION email_unsubscribe(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION email_unsubscribe(TEXT) TO anon, authenticated;

-- Server only: the unsubscribe token for a user, or NULL when they turned these emails off
CREATE OR REPLACE FUNCTION email_tips_token(p_user UUID)
RETURNS UUID LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE r email_prefs;
BEGIN
  IF p_user IS NULL THEN RETURN NULL; END IF;
  INSERT INTO email_prefs (user_id) VALUES (p_user) ON CONFLICT (user_id) DO NOTHING;
  SELECT * INTO r FROM email_prefs WHERE user_id = p_user;
  RETURN CASE WHEN r.tips THEN r.unsubscribe_token END;
END $$;
REVOKE ALL ON FUNCTION email_tips_token(UUID) FROM PUBLIC, anon, authenticated;

-- ================================================================
-- Done. You should see "Success. No rows returned."
-- ================================================================

-- ################################################################
-- PART 11 — Trust on the profile: what's included in each package,
-- "a full shoot" sample gallery, intro video link, completed shoots
-- (counted by the database), the agreed package kept with each booking.
-- Safe to re-run.
-- ################################################################

-- ── 1. A set of public photos: up to `max` items { url, thumb? } with https links ──
CREATE OR REPLACE FUNCTION photo_set_is_valid(g JSONB, max_items INTEGER)
RETURNS BOOLEAN LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_typeof(g) = 'array'
     AND jsonb_array_length(g) <= max_items
     AND NOT EXISTS (
       SELECT 1 FROM jsonb_array_elements(g) e
       WHERE jsonb_typeof(e) <> 'object'
          OR coalesce(e->>'url', '') !~ '^https://'
          OR char_length(e->>'url') > 500
          OR (e ? 'thumb' AND (coalesce(e->>'thumb', '') !~ '^https://' OR char_length(e->>'thumb') > 500))
     );
$$;

ALTER TABLE photographers ADD COLUMN IF NOT EXISTS sample_gallery   JSONB   NOT NULL DEFAULT '[]';
ALTER TABLE photographers ADD COLUMN IF NOT EXISTS sample_title     TEXT;
ALTER TABLE photographers ADD COLUMN IF NOT EXISTS intro_video_url  TEXT;
ALTER TABLE photographers ADD COLUMN IF NOT EXISTS completed_shoots INTEGER NOT NULL DEFAULT 0;   -- server only
ALTER TABLE photographers DROP CONSTRAINT IF EXISTS sample_gallery_check;
ALTER TABLE photographers ADD  CONSTRAINT sample_gallery_check CHECK (photo_set_is_valid(sample_gallery, 40));
ALTER TABLE photographers DROP CONSTRAINT IF EXISTS sample_title_check;
ALTER TABLE photographers ADD  CONSTRAINT sample_title_check CHECK (sample_title IS NULL OR char_length(sample_title) <= 80);
-- Only a link to a well-known video site (opened there, never embedded on CapturaGo)
ALTER TABLE photographers DROP CONSTRAINT IF EXISTS intro_video_check;
ALTER TABLE photographers ADD  CONSTRAINT intro_video_check CHECK (intro_video_url IS NULL OR (
  char_length(intro_video_url) <= 300
  AND intro_video_url ~* '^https://([a-z0-9-]+\.)*(youtube\.com|youtu\.be|instagram\.com|tiktok\.com|vimeo\.com)(/[^\s<>"]*)?$'));

-- ── 2. What's included in a package (new optional fields; older packages stay valid) ──
CREATE OR REPLACE FUNCTION packages_details_valid(pk JSONB)
RETURNS BOOLEAN LANGUAGE sql IMMUTABLE AS $$
  SELECT pk IS NULL OR jsonb_typeof(pk) <> 'array' OR NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(pk) k
    WHERE jsonb_typeof(k) = 'object' AND (
         (k ? 'photos' AND (jsonb_typeof(k->'photos') <> 'number' OR (k->>'photos')::numeric NOT BETWEEN 1 AND 2000 OR (k->>'photos')::numeric <> trunc((k->>'photos')::numeric)))
      OR (k ? 'edit_days' AND (jsonb_typeof(k->'edit_days') <> 'number' OR (k->>'edit_days')::numeric NOT BETWEEN 1 AND 60))
      OR (k ? 'includes' AND (jsonb_typeof(k->'includes') <> 'array' OR jsonb_array_length(k->'includes') > 6
            OR EXISTS (SELECT 1 FROM jsonb_array_elements(k->'includes') i WHERE jsonb_typeof(i) <> 'string' OR char_length(i #>> '{}') > 60)))
    ));
$$;
DO $$ BEGIN
  ALTER TABLE photographers ADD CONSTRAINT packages_details_check CHECK (packages_details_valid(packages)) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

GRANT SELECT (sample_gallery, sample_title, intro_video_url, completed_shoots) ON photographers TO anon, authenticated;
GRANT INSERT (sample_gallery, sample_title, intro_video_url) ON photographers TO authenticated;
GRANT UPDATE (sample_gallery, sample_title, intro_video_url) ON photographers TO authenticated;

-- ── 3. Completed shoots, counted by the database whenever a booking changes (can't be edited) ──
CREATE OR REPLACE FUNCTION refresh_completed_shoots(p_id UUID)
RETURNS VOID LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE photographers SET completed_shoots = (SELECT count(*) FROM bookings WHERE photographer_id = p_id AND status = 'completed')
  WHERE id = p_id;
$$;
REVOKE ALL ON FUNCTION refresh_completed_shoots(UUID) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION bookings_count_completed()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') AND OLD.photographer_id IS NOT NULL THEN PERFORM refresh_completed_shoots(OLD.photographer_id); END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') AND NEW.photographer_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.photographer_id IS DISTINCT FROM OLD.photographer_id OR NEW.status IS DISTINCT FROM OLD.status) THEN
    PERFORM refresh_completed_shoots(NEW.photographer_id);
  END IF;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS bookings_count_completed ON bookings;
CREATE TRIGGER bookings_count_completed AFTER INSERT OR UPDATE OF status, photographer_id OR DELETE ON bookings
  FOR EACH ROW EXECUTE FUNCTION bookings_count_completed();
-- first run: count what's already there
UPDATE photographers p SET completed_shoots = c.n
FROM (SELECT photographer_id, count(*)::int AS n FROM bookings WHERE status = 'completed' AND photographer_id IS NOT NULL GROUP BY 1) c
WHERE c.photographer_id = p.id AND p.completed_shoots IS DISTINCT FROM c.n;

-- ── 4. The package as it was when the traveller paid (set by the server; fair for problems and refunds) ──
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS package_details JSONB;
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS package_details_size;
ALTER TABLE bookings ADD  CONSTRAINT package_details_size CHECK (package_details IS NULL OR (jsonb_typeof(package_details) = 'object' AND pg_column_size(package_details) <= 4000));
GRANT SELECT (package_details) ON bookings TO authenticated;

-- ================================================================
-- Done. You should see "Success. No rows returned."
-- ================================================================

-- ################################################################
-- PART 12 — Payment held until the photos arrive, creators on the
-- road (trips), calendar sync (export a feed, import busy days).
-- Safe to re-run.
-- ################################################################

-- ── 0. Which bookings keep a creator's day: paid/confirmed ones, a checkout in progress (30 minutes),
--       and a booking whose cost is being split between friends (until its payment deadline) ──
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS split_count    INTEGER NOT NULL DEFAULT 1;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS split_deadline TIMESTAMPTZ;
CREATE OR REPLACE FUNCTION booking_holds_day(p_status TEXT, p_created TIMESTAMPTZ, p_split_deadline TIMESTAMPTZ)
RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
  SELECT p_status IN ('paid', 'confirmed')
      OR (p_status = 'pending_payment' AND (p_created > NOW() - INTERVAL '30 minutes' OR (p_split_deadline IS NOT NULL AND p_split_deadline > NOW())));
$$;

-- ── 1. Payment held until the photos arrive ──
-- A package that promises the photos "within N days" keeps the payment on hold until the creator has sent the
-- photos (first time) and 3 more days have passed — or until the traveller releases it themselves.
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS photos_delivered_at TIMESTAMPTZ;   -- first "photos ready" (server only)
UPDATE bookings SET photos_delivered_at = photos_ready_at WHERE photos_delivered_at IS NULL AND photos_ready_at IS NOT NULL;
DO $$ BEGIN
  ALTER TABLE bookings ADD COLUMN photos_promised BOOLEAN GENERATED ALWAYS AS (
    CASE WHEN booking_type = 'session' AND package_details IS NOT NULL AND jsonb_typeof(package_details->'edit_days') = 'number'
         THEN (package_details->>'edit_days')::numeric BETWEEN 1 AND 60 ELSE FALSE END) STORED;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_bookings_held ON bookings (shoot_date) WHERE status = 'confirmed' AND photos_promised;

-- ── 2. Creators on the road: "I'm in Lisbon 3–10 Nov" ──
-- trips: [{ city, from: 'YYYY-MM-DD', to: 'YYYY-MM-DD', lat?, lon? }] — up to 10, at most 61 days each, no overlaps.
-- On a trip day the creator shoots in the trip city; on other days in their home city.
ALTER TABLE photographers ADD COLUMN IF NOT EXISTS trips JSONB NOT NULL DEFAULT '[]';
CREATE OR REPLACE FUNCTION trips_valid(t JSONB)
RETURNS BOOLEAN LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE e JSONB; f DATE; d DATE; prev DATE := NULL; c TEXT;
BEGIN
  IF t IS NULL OR jsonb_typeof(t) <> 'array' OR jsonb_array_length(t) > 10 THEN RETURN FALSE; END IF;
  FOR e IN SELECT x FROM jsonb_array_elements(t) x ORDER BY x->>'from' LOOP
    IF jsonb_typeof(e) <> 'object' THEN RETURN FALSE; END IF;
    IF EXISTS (SELECT 1 FROM jsonb_object_keys(e) k WHERE k NOT IN ('city', 'from', 'to', 'lat', 'lon')) THEN RETURN FALSE; END IF;
    IF jsonb_typeof(e->'city') <> 'string' THEN RETURN FALSE; END IF;
    c := e->>'city';
    IF char_length(btrim(c)) < 2 OR char_length(c) > 80 OR c ~ '[<>"\n\r]' THEN RETURN FALSE; END IF;
    IF coalesce(e->>'from', '') !~ '^\d{4}-\d{2}-\d{2}$' OR coalesce(e->>'to', '') !~ '^\d{4}-\d{2}-\d{2}$' THEN RETURN FALSE; END IF;
    BEGIN f := (e->>'from')::date; d := (e->>'to')::date; EXCEPTION WHEN others THEN RETURN FALSE; END;
    IF to_char(f, 'YYYY-MM-DD') <> e->>'from' OR to_char(d, 'YYYY-MM-DD') <> e->>'to' THEN RETURN FALSE; END IF;
    IF d < f OR d - f > 60 THEN RETURN FALSE; END IF;
    IF prev IS NOT NULL AND f <= prev THEN RETURN FALSE; END IF;               -- trips can't overlap
    prev := d;
    IF (e ? 'lat') <> (e ? 'lon') THEN RETURN FALSE; END IF;
    IF e ? 'lat' AND (jsonb_typeof(e->'lat') <> 'number' OR jsonb_typeof(e->'lon') <> 'number'
        OR (e->>'lat')::numeric NOT BETWEEN -90 AND 90 OR (e->>'lon')::numeric NOT BETWEEN -180 AND 180) THEN RETURN FALSE; END IF;
  END LOOP;
  RETURN TRUE;
END $$;
ALTER TABLE photographers DROP CONSTRAINT IF EXISTS trips_check;
ALTER TABLE photographers ADD  CONSTRAINT trips_check CHECK (trips_valid(trips));

-- The trip on a given day (NULL = the creator is at home that day)
CREATE OR REPLACE FUNCTION trip_on(t JSONB, d DATE)
RETURNS JSONB LANGUAGE sql IMMUTABLE AS $$
  SELECT x FROM jsonb_array_elements(CASE WHEN jsonb_typeof(t) = 'array' THEN t ELSE '[]'::jsonb END) x
  WHERE d BETWEEN (x->>'from')::date AND (x->>'to')::date LIMIT 1;
$$;

GRANT SELECT (trips) ON photographers TO anon, authenticated;
GRANT INSERT (trips), UPDATE (trips) ON photographers TO authenticated;

-- Where a booking takes place: set by the database from the creator's trips (never by the browser)
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS shoot_city   TEXT;    -- NULL = the creator's home city
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS shoot_coords JSONB;
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_shoot_place_check;
ALTER TABLE bookings ADD  CONSTRAINT bookings_shoot_place_check CHECK (
  (shoot_city IS NULL OR char_length(shoot_city) <= 80) AND (shoot_coords IS NULL OR jsonb_typeof(shoot_coords) = 'object'));

CREATE OR REPLACE FUNCTION bookings_set_place()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE tr JSONB; trips JSONB; place TEXT;
BEGIN
  IF NEW.booking_type IS DISTINCT FROM 'session' OR NEW.photographer_id IS NULL OR NEW.shoot_date IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND NEW.shoot_date IS NOT DISTINCT FROM OLD.shoot_date THEN RETURN NEW; END IF;
  SELECT p.trips INTO trips FROM photographers p WHERE p.id = NEW.photographer_id FOR SHARE;   -- waits for a trip change in progress
  tr := trip_on(trips, NEW.shoot_date);
  place := tr->>'city';
  IF TG_OP = 'INSERT' THEN
    NEW.shoot_city := place;
    NEW.shoot_coords := CASE WHEN tr ? 'lat' THEN jsonb_build_object('lat', tr->'lat', 'lon', tr->'lon') END;
  ELSIF city_key(place) IS DISTINCT FROM city_key(OLD.shoot_city) THEN
    RAISE EXCEPTION 'The creator is in another city on that day. Please choose another date.' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS bookings_set_place ON bookings;
CREATE TRIGGER bookings_set_place BEFORE INSERT OR UPDATE OF shoot_date ON bookings FOR EACH ROW EXECUTE FUNCTION bookings_set_place();

-- A creator can't move a trip away from a booked shoot (or put a trip over a shoot at home)
CREATE OR REPLACE FUNCTION photographers_trips_guard()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b RECORD; place TEXT;
BEGIN
  IF NEW.trips IS NOT DISTINCT FROM OLD.trips THEN RETURN NEW; END IF;
  FOR b IN SELECT shoot_date, shoot_city FROM bookings
           WHERE photographer_id = NEW.id AND booking_type = 'session' AND shoot_date >= CURRENT_DATE
             AND booking_holds_day(status, created_at, split_deadline)
           ORDER BY shoot_date LOOP
    place := trip_on(NEW.trips, b.shoot_date)->>'city';
    IF city_key(place) IS DISTINCT FROM city_key(b.shoot_city) THEN
      IF b.shoot_city IS NULL THEN
        RAISE EXCEPTION 'You have a shoot at home on %. Move it first, or choose other trip dates.', to_char(b.shoot_date, 'FMDD Mon YYYY') USING ERRCODE = 'P0001';
      ELSE
        RAISE EXCEPTION 'You have a shoot in % on %. Keep that trip (you can change its other dates).', split_part(b.shoot_city, ',', 1), to_char(b.shoot_date, 'FMDD Mon YYYY') USING ERRCODE = 'P0001';
      END IF;
    END IF;
  END LOOP;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS photographers_trips_guard ON photographers;
CREATE TRIGGER photographers_trips_guard BEFORE UPDATE OF trips ON photographers FOR EACH ROW EXECUTE FUNCTION photographers_trips_guard();

-- "Notify me about Lisbon" also fires when a creator plans a trip there (server only; one email per alert)
CREATE OR REPLACE FUNCTION due_trip_alerts(p_limit INTEGER DEFAULT 100)
RETURNS TABLE (alert_id UUID, user_id UUID, city_label TEXT, service TEXT, photographer_id UUID, photographer_name TEXT, photographer_handle TEXT, trip_from DATE, trip_to DATE)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT ON (a.id) a.id, a.user_id, a.city_label, a.service, p.id, p.name, p.handle, (t->>'from')::date, (t->>'to')::date
  FROM city_alerts a
  JOIN photographers p ON p.hidden IS NOT TRUE AND p.available IS NOT FALSE AND p.user_id <> a.user_id
   AND (a.service IS NULL OR a.service = ANY(listing_services(p.services, p.type)))
  CROSS JOIN LATERAL jsonb_array_elements(p.trips) t
  WHERE a.notified_at IS NULL AND city_key(t->>'city') = a.city_key AND (t->>'to')::date >= CURRENT_DATE
  ORDER BY a.id, (t->>'from')::date
  LIMIT greatest(1, least(coalesce(p_limit, 100), 500));
$$;
REVOKE ALL ON FUNCTION due_trip_alerts(INTEGER) FROM PUBLIC, anon, authenticated;

-- ── 3. Calendar sync ──
-- Busy days read from the creator's own calendar (Google, Apple, Outlook…) by the server. Private: never shown
-- as such — they only make those days unbookable.
ALTER TABLE photographers ADD COLUMN IF NOT EXISTS external_busy_dates DATE[] NOT NULL DEFAULT '{}';   -- server only
ALTER TABLE photographers DROP CONSTRAINT IF EXISTS external_busy_check;
ALTER TABLE photographers ADD  CONSTRAINT external_busy_check CHECK (coalesce(cardinality(external_busy_dates), 0) <= 400);

-- Only calendar links of well-known providers are fetched (the server never visits other addresses)
CREATE OR REPLACE FUNCTION calendar_url_ok(u TEXT)
RETURNS BOOLEAN LANGUAGE sql IMMUTABLE AS $$
  SELECT u IS NOT NULL AND char_length(u) BETWEEN 20 AND 1000
     AND u ~* '^https://(calendar\.google\.com|([a-z0-9-]+\.)*icloud\.com|outlook\.live\.com|outlook\.office365\.com|outlook\.office\.com|calendar\.proton\.me|user\.fm)/[^\s<>"\\]*$';
$$;

CREATE TABLE IF NOT EXISTS calendar_imports (
  user_id        UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  url            TEXT        NOT NULL CHECK (calendar_url_ok(url)),
  last_synced_at TIMESTAMPTZ,
  last_error     TEXT        CHECK (char_length(last_error) <= 200),
  busy_count     INTEGER     NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_calendar_imports_sync ON calendar_imports (last_synced_at NULLS FIRST);
ALTER TABLE calendar_imports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON calendar_imports FROM anon, authenticated;   -- the secret calendar link is never readable by the browser

-- Private feed of your CapturaGo bookings for your own calendar app (the link itself is the key)
CREATE TABLE IF NOT EXISTS calendar_feeds (
  user_id    UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  token      UUID        NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE calendar_feeds ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON calendar_feeds FROM anon, authenticated;

CREATE OR REPLACE FUNCTION my_calendar_feed(p_reset BOOLEAN DEFAULT FALSE)
RETURNS UUID LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE me UUID := auth.uid(); t UUID;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Please sign in first.' USING ERRCODE = 'P0001'; END IF;
  INSERT INTO calendar_feeds (user_id) VALUES (me) ON CONFLICT (user_id) DO NOTHING;
  IF p_reset THEN UPDATE calendar_feeds SET token = gen_random_uuid(), created_at = NOW() WHERE user_id = me; END IF;
  SELECT token INTO t FROM calendar_feeds WHERE user_id = me;
  RETURN t;
END $$;
REVOKE ALL ON FUNCTION my_calendar_feed(BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION my_calendar_feed(BOOLEAN) TO authenticated;

CREATE OR REPLACE FUNCTION set_calendar_import(p_url TEXT)
RETURNS TEXT LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE me UUID := auth.uid(); u TEXT := btrim(coalesce(p_url, ''));
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Please sign in first.' USING ERRCODE = 'P0001'; END IF;
  IF NOT EXISTS (SELECT 1 FROM photographers WHERE user_id = me) THEN RAISE EXCEPTION 'Create your listing first.' USING ERRCODE = 'P0001'; END IF;
  IF u ~* '^webcal://' THEN u := 'https://' || substr(u, 10); END IF;
  IF NOT calendar_url_ok(u) THEN
    RAISE EXCEPTION 'Paste the secret iCal link from Google Calendar, Apple iCloud, Outlook, Proton or Fastmail (it starts with https:// or webcal://).' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO calendar_imports (user_id, url) VALUES (me, u)
  ON CONFLICT (user_id) DO UPDATE SET url = EXCLUDED.url, last_synced_at = NULL, last_error = NULL, busy_count = 0, created_at = NOW();
  RETURN substring(u FROM '^https://([^/]+)');
END $$;
REVOKE ALL ON FUNCTION set_calendar_import(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION set_calendar_import(TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION remove_calendar_import()
RETURNS VOID LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE me UUID := auth.uid();
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Please sign in first.' USING ERRCODE = 'P0001'; END IF;
  DELETE FROM calendar_imports WHERE user_id = me;
  UPDATE photographers SET external_busy_dates = '{}' WHERE user_id = me AND cardinality(external_busy_dates) > 0;
END $$;
REVOKE ALL ON FUNCTION remove_calendar_import() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION remove_calendar_import() TO authenticated;

-- Your own sync status (the link is shown only as its provider, e.g. "calendar.google.com")
CREATE OR REPLACE FUNCTION my_calendar_sync()
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'import', (SELECT jsonb_build_object('host', substring(i.url FROM '^https://([^/]+)'), 'last_synced_at', i.last_synced_at,
                                         'last_error', i.last_error, 'busy_count', i.busy_count)
               FROM calendar_imports i WHERE i.user_id = auth.uid()),
    'busy_dates', coalesce((SELECT to_jsonb(ARRAY(SELECT d FROM unnest(p.external_busy_dates) d WHERE d >= CURRENT_DATE ORDER BY d))
                            FROM photographers p WHERE p.user_id = auth.uid()), '[]'::jsonb))
  WHERE auth.uid() IS NOT NULL;
$$;
REVOKE ALL ON FUNCTION my_calendar_sync() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION my_calendar_sync() TO authenticated;

-- Busy days for the booking calendar now include days blocked in the creator's own calendar
CREATE OR REPLACE FUNCTION creator_busy_dates(p_photographer_id UUID)
RETURNS SETOF DATE LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT d FROM (
    SELECT unnest(unavailable_dates) AS d FROM photographers WHERE id = p_photographer_id
    UNION
    SELECT unnest(external_busy_dates) FROM photographers WHERE id = p_photographer_id
    UNION
    SELECT b.shoot_date FROM bookings b JOIN photographers p ON p.id = b.photographer_id
    WHERE b.photographer_id = p_photographer_id
      AND b.booking_type = 'session'
      AND booking_holds_day(b.status, b.created_at, b.split_deadline)
    GROUP BY b.shoot_date, p.max_per_day
    HAVING count(*) >= p.max_per_day
  ) x
  WHERE d >= CURRENT_DATE AND d <= CURRENT_DATE + 400
  ORDER BY d;
$$;
REVOKE ALL ON FUNCTION creator_busy_dates(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION creator_busy_dates(UUID) TO anon, authenticated;

-- Trip planner: free days count only where the creator really is (home city, or the trip city on trip days),
-- and days blocked in their own calendar are left out
CREATE OR REPLACE FUNCTION available_creators(p_city TEXT, p_from DATE, p_to DATE)
RETURNS TABLE (photographer_id UUID, free_days INTEGER, first_free DATE)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE f DATE := greatest(coalesce(p_from, CURRENT_DATE + 1), CURRENT_DATE + 1); t DATE := coalesce(p_to, p_from);  -- bookings start tomorrow
        needle TEXT := nullif(replace(replace(lower(btrim(coalesce(p_city, ''))), '%', ''), '_', ''), '');
BEGIN
  IF t IS NULL OR t < f THEN RAISE EXCEPTION 'Choose dates from tomorrow on.' USING ERRCODE = 'P0001'; END IF;
  IF t - f > 30 THEN RAISE EXCEPTION 'Choose up to 31 days at a time.' USING ERRCODE = 'P0001'; END IF;
  IF t > CURRENT_DATE + 365 THEN RAISE EXCEPTION 'Choose dates within the next 12 months.' USING ERRCODE = 'P0001'; END IF;
  RETURN QUERY
  WITH cand AS (
    SELECT p.id, p.city, p.unavailable_dates, p.external_busy_dates, p.max_per_day, p.trips FROM photographers p
    WHERE p.hidden IS NOT TRUE AND p.available IS NOT FALSE
      AND listing_services(p.services, p.type) && ARRAY['photo', 'video', 'phone', 'event', 'drone', 'guide']
  ), booked AS (
    SELECT b.photographer_id AS pid, b.shoot_date AS d, count(*) AS n FROM bookings b
    WHERE b.photographer_id IN (SELECT id FROM cand) AND b.booking_type = 'session' AND b.shoot_date BETWEEN f AND t
      AND booking_holds_day(b.status, b.created_at, b.split_deadline)
    GROUP BY 1, 2
  ), days AS (
    SELECT c.id, c.max_per_day, c.unavailable_dates, c.external_busy_dates, dd.d,
           coalesce(trip_on(c.trips, dd.d)->>'city', c.city) AS place
    FROM cand c CROSS JOIN (SELECT generate_series(f, t, INTERVAL '1 day')::DATE AS d) dd
  )
  SELECT x.id, count(*)::INTEGER, min(x.d)::DATE
  FROM days x
  LEFT JOIN booked k ON k.pid = x.id AND k.d = x.d
  WHERE (needle IS NULL OR city_key(x.place) = city_key(needle) OR lower(x.place) LIKE '%' || needle || '%')
    AND NOT (x.d = ANY(coalesce(x.unavailable_dates, '{}'))) AND NOT (x.d = ANY(coalesce(x.external_busy_dates, '{}')))
    AND coalesce(k.n, 0) < x.max_per_day
  GROUP BY x.id
  LIMIT 500;
END $$;
REVOKE ALL ON FUNCTION available_creators(TEXT, DATE, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION available_creators(TEXT, DATE, DATE) TO anon, authenticated;

GRANT SELECT (photos_delivered_at, photos_promised, shoot_city, shoot_coords) ON bookings TO authenticated;

-- ################################################################
-- PART 13 — Gift a shoot (gift cards) and split the cost with friends.
-- Safe to re-run.
-- ################################################################

-- ── 1. Gift cards: bought on the website, used at checkout (balance kept by the database) ──
CREATE OR REPLACE FUNCTION gift_code_norm(p TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  -- "cg-abcd efgh-…" → "CG-ABCD-EFGH-JKLM-NPQR" (letters/digits that can't be confused: no 0/O, 1/I/L)
  SELECT CASE WHEN x ~ '^CG[A-HJ-NP-Z2-9]{16}$' THEN 'CG-' || substr(x, 3, 4) || '-' || substr(x, 7, 4) || '-' || substr(x, 11, 4) || '-' || substr(x, 15, 4) END
  FROM (SELECT upper(regexp_replace(coalesce(p, ''), '[^A-Za-z0-9]', '', 'g')) AS x) t;
$$;

CREATE TABLE IF NOT EXISTS gift_cards (
  id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  code                        TEXT        NOT NULL UNIQUE CHECK (code ~ '^CG-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$'),
  buyer_user_id               UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  buyer_email                 TEXT        CHECK (buyer_email IS NULL OR char_length(buyer_email) <= 254),
  recipient_name              TEXT        CHECK (recipient_name IS NULL OR char_length(recipient_name) <= 60),
  recipient_email             TEXT        CHECK (recipient_email IS NULL OR (char_length(recipient_email) <= 254 AND recipient_email ~ '^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$')),
  message                     TEXT        CHECK (message IS NULL OR char_length(message) <= 300),
  amount_cents                INTEGER     NOT NULL CHECK (amount_cents BETWEEN 2500 AND 100000),
  balance_cents               INTEGER     NOT NULL,
  currency                    TEXT        NOT NULL DEFAULT 'eur',
  status                      TEXT        NOT NULL DEFAULT 'pending_payment' CHECK (status IN ('pending_payment', 'active', 'expired_checkout', 'refunded')),
  stripe_checkout_session_id  TEXT,
  stripe_payment_intent_id    TEXT,
  stripe_refund_id            TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at                     TIMESTAMPTZ,
  expires_at                  TIMESTAMPTZ,
  recipient_emailed_at        TIMESTAMPTZ,
  CONSTRAINT gift_balance_range CHECK (balance_cents BETWEEN 0 AND amount_cents)
);
CREATE INDEX IF NOT EXISTS idx_gift_cards_buyer ON gift_cards (buyer_user_id, created_at DESC);
ALTER TABLE gift_cards ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON gift_cards FROM anon, authenticated;          -- codes are money: only the server and the buyer's own RPC see them

CREATE TABLE IF NOT EXISTS gift_redemptions (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  gift_id      UUID        NOT NULL REFERENCES gift_cards(id) ON DELETE CASCADE,
  booking_id   UUID        NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  amount_cents INTEGER     NOT NULL CHECK (amount_cents > 0),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reversed_at  TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS gift_redemptions_once ON gift_redemptions (gift_id, booking_id) WHERE reversed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_gift_redemptions_booking ON gift_redemptions (booking_id);
ALTER TABLE gift_redemptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON gift_redemptions FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS gift_attempts (
  id         BIGSERIAL   PRIMARY KEY,
  user_id    UUID        NOT NULL,
  ok         BOOLEAN     NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_gift_attempts_user ON gift_attempts (user_id, created_at);
ALTER TABLE gift_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON gift_attempts FROM anon, authenticated;

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS gift_cents INTEGER NOT NULL DEFAULT 0;
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_gift_check;
ALTER TABLE bookings ADD  CONSTRAINT bookings_gift_check CHECK (gift_cents >= 0 AND gift_cents <= total_cents);

-- Look up a code for a user (rate limited: 10 wrong codes per hour). Never raises for a wrong code,
-- so the failed attempt is kept. Returns { ok, error?, balance_cents?, expires_at? }.
CREATE OR REPLACE FUNCTION gift_check_as(p_user UUID, p_code TEXT)
RETURNS JSONB LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE c TEXT := gift_code_norm(p_code); g gift_cards; bad INTEGER;
BEGIN
  IF p_user IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Please sign in first.'); END IF;
  SELECT count(*) INTO bad FROM gift_attempts WHERE user_id = p_user AND NOT ok AND created_at > NOW() - INTERVAL '1 hour';
  IF bad >= 10 THEN RETURN jsonb_build_object('ok', false, 'error', 'Too many wrong codes. Please try again in an hour.'); END IF;
  IF c IS NOT NULL THEN SELECT * INTO g FROM gift_cards WHERE code = c; END IF;
  IF g.id IS NULL OR g.status NOT IN ('active') THEN
    INSERT INTO gift_attempts (user_id, ok) VALUES (p_user, FALSE);
    RETURN jsonb_build_object('ok', false, 'error', 'We couldn''t find that gift card. Please check the code.');
  END IF;
  INSERT INTO gift_attempts (user_id, ok) VALUES (p_user, TRUE);
  IF g.expires_at IS NOT NULL AND g.expires_at < NOW() THEN RETURN jsonb_build_object('ok', false, 'error', 'This gift card has expired.'); END IF;
  IF g.balance_cents <= 0 THEN RETURN jsonb_build_object('ok', false, 'error', 'This gift card has been used up.'); END IF;
  RETURN jsonb_build_object('ok', true, 'balance_cents', g.balance_cents, 'expires_at', g.expires_at);
END $$;
REVOKE ALL ON FUNCTION gift_check_as(UUID, TEXT) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION check_gift(p_code TEXT)
RETURNS JSONB LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public AS $$
  SELECT gift_check_as(auth.uid(), p_code);
$$;
REVOKE ALL ON FUNCTION check_gift(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION check_gift(TEXT) TO authenticated;

-- Take money from a gift card for a booking (server only). The card is locked while it changes, so two
-- checkouts can never spend the same balance. Leaves at least €0.50 to pay by card, or covers everything.
CREATE OR REPLACE FUNCTION reserve_gift(p_code TEXT, p_booking UUID, p_total INTEGER)
RETURNS INTEGER LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE g gift_cards; amt INTEGER;
BEGIN
  SELECT * INTO g FROM gift_cards WHERE code = gift_code_norm(p_code) FOR UPDATE;
  IF g.id IS NULL OR g.status <> 'active' THEN RAISE EXCEPTION 'We couldn''t find that gift card. Please check the code.' USING ERRCODE = 'P0001'; END IF;
  IF g.expires_at IS NOT NULL AND g.expires_at < NOW() THEN RAISE EXCEPTION 'This gift card has expired.' USING ERRCODE = 'P0001'; END IF;
  IF g.balance_cents <= 0 THEN RAISE EXCEPTION 'This gift card has been used up.' USING ERRCODE = 'P0001'; END IF;
  IF p_total IS NULL OR p_total <= 0 THEN RAISE EXCEPTION 'Nothing to pay.' USING ERRCODE = 'P0001'; END IF;
  amt := CASE WHEN g.balance_cents >= p_total THEN p_total
              WHEN p_total - g.balance_cents < 50 THEN p_total - 50
              ELSE g.balance_cents END;
  IF amt <= 0 THEN RAISE EXCEPTION 'This gift card can''t be used for this amount.' USING ERRCODE = 'P0001'; END IF;
  UPDATE gift_cards SET balance_cents = balance_cents - amt WHERE id = g.id;
  INSERT INTO gift_redemptions (gift_id, booking_id, amount_cents) VALUES (g.id, p_booking, amt);
  UPDATE bookings SET gift_cents = gift_cents + amt WHERE id = p_booking;
  RETURN amt;
END $$;
REVOKE ALL ON FUNCTION reserve_gift(TEXT, UUID, INTEGER) FROM PUBLIC, anon, authenticated;

-- Give the gift money of a booking back to its card(s) (server only): unpaid checkout, cancel or refund.
CREATE OR REPLACE FUNCTION release_gift(p_booking UUID)
RETURNS INTEGER LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE r RECORD; total INTEGER := 0;
BEGIN
  FOR r IN SELECT id, gift_id, amount_cents FROM gift_redemptions WHERE booking_id = p_booking AND reversed_at IS NULL ORDER BY created_at FOR UPDATE LOOP
    UPDATE gift_cards SET balance_cents = least(amount_cents, balance_cents + r.amount_cents) WHERE id = r.gift_id;
    UPDATE gift_redemptions SET reversed_at = NOW() WHERE id = r.id;
    total := total + r.amount_cents;
  END LOOP;
  IF total > 0 THEN UPDATE bookings SET gift_cents = greatest(gift_cents - total, 0) WHERE id = p_booking; END IF;
  RETURN total;
END $$;
REVOKE ALL ON FUNCTION release_gift(UUID) FROM PUBLIC, anon, authenticated;

-- The gift cards I bought (with their codes — I may pass them on)
CREATE OR REPLACE FUNCTION my_gift_cards()
RETURNS TABLE (id UUID, code TEXT, amount_cents INTEGER, balance_cents INTEGER, status TEXT, recipient_name TEXT, recipient_email TEXT,
               created_at TIMESTAMPTZ, paid_at TIMESTAMPTZ, expires_at TIMESTAMPTZ)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT g.id, CASE WHEN g.status = 'active' THEN g.code END, g.amount_cents, g.balance_cents, g.status, g.recipient_name, g.recipient_email,
         g.created_at, g.paid_at, g.expires_at
  FROM gift_cards g
  WHERE g.buyer_user_id = auth.uid() AND auth.uid() IS NOT NULL AND g.status IN ('active', 'refunded', 'pending_payment')
    AND (g.status <> 'pending_payment' OR g.created_at > NOW() - INTERVAL '1 day')
  ORDER BY g.created_at DESC
  LIMIT 50;
$$;
REVOKE ALL ON FUNCTION my_gift_cards() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION my_gift_cards() TO authenticated;

-- ── 2. Split the cost: each friend pays their share by a private link before the deadline ──
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_split_check;
ALTER TABLE bookings ADD  CONSTRAINT bookings_split_check CHECK (split_count BETWEEN 1 AND 6 AND (split_count = 1 OR split_deadline IS NOT NULL) AND NOT (split_count > 1 AND gift_cents > 0));

CREATE TABLE IF NOT EXISTS booking_shares (
  id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id                  UUID        NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  share_no                    INTEGER     NOT NULL CHECK (share_no BETWEEN 1 AND 6),
  amount_cents                INTEGER     NOT NULL CHECK (amount_cents >= 50),
  token                       UUID        NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  status                      TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'refunded')),
  payer_user_id               UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  payer_email                 TEXT        CHECK (payer_email IS NULL OR char_length(payer_email) <= 254),
  stripe_checkout_session_id  TEXT,
  stripe_payment_intent_id    TEXT,
  stripe_refund_id            TEXT,
  paid_at                     TIMESTAMPTZ,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (booking_id, share_no)
);
ALTER TABLE booking_shares ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON booking_shares FROM anon, authenticated;

-- The organiser's view: every share, with the payment link of the ones still open
CREATE OR REPLACE FUNCTION my_booking_shares(p_booking UUID)
RETURNS TABLE (share_no INTEGER, amount_cents INTEGER, status TEXT, token UUID, paid_at TIMESTAMPTZ, paid_by_me BOOLEAN)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.share_no, s.amount_cents, s.status, CASE WHEN s.status = 'pending' AND b.status = 'pending_payment' THEN s.token END, s.paid_at, s.payer_user_id = auth.uid()
  FROM booking_shares s JOIN bookings b ON b.id = s.booking_id
  WHERE s.booking_id = p_booking AND b.client_user_id = auth.uid() AND auth.uid() IS NOT NULL
  ORDER BY s.share_no;
$$;
REVOKE ALL ON FUNCTION my_booking_shares(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION my_booking_shares(UUID) TO authenticated;

-- What a friend sees on the payment link (no names of other payers, no contact details)
CREATE OR REPLACE FUNCTION share_info(p_token UUID)
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'share_no', s.share_no, 'count', b.split_count, 'amount_cents', s.amount_cents, 'status', s.status,
    'booking_status', b.status, 'package_name', b.package_name, 'shoot_date', b.shoot_date, 'time_slot', b.time_slot,
    'creator', split_part(coalesce(p.name, 'your creator'), ' ', 1), 'city', coalesce(b.shoot_city, p.city),
    'organiser', split_part(coalesce(b.client_name, ''), ' ', 1), 'deadline', b.split_deadline,
    'paid_count', (SELECT count(*) FROM booking_shares x WHERE x.booking_id = b.id AND x.status = 'paid'),
    'surprise', b.surprise)
  FROM booking_shares s JOIN bookings b ON b.id = s.booking_id LEFT JOIN photographers p ON p.id = b.photographer_id
  WHERE s.token = p_token;
$$;
REVOKE ALL ON FUNCTION share_info(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION share_info(UUID) TO anon, authenticated;

GRANT SELECT (gift_cents, split_count, split_deadline) ON bookings TO authenticated;

-- ################################################################
-- PART 14 — Shoot requests: a traveller describes the shoot they want,
-- creators in that city send offers, the traveller books the best one.
-- Safe to run more than once.
-- ################################################################

CREATE TABLE IF NOT EXISTS shoot_requests (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name   TEXT        NOT NULL CHECK (char_length(first_name) BETWEEN 1 AND 40),
  city         TEXT        NOT NULL CHECK (char_length(btrim(city)) BETWEEN 2 AND 120),
  date_from    DATE        NOT NULL,
  date_to      DATE        NOT NULL,
  service      TEXT        NOT NULL CHECK (service IN ('photo', 'video', 'phone', 'drone', 'guide', 'event')),
  people       INTEGER     NOT NULL DEFAULT 1 CHECK (people BETWEEN 1 AND 30),
  budget_eur   INTEGER     CHECK (budget_eur IS NULL OR budget_eur BETWEEN 20 AND 10000),
  note         TEXT        NOT NULL DEFAULT '' CHECK (char_length(note) <= 1000),
  status       TEXT        NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'booked')),
  notified_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT shoot_requests_dates CHECK (date_to >= date_from AND date_to - date_from <= 30)
);
CREATE INDEX IF NOT EXISTS idx_shoot_requests_open ON shoot_requests (status, date_to);
CREATE INDEX IF NOT EXISTS idx_shoot_requests_user ON shoot_requests (user_id, created_at DESC);
ALTER TABLE shoot_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON shoot_requests FROM anon, authenticated;     -- only through the functions below

CREATE TABLE IF NOT EXISTS request_offers (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id      UUID        NOT NULL REFERENCES shoot_requests(id) ON DELETE CASCADE,
  photographer_id UUID        NOT NULL REFERENCES photographers(id) ON DELETE CASCADE,
  creator_user_id UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  price_eur       INTEGER     NOT NULL CHECK (price_eur BETWEEN 20 AND 10000),
  shoot_date      DATE        NOT NULL,
  minutes         INTEGER     NOT NULL CHECK (minutes BETWEEN 15 AND 720),
  photos          INTEGER     CHECK (photos IS NULL OR photos BETWEEN 0 AND 2000),
  edit_days       INTEGER     CHECK (edit_days IS NULL OR edit_days BETWEEN 1 AND 60),
  message         TEXT        NOT NULL DEFAULT '' CHECK (char_length(message) <= 600),
  status          TEXT        NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'withdrawn', 'declined', 'accepted')),
  notified_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (request_id, photographer_id)
);
CREATE INDEX IF NOT EXISTS idx_request_offers_creator ON request_offers (creator_user_id, created_at DESC);
ALTER TABLE request_offers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON request_offers FROM anon, authenticated;

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS offer_id UUID REFERENCES request_offers(id) ON DELETE SET NULL;
GRANT SELECT (offer_id) ON bookings TO authenticated;

-- Is the creator in this city on this day? (home city, or the trip city on trip days)
CREATE OR REPLACE FUNCTION creator_in_city(p_city TEXT, p_trips JSONB, p_home TEXT, p_day DATE)
RETURNS BOOLEAN LANGUAGE sql IMMUTABLE AS $$
  SELECT city_key(coalesce(trip_on(p_trips, p_day)->>'city', p_home)) = city_key(p_city);
$$;

-- A traveller posts a request (max 3 open, max 8 a day)
CREATE OR REPLACE FUNCTION create_shoot_request(p_city TEXT, p_from DATE, p_to DATE, p_service TEXT, p_people INTEGER, p_budget INTEGER, p_note TEXT)
RETURNS UUID LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE uid UUID := auth.uid(); nm TEXT; c TEXT := regexp_replace(btrim(coalesce(p_city, '')), '\s+', ' ', 'g'); rid UUID;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Please sign in first.' USING ERRCODE = 'P0001'; END IF;
  IF char_length(c) < 2 OR char_length(c) > 120 THEN RAISE EXCEPTION 'Tell us the city.' USING ERRCODE = 'P0001'; END IF;
  IF p_from IS NULL OR p_to IS NULL OR p_from < CURRENT_DATE + 1 THEN RAISE EXCEPTION 'Choose dates from tomorrow on.' USING ERRCODE = 'P0001'; END IF;
  IF p_to < p_from OR p_to - p_from > 30 THEN RAISE EXCEPTION 'Choose up to 31 days.' USING ERRCODE = 'P0001'; END IF;
  IF p_to > CURRENT_DATE + 365 THEN RAISE EXCEPTION 'Choose dates within the next 12 months.' USING ERRCODE = 'P0001'; END IF;
  IF p_service IS NULL OR p_service NOT IN ('photo', 'video', 'phone', 'drone', 'guide', 'event') THEN RAISE EXCEPTION 'Choose what you need.' USING ERRCODE = 'P0001'; END IF;
  IF p_people IS NULL OR p_people < 1 OR p_people > 30 THEN RAISE EXCEPTION 'How many people? (1–30)' USING ERRCODE = 'P0001'; END IF;
  IF p_budget IS NOT NULL AND (p_budget < 20 OR p_budget > 10000) THEN RAISE EXCEPTION 'The budget can be from €20 to €10,000.' USING ERRCODE = 'P0001'; END IF;
  IF char_length(coalesce(p_note, '')) > 1000 THEN RAISE EXCEPTION 'The note can be up to 1000 characters.' USING ERRCODE = 'P0001'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('shoot_request:' || uid::text));
  IF (SELECT count(*) FROM shoot_requests WHERE user_id = uid AND status = 'open' AND date_to >= CURRENT_DATE) >= 3 THEN
    RAISE EXCEPTION 'You have 3 open requests. Close one to post another.' USING ERRCODE = 'P0001'; END IF;
  IF (SELECT count(*) FROM shoot_requests WHERE user_id = uid AND created_at > NOW() - INTERVAL '1 day') >= 8 THEN
    RAISE EXCEPTION 'Too many requests today. Please try again tomorrow.' USING ERRCODE = 'P0001'; END IF;
  SELECT coalesce(nullif(split_part(btrim(coalesce(raw_user_meta_data->>'full_name', '')), ' ', 1), ''), 'Traveller') INTO nm FROM auth.users WHERE id = uid;
  INSERT INTO shoot_requests (user_id, first_name, city, date_from, date_to, service, people, budget_eur, note)
  VALUES (uid, left(coalesce(nm, 'Traveller'), 40), c, p_from, p_to, p_service, p_people, p_budget, btrim(coalesce(p_note, '')))
  RETURNING id INTO rid;
  RETURN rid;
END $$;
REVOKE ALL ON FUNCTION create_shoot_request(TEXT, DATE, DATE, TEXT, INTEGER, INTEGER, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION create_shoot_request(TEXT, DATE, DATE, TEXT, INTEGER, INTEGER, TEXT) TO authenticated;

-- My requests, with the offers I got (and who sent them — public profile facts only)
CREATE OR REPLACE FUNCTION my_shoot_requests()
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(jsonb_agg(r ORDER BY r.created_at DESC), '[]'::jsonb) FROM (
    SELECT q.id, q.city, q.date_from, q.date_to, q.service, q.people, q.budget_eur, q.note, q.created_at,
      CASE WHEN q.status = 'open' AND q.date_to < CURRENT_DATE THEN 'closed' ELSE q.status END AS status,
      coalesce((SELECT jsonb_agg(jsonb_build_object(
          'id', o.id, 'price_eur', o.price_eur, 'shoot_date', o.shoot_date, 'minutes', o.minutes, 'photos', o.photos, 'edit_days', o.edit_days,
          'message', o.message, 'status', o.status, 'created_at', o.created_at,
          'creator', jsonb_build_object('id', p.id, 'name', p.name, 'city', p.city, 'handle', p.handle, 'cover_image_url', p.cover_image_url,
                                        'rating', p.rating, 'reviews_count', p.reviews_count, 'verified', p.verified))
        ORDER BY o.price_eur, o.created_at)
        FROM request_offers o JOIN photographers p ON p.id = o.photographer_id
        WHERE o.request_id = q.id AND o.status <> 'withdrawn'), '[]'::jsonb) AS offers
    FROM shoot_requests q
    WHERE q.user_id = auth.uid() AND auth.uid() IS NOT NULL AND q.created_at > NOW() - INTERVAL '120 days'
    ORDER BY q.created_at DESC LIMIT 30
  ) r;
$$;
REVOKE ALL ON FUNCTION my_shoot_requests() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION my_shoot_requests() TO authenticated;

CREATE OR REPLACE FUNCTION close_shoot_request(p_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE shoot_requests SET status = 'closed' WHERE id = p_id AND user_id = auth.uid() AND status = 'open';
  IF NOT FOUND THEN RAISE EXCEPTION 'This request is already closed.' USING ERRCODE = 'P0001'; END IF;
  UPDATE request_offers SET status = 'declined', updated_at = NOW() WHERE request_id = p_id AND status = 'open';
  RETURN TRUE;
END $$;
REVOKE ALL ON FUNCTION close_shoot_request(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION close_shoot_request(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION decline_offer(p_offer UUID)
RETURNS BOOLEAN LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE request_offers o SET status = 'declined', updated_at = NOW()
  FROM shoot_requests q WHERE o.id = p_offer AND q.id = o.request_id AND q.user_id = auth.uid() AND o.status = 'open';
  IF NOT FOUND THEN RAISE EXCEPTION 'This offer is no longer open.' USING ERRCODE = 'P0001'; END IF;
  RETURN TRUE;
END $$;
REVOKE ALL ON FUNCTION decline_offer(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION decline_offer(UUID) TO authenticated;

-- Creators: open requests where I am on those dates and that match my services (the traveller's first name only)
CREATE OR REPLACE FUNCTION requests_for_me()
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH me AS (
    SELECT p.id, p.city, p.trips, listing_services(p.services, p.type) AS svc FROM photographers p
    WHERE p.user_id = auth.uid() AND auth.uid() IS NOT NULL AND p.hidden IS NOT TRUE LIMIT 1
  )
  SELECT coalesce(jsonb_agg(x ORDER BY x.date_from, x.created_at), '[]'::jsonb) FROM (
    SELECT q.id, q.first_name, q.city, q.date_from, q.date_to, q.service, q.people, q.budget_eur, q.note, q.created_at,
      (SELECT count(*) FROM request_offers o WHERE o.request_id = q.id AND o.status IN ('open', 'accepted')) AS offers_count,
      (SELECT jsonb_build_object('id', o.id, 'price_eur', o.price_eur, 'shoot_date', o.shoot_date, 'minutes', o.minutes, 'photos', o.photos,
                                 'edit_days', o.edit_days, 'message', o.message, 'status', o.status)
         FROM request_offers o WHERE o.request_id = q.id AND o.photographer_id = me.id) AS my_offer
    FROM shoot_requests q, me
    WHERE q.status = 'open' AND q.date_to >= CURRENT_DATE + 1 AND q.user_id <> auth.uid()
      AND q.service = ANY(me.svc)
      AND EXISTS (SELECT 1 FROM generate_series(greatest(q.date_from, CURRENT_DATE + 1), q.date_to, INTERVAL '1 day') d
                  WHERE creator_in_city(q.city, me.trips, me.city, d::date))
    ORDER BY q.date_from LIMIT 100
  ) x;
$$;
REVOKE ALL ON FUNCTION requests_for_me() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION requests_for_me() TO authenticated;

-- A creator sends (or changes) an offer. One per request; the day must be free and they must be in that city.
CREATE OR REPLACE FUNCTION make_offer(p_request UUID, p_price INTEGER, p_date DATE, p_minutes INTEGER, p_photos INTEGER, p_edit_days INTEGER, p_message TEXT)
RETURNS UUID LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE uid UUID := auth.uid(); me photographers; q shoot_requests; o request_offers; oid UUID;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Please sign in first.' USING ERRCODE = 'P0001'; END IF;
  SELECT * INTO me FROM photographers WHERE user_id = uid LIMIT 1;
  IF me.id IS NULL OR me.hidden IS TRUE THEN RAISE EXCEPTION 'Create your listing first.' USING ERRCODE = 'P0001'; END IF;
  IF me.payouts_enabled IS NOT TRUE THEN RAISE EXCEPTION 'Connect payouts first, so travellers can book your offer.' USING ERRCODE = 'P0001'; END IF;
  SELECT * INTO q FROM shoot_requests WHERE id = p_request FOR SHARE;
  IF q.id IS NULL OR q.status <> 'open' OR q.date_to < CURRENT_DATE + 1 THEN RAISE EXCEPTION 'This request is no longer open.' USING ERRCODE = 'P0001'; END IF;
  IF q.user_id = uid THEN RAISE EXCEPTION 'That''s your own request.' USING ERRCODE = 'P0001'; END IF;
  IF NOT (q.service = ANY(listing_services(me.services, me.type))) THEN RAISE EXCEPTION 'This request is for a service you don''t offer.' USING ERRCODE = 'P0001'; END IF;
  IF p_price IS NULL OR p_price < 20 OR p_price > 10000 THEN RAISE EXCEPTION 'The price can be from €20 to €10,000.' USING ERRCODE = 'P0001'; END IF;
  IF p_minutes IS NULL OR p_minutes < 15 OR p_minutes > 720 THEN RAISE EXCEPTION 'The length can be from 15 minutes to 12 hours.' USING ERRCODE = 'P0001'; END IF;
  IF p_photos IS NOT NULL AND (p_photos < 0 OR p_photos > 2000) THEN RAISE EXCEPTION 'Up to 2000 photos.' USING ERRCODE = 'P0001'; END IF;
  IF p_edit_days IS NOT NULL AND (p_edit_days < 1 OR p_edit_days > 60) THEN RAISE EXCEPTION 'Photos can be promised within 1 to 60 days.' USING ERRCODE = 'P0001'; END IF;
  IF char_length(coalesce(p_message, '')) > 600 THEN RAISE EXCEPTION 'The message can be up to 600 characters.' USING ERRCODE = 'P0001'; END IF;
  IF p_date IS NULL OR p_date < greatest(q.date_from, CURRENT_DATE + 1) OR p_date > q.date_to THEN RAISE EXCEPTION 'Choose a day within the traveller''s dates.' USING ERRCODE = 'P0001'; END IF;
  IF NOT creator_in_city(q.city, me.trips, me.city, p_date) THEN RAISE EXCEPTION 'You aren''t in % on that day (check your trips).', split_part(q.city, ',', 1) USING ERRCODE = 'P0001'; END IF;
  IF p_date IN (SELECT creator_busy_dates(me.id)) THEN RAISE EXCEPTION 'You''re not available on that day.' USING ERRCODE = 'P0001'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('offer:' || uid::text));
  SELECT * INTO o FROM request_offers WHERE request_id = q.id AND photographer_id = me.id FOR UPDATE;
  IF o.id IS NULL THEN
    IF (SELECT count(*) FROM request_offers WHERE creator_user_id = uid AND created_at > NOW() - INTERVAL '1 day') >= 30 THEN
      RAISE EXCEPTION 'You''ve sent 30 offers today. Please try again tomorrow.' USING ERRCODE = 'P0001'; END IF;
    INSERT INTO request_offers (request_id, photographer_id, creator_user_id, price_eur, shoot_date, minutes, photos, edit_days, message)
    VALUES (q.id, me.id, uid, p_price, p_date, p_minutes, p_photos, p_edit_days, btrim(coalesce(p_message, ''))) RETURNING id INTO oid;
    RETURN oid;
  END IF;
  IF o.status IN ('declined', 'accepted') THEN RAISE EXCEPTION 'The traveller has already answered your offer.' USING ERRCODE = 'P0001'; END IF;
  UPDATE request_offers SET price_eur = p_price, shoot_date = p_date, minutes = p_minutes, photos = p_photos, edit_days = p_edit_days,
    message = btrim(coalesce(p_message, '')), status = 'open', notified_at = NULL, updated_at = NOW()
  WHERE id = o.id;
  RETURN o.id;
END $$;
REVOKE ALL ON FUNCTION make_offer(UUID, INTEGER, DATE, INTEGER, INTEGER, INTEGER, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION make_offer(UUID, INTEGER, DATE, INTEGER, INTEGER, INTEGER, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION withdraw_offer(p_offer UUID)
RETURNS BOOLEAN LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE request_offers SET status = 'withdrawn', updated_at = NOW() WHERE id = p_offer AND creator_user_id = auth.uid() AND status = 'open';
  IF NOT FOUND THEN RAISE EXCEPTION 'This offer is no longer open.' USING ERRCODE = 'P0001'; END IF;
  RETURN TRUE;
END $$;
REVOKE ALL ON FUNCTION withdraw_offer(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION withdraw_offer(UUID) TO authenticated;

-- Server only: creators to tell about a new request (visible, payouts on, the right service, in that city on one of the days)
CREATE OR REPLACE FUNCTION request_matches(p_request UUID)
RETURNS TABLE (photographer_id UUID, user_id UUID, email TEXT, name TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.user_id, p.email, p.name FROM photographers p, shoot_requests q
  WHERE q.id = p_request AND p.hidden IS NOT TRUE AND p.available IS NOT FALSE AND p.payouts_enabled IS TRUE
    AND p.user_id <> q.user_id AND p.email IS NOT NULL
    AND q.service = ANY(listing_services(p.services, p.type))
    AND EXISTS (SELECT 1 FROM generate_series(greatest(q.date_from, CURRENT_DATE + 1), q.date_to, INTERVAL '1 day') d
                WHERE creator_in_city(q.city, p.trips, p.city, d::date))
  ORDER BY p.featured DESC NULLS LAST, p.rating DESC NULLS LAST
  LIMIT 40;
$$;
REVOKE ALL ON FUNCTION request_matches(UUID) FROM PUBLIC, anon, authenticated;

-- ################################################################
-- PART 15 — Invite a creator: when the invited creator completes their first
-- booking, both get a free 7-day boost (max 10 rewarded invites per creator).
-- Safe to run more than once.
-- ################################################################

ALTER TABLE photographers ADD COLUMN IF NOT EXISTS invite_code         TEXT;
ALTER TABLE photographers ADD COLUMN IF NOT EXISTS invited_by          UUID REFERENCES photographers(id) ON DELETE SET NULL;
ALTER TABLE photographers ADD COLUMN IF NOT EXISTS invite_rewarded_at  TIMESTAMPTZ;
ALTER TABLE photographers DROP CONSTRAINT IF EXISTS photographers_invite_code_check;
ALTER TABLE photographers ADD  CONSTRAINT photographers_invite_code_check CHECK (invite_code IS NULL OR invite_code ~ '^[A-HJ-NP-Z2-9]{8}$');
CREATE UNIQUE INDEX IF NOT EXISTS photographers_invite_code_key ON photographers (invite_code) WHERE invite_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_photographers_invited_by ON photographers (invited_by) WHERE invited_by IS NOT NULL;
-- (no column grants: only the functions below set these)

CREATE TABLE IF NOT EXISTS invite_rewards (
  id             BIGSERIAL   PRIMARY KEY,
  inviter_id     UUID        REFERENCES photographers(id) ON DELETE SET NULL,
  invitee_id     UUID        NOT NULL UNIQUE REFERENCES photographers(id) ON DELETE CASCADE,
  booking_id     UUID        REFERENCES bookings(id) ON DELETE SET NULL,
  days           INTEGER     NOT NULL,
  inviter_boosted BOOLEAN    NOT NULL DEFAULT FALSE,
  emailed_at     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE invite_rewards ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON invite_rewards FROM anon, authenticated;

-- My invite link code (made on first use), and how my invites are going
CREATE OR REPLACE FUNCTION my_invite()
RETURNS JSONB LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE me photographers; c TEXT; i INTEGER := 0;
BEGIN
  SELECT * INTO me FROM photographers WHERE user_id = auth.uid() AND auth.uid() IS NOT NULL LIMIT 1 FOR UPDATE;
  IF me.id IS NULL THEN RAISE EXCEPTION 'Create your listing first.' USING ERRCODE = 'P0001'; END IF;
  c := me.invite_code;
  WHILE c IS NULL AND i < 10 LOOP
    -- 8 random symbols from the random bytes of a v4 UUID (bytes 6 and 8 carry the version, so they are skipped)
    c := (SELECT string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + (get_byte(b, n) % 32), 1), '' ORDER BY n)
          FROM (SELECT uuid_send(gen_random_uuid()) AS b) x, unnest(ARRAY[0, 1, 2, 3, 4, 5, 10, 11]) n);
    BEGIN
      UPDATE photographers SET invite_code = c WHERE id = me.id;
    EXCEPTION WHEN unique_violation THEN c := NULL;
    END;
    i := i + 1;
  END LOOP;
  RETURN jsonb_build_object(
    'code', c,
    'joined', (SELECT count(*) FROM photographers WHERE invited_by = me.id),
    'rewarded', (SELECT count(*) FROM invite_rewards WHERE inviter_id = me.id AND inviter_boosted),
    'max', 10, 'days', 7,
    'invited_by', (SELECT name FROM photographers WHERE id = me.invited_by),
    'my_reward', me.invite_rewarded_at IS NOT NULL);
END $$;
REVOKE ALL ON FUNCTION my_invite() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION my_invite() TO authenticated;

-- Who invited me? (public: the first name and city on the invite page, nothing else)
CREATE OR REPLACE FUNCTION invite_info(p_code TEXT)
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object('name', split_part(p.name, ' ', 1), 'city', split_part(p.city, ',', 1))
  FROM photographers p WHERE p.invite_code = upper(btrim(coalesce(p_code, ''))) AND p.hidden IS NOT TRUE;
$$;
REVOKE ALL ON FUNCTION invite_info(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION invite_info(TEXT) TO anon, authenticated;

-- A new creator says who invited them: once, within 14 days of creating the listing, never themselves
CREATE OR REPLACE FUNCTION claim_invite(p_code TEXT)
RETURNS TEXT LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE me photographers; inviter photographers;
BEGIN
  SELECT * INTO me FROM photographers WHERE user_id = auth.uid() AND auth.uid() IS NOT NULL LIMIT 1 FOR UPDATE;
  IF me.id IS NULL THEN RAISE EXCEPTION 'Create your listing first.' USING ERRCODE = 'P0001'; END IF;
  IF me.invited_by IS NOT NULL THEN RAISE EXCEPTION 'You already joined with an invite.' USING ERRCODE = 'P0001'; END IF;
  IF me.created_at < NOW() - INTERVAL '14 days' THEN RAISE EXCEPTION 'Invites are for new creators (within 14 days of joining).' USING ERRCODE = 'P0001'; END IF;
  IF EXISTS (SELECT 1 FROM bookings WHERE photographer_id = me.id AND status IN ('paid', 'confirmed', 'delivered', 'completed')) THEN
    RAISE EXCEPTION 'Invites are for creators before their first booking.' USING ERRCODE = 'P0001'; END IF;
  SELECT * INTO inviter FROM photographers WHERE invite_code = upper(btrim(coalesce(p_code, '')));
  IF inviter.id IS NULL OR inviter.hidden IS TRUE THEN RAISE EXCEPTION 'This invite link is not valid.' USING ERRCODE = 'P0001'; END IF;
  IF inviter.id = me.id OR inviter.user_id = me.user_id THEN RAISE EXCEPTION 'You can''t invite yourself.' USING ERRCODE = 'P0001'; END IF;
  IF inviter.invited_by = me.id THEN RAISE EXCEPTION 'You invited this creator — you can''t invite each other.' USING ERRCODE = 'P0001'; END IF;
  UPDATE photographers SET invited_by = inviter.id WHERE id = me.id;
  RETURN split_part(inviter.name, ' ', 1);
END $$;
REVOKE ALL ON FUNCTION claim_invite(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION claim_invite(TEXT) TO authenticated;

-- The reward: the invited creator's first completed booking → both get 7 days of boost (inviter: max 10 times)
CREATE OR REPLACE FUNCTION invite_reward_on_complete()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me photographers; inviter photographers; ok BOOLEAN := FALSE;
BEGIN
  IF NEW.status <> 'completed' OR OLD.status = 'completed' OR NEW.photographer_id IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO me FROM photographers WHERE id = NEW.photographer_id FOR UPDATE;
  IF me.id IS NULL OR me.invited_by IS NULL OR me.invite_rewarded_at IS NOT NULL THEN RETURN NEW; END IF;
  IF NEW.client_user_id = me.user_id THEN RETURN NEW; END IF;
  SELECT * INTO inviter FROM photographers WHERE id = me.invited_by FOR UPDATE;
  -- the inviter can't earn by booking their own invitee
  IF inviter.id IS NOT NULL AND NEW.client_user_id = inviter.user_id THEN RETURN NEW; END IF;
  UPDATE photographers SET invite_rewarded_at = NOW(), boosted_until = greatest(coalesce(boosted_until, NOW()), NOW()) + INTERVAL '7 days' WHERE id = me.id;
  IF inviter.id IS NOT NULL AND inviter.hidden IS NOT TRUE
     AND (SELECT count(*) FROM invite_rewards WHERE inviter_id = inviter.id AND inviter_boosted) < 10 THEN
    UPDATE photographers SET boosted_until = greatest(coalesce(boosted_until, NOW()), NOW()) + INTERVAL '7 days' WHERE id = inviter.id;
    ok := TRUE;
  END IF;
  INSERT INTO invite_rewards (inviter_id, invitee_id, booking_id, days, inviter_boosted) VALUES (inviter.id, me.id, NEW.id, 7, ok)
  ON CONFLICT (invitee_id) DO NOTHING;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS bookings_invite_reward ON bookings;
CREATE TRIGGER bookings_invite_reward AFTER UPDATE OF status ON bookings
  FOR EACH ROW EXECUTE FUNCTION invite_reward_on_complete();
REVOKE ALL ON FUNCTION invite_reward_on_complete() FROM PUBLIC, anon, authenticated;

-- ################################################################
-- PART 16 — Partners (hotels, hostels, guesthouses, tour desks): their guests
-- book through the partner's link or QR card and pay a lower service fee;
-- the partner gets a 3% thank-you of the package price for every completed
-- booking (paid out by CapturaGo, recorded here). Safe to run more than once.
-- ################################################################

CREATE TABLE IF NOT EXISTS partners (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  name          TEXT        NOT NULL CHECK (char_length(btrim(name)) BETWEEN 2 AND 100),
  kind          TEXT        NOT NULL CHECK (kind IN ('hotel', 'hostel', 'guesthouse', 'apartments', 'tours', 'other')),
  city          TEXT        NOT NULL CHECK (char_length(btrim(city)) BETWEEN 2 AND 120),
  website       TEXT        CHECK (website IS NULL OR (char_length(website) <= 300 AND website ~ '^https://[^\s<>"]+$')),
  contact_name  TEXT        NOT NULL CHECK (char_length(btrim(contact_name)) BETWEEN 2 AND 80),
  message       TEXT        NOT NULL DEFAULT '' CHECK (char_length(message) <= 1000),
  payout_note   TEXT        NOT NULL DEFAULT '' CHECK (char_length(payout_note) <= 300),   -- how they want the thank-you paid (IBAN etc.; private)
  status        TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'paused')),
  code          TEXT        UNIQUE CHECK (code IS NULL OR code ~ '^[A-Z0-9]{4,12}$'),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at   TIMESTAMPTZ
);
ALTER TABLE partners ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON partners FROM anon, authenticated;

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS partner_id UUID REFERENCES partners(id) ON DELETE SET NULL;
GRANT SELECT (partner_id) ON bookings TO authenticated;
CREATE INDEX IF NOT EXISTS idx_bookings_partner ON bookings (partner_id) WHERE partner_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS partner_earnings (
  id          BIGSERIAL   PRIMARY KEY,
  partner_id  UUID        NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  booking_id  UUID        NOT NULL UNIQUE REFERENCES bookings(id) ON DELETE CASCADE,
  amount_cents INTEGER    NOT NULL CHECK (amount_cents >= 0),
  status      TEXT        NOT NULL DEFAULT 'owed' CHECK (status IN ('owed', 'paid', 'void')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at     TIMESTAMPTZ
);
ALTER TABLE partner_earnings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON partner_earnings FROM anon, authenticated;

-- Apply (signed in; one application per account). A rejected application can be sent again after 30 days.
CREATE OR REPLACE FUNCTION apply_partner(p_name TEXT, p_kind TEXT, p_city TEXT, p_website TEXT, p_contact TEXT, p_message TEXT, p_payout TEXT)
RETURNS TEXT LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE uid UUID := auth.uid(); cur partners; w TEXT := nullif(btrim(coalesce(p_website, '')), '');
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Please sign in first.' USING ERRCODE = 'P0001'; END IF;
  IF char_length(btrim(coalesce(p_name, ''))) < 2 OR char_length(p_name) > 100 THEN RAISE EXCEPTION 'Tell us the name of your place.' USING ERRCODE = 'P0001'; END IF;
  IF p_kind IS NULL OR p_kind NOT IN ('hotel', 'hostel', 'guesthouse', 'apartments', 'tours', 'other') THEN RAISE EXCEPTION 'Choose what kind of place it is.' USING ERRCODE = 'P0001'; END IF;
  IF char_length(btrim(coalesce(p_city, ''))) < 2 OR char_length(p_city) > 120 THEN RAISE EXCEPTION 'Tell us the city.' USING ERRCODE = 'P0001'; END IF;
  IF w IS NOT NULL AND (char_length(w) > 300 OR w !~ '^https://[^\s<>"]+$') THEN RAISE EXCEPTION 'The website must start with https://' USING ERRCODE = 'P0001'; END IF;
  IF char_length(btrim(coalesce(p_contact, ''))) < 2 OR char_length(p_contact) > 80 THEN RAISE EXCEPTION 'Tell us your name.' USING ERRCODE = 'P0001'; END IF;
  IF char_length(coalesce(p_message, '')) > 1000 OR char_length(coalesce(p_payout, '')) > 300 THEN RAISE EXCEPTION 'Please keep it shorter.' USING ERRCODE = 'P0001'; END IF;
  SELECT * INTO cur FROM partners WHERE user_id = uid FOR UPDATE;
  IF cur.id IS NOT NULL THEN
    IF cur.status = 'rejected' AND cur.created_at < NOW() - INTERVAL '30 days' THEN
      UPDATE partners SET name = btrim(p_name), kind = p_kind, city = btrim(p_city), website = w, contact_name = btrim(p_contact), message = btrim(coalesce(p_message, '')),
        payout_note = btrim(coalesce(p_payout, '')), status = 'pending', created_at = NOW() WHERE id = cur.id;
      RETURN 'pending';
    END IF;
    IF cur.status = 'pending' THEN
      UPDATE partners SET name = btrim(p_name), kind = p_kind, city = btrim(p_city), website = w, contact_name = btrim(p_contact), message = btrim(coalesce(p_message, '')),
        payout_note = btrim(coalesce(p_payout, '')) WHERE id = cur.id;
      RETURN 'pending';
    END IF;
    IF cur.status = 'approved' THEN   -- approved partners can only change their payout details here
      UPDATE partners SET payout_note = btrim(coalesce(p_payout, '')) WHERE id = cur.id;
      RETURN 'approved';
    END IF;
    RAISE EXCEPTION 'Your application was not approved. You can apply again 30 days after it was sent.' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO partners (user_id, name, kind, city, website, contact_name, message, payout_note)
  VALUES (uid, btrim(p_name), p_kind, btrim(p_city), w, btrim(p_contact), btrim(coalesce(p_message, '')), btrim(coalesce(p_payout, '')));
  RETURN 'pending';
END $$;
REVOKE ALL ON FUNCTION apply_partner(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION apply_partner(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- My partner page: the application, the link code (once approved), bookings and thank-yous
CREATE OR REPLACE FUNCTION my_partner()
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'name', p.name, 'kind', p.kind, 'city', p.city, 'website', p.website, 'contact_name', p.contact_name, 'message', p.message,
    'payout_note', p.payout_note, 'status', p.status, 'code', CASE WHEN p.status = 'approved' THEN p.code END, 'created_at', p.created_at,
    'bookings', (SELECT count(*) FROM bookings b WHERE b.partner_id = p.id AND b.status IN ('paid', 'confirmed', 'delivered', 'completed')),
    'completed', (SELECT count(*) FROM bookings b WHERE b.partner_id = p.id AND b.status = 'completed'),
    'owed_cents', (SELECT coalesce(sum(amount_cents), 0) FROM partner_earnings e WHERE e.partner_id = p.id AND e.status = 'owed'),
    'paid_cents', (SELECT coalesce(sum(amount_cents), 0) FROM partner_earnings e WHERE e.partner_id = p.id AND e.status = 'paid'))
  FROM partners p WHERE p.user_id = auth.uid() AND auth.uid() IS NOT NULL;
$$;
REVOKE ALL ON FUNCTION my_partner() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION my_partner() TO authenticated;

-- Public: the partner's name on the welcome note ("Recommended by Hostel Zebra") — approved partners only
CREATE OR REPLACE FUNCTION partner_info(p_code TEXT)
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object('name', p.name, 'city', split_part(p.city, ',', 1))
  FROM partners p WHERE p.code = upper(btrim(coalesce(p_code, ''))) AND p.status = 'approved';
$$;
REVOKE ALL ON FUNCTION partner_info(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION partner_info(TEXT) TO anon, authenticated;

-- The thank-you: 3% of the package price when a partner's booking is completed (never for the partner's own bookings)
CREATE OR REPLACE FUNCTION partner_earning_on_complete()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pr partners;
BEGIN
  IF NEW.partner_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
    SELECT * INTO pr FROM partners WHERE id = NEW.partner_id;
    IF pr.id IS NULL OR pr.status <> 'approved' OR pr.user_id = NEW.client_user_id OR pr.user_id = NEW.creator_user_id THEN RETURN NEW; END IF;
    INSERT INTO partner_earnings (partner_id, booking_id, amount_cents) VALUES (pr.id, NEW.id, round(NEW.price_cents * 0.03)::INTEGER)
    ON CONFLICT (booking_id) DO NOTHING;
  ELSIF NEW.status = 'refunded' AND OLD.status IS DISTINCT FROM 'refunded' THEN   -- refunded later by support → no thank-you (if not paid yet)
    UPDATE partner_earnings SET status = 'void' WHERE booking_id = NEW.id AND status = 'owed';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS bookings_partner_earning ON bookings;
CREATE TRIGGER bookings_partner_earning AFTER UPDATE OF status ON bookings
  FOR EACH ROW EXECUTE FUNCTION partner_earning_on_complete();
REVOKE ALL ON FUNCTION partner_earning_on_complete() FROM PUBLIC, anon, authenticated;

-- ================================================================
-- PART 17 — Your language for emails and text messages: the language you
-- chose on the website or in the app (English, German, Spanish, French)
-- is saved on your account, so our emails come in that language too.
-- ================================================================
ALTER TABLE email_prefs ADD COLUMN IF NOT EXISTS lang TEXT NOT NULL DEFAULT 'en';
DO $$ BEGIN
  ALTER TABLE email_prefs ADD CONSTRAINT email_prefs_lang_check CHECK (lang IN ('en', 'de', 'es', 'fr'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE OR REPLACE FUNCTION my_email_prefs()
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object('tips', coalesce((SELECT tips FROM email_prefs WHERE user_id = auth.uid()), true),
                            'lang', coalesce((SELECT lang FROM email_prefs WHERE user_id = auth.uid()), 'en'));
$$;
REVOKE ALL ON FUNCTION my_email_prefs() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION my_email_prefs() TO authenticated;

CREATE OR REPLACE FUNCTION set_my_language(p_lang TEXT)
RETURNS TEXT LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Please sign in.' USING ERRCODE = '42501'; END IF;
  IF p_lang IS NULL OR p_lang NOT IN ('en', 'de', 'es', 'fr') THEN RAISE EXCEPTION 'Choose English, Deutsch, Español or Français.' USING ERRCODE = '22023'; END IF;
  INSERT INTO email_prefs (user_id, lang) VALUES (auth.uid(), p_lang)
  ON CONFLICT (user_id) DO UPDATE SET lang = EXCLUDED.lang, updated_at = NOW();
  RETURN p_lang;
END $$;
REVOKE ALL ON FUNCTION set_my_language(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION set_my_language(TEXT) TO authenticated;

-- For the server (emails): the language of an account, found by its id or else its email address
CREATE OR REPLACE FUNCTION email_lang(p_user UUID, p_email TEXT)
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(
    (SELECT lang FROM email_prefs WHERE user_id = p_user),
    (SELECT ep.lang FROM auth.users u JOIN email_prefs ep ON ep.user_id = u.id
      WHERE p_user IS NULL AND p_email IS NOT NULL AND lower(u.email) = lower(btrim(p_email)) LIMIT 1),
    (SELECT ep.lang FROM photographers ph JOIN email_prefs ep ON ep.user_id = ph.user_id
      WHERE p_user IS NULL AND p_email IS NOT NULL AND lower(ph.email) = lower(btrim(p_email)) LIMIT 1),
    'en');
$$;
REVOKE ALL ON FUNCTION email_lang(UUID, TEXT) FROM PUBLIC, anon, authenticated;

-- ================================================================
-- PART 18 — Last-minute deals: a creator marks a free day tomorrow or the
-- day after at a lower price (10–50 % off in-person packages). Travellers
-- who are in that city (open requests, city followers, travellers with a
-- booking there these days) get one email. Safe to run more than once.
-- ================================================================
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS deal_pct SMALLINT;
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_deal_pct_check;
ALTER TABLE bookings ADD  CONSTRAINT bookings_deal_pct_check CHECK (deal_pct IS NULL OR deal_pct BETWEEN 10 AND 50);
GRANT SELECT (deal_pct) ON bookings TO authenticated;

CREATE TABLE IF NOT EXISTS last_minute_deals (
  photographer_id  UUID        NOT NULL REFERENCES photographers(id) ON DELETE CASCADE,
  day              DATE        NOT NULL,
  pct              SMALLINT    NOT NULL CHECK (pct BETWEEN 10 AND 50),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  removed_at       TIMESTAMPTZ,                 -- taken back by the creator (kept, so travellers aren't emailed twice)
  notified_at      TIMESTAMPTZ,                 -- travellers in the city were emailed (once per creator and day)
  PRIMARY KEY (photographer_id, day)
);
CREATE INDEX IF NOT EXISTS idx_last_minute_day ON last_minute_deals (day) WHERE removed_at IS NULL;
ALTER TABLE last_minute_deals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON last_minute_deals FROM anon, authenticated;   -- read and changed only through the functions below

-- One deal email per traveller per day, whoever sends it
CREATE TABLE IF NOT EXISTS deal_emails (
  user_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sent_on   DATE NOT NULL DEFAULT CURRENT_DATE,
  PRIMARY KEY (user_id, sent_on)
);
ALTER TABLE deal_emails ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON deal_emails FROM anon, authenticated;

-- Is a day free for new bookings with this creator? (days off, busy in their calendar, fully booked)
CREATE OR REPLACE FUNCTION creator_day_free(p_photographer UUID, p_day DATE)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM photographers p
    WHERE p.id = p_photographer
      AND NOT (p_day = ANY(coalesce(p.unavailable_dates, '{}'::DATE[])))
      AND NOT (p_day = ANY(coalesce(p.external_busy_dates, '{}'::DATE[])))
      AND (SELECT count(*) FROM bookings b
            WHERE b.photographer_id = p.id AND b.shoot_date = p_day AND b.booking_type = 'session'
              AND (b.status IN ('paid', 'confirmed')
                   OR (b.status = 'pending_payment' AND (b.created_at > NOW() - INTERVAL '30 minutes' OR b.split_deadline > NOW()))))
          < least(greatest(coalesce(p.max_per_day, 1), 1), 6));
$$;
REVOKE ALL ON FUNCTION creator_day_free(UUID, DATE) FROM PUBLIC, anon, authenticated;

-- The two days a deal can be on: tomorrow and the day after (bookings start tomorrow)
CREATE OR REPLACE FUNCTION my_last_minute()
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE p photographers; out JSONB := '[]'::JSONB; d DATE; r last_minute_deals; free BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Please sign in.' USING ERRCODE = '42501'; END IF;
  SELECT * INTO p FROM photographers WHERE user_id = auth.uid() ORDER BY created_at LIMIT 1;
  IF p.id IS NULL THEN RETURN out; END IF;
  FOR d IN SELECT generate_series(CURRENT_DATE + 1, CURRENT_DATE + 2, INTERVAL '1 day')::DATE LOOP
    SELECT * INTO r FROM last_minute_deals WHERE photographer_id = p.id AND day = d AND removed_at IS NULL;
    free := creator_day_free(p.id, d);
    out := out || jsonb_build_object('day', d, 'pct', r.pct, 'free', free, 'notified', r.notified_at IS NOT NULL);
  END LOOP;
  RETURN out;
END $$;
REVOKE ALL ON FUNCTION my_last_minute() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION my_last_minute() TO authenticated;

CREATE OR REPLACE FUNCTION set_last_minute(p_day DATE, p_pct INTEGER)
RETURNS JSONB LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE p photographers;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Please sign in.' USING ERRCODE = '42501'; END IF;
  SELECT * INTO p FROM photographers WHERE user_id = auth.uid() ORDER BY created_at LIMIT 1;
  IF p.id IS NULL THEN RAISE EXCEPTION 'Create your listing first.' USING ERRCODE = 'P0001'; END IF;
  IF p.hidden IS TRUE OR p.available IS FALSE THEN RAISE EXCEPTION 'Show your listing as available first.' USING ERRCODE = 'P0001'; END IF;
  IF p.payouts_enabled IS NOT TRUE THEN RAISE EXCEPTION 'Set up payouts first — last-minute deals are for online bookings.' USING ERRCODE = 'P0001'; END IF;
  IF p_day IS NULL OR p_day < CURRENT_DATE + 1 OR p_day > CURRENT_DATE + 2 THEN RAISE EXCEPTION 'Last-minute deals are for tomorrow and the day after.' USING ERRCODE = 'P0001'; END IF;
  IF p_pct IS NULL OR p_pct < 10 OR p_pct > 50 THEN RAISE EXCEPTION 'Choose a discount from 10 to 50 %%.' USING ERRCODE = 'P0001'; END IF;
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p.packages) = 'array' THEN p.packages ELSE '[]'::JSONB END) k
                 WHERE coalesce(k->>'type', 'session') <> 'delivery' AND (k->>'price_eur') ~ '^[0-9]+(\.[0-9]+)?$' AND (k->>'price_eur')::NUMERIC >= 10) THEN
    RAISE EXCEPTION 'Add an in-person package with a price first.' USING ERRCODE = 'P0001'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('deal:' || p.id::text));
  IF NOT creator_day_free(p.id, p_day) THEN RAISE EXCEPTION 'That day isn''t free — it''s a day off, busy in your calendar or fully booked.' USING ERRCODE = 'P0001'; END IF;
  INSERT INTO last_minute_deals (photographer_id, day, pct) VALUES (p.id, p_day, p_pct)
  ON CONFLICT (photographer_id, day) DO UPDATE SET pct = EXCLUDED.pct, removed_at = NULL, updated_at = NOW();
  RETURN my_last_minute();
END $$;
REVOKE ALL ON FUNCTION set_last_minute(DATE, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION set_last_minute(DATE, INTEGER) TO authenticated;

CREATE OR REPLACE FUNCTION remove_last_minute(p_day DATE)
RETURNS JSONB LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Please sign in.' USING ERRCODE = '42501'; END IF;
  UPDATE last_minute_deals SET removed_at = NOW(), updated_at = NOW()
   WHERE day = p_day AND removed_at IS NULL AND photographer_id IN (SELECT id FROM photographers WHERE user_id = auth.uid());
  RETURN my_last_minute();
END $$;
REVOKE ALL ON FUNCTION remove_last_minute(DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION remove_last_minute(DATE) TO authenticated;

-- Public: the deals travellers can book right now (visible, bookable listings; free days only)
CREATE OR REPLACE FUNCTION active_deals()
RETURNS TABLE (photographer_id UUID, day DATE, pct SMALLINT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT d.photographer_id, d.day, d.pct FROM last_minute_deals d JOIN photographers p ON p.id = d.photographer_id
  WHERE d.removed_at IS NULL AND d.day BETWEEN CURRENT_DATE + 1 AND CURRENT_DATE + 2
    AND p.hidden IS NOT TRUE AND p.available IS NOT FALSE AND p.payouts_enabled IS TRUE
    AND creator_day_free(d.photographer_id, d.day)
  ORDER BY d.day, d.pct DESC
  LIMIT 500;
$$;
REVOKE ALL ON FUNCTION active_deals() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION active_deals() TO anon, authenticated;

-- For the server (checkout): the discount on a creator's day, if the deal is live
CREATE OR REPLACE FUNCTION deal_pct_for(p_photographer UUID, p_day DATE)
RETURNS INTEGER LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT d.pct::INTEGER FROM last_minute_deals d
  WHERE d.photographer_id = p_photographer AND d.day = p_day AND d.removed_at IS NULL
    AND d.day BETWEEN CURRENT_DATE + 1 AND CURRENT_DATE + 2;
$$;
REVOKE ALL ON FUNCTION deal_pct_for(UUID, DATE) FROM PUBLIC, anon, authenticated;

-- For the server (hourly job): who to tell about a deal — travellers in the creator's city that day
-- (open request covering the day, following the city, or a booking there within 3 days), not the creator,
-- not people who turned off tips, and nobody who already got a deal email today.
CREATE OR REPLACE FUNCTION deal_recipients(p_photographer UUID, p_day DATE)
RETURNS TABLE (user_id UUID, email TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH p AS (SELECT * FROM photographers WHERE id = p_photographer),
  place AS (SELECT city_key(coalesce(trip_on(p.trips, p_day)->>'city', p.city)) AS ck FROM p),
  who AS (
    SELECT q.user_id FROM shoot_requests q, p
     WHERE q.status = 'open' AND p_day BETWEEN q.date_from AND q.date_to
       AND city_key(q.city) = (SELECT ck FROM place) AND q.service = ANY(listing_services(p.services, p.type))
    UNION
    SELECT a.user_id FROM city_alerts a, p
     WHERE a.city_key = (SELECT ck FROM place) AND (a.service IS NULL OR a.service = ANY(listing_services(p.services, p.type)))
    UNION
    SELECT b.client_user_id FROM bookings b
      LEFT JOIN photographers bp ON bp.id = b.photographer_id
     WHERE b.client_user_id IS NOT NULL AND b.status IN ('paid', 'confirmed', 'completed')
       AND b.booking_type = 'session' AND b.shoot_date BETWEEN p_day - 3 AND p_day + 3
       AND city_key(coalesce(b.shoot_city, bp.city)) = (SELECT ck FROM place)
  )
  SELECT DISTINCT u.id, u.email FROM who JOIN auth.users u ON u.id = who.user_id, p
  WHERE (SELECT ck FROM place) IS NOT NULL AND u.id <> p.user_id AND coalesce(u.email, '') <> ''
    AND NOT EXISTS (SELECT 1 FROM email_prefs e WHERE e.user_id = u.id AND e.tips IS FALSE)
    AND NOT EXISTS (SELECT 1 FROM deal_emails x WHERE x.user_id = u.id AND x.sent_on = CURRENT_DATE)
  LIMIT 300;
$$;
REVOKE ALL ON FUNCTION deal_recipients(UUID, DATE) FROM PUBLIC, anon, authenticated;

-- For the server: count this traveller's one deal email for today (false = already had one)
CREATE OR REPLACE FUNCTION claim_deal_email(p_user UUID)
RETURNS BOOLEAN LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO deal_emails (user_id, sent_on) VALUES (p_user, CURRENT_DATE) ON CONFLICT DO NOTHING;
  RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION claim_deal_email(UUID) FROM PUBLIC, anon, authenticated;

-- ================================================================
-- PART 19 — Text reminders on the shoot day (SMS or WhatsApp): a verified
-- phone number, given with consent, gets the meeting point and time on the
-- day of a shoot. Codes and messages are sent by the "phone" function and
-- the hourly job (Twilio); keys stay in Supabase secrets. Safe to run more than once.
-- ================================================================
CREATE TABLE IF NOT EXISTS phone_numbers (
  user_id          UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone            TEXT        NOT NULL CHECK (phone ~ '^\+[1-9][0-9]{6,14}$'),
  channel          TEXT        NOT NULL DEFAULT 'sms' CHECK (channel IN ('sms', 'whatsapp')),
  reminders        BOOLEAN     NOT NULL DEFAULT TRUE,
  verified_at      TIMESTAMPTZ,
  consent_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  code_hash        TEXT        CHECK (code_hash IS NULL OR code_hash ~ '^[0-9a-f]{64}$'),
  code_expires_at  TIMESTAMPTZ,
  code_attempts    SMALLINT    NOT NULL DEFAULT 0,
  texts_on         DATE,
  texts_sent       SMALLINT    NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE phone_numbers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON phone_numbers FROM anon, authenticated;   -- only through the functions below

-- Every code sent (rate limits per account and per number; kept 2 days)
CREATE TABLE IF NOT EXISTS phone_code_log (
  id          BIGSERIAL   PRIMARY KEY,
  user_id     UUID        REFERENCES auth.users(id) ON DELETE CASCADE,
  phone       TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_phone_code_log_user ON phone_code_log (user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_phone_code_log_phone ON phone_code_log (phone, created_at);
ALTER TABLE phone_code_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON phone_code_log FROM anon, authenticated;

-- My number (the full number is shown only to its owner)
CREATE OR REPLACE FUNCTION my_phone()
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN p.user_id IS NULL THEN NULL ELSE jsonb_build_object(
    'phone', p.phone, 'channel', p.channel, 'reminders', p.reminders, 'verified', p.verified_at IS NOT NULL,
    'pending', p.verified_at IS NULL AND p.code_expires_at > NOW()) END
  FROM (SELECT auth.uid() AS uid) me LEFT JOIN phone_numbers p ON p.user_id = me.uid;
$$;
REVOKE ALL ON FUNCTION my_phone() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION my_phone() TO authenticated;

CREATE OR REPLACE FUNCTION set_phone_prefs(p_reminders BOOLEAN, p_channel TEXT)
RETURNS JSONB LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Please sign in.' USING ERRCODE = '42501'; END IF;
  IF p_channel IS NOT NULL AND p_channel NOT IN ('sms', 'whatsapp') THEN RAISE EXCEPTION 'Choose SMS or WhatsApp.' USING ERRCODE = 'P0001'; END IF;
  UPDATE phone_numbers SET reminders = coalesce(p_reminders, reminders), channel = coalesce(p_channel, channel), updated_at = NOW()
   WHERE user_id = auth.uid() AND verified_at IS NOT NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Add and confirm your number first.' USING ERRCODE = 'P0001'; END IF;
  RETURN my_phone();
END $$;
REVOKE ALL ON FUNCTION set_phone_prefs(BOOLEAN, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION set_phone_prefs(BOOLEAN, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION remove_my_phone()
RETURNS BOOLEAN LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Please sign in.' USING ERRCODE = '42501'; END IF;
  DELETE FROM phone_numbers WHERE user_id = auth.uid();
  RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION remove_my_phone() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION remove_my_phone() TO authenticated;

-- For the server ("phone" function): store a new code for this account and number, within the limits
-- (one a minute, 5 a day per account, 8 a day per number). Returns 'ok' or the reason it can't.
CREATE OR REPLACE FUNCTION phone_code_start(p_user UUID, p_phone TEXT, p_channel TEXT, p_code_hash TEXT)
RETURNS TEXT LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE cur phone_numbers;
BEGIN
  IF p_user IS NULL OR p_phone IS NULL OR p_phone !~ '^\+[1-9][0-9]{6,14}$' THEN RETURN 'invalid'; END IF;
  IF p_code_hash IS NULL OR p_code_hash !~ '^[0-9a-f]{64}$' THEN RETURN 'invalid'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('phone:' || p_user::text));
  IF EXISTS (SELECT 1 FROM phone_code_log WHERE user_id = p_user AND created_at > NOW() - INTERVAL '60 seconds') THEN RETURN 'wait'; END IF;
  IF (SELECT count(*) FROM phone_code_log WHERE user_id = p_user AND created_at > NOW() - INTERVAL '1 day') >= 5 THEN RETURN 'limit'; END IF;
  IF (SELECT count(*) FROM phone_code_log WHERE phone = p_phone AND created_at > NOW() - INTERVAL '1 day') >= 8 THEN RETURN 'limit'; END IF;
  SELECT * INTO cur FROM phone_numbers WHERE user_id = p_user;
  INSERT INTO phone_code_log (user_id, phone) VALUES (p_user, p_phone);
  INSERT INTO phone_numbers (user_id, phone, channel, code_hash, code_expires_at, code_attempts, consent_at)
  VALUES (p_user, p_phone, coalesce(p_channel, 'sms'), p_code_hash, NOW() + INTERVAL '10 minutes', 0, NOW())
  ON CONFLICT (user_id) DO UPDATE SET
    phone = EXCLUDED.phone, channel = EXCLUDED.channel, code_hash = EXCLUDED.code_hash, code_expires_at = EXCLUDED.code_expires_at,
    code_attempts = 0, consent_at = NOW(), updated_at = NOW(),
    verified_at = CASE WHEN phone_numbers.phone = EXCLUDED.phone THEN phone_numbers.verified_at ELSE NULL END;
  RETURN 'ok';
END $$;
REVOKE ALL ON FUNCTION phone_code_start(UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;

-- For the server: check a code (5 tries, 10 minutes). 'ok' | 'wrong' | 'expired' | 'tries' | 'none'
CREATE OR REPLACE FUNCTION phone_code_check(p_user UUID, p_code_hash TEXT)
RETURNS TEXT LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE cur phone_numbers;
BEGIN
  SELECT * INTO cur FROM phone_numbers WHERE user_id = p_user FOR UPDATE;
  IF cur.user_id IS NULL OR cur.code_hash IS NULL THEN RETURN 'none'; END IF;
  IF cur.code_expires_at < NOW() THEN RETURN 'expired'; END IF;
  IF cur.code_attempts >= 5 THEN RETURN 'tries'; END IF;
  IF p_code_hash IS DISTINCT FROM cur.code_hash THEN
    UPDATE phone_numbers SET code_attempts = code_attempts + 1 WHERE user_id = p_user;
    RETURN CASE WHEN cur.code_attempts + 1 >= 5 THEN 'tries' ELSE 'wrong' END;
  END IF;
  UPDATE phone_numbers SET verified_at = NOW(), code_hash = NULL, code_expires_at = NULL, code_attempts = 0, reminders = TRUE, updated_at = NOW()
   WHERE user_id = p_user;
  RETURN 'ok';
END $$;
REVOKE ALL ON FUNCTION phone_code_check(UUID, TEXT) FROM PUBLIC, anon, authenticated;

-- For the server (hourly job): count a text (max 4 a day per number — protects against loops and cost)
CREATE OR REPLACE FUNCTION claim_text(p_user UUID)
RETURNS BOOLEAN LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE phone_numbers SET texts_sent = CASE WHEN texts_on = CURRENT_DATE THEN texts_sent + 1 ELSE 1 END, texts_on = CURRENT_DATE
   WHERE user_id = p_user AND verified_at IS NOT NULL AND reminders
     AND (texts_on IS DISTINCT FROM CURRENT_DATE OR texts_sent < 4);
  RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION claim_text(UUID) FROM PUBLIC, anon, authenticated;

-- ================================================================
-- Done. You should see "Success. No rows returned."
-- ================================================================
