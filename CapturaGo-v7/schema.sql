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
