-- ================================================================
-- CapturaGo — Categories patch (new creator types, vibes, occasions)
-- Run in Supabase → SQL Editor AFTER schema.sql, security-patch.sql
-- and payments-patch.sql. Safe to run more than once. Never deletes data.
--
-- Adds:
--  1. occasions        — "Who is it for?" tags (proposal, headshots, …)
--  2. drone_certified  — creator confirmed they hold the drone certificate
--  3. Rules: a listing can only offer drone shoots with that confirmation,
--     and tag lists can't be stuffed with hundreds of values
-- New services (phone, event, drone) and vibes need no database change:
-- they are stored in the existing services / vibes columns.
-- ================================================================

-- ── 1. New listing columns ─────────────────────────────────────
ALTER TABLE photographers ADD COLUMN IF NOT EXISTS occasions       TEXT[]  DEFAULT '{}';
ALTER TABLE photographers ADD COLUMN IF NOT EXISTS drone_certified BOOLEAN DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_photo_occasions ON photographers USING gin(occasions);

-- ── 2. Rules ───────────────────────────────────────────────────
DO $$ BEGIN
  ALTER TABLE photographers ADD CONSTRAINT drone_needs_certificate
    CHECK (NOT ('drone' = ANY(coalesce(services, '{}'))) OR coalesce(drone_certified, FALSE)) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE photographers ADD CONSTRAINT tag_list_sizes
    CHECK (coalesce(cardinality(services), 0)  <= 12
       AND coalesce(cardinality(vibes), 0)     <= 20
       AND coalesce(cardinality(occasions), 0) <= 20) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 3. Column permissions (same as before + the two new columns) ─
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

-- Creators may write these columns — never payouts_enabled, boosted_until,
-- stripe_account_id, rating, verified or featured.
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

-- ================================================================
-- Done. You should see "Success. No rows returned."
-- ================================================================
