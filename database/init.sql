-- TrackSphere — schema + fictional seed data (local demo only)

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  display_name  VARCHAR(120) NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS assets (
  id              SERIAL PRIMARY KEY,
  asset_code      VARCHAR(50) NOT NULL UNIQUE,
  name            VARCHAR(200) NOT NULL,
  category        VARCHAR(100) NOT NULL,
  location        VARCHAR(200) NOT NULL,
  rfid_tag_id     VARCHAR(100) NOT NULL UNIQUE,
  status          VARCHAR(40) NOT NULL DEFAULT 'available'
                  CHECK (status IN ('available', 'in_use', 'maintenance', 'missing', 'retired')),
  last_scanned_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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

CREATE TABLE IF NOT EXISTS tracking_events (
  id          SERIAL PRIMARY KEY,
  asset_id    INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  rfid_tag_id VARCHAR(100) NOT NULL,
  location    VARCHAR(200) NOT NULL,
  scanned_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source      VARCHAR(80) NOT NULL DEFAULT 'rfid_simulation',
  notes       TEXT
);

CREATE TABLE IF NOT EXISTS edge_agents (
  id             SERIAL PRIMARY KEY,
  agent_code     VARCHAR(50) NOT NULL UNIQUE,
  display_name   VARCHAR(120) NOT NULL,
  location       VARCHAR(200) NOT NULL,
  status         VARCHAR(40) NOT NULL DEFAULT 'online'
                 CHECK (status IN ('online', 'offline', 'degraded')),
  last_heartbeat TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assets_status ON assets(status);
CREATE INDEX IF NOT EXISTS idx_assets_rfid ON assets(rfid_tag_id);
CREATE INDEX IF NOT EXISTS idx_tracking_asset ON tracking_events(asset_id);
CREATE INDEX IF NOT EXISTS idx_tracking_scanned_at ON tracking_events(scanned_at DESC);
CREATE INDEX IF NOT EXISTS idx_allocations_asset ON allocations(asset_id);
CREATE INDEX IF NOT EXISTS idx_allocations_status ON allocations(status);
CREATE INDEX IF NOT EXISTS idx_transfers_status ON transfers(status);
CREATE INDEX IF NOT EXISTS idx_retirements_status ON retirements(status);

-- Demo login: admin@tracksphere.demo / Demo@123
INSERT INTO users (email, password_hash, display_name) VALUES
  (
    'admin@tracksphere.demo',
    '$2a$10$zsy8vDe73nnmcEyUB7lwY.zq1yJlsRhXj4qHanfyoch6Qf0gPcoui',
    'TrackSphere Admin'
  )
ON CONFLICT (email) DO NOTHING;

INSERT INTO edge_agents (agent_code, display_name, location, status, last_heartbeat) VALUES
  ('EDGE-LAB-01', 'Lab Entrance Agent', 'Building A — Lab Lobby', 'online', NOW() - INTERVAL '2 minutes'),
  ('EDGE-WH-02', 'Warehouse Dock Agent', 'Building B — Dock 2', 'online', NOW() - INTERVAL '5 minutes'),
  ('EDGE-OFF-03', 'Office Floor Agent', 'Building A — Floor 3', 'degraded', NOW() - INTERVAL '45 minutes')
ON CONFLICT (agent_code) DO NOTHING;

INSERT INTO assets (asset_code, name, category, location, rfid_tag_id, status, last_scanned_at) VALUES
  ('AST-1001', 'Dell Latitude 5540', 'Laptop', 'Building A — Floor 3', 'RFID-TAG-1001', 'in_use', NOW() - INTERVAL '1 day'),
  ('AST-1002', 'HP EliteDesk 800', 'Desktop', 'Building A — Lab Lobby', 'RFID-TAG-1002', 'available', NOW() - INTERVAL '3 hours'),
  ('AST-1003', 'Cisco Catalyst 2960', 'Network', 'Building B — Dock 2', 'RFID-TAG-1003', 'available', NOW() - INTERVAL '2 days'),
  ('AST-1004', 'Epson Projector EB-X06', 'AV Equipment', 'Building A — Conference Room', 'RFID-TAG-1004', 'maintenance', NOW() - INTERVAL '10 days'),
  ('AST-1005', 'iPad Pro 11"', 'Tablet', 'Unknown', 'RFID-TAG-1005', 'missing', NOW() - INTERVAL '30 days'),
  ('AST-1006', 'Lenovo ThinkPad T14', 'Laptop', 'Building A — Floor 3', 'RFID-TAG-1006', 'in_use', NOW() - INTERVAL '6 hours'),
  ('AST-1007', 'Brother HL-L2350DW', 'Printer', 'Building B — Dock 2', 'RFID-TAG-1007', 'available', NOW() - INTERVAL '12 hours'),
  ('AST-1008', 'Handheld Barcode Scanner', 'Peripheral', 'Building A — Lab Lobby', 'RFID-TAG-1008', 'available', NOW() - INTERVAL '4 days')
ON CONFLICT (asset_code) DO NOTHING;

INSERT INTO tracking_events (asset_id, rfid_tag_id, location, scanned_at, source, notes)
SELECT a.id, a.rfid_tag_id, a.location, a.last_scanned_at, 'rfid_simulation', 'Seeded demo event'
FROM assets a
WHERE a.last_scanned_at IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM tracking_events t WHERE t.asset_id = a.id
  );

INSERT INTO allocations (asset_id, assigned_to, allocated_by, return_by, notes, status, allocated_at)
SELECT a.id, 'Priya Sharma', 'TrackSphere Admin', CURRENT_DATE + 30, 'Demo allocation for laptop', 'allocated', NOW() - INTERVAL '2 days'
FROM assets a
WHERE a.asset_code = 'AST-1001';

INSERT INTO transfers (asset_id, from_location, to_location, requested_by, notes, status, created_at)
SELECT a.id, a.location, 'Building A — Floor 3', 'TrackSphere Admin', 'Demo pending transfer', 'pending', NOW() - INTERVAL '1 day'
FROM assets a
WHERE a.asset_code = 'AST-1003';

INSERT INTO retirements (asset_id, retirement_type, reason, requested_by, status, created_at)
SELECT a.id, 'scrap', 'Projector no longer serviceable — demo retirement', 'TrackSphere Admin', 'pending', NOW() - INTERVAL '6 hours'
FROM assets a
WHERE a.asset_code = 'AST-1004';
