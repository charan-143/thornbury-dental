-- Thornbury Dental, initial schema (PostgreSQL).
--
-- Doctor-facing only: patients exist as clinical records, but they have no
-- accounts and no way to sign in. Every table holding health information
-- carries patient_id so authorisation can be enforced on the row.
--
-- Timestamps are TIMESTAMPTZ rather than text. Appointment times are the whole
-- point of the product, and a practice whose clocks shift twice a year cannot
-- store them as naive local strings.

CREATE TABLE IF NOT EXISTS schema_migrations (
  version    TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- --------------------------------------------------------------------------
-- staff and access
-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS clinicians (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  credentials TEXT NOT NULL DEFAULT '',
  specialty   TEXT NOT NULL DEFAULT '',
  room        TEXT NOT NULL DEFAULT '',
  photo       TEXT,
  bio         TEXT,
  active      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS accounts (
  id                  TEXT PRIMARY KEY,
  email               TEXT NOT NULL UNIQUE,
  role                TEXT NOT NULL CHECK (role IN ('clinician', 'admin')),
  clinician_id        TEXT NOT NULL REFERENCES clinicians(id) ON DELETE RESTRICT,
  password_hash       TEXT NOT NULL,
  password_salt       TEXT NOT NULL,
  kdf                 TEXT NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  password_changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  failed_attempts     INTEGER NOT NULL DEFAULT 0,
  locked_until        TIMESTAMPTZ,
  last_sign_in_at     TIMESTAMPTZ,
  disabled_at         TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_accounts_clinician ON accounts(clinician_id);

-- The cookie carries a random token; only its digest is stored, so a database
-- disclosure does not hand over live sessions.
CREATE TABLE IF NOT EXISTS sessions (
  id           TEXT PRIMARY KEY,
  account_id   TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  token_hash   TEXT NOT NULL UNIQUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at   TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at   TIMESTAMPTZ,
  user_agent   TEXT
);
CREATE INDEX IF NOT EXISTS idx_sessions_account ON sessions(account_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at) WHERE revoked_at IS NULL;

-- Colleagues are invited rather than self-registering. The token digest is
-- stored, never the token.
CREATE TABLE IF NOT EXISTS invites (
  id           TEXT PRIMARY KEY,
  email        TEXT NOT NULL,
  role         TEXT NOT NULL CHECK (role IN ('clinician', 'admin')),
  -- The clinician profile is created up front, so the invitee has a record to
  -- attach to and colleagues can see them on the roster before they accept.
  clinician_id TEXT NOT NULL REFERENCES clinicians(id) ON DELETE CASCADE,
  token_hash   TEXT NOT NULL UNIQUE,
  invited_by  TEXT REFERENCES accounts(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  revoked_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_invites_email ON invites(lower(email));

CREATE TABLE IF NOT EXISTS password_resets (
  code_hash  TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS auth_throttle (
  key       TEXT PRIMARY KEY,
  hits      INTEGER NOT NULL DEFAULT 0,
  window_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- --------------------------------------------------------------------------
-- clinical records
-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS patients (
  id                  TEXT PRIMARY KEY,
  mrn                 TEXT NOT NULL UNIQUE,
  op_no               TEXT,
  name                TEXT NOT NULL,
  dob                 DATE NOT NULL,
  phone               TEXT,
  email               TEXT,
  address             TEXT,
  medical_history     TEXT,
  family_history      TEXT,
  past_dental_history TEXT,
  photo               TEXT,
  last_visit          DATE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_patients_name ON patients(lower(name));

CREATE TABLE IF NOT EXISTS allergies (
  id         TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  substance  TEXT NOT NULL,
  reaction   TEXT NOT NULL,
  severity   TEXT NOT NULL CHECK (severity IN ('mild', 'moderate', 'severe'))
);
CREATE INDEX IF NOT EXISTS idx_allergies_patient ON allergies(patient_id);

CREATE TABLE IF NOT EXISTS conditions (
  id         TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  label      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_conditions_patient ON conditions(patient_id);

CREATE TABLE IF NOT EXISTS dental_chart (
  id         TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  tooth_num  INTEGER NOT NULL CHECK (tooth_num >= 1 AND tooth_num <= 32),
  condition  TEXT NOT NULL DEFAULT 'sound',
  notes      TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(patient_id, tooth_num)
);
CREATE INDEX IF NOT EXISTS idx_dental_chart_patient ON dental_chart(patient_id);

CREATE TABLE IF NOT EXISTS appointments (
  id           TEXT PRIMARY KEY,
  patient_id   TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  clinician_id TEXT NOT NULL REFERENCES clinicians(id),
  starts_at    TIMESTAMPTZ NOT NULL,
  duration_min INTEGER NOT NULL CHECK (duration_min > 0 AND duration_min <= 480),
  type         TEXT NOT NULL,
  status       TEXT NOT NULL CHECK (status IN ('confirmed', 'completed', 'cancelled')),
  room         TEXT NOT NULL DEFAULT '',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_appt_patient ON appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appt_clinician_day ON appointments(clinician_id, starts_at);

-- A published plan is immutable. Corrections become addenda, so what the
-- patient was originally told stays recoverable.
CREATE TABLE IF NOT EXISTS plans (
  id           TEXT PRIMARY KEY,
  patient_id   TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  clinician_id TEXT NOT NULL REFERENCES clinicians(id),
  procedure    TEXT NOT NULL,
  phase        TEXT NOT NULL CHECK (phase IN ('pre', 'post')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at TIMESTAMPTZ,
  locked_at    TIMESTAMPTZ,
  CONSTRAINT published_implies_locked CHECK (
    (published_at IS NULL AND locked_at IS NULL) OR
    (published_at IS NOT NULL AND locked_at IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS idx_plans_patient ON plans(patient_id);

CREATE TABLE IF NOT EXISTS plan_steps (
  id      TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  ordinal INTEGER NOT NULL,
  title   TEXT NOT NULL,
  detail  TEXT NOT NULL DEFAULT '',
  UNIQUE (plan_id, ordinal)
);

CREATE TABLE IF NOT EXISTS plan_addenda (
  id         TEXT PRIMARY KEY,
  plan_id    TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  author_id  TEXT NOT NULL REFERENCES clinicians(id),
  body       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS prescriptions (
  id              TEXT PRIMARY KEY,
  patient_id      TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  clinician_id    TEXT NOT NULL REFERENCES clinicians(id),
  drug            TEXT NOT NULL,
  form            TEXT NOT NULL,
  dose            TEXT NOT NULL,
  route           TEXT NOT NULL,
  frequency       TEXT NOT NULL,
  duration_days   INTEGER NOT NULL CHECK (duration_days > 0 AND duration_days <= 365),
  refills         INTEGER NOT NULL DEFAULT 0 CHECK (refills >= 0),
  indication      TEXT NOT NULL,
  issued_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  override_reason TEXT
);
CREATE INDEX IF NOT EXISTS idx_rx_patient ON prescriptions(patient_id);

CREATE TABLE IF NOT EXISTS reminders (
  id              TEXT PRIMARY KEY,
  prescription_id TEXT NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
  patient_id      TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  times           JSONB NOT NULL,
  starts_on       DATE NOT NULL,
  ends_on         DATE NOT NULL,
  CONSTRAINT ends_after_start CHECK (ends_on >= starts_on)
);
CREATE INDEX IF NOT EXISTS idx_reminders_patient ON reminders(patient_id);

CREATE TABLE IF NOT EXISTS dose_log (
  id          TEXT PRIMARY KEY,
  reminder_id TEXT NOT NULL REFERENCES reminders(id) ON DELETE CASCADE,
  on_date     DATE NOT NULL,
  slot        TEXT NOT NULL,
  taken       BOOLEAN NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (reminder_id, on_date, slot)
);

-- released_at NULL means the result is still with the clinician.
CREATE TABLE IF NOT EXISTS reports (
  id           TEXT PRIMARY KEY,
  patient_id   TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  clinician_id TEXT NOT NULL REFERENCES clinicians(id),
  kind         TEXT NOT NULL,
  title        TEXT NOT NULL,
  summary      TEXT NOT NULL,
  image        TEXT,
  taken_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  released_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_reports_patient ON reports(patient_id);

CREATE TABLE IF NOT EXISTS notes (
  id           TEXT PRIMARY KEY,
  patient_id   TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  clinician_id TEXT NOT NULL REFERENCES clinicians(id),
  body         TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notes_patient ON notes(patient_id);

-- --------------------------------------------------------------------------
-- audit
-- --------------------------------------------------------------------------

-- Append only and hash chained: each row commits to the digest of the row
-- before it, so a deleted or edited entry breaks verification for everything
-- after it. Stores opaque ids only, never names or clinical text.
CREATE TABLE IF NOT EXISTS audit (
  seq        BIGSERIAL PRIMARY KEY,
  at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_id   TEXT,
  actor_role TEXT,
  action     TEXT NOT NULL,
  entity     TEXT NOT NULL,
  entity_id  TEXT,
  patient_id TEXT,
  outcome    TEXT NOT NULL DEFAULT 'ok' CHECK (outcome IN ('ok', 'denied', 'failed')),
  prev_hash  TEXT NOT NULL,
  hash       TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_patient ON audit(patient_id);
CREATE INDEX IF NOT EXISTS idx_audit_at ON audit(at DESC);

-- Forces the chain to stay linear under concurrency. Two writers that read the
-- same tail cannot both append to it: the second violates this constraint and
-- retries against the new tail. Without it, concurrent writes could fork the
-- chain and verification would fail for reasons nobody tampered with.
CREATE UNIQUE INDEX IF NOT EXISTS idx_audit_prev_hash ON audit(prev_hash);

-- Defence in depth: refuse UPDATE and DELETE on the audit trail at the
-- database level, so an application bug cannot quietly rewrite history.
CREATE OR REPLACE FUNCTION audit_is_append_only() RETURNS TRIGGER AS $fn$
BEGIN
  RAISE EXCEPTION 'audit is append only';
END;
$fn$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_no_update ON audit;
CREATE TRIGGER audit_no_update BEFORE UPDATE ON audit
  FOR EACH ROW EXECUTE FUNCTION audit_is_append_only();

DROP TRIGGER IF EXISTS audit_no_delete ON audit;
CREATE TRIGGER audit_no_delete BEFORE DELETE ON audit
  FOR EACH ROW EXECUTE FUNCTION audit_is_append_only();
