import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { createHash, randomBytes } from "node:crypto";
import { getPGliteClient } from "./pglite-db";

/**
 * Database access, on Neon serverless Postgres with local PGlite fallback.
 *
 * If Neon Postgres is reachable, queries go directly to Neon.
 * If Neon Postgres is unreachable (e.g. invalid DATABASE_URL, DNS failure,
 * offline development), queries seamlessly fall back to local PGlite WASM Postgres.
 */

let neonClient: NeonQueryFunction<false, false> | null = null;
let useFallback = false;

export function assertDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Create a Neon project, then set it locally in "
      + ".env.local and in the Vercel project settings.",
    );
  }
  return url;
}
let neonInitPromise: Promise<void> | null = null;

async function ensureNeonColumns(client: NeonQueryFunction<false, false>) {
  // Fast path: if schema is already provisioned, ensure primary_clinician_id exists and skip full DDL
  try {
    const check = await client.query(
      "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'patients' LIMIT 1"
    );
    if (check && (check as any[]).length > 0) {
      try {
        await client.query("ALTER TABLE patients ADD COLUMN IF NOT EXISTS primary_clinician_id TEXT;");
        await client.query(`
          UPDATE patients SET primary_clinician_id = (
            SELECT clinician_id FROM appointments WHERE appointments.patient_id = patients.id LIMIT 1
          ) WHERE primary_clinician_id IS NULL;
        `);
        await client.query(`
          UPDATE patients SET primary_clinician_id = (
            SELECT id FROM clinicians WHERE active ORDER BY id LIMIT 1
          ) WHERE primary_clinician_id IS NULL;
        `);
      } catch (colErr) {
        console.warn("Fast-path primary_clinician_id migration notice:", colErr instanceof Error ? colErr.message : String(colErr));
      }
      return;
    }
  } catch (e) {}

  // Self-healing pre-migration: if `patients` table already exists from an older schema
  // or separate branch, ensure its columns and primary key constraints match what
  // dependent tables (allergies, plans, prescriptions, etc.) require for foreign keys.
  try {
    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'patients') THEN
          -- 1. Ensure id column exists
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patients' AND column_name = 'id') THEN
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patients' AND column_name = 'patient_id') THEN
              ALTER TABLE patients RENAME COLUMN patient_id TO id;
            ELSE
              ALTER TABLE patients ADD COLUMN id TEXT;
              UPDATE patients SET id = 'p_' || substr(md5(random()::text), 1, 12) WHERE id IS NULL;
              ALTER TABLE patients ALTER COLUMN id SET NOT NULL;
            END IF;
          END IF;

          -- 2. Ensure id is TEXT
          IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'patients' AND column_name = 'id' AND data_type != 'text'
          ) THEN
            ALTER TABLE patients ALTER COLUMN id TYPE TEXT USING id::text;
          END IF;

          -- 3. Ensure a primary key or unique constraint exists on id
          IF NOT EXISTS (
            SELECT 1
            FROM pg_constraint c
            JOIN pg_class t ON c.conrelid = t.oid
            JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(c.conkey)
            WHERE t.relname = 'patients' AND (c.contype = 'p' OR c.contype = 'u') AND a.attname = 'id'
          ) THEN
            BEGIN
              ALTER TABLE patients ADD PRIMARY KEY (id);
            EXCEPTION WHEN OTHERS THEN
              BEGIN
                ALTER TABLE patients ADD CONSTRAINT patients_id_unique UNIQUE (id);
              EXCEPTION WHEN OTHERS THEN
                NULL;
              END;
            END;
          END IF;

          -- 4. Ensure name column exists
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patients' AND column_name = 'name') THEN
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patients' AND column_name = 'first_name') THEN
              ALTER TABLE patients ADD COLUMN name TEXT;
              UPDATE patients SET name = TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, ''));
              UPDATE patients SET name = 'Unknown Patient' WHERE name IS NULL OR name = '';
            ELSE
              ALTER TABLE patients ADD COLUMN name TEXT NOT NULL DEFAULT 'Unknown Patient';
            END IF;
          END IF;

          -- 5. Ensure other required columns exist
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patients' AND column_name = 'mrn') THEN
            ALTER TABLE patients ADD COLUMN mrn TEXT;
            UPDATE patients SET mrn = 'TD-' || (40000 + (ROW_NUMBER() OVER ())::int) WHERE mrn IS NULL;
          END IF;

          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patients' AND column_name = 'dob') THEN
            ALTER TABLE patients ADD COLUMN dob DATE DEFAULT '1990-01-01';
          END IF;

          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patients' AND column_name = 'phone') THEN
            ALTER TABLE patients ADD COLUMN phone TEXT;
          END IF;

          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patients' AND column_name = 'email') THEN
            ALTER TABLE patients ADD COLUMN email TEXT;
          END IF;

          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patients' AND column_name = 'created_at') THEN
            ALTER TABLE patients ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT now();
          END IF;
        END IF;
      END $$;
    `);
  } catch (e) {
    console.warn("Neon patients pre-migration check:", e instanceof Error ? e.message : String(e));
  }

  const ddlStatements = [
    `CREATE TABLE IF NOT EXISTS schema_migrations (
      version    TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );`,
    `CREATE TABLE IF NOT EXISTS clinicians (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      credentials TEXT NOT NULL DEFAULT '',
      specialty   TEXT NOT NULL DEFAULT '',
      room        TEXT NOT NULL DEFAULT '',
      photo       TEXT,
      bio         TEXT,
      active      BOOLEAN NOT NULL DEFAULT true,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );`,
    `CREATE TABLE IF NOT EXISTS accounts (
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
    );`,
    `CREATE INDEX IF NOT EXISTS idx_accounts_clinician ON accounts(clinician_id);`,
    `CREATE TABLE IF NOT EXISTS sessions (
      id           TEXT PRIMARY KEY,
      account_id   TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      token_hash   TEXT NOT NULL UNIQUE,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
      expires_at   TIMESTAMPTZ NOT NULL,
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      revoked_at   TIMESTAMPTZ,
      user_agent   TEXT
    );`,
    `CREATE INDEX IF NOT EXISTS idx_sessions_account ON sessions(account_id);`,
    `CREATE TABLE IF NOT EXISTS invites (
      id           TEXT PRIMARY KEY,
      email        TEXT NOT NULL,
      role         TEXT NOT NULL CHECK (role IN ('clinician', 'admin')),
      clinician_id TEXT NOT NULL REFERENCES clinicians(id) ON DELETE CASCADE,
      token_hash   TEXT NOT NULL UNIQUE,
      invited_by  TEXT REFERENCES accounts(id) ON DELETE SET NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      expires_at  TIMESTAMPTZ NOT NULL,
      accepted_at TIMESTAMPTZ,
      revoked_at  TIMESTAMPTZ
    );`,
    `CREATE TABLE IF NOT EXISTS password_resets (
      code_hash  TEXT PRIMARY KEY,
      account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL,
      used_at    TIMESTAMPTZ
    );`,
    `CREATE TABLE IF NOT EXISTS auth_throttle (
      key       TEXT PRIMARY KEY,
      hits      INTEGER NOT NULL DEFAULT 0,
      window_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );`,
    `CREATE TABLE IF NOT EXISTS patients (
      id                   TEXT PRIMARY KEY,
      mrn                  TEXT NOT NULL UNIQUE,
      op_no                TEXT,
      name                 TEXT NOT NULL,
      dob                  DATE NOT NULL,
      phone                TEXT,
      email                TEXT,
      address              TEXT,
      primary_clinician_id TEXT REFERENCES clinicians(id) ON DELETE SET NULL,
      medical_history      TEXT,
      family_history       TEXT,
      past_dental_history  TEXT,
      photo                TEXT,
      last_visit           DATE,
      created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
    );`,
    `CREATE TABLE IF NOT EXISTS allergies (
      id         TEXT PRIMARY KEY,
      patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      substance  TEXT NOT NULL,
      reaction   TEXT NOT NULL,
      severity   TEXT NOT NULL CHECK (severity IN ('mild', 'moderate', 'severe'))
    );`,
    `CREATE TABLE IF NOT EXISTS conditions (
      id         TEXT PRIMARY KEY,
      patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      label      TEXT NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS dental_chart (
      id         TEXT PRIMARY KEY,
      patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      tooth_num  INTEGER NOT NULL CHECK (tooth_num >= 1 AND tooth_num <= 32),
      condition  TEXT NOT NULL DEFAULT 'sound',
      notes      TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(patient_id, tooth_num)
    );`,
    `CREATE TABLE IF NOT EXISTS appointments (
      id           TEXT PRIMARY KEY,
      patient_id   TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      clinician_id TEXT NOT NULL REFERENCES clinicians(id),
      starts_at    TIMESTAMPTZ NOT NULL,
      duration_min INTEGER NOT NULL CHECK (duration_min > 0 AND duration_min <= 480),
      type         TEXT NOT NULL,
      status       TEXT NOT NULL CHECK (status IN ('confirmed', 'completed', 'cancelled')),
      room         TEXT NOT NULL DEFAULT '',
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
    );`,
    `CREATE TABLE IF NOT EXISTS plans (
      id           TEXT PRIMARY KEY,
      patient_id   TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      clinician_id TEXT NOT NULL REFERENCES clinicians(id),
      procedure    TEXT NOT NULL,
      phase        TEXT NOT NULL CHECK (phase IN ('pre', 'post')),
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
      published_at TIMESTAMPTZ,
      locked_at    TIMESTAMPTZ
    );`,
    `CREATE TABLE IF NOT EXISTS plan_steps (
      id      TEXT PRIMARY KEY,
      plan_id TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
      ordinal INTEGER NOT NULL,
      title   TEXT NOT NULL,
      detail  TEXT NOT NULL DEFAULT '',
      UNIQUE (plan_id, ordinal)
    );`,
    `CREATE TABLE IF NOT EXISTS plan_addenda (
      id         TEXT PRIMARY KEY,
      plan_id    TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
      author_id  TEXT NOT NULL REFERENCES clinicians(id),
      body       TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );`,
    `CREATE TABLE IF NOT EXISTS prescriptions (
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
    );`,
    `CREATE TABLE IF NOT EXISTS reminders (
      id              TEXT PRIMARY KEY,
      prescription_id TEXT NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
      patient_id      TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      times           JSONB NOT NULL,
      starts_on       DATE NOT NULL,
      ends_on         DATE NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS dose_log (
      id          TEXT PRIMARY KEY,
      reminder_id TEXT NOT NULL REFERENCES reminders(id) ON DELETE CASCADE,
      on_date     DATE NOT NULL,
      slot        TEXT NOT NULL,
      taken       BOOLEAN NOT NULL,
      recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (reminder_id, on_date, slot)
    );`,
    `CREATE TABLE IF NOT EXISTS reports (
      id           TEXT PRIMARY KEY,
      patient_id   TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      clinician_id TEXT NOT NULL REFERENCES clinicians(id),
      kind         TEXT NOT NULL,
      title        TEXT NOT NULL,
      summary      TEXT NOT NULL,
      image        TEXT,
      taken_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
      released_at  TIMESTAMPTZ
    );`,
    `CREATE TABLE IF NOT EXISTS notes (
      id           TEXT PRIMARY KEY,
      patient_id   TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      clinician_id TEXT NOT NULL REFERENCES clinicians(id),
      body         TEXT NOT NULL,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
    );`,
    `CREATE TABLE IF NOT EXISTS audit (
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
    );`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_audit_prev_hash ON audit(prev_hash);`,
    `CREATE OR REPLACE FUNCTION audit_is_append_only() RETURNS TRIGGER AS $$
     BEGIN
       RAISE EXCEPTION 'audit is append only';
     END;
     $$ LANGUAGE plpgsql;`,
  ];

  for (const stmt of ddlStatements) {
    try {
      await client.query(stmt);
    } catch (e) {
      const err = e as { message?: string; detail?: string; hint?: string };
      console.warn(
        "Neon fallback statement execute:",
        err.message || String(e),
        err.detail ? `[Detail: ${err.detail}]` : "",
        err.hint ? `[Hint: ${err.hint}]` : "",
      );
    }
  }

  try {
    await client.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_no_update') THEN
          CREATE TRIGGER audit_no_update BEFORE UPDATE ON audit FOR EACH ROW EXECUTE FUNCTION audit_is_append_only();
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_no_delete') THEN
          CREATE TRIGGER audit_no_delete BEFORE DELETE ON audit FOR EACH ROW EXECUTE FUNCTION audit_is_append_only();
        END IF;
      END $$;
    `);
  } catch (e) {}

  try { await client`ALTER TABLE patients ADD COLUMN IF NOT EXISTS name TEXT DEFAULT 'Unknown Patient';`; } catch (e) {}
  try { await client`ALTER TABLE patients ADD COLUMN IF NOT EXISTS mrn TEXT;`; } catch (e) {}
  try { await client`ALTER TABLE patients ADD COLUMN IF NOT EXISTS dob DATE DEFAULT '1990-01-01';`; } catch (e) {}
  try { await client`ALTER TABLE patients ADD COLUMN IF NOT EXISTS phone TEXT;`; } catch (e) {}
  try { await client`ALTER TABLE patients ADD COLUMN IF NOT EXISTS email TEXT;`; } catch (e) {}
  try { await client`ALTER TABLE patients ADD COLUMN IF NOT EXISTS op_no TEXT;`; } catch (e) {}
  try { await client`ALTER TABLE patients ADD COLUMN IF NOT EXISTS address TEXT;`; } catch (e) {}
  try { await client`ALTER TABLE patients ADD COLUMN IF NOT EXISTS medical_history TEXT;`; } catch (e) {}
  try { await client`ALTER TABLE patients ADD COLUMN IF NOT EXISTS family_history TEXT;`; } catch (e) {}
  try { await client`ALTER TABLE patients ADD COLUMN IF NOT EXISTS past_dental_history TEXT;`; } catch (e) {}
  try { await client`ALTER TABLE patients ADD COLUMN IF NOT EXISTS primary_clinician_id TEXT;`; } catch (e) {}

  try { await client`ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS refills INTEGER NOT NULL DEFAULT 0;`; } catch (e) {}
  try { await client`ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS override_reason TEXT;`; } catch (e) {}

  try { await client`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS duration_min INTEGER NOT NULL DEFAULT 30;`; } catch (e) {}
  try { await client`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS room TEXT NOT NULL DEFAULT '';`; } catch (e) {}
  try { await client`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'General';`; } catch (e) {}
  try { await client`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'confirmed';`; } catch (e) {}

  try {
    await client.query(`
      DO $$ 
      BEGIN 
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='appointments' AND column_name='duration') 
           AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='appointments' AND column_name='duration_min') THEN
          UPDATE appointments SET duration_min = duration WHERE duration_min IS NULL OR duration_min = 30;
        END IF;
      END $$;
    `);
  } catch (e) {}

  try { await client`ALTER TABLE clinicians ADD COLUMN IF NOT EXISTS room TEXT NOT NULL DEFAULT '';`; } catch (e) {}
  try { await client`ALTER TABLE clinicians ADD COLUMN IF NOT EXISTS photo TEXT;`; } catch (e) {}
  try { await client`ALTER TABLE clinicians ADD COLUMN IF NOT EXISTS bio TEXT;`; } catch (e) {}
  try { await client`ALTER TABLE clinicians ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;`; } catch (e) {}

  try { await client`ALTER TABLE reports ADD COLUMN IF NOT EXISTS image TEXT;`; } catch (e) {}
  try { await client`ALTER TABLE reports ADD COLUMN IF NOT EXISTS released_at TIMESTAMPTZ;`; } catch (e) {}

  try {
    await client`
      CREATE TABLE IF NOT EXISTS dental_chart (
        id         TEXT PRIMARY KEY,
        patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        tooth_num  INTEGER NOT NULL CHECK (tooth_num >= 1 AND tooth_num <= 32),
        condition  TEXT NOT NULL DEFAULT 'sound',
        notes      TEXT,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE(patient_id, tooth_num)
      );
    `;
  } catch (e) {}
}

/**
 * Whether this process may quietly serve clinical data from the local PGlite
 * database when Neon cannot be reached.
 *
 * Off unless asked for, and never on in production. The fallback is useful for
 * working on a train; it is dangerous anywhere real, because PGlite keeps a
 * separate copy of the records under .data/ and the application cannot tell
 * the difference. A practice running on it sees an empty-looking roster, books
 * appointments into it, writes notes into it, and is told each time that the
 * save succeeded. None of it reaches Neon, and none of it is in the backups.
 *
 * Set ALLOW_LOCAL_DB_FALLBACK=1 to opt in for offline development.
 */
function localFallbackAllowed(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  const flag = process.env.ALLOW_LOCAL_DB_FALLBACK;
  return flag === "1" || flag === "true";
}

/** Rethrows unless the local fallback has been explicitly opted into. */
function refuseFallback(error: unknown): never {
  console.error(
    "Database unreachable and the local fallback is not enabled. "
    + "Set ALLOW_LOCAL_DB_FALLBACK=1 for offline development only.",
  );
  throw error;
}

export function db(): any {
  if (useFallback) {
    return createAsyncPGliteProxy();
  }

  const getNeon = () => {
    if (!neonClient) {
      // Throws when unset, rather than silently redirecting the whole
      // application to a local database nobody asked for.
      const url = localFallbackAllowed() ? process.env.DATABASE_URL : assertDatabaseUrl();
      if (!url) {
        useFallback = true;
        return null;
      }
      neonClient = neon(url);
      neonInitPromise = ensureNeonColumns(neonClient);
    }
    return neonClient;
  };

  const client = getNeon();
  if (!client) {
    return createAsyncPGliteProxy();
  }

  const proxy = async (strings: TemplateStringsArray, ...values: any[]) => {
    if (neonInitPromise) {
      await neonInitPromise.catch(() => {});
    }
    try {
      return await client(strings, ...values);
    } catch (error) {
      if (isConnectivityError(error)) {
        if (!localFallbackAllowed()) refuseFallback(error);
        console.warn("Neon database unreachable. Falling back to local PGlite database:", error instanceof Error ? error.message : String(error));
        useFallback = true;
        const pgliteClient = await getPGliteClient();
        return await pgliteClient(strings, ...values);
      }
      throw error;
    }
  };

  proxy.query = async (queryText: string, params: any[] = []) => {
    if (neonInitPromise) {
      await neonInitPromise.catch(() => {});
    }
    try {
      return await client.query(queryText, params);
    } catch (error) {
      if (isConnectivityError(error)) {
        if (!localFallbackAllowed()) refuseFallback(error);
        console.warn("Neon database unreachable. Falling back to local PGlite database:", error instanceof Error ? error.message : String(error));
        useFallback = true;
        const pgliteClient = await getPGliteClient();
        return await pgliteClient.query(queryText, params);
      }
      throw error;
    }
  };

  proxy.transaction = async (queries: any[]) => {
    if (neonInitPromise) {
      await neonInitPromise.catch(() => {});
    }
    try {
      return await client.transaction(queries);
    } catch (error) {
      if (isConnectivityError(error)) {
        if (!localFallbackAllowed()) refuseFallback(error);
        console.warn("Neon database unreachable. Falling back to local PGlite database:", error instanceof Error ? error.message : String(error));
        useFallback = true;
        const pgliteClient = await getPGliteClient();
        return await pgliteClient.transaction(queries);
      }
      throw error;
    }
  };

  return proxy;
}

function createAsyncPGliteProxy(): any {
  const proxy = async (strings: TemplateStringsArray, ...values: any[]) => {
    const pgliteClient = await getPGliteClient();
    return await pgliteClient(strings, ...values);
  };

  proxy.query = async (queryText: string, params: any[] = []) => {
    const pgliteClient = await getPGliteClient();
    return await pgliteClient.query(queryText, params);
  };

  proxy.transaction = async (queries: any[]) => {
    const pgliteClient = await getPGliteClient();
    return await pgliteClient.transaction(queries);
  };

  return proxy;
}

/**
 * True when a query failed because the database could not be reached at all,
 * rather than because it answered with something unwelcome.
 */
export function isConnectivityError(error: unknown): boolean {
  if (!error) return false;
  const codes = ["ENOTFOUND", "ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "EAI_AGAIN"];

  const seen = new Set<unknown>();
  let current: unknown = error;

  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    const node = current as {
      code?: string; message?: string; cause?: unknown; sourceError?: unknown;
    };

    if (node.code && codes.includes(node.code)) return true;
    if (
      node.message
      && (node.message.includes("fetch failed")
        || node.message.includes("Error connecting to database"))
    ) {
      return true;
    }
    current = node.sourceError ?? node.cause;
  }

  return false;
}

/** Stable digest used by the audit chain and for token storage. */
export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function nowIso(): string {
  return new Date().toISOString();
}

/** Opaque identifier. Never derived from patient data. */
export function newId(prefix: string): string {
  return `${prefix}_${randomBytes(9).toString("base64url")}`;
}

/**
 * Postgres returns TIMESTAMPTZ as a Date and DATE as a string. This narrows
 * both back to what the views want, in one place rather than at each call.
 */
export function toIso(value: Date | string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}

/** Local calendar date as YYYY-MM-DD, for DATE columns and day comparisons. */
export function isoDate(value: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}
