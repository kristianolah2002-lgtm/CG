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
ALTER TABLE photographers ADD COLUMN IF NOT EXISTS occasions         TEXT[]      DEFAULT '{}';
ALTER TABLE photographers ADD COLUMN IF NOT EXISTS drone_certified   BOOLEAN     DEFAULT FALSE;

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
              packages, payouts_enabled, boosted_until,
              occasions, drone_certified)
  ON photographers TO anon, authenticated;

-- Creators may write their packages — but never payouts_enabled,
-- boosted_until or stripe_account_id (only the server sets those).
REVOKE INSERT, UPDATE ON photographers FROM anon, authenticated;
GRANT INSERT (user_id, name, city, coords, email, languages, type, services,
              vibes, specialties, level, description, tags, local_spots,
              portfolio_url, cover_image_url, price, available,
              travel_available, packages, occasions, drone_certified)
  ON photographers TO authenticated;
GRANT UPDATE (name, city, coords, email, languages, type, services,
              vibes, specialties, level, description, tags, local_spots,
              portfolio_url, cover_image_url, price, available,
              travel_available, packages, occasions, drone_certified)
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
