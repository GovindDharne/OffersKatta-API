-- ============================================================
-- Phase 8 — PostGIS geo column + auto-sync triggers + GIST indexes
--
-- Runs idempotently after `prisma db push` in the migration service.
-- Why a trigger instead of a generated column:
--   * Prisma still owns lat/lng. The geog column is invisible to Prisma
--     (declared as Unsupported), so writing through the Prisma client just
--     updates latitude/longitude — the trigger does the rest.
--   * Generated columns can't be updated by application code at all and
--     have stricter immutability rules around the function used.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS postgis;

-- ─── Columns ─────────────────────────────────────────────────
-- Created defensively with IF NOT EXISTS so this script is the single source
-- of truth for the geog infrastructure regardless of how the table was built
-- (Prisma `db push` from the Unsupported field in dev/uat, or `migrate deploy`
-- in prod where the column may not be in the migration history yet).
ALTER TABLE business_branches ADD COLUMN IF NOT EXISTS geog geography(Point, 4326);
ALTER TABLE users             ADD COLUMN IF NOT EXISTS geog geography(Point, 4326);
ALTER TABLE malls             ADD COLUMN IF NOT EXISTS geog geography(Point, 4326);

-- ─── Shared trigger function ──────────────────────────────────
-- Recomputes geog from latitude/longitude. Handles NULLs (some rows in
-- `users` have no location yet — leave geog NULL in that case).
CREATE OR REPLACE FUNCTION offerhub_sync_geog() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.latitude IS NULL OR NEW.longitude IS NULL THEN
    NEW.geog := NULL;
  ELSE
    NEW.geog := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
  END IF;
  RETURN NEW;
END;
$$;

-- ─── BusinessBranch ──────────────────────────────────────────
DROP TRIGGER IF EXISTS business_branches_geog_sync ON business_branches;
CREATE TRIGGER business_branches_geog_sync
  BEFORE INSERT OR UPDATE OF latitude, longitude
  ON business_branches
  FOR EACH ROW EXECUTE FUNCTION offerhub_sync_geog();

UPDATE business_branches
SET geog = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
WHERE geog IS NULL AND latitude IS NOT NULL AND longitude IS NOT NULL;

CREATE INDEX IF NOT EXISTS business_branches_geog_gix
  ON business_branches USING GIST (geog);

-- ─── Users (customer locations) ──────────────────────────────
DROP TRIGGER IF EXISTS users_geog_sync ON users;
CREATE TRIGGER users_geog_sync
  BEFORE INSERT OR UPDATE OF latitude, longitude
  ON users
  FOR EACH ROW EXECUTE FUNCTION offerhub_sync_geog();

UPDATE users
SET geog = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
WHERE geog IS NULL AND latitude IS NOT NULL AND longitude IS NOT NULL;

CREATE INDEX IF NOT EXISTS users_geog_gix
  ON users USING GIST (geog);

-- ─── Malls ───────────────────────────────────────────────────
DROP TRIGGER IF EXISTS malls_geog_sync ON malls;
CREATE TRIGGER malls_geog_sync
  BEFORE INSERT OR UPDATE OF latitude, longitude
  ON malls
  FOR EACH ROW EXECUTE FUNCTION offerhub_sync_geog();

UPDATE malls
SET geog = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
WHERE geog IS NULL AND latitude IS NOT NULL AND longitude IS NOT NULL;

CREATE INDEX IF NOT EXISTS malls_geog_gix
  ON malls USING GIST (geog);
