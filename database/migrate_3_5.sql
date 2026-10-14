-- TrackSphere Phase 3.5 — run against an existing DB
-- docker exec -i tracksphere-db psql -U tracksphere -d tracksphere < database/migrate_3_5.sql

ALTER TABLE assets DROP CONSTRAINT IF EXISTS assets_status_check;
ALTER TABLE assets
  ADD CONSTRAINT assets_status_check
  CHECK (status IN ('available', 'in_use', 'maintenance', 'missing', 'retired'));

CREATE TABLE IF NOT EXISTS allocations (
  id            SERIAL PRIMARY KEY,
  asset_id      INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  assigned_to   VARCHAR(200) NOT NULL,
  allocated_by  VARCHAR(200) NOT NULL,
  return_by     DATE,
  notes         TEXT,
  status        VARCHAR(40) NOT NULL DEFAULT 'allocated'
                CHECK (status IN ('allocated', 'returned')),
  allocated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  returned_at   TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS transfers (
  id             SERIAL PRIMARY KEY,
  asset_id       INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  from_location  VARCHAR(200) NOT NULL,
  to_location    VARCHAR(200) NOT NULL,
  requested_by   VARCHAR(200) NOT NULL,
  notes          TEXT,
  status         VARCHAR(40) NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'approved', 'rejected')),
  review_comment TEXT,
  reviewed_by    VARCHAR(200),
  reviewed_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS retirements (
  id               SERIAL PRIMARY KEY,
  asset_id         INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  retirement_type  VARCHAR(40) NOT NULL
                   CHECK (retirement_type IN ('scrap', 'sale', 'donate')),
  reason           TEXT NOT NULL,
  requested_by     VARCHAR(200) NOT NULL,
  notes            TEXT,
  status           VARCHAR(40) NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'retired', 'rejected')),
  review_comment   TEXT,
  reviewed_by      VARCHAR(200),
  reviewed_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_allocations_asset ON allocations(asset_id);
CREATE INDEX IF NOT EXISTS idx_allocations_status ON allocations(status);
CREATE INDEX IF NOT EXISTS idx_transfers_status ON transfers(status);
CREATE INDEX IF NOT EXISTS idx_retirements_status ON retirements(status);

-- Seed sample lifecycle rows if empty (uses existing assets by code)
INSERT INTO allocations (asset_id, assigned_to, allocated_by, return_by, notes, status, allocated_at)
SELECT a.id, 'Priya Sharma', 'TrackSphere Admin', CURRENT_DATE + 30, 'Demo allocation for laptop', 'allocated', NOW() - INTERVAL '2 days'
FROM assets a
WHERE a.asset_code = 'AST-1001'
  AND NOT EXISTS (SELECT 1 FROM allocations LIMIT 1);

INSERT INTO transfers (asset_id, from_location, to_location, requested_by, notes, status, created_at)
SELECT a.id, a.location, 'Building A — Floor 3', 'TrackSphere Admin', 'Demo pending transfer', 'pending', NOW() - INTERVAL '1 day'
FROM assets a
WHERE a.asset_code = 'AST-1003'
  AND NOT EXISTS (SELECT 1 FROM transfers LIMIT 1);

INSERT INTO retirements (asset_id, retirement_type, reason, requested_by, status, created_at)
SELECT a.id, 'scrap', 'Projector no longer serviceable — demo retirement', 'TrackSphere Admin', 'pending', NOW() - INTERVAL '6 hours'
FROM assets a
WHERE a.asset_code = 'AST-1004'
  AND NOT EXISTS (SELECT 1 FROM retirements LIMIT 1);
