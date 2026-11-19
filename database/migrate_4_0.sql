-- TrackSphere migration 4.0 — safe to run on an existing database (preserves data)

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Users: roles
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(40) NOT NULL DEFAULT 'Staff';
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('Admin', 'Staff', 'Approver'));

UPDATE users SET role = 'Admin' WHERE email = 'admin@tracksphere.demo' AND role = 'Staff';

-- Assets: valuation + QR + photo + vendor/serial (keep rfid_tag_id for legacy compatibility)
ALTER TABLE assets ADD COLUMN IF NOT EXISTS purchase_cost NUMERIC(14,2);
ALTER TABLE assets ADD COLUMN IF NOT EXISTS purchase_date DATE;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS residual_value NUMERIC(14,2) DEFAULT 0;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS useful_life_years NUMERIC(8,2);
ALTER TABLE assets ADD COLUMN IF NOT EXISTS vendor VARCHAR(200);
ALTER TABLE assets ADD COLUMN IF NOT EXISTS serial_number VARCHAR(120);
ALTER TABLE assets ADD COLUMN IF NOT EXISTS qr_token UUID DEFAULT gen_random_uuid();
ALTER TABLE assets ADD COLUMN IF NOT EXISTS photo_path VARCHAR(500);
ALTER TABLE assets ADD COLUMN IF NOT EXISTS last_handover_at TIMESTAMPTZ;

UPDATE assets SET qr_token = gen_random_uuid() WHERE qr_token IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_assets_qr_token ON assets(qr_token);

-- Make rfid_tag_id optional for new QR-first assets (drop NOT NULL if present)
DO $$
BEGIN
  ALTER TABLE assets ALTER COLUMN rfid_tag_id DROP NOT NULL;
EXCEPTION WHEN others THEN
  NULL;
END $$;

-- Employees (handover recipients — no login)
CREATE TABLE IF NOT EXISTS employees (
  id          SERIAL PRIMARY KEY,
  employee_code VARCHAR(50) NOT NULL UNIQUE,
  full_name   VARCHAR(200) NOT NULL,
  email       VARCHAR(255) NOT NULL,
  department  VARCHAR(120) NOT NULL,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Allocations: link to employees + acting users
ALTER TABLE allocations ADD COLUMN IF NOT EXISTS employee_id INTEGER REFERENCES employees(id);
ALTER TABLE allocations ADD COLUMN IF NOT EXISTS allocated_by_user_id INTEGER REFERENCES users(id);
ALTER TABLE allocations ADD COLUMN IF NOT EXISTS returned_by_user_id INTEGER REFERENCES users(id);

-- Activity history
CREATE TABLE IF NOT EXISTS activity_logs (
  id          SERIAL PRIMARY KEY,
  actor_user_id INTEGER REFERENCES users(id),
  actor_name  VARCHAR(200),
  action      VARCHAR(80) NOT NULL,
  entity_type VARCHAR(80) NOT NULL,
  entity_id   INTEGER,
  asset_id    INTEGER REFERENCES assets(id) ON DELETE SET NULL,
  summary     TEXT NOT NULL,
  details     JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_asset ON activity_logs(asset_id);

-- Device health check-ins (laptop health agent)
CREATE TABLE IF NOT EXISTS device_checkins (
  id              SERIAL PRIMARY KEY,
  device_id       VARCHAR(120) NOT NULL,
  checked_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cpu_percent     NUMERIC(6,2),
  memory_percent  NUMERIC(6,2),
  battery_percent NUMERIC(6,2),
  battery_health  VARCHAR(40),
  is_demo         BOOLEAN NOT NULL DEFAULT FALSE,
  raw_meta        JSONB
);
CREATE INDEX IF NOT EXISTS idx_device_checkins_device ON device_checkins(device_id, checked_at DESC);

-- Transfer / retirement: store acting user ids when available
ALTER TABLE transfers ADD COLUMN IF NOT EXISTS requested_by_user_id INTEGER REFERENCES users(id);
ALTER TABLE transfers ADD COLUMN IF NOT EXISTS reviewed_by_user_id INTEGER REFERENCES users(id);
ALTER TABLE retirements ADD COLUMN IF NOT EXISTS requested_by_user_id INTEGER REFERENCES users(id);
ALTER TABLE retirements ADD COLUMN IF NOT EXISTS reviewed_by_user_id INTEGER REFERENCES users(id);

-- Demo employees (fictional)
INSERT INTO employees (employee_code, full_name, email, department) VALUES
  ('EMP-001', 'Priya Sharma', 'priya.sharma@demo.tracksphere.local', 'Engineering'),
  ('EMP-002', 'Aman Verma', 'aman.verma@demo.tracksphere.local', 'Operations'),
  ('EMP-003', 'Neha Patel', 'neha.patel@demo.tracksphere.local', 'Finance'),
  ('EMP-004', 'Rohan Mehta', 'rohan.mehta@demo.tracksphere.local', 'IT Support'),
  ('EMP-005', 'Sara Khan', 'sara.khan@demo.tracksphere.local', 'HR')
ON CONFLICT (employee_code) DO NOTHING;

-- Demo role users (password Demo@123 for all)
INSERT INTO users (email, password_hash, display_name, role) VALUES
  (
    'staff@tracksphere.demo',
    '$2a$10$ASQkFRER4W1YizH7V41TNOKKgJZj9ZimQBW8bJ08Jf5FmdfYGqd4O',
    'Demo Staff',
    'Staff'
  ),
  (
    'approver@tracksphere.demo',
    '$2a$10$uh2jMCh3/lJt8jBGyuTm.OGDnP2kWtpohYAMxCt0hM0zw2.RuCE4e',
    'Demo Approver',
    'Approver'
  )
ON CONFLICT (email) DO NOTHING;

UPDATE users SET role = 'Admin', display_name = COALESCE(display_name, 'TrackSphere Admin')
WHERE email = 'admin@tracksphere.demo';

-- Backfill valuation demo numbers for existing assets (only where null)
UPDATE assets SET
  purchase_cost = COALESCE(purchase_cost, 45000),
  purchase_date = COALESCE(purchase_date, CURRENT_DATE - INTERVAL '18 months'),
  residual_value = COALESCE(residual_value, 5000),
  useful_life_years = COALESCE(useful_life_years, 4),
  vendor = COALESCE(vendor, 'Demo Vendor Pvt Ltd'),
  serial_number = COALESCE(serial_number, 'SN-' || asset_code)
WHERE purchase_cost IS NULL;

-- Link demo allocation for AST-1001 to employee if possible
UPDATE allocations al
SET employee_id = e.id
FROM employees e, assets a
WHERE al.asset_id = a.id
  AND a.asset_code = 'AST-1001'
  AND al.status = 'allocated'
  AND e.employee_code = 'EMP-001'
  AND al.employee_id IS NULL;
