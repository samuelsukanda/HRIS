-- HRIS schema — mirror src/lib/types.ts (PRD §61)
CREATE TABLE IF NOT EXISTS branches (
  id   TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  city TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS departments (
  id        TEXT PRIMARY KEY,
  name      TEXT NOT NULL,
  branch_id TEXT NOT NULL REFERENCES branches(id)
);

CREATE TABLE IF NOT EXISTS positions (
  id    TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  level TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS work_locations (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  branch_id     TEXT NOT NULL REFERENCES branches(id),
  latitude      DOUBLE PRECISION NOT NULL,
  longitude     DOUBLE PRECISION NOT NULL,
  radius_m      INTEGER NOT NULL,
  allowed_types TEXT[] NOT NULL DEFAULT '{onsite}'
);

CREATE TABLE IF NOT EXISTS employees (
  id                TEXT PRIMARY KEY,
  nik               TEXT NOT NULL,
  name              TEXT NOT NULL,
  gender            TEXT NOT NULL,
  birth_place       TEXT NOT NULL,
  birth_date        TEXT NOT NULL,
  address           TEXT NOT NULL,
  phone             TEXT NOT NULL,
  email             TEXT NOT NULL,
  join_date         TEXT NOT NULL,
  department_id     TEXT NOT NULL REFERENCES departments(id),
  position_id       TEXT NOT NULL REFERENCES positions(id),
  manager_id        TEXT REFERENCES employees(id),
  branch_id         TEXT NOT NULL REFERENCES branches(id),
  work_location_id  TEXT NOT NULL REFERENCES work_locations(id),
  employment_type   TEXT NOT NULL,
  status            TEXT NOT NULL,
  bank_name         TEXT NOT NULL,
  bank_account      TEXT NOT NULL,
  emergency_contact JSONB NOT NULL,
  face_registered   BOOLEAN NOT NULL DEFAULT false,
  face_descriptor   JSONB,
  base_salary       INTEGER NOT NULL DEFAULT 5000000,
  allowance         INTEGER NOT NULL DEFAULT 750000
);

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  employee_id   TEXT NOT NULL REFERENCES employees(id),
  email         TEXT NOT NULL UNIQUE,
  role          TEXT NOT NULL,
  password_hash TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS shifts (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  start_time       TEXT NOT NULL,
  end_time         TEXT NOT NULL,
  grace_minutes    INTEGER NOT NULL,
  crosses_midnight BOOLEAN NOT NULL
);

CREATE TABLE IF NOT EXISTS roster (
  employee_id TEXT NOT NULL REFERENCES employees(id),
  date        DATE NOT NULL,
  shift_id    TEXT REFERENCES shifts(id),
  PRIMARY KEY (employee_id, date)
);

CREATE TABLE IF NOT EXISTS attendance (
  id                  TEXT PRIMARY KEY,
  employee_id         TEXT NOT NULL REFERENCES employees(id),
  date                DATE NOT NULL,
  check_in_at         TIMESTAMPTZ,
  check_out_at        TIMESTAMPTZ,
  check_in_snap       JSONB,
  check_out_snap      JSONB,
  status              TEXT NOT NULL,
  risk_score          INTEGER NOT NULL DEFAULT 0,
  verification_status TEXT NOT NULL DEFAULT 'pending',
  rejection_reason    TEXT,
  corrections         JSONB NOT NULL DEFAULT '[]'
);
CREATE INDEX IF NOT EXISTS idx_attendance_emp_date ON attendance(employee_id, date);

CREATE TABLE IF NOT EXISTS leave_types (
  id                  TEXT PRIMARY KEY,
  name                TEXT NOT NULL,
  allocation_days     INTEGER NOT NULL,
  paid                BOOLEAN NOT NULL,
  requires_attachment BOOLEAN NOT NULL
);

CREATE TABLE IF NOT EXISTS leave_requests (
  id           TEXT PRIMARY KEY,
  employee_id  TEXT NOT NULL REFERENCES employees(id),
  type_id      TEXT NOT NULL REFERENCES leave_types(id),
  start_date   DATE NOT NULL,
  end_date     DATE NOT NULL,
  days         INTEGER NOT NULL,
  reason       TEXT NOT NULL,
  status       TEXT NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL,
  decided_by   TEXT,
  decided_at   TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS overtime_requests (
  id           TEXT PRIMARY KEY,
  employee_id  TEXT NOT NULL REFERENCES employees(id),
  date         DATE NOT NULL,
  start_time   TEXT NOT NULL,
  end_time     TEXT NOT NULL,
  hours        NUMERIC(4,1) NOT NULL,
  reason       TEXT NOT NULL,
  status       TEXT NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL,
  decided_by   TEXT
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id          TEXT PRIMARY KEY,
  actor_id    TEXT NOT NULL,
  actor_name  TEXT NOT NULL,
  action      TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id   TEXT NOT NULL,
  detail      TEXT NOT NULL,
  before      TEXT,
  after       TEXT,
  at          TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS announcements (
  id       TEXT PRIMARY KEY,
  title    TEXT NOT NULL,
  body     TEXT NOT NULL,
  category TEXT NOT NULL,
  date     DATE NOT NULL
);

-- Fase D: payroll
CREATE TABLE IF NOT EXISTS payroll_runs (
  id         TEXT PRIMARY KEY,
  period     TEXT NOT NULL UNIQUE, -- YYYY-MM
  status     TEXT NOT NULL DEFAULT 'draft', -- draft | approved
  created_at TIMESTAMPTZ NOT NULL,
  approved_at TIMESTAMPTZ,
  approved_by TEXT
);

CREATE TABLE IF NOT EXISTS payslips (
  id          TEXT PRIMARY KEY,
  run_id      TEXT NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
  employee_id TEXT NOT NULL REFERENCES employees(id),
  breakdown   JSONB NOT NULL,
  UNIQUE (run_id, employee_id)
);

-- Phase 3-4 modules

CREATE TABLE IF NOT EXISTS reimbursements (
  id           TEXT PRIMARY KEY,
  employee_id  TEXT NOT NULL REFERENCES employees(id),
  category     TEXT NOT NULL,
  amount       INTEGER NOT NULL,
  description  TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending',
  submitted_at TIMESTAMPTZ NOT NULL,
  approvals    JSONB NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS job_postings (
  id             TEXT PRIMARY KEY,
  title          TEXT NOT NULL,
  department_id  TEXT NOT NULL REFERENCES departments(id),
  description    TEXT NOT NULL,
  requirements   TEXT NOT NULL,
  salary_range   TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'open',
  created_at     TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS candidates (
  id              TEXT PRIMARY KEY,
  job_posting_id  TEXT NOT NULL REFERENCES job_postings(id),
  name            TEXT NOT NULL,
  email           TEXT NOT NULL,
  phone           TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'applied',
  applied_at      TIMESTAMPTZ NOT NULL,
  notes           TEXT
);

CREATE TABLE IF NOT EXISTS trainings (
  id                TEXT PRIMARY KEY,
  title             TEXT NOT NULL,
  provider          TEXT NOT NULL,
  description       TEXT NOT NULL,
  start_date        DATE NOT NULL,
  end_date          DATE NOT NULL,
  max_participants  INTEGER NOT NULL,
  status            TEXT NOT NULL DEFAULT 'upcoming'
);

CREATE TABLE IF NOT EXISTS training_enrollments (
  id           TEXT PRIMARY KEY,
  training_id  TEXT NOT NULL REFERENCES trainings(id),
  employee_id  TEXT NOT NULL REFERENCES employees(id),
  status       TEXT NOT NULL DEFAULT 'enrolled',
  enrolled_at  TIMESTAMPTZ NOT NULL,
  UNIQUE (training_id, employee_id)
);

CREATE TABLE IF NOT EXISTS assets (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  category       TEXT NOT NULL,
  serial_number  TEXT NOT NULL,
  purchase_date  DATE NOT NULL,
  status         TEXT NOT NULL DEFAULT 'available'
);
ALTER TABLE assets ADD COLUMN IF NOT EXISTS brand TEXT;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS model TEXT;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS purchase_price INTEGER;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS notes TEXT;

CREATE TABLE IF NOT EXISTS asset_assignments (
  id           TEXT PRIMARY KEY,
  asset_id     TEXT NOT NULL REFERENCES assets(id),
  employee_id  TEXT NOT NULL REFERENCES employees(id),
  assigned_at  TIMESTAMPTZ NOT NULL,
  returned_at  TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS performance_reviews (
  id           TEXT PRIMARY KEY,
  employee_id  TEXT NOT NULL REFERENCES employees(id),
  reviewer_id  TEXT NOT NULL REFERENCES employees(id),
  period        TEXT NOT NULL,
  score        INTEGER NOT NULL,
  strengths    TEXT NOT NULL,
  improvements TEXT NOT NULL,
  goals        TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'draft',
  created_at   TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS shift_swaps (
  id              TEXT PRIMARY KEY,
  employee_id     TEXT NOT NULL REFERENCES employees(id),
  date            DATE NOT NULL,
  from_shift_id   TEXT REFERENCES shifts(id),
  target_shift_id TEXT REFERENCES shifts(id),
  reason          TEXT NOT NULL DEFAULT '',
  status          TEXT NOT NULL DEFAULT 'pending',
  decided_by      TEXT,
  created_at      TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
INSERT INTO settings (key, value, updated_at) VALUES
  ('wfh_gps', 'TIDAK DIWAJIBKAN', NOW()),
  ('wfh_face', 'WAJIB', NOW()),
  ('wfh_liveness', 'WAJIB', NOW())
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS asset_requests (
  id           TEXT PRIMARY KEY,
  employee_id  TEXT NOT NULL REFERENCES employees(id),
  category     TEXT NOT NULL,
  description  TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending',
  decided_by   TEXT,
  created_at   TIMESTAMPTZ NOT NULL
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS attachment_url TEXT;
ALTER TABLE reimbursements ADD COLUMN IF NOT EXISTS attachment_url TEXT;

CREATE TABLE IF NOT EXISTS notifications (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id),
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,
  type       TEXT NOT NULL,
  read       BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL,
  link       TEXT
);
