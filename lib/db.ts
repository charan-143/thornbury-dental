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

import fs from "node:fs";
import path from "node:path";

let neonInitPromise: Promise<void> | null = null;

async function ensureNeonColumns(client: NeonQueryFunction<false, false>) {
  let fileMigrationSucceeded = false;
  try {
    const migrationPath = path.join(process.cwd(), "migrations", "0001_init.sql");
    if (fs.existsSync(migrationPath)) {
      const migrationSql = fs.readFileSync(migrationPath, "utf8");
      await client.query(migrationSql);
      fileMigrationSucceeded = true;
    }
  } catch (e) {
    console.warn("Neon migration init check:", e instanceof Error ? e.message : String(e));
  }

  if (!fileMigrationSucceeded) {
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
    ];

    for (const stmt of ddlStatements) {
      try {
        await client.query(stmt);
      } catch (e) {
        console.warn("Neon fallback statement execute:", e instanceof Error ? e.message : String(e));
      }
    }
  }

  try { await client`ALTER TABLE patients ADD COLUMN IF NOT EXISTS op_no TEXT;`; } catch (e) {}
  try { await client`ALTER TABLE patients ADD COLUMN IF NOT EXISTS address TEXT;`; } catch (e) {}
  try { await client`ALTER TABLE patients ADD COLUMN IF NOT EXISTS medical_history TEXT;`; } catch (e) {}
  try { await client`ALTER TABLE patients ADD COLUMN IF NOT EXISTS family_history TEXT;`; } catch (e) {}
  try { await client`ALTER TABLE patients ADD COLUMN IF NOT EXISTS past_dental_history TEXT;`; } catch (e) {}

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

export function db(): any {
  if (useFallback) {
    return createAsyncPGliteProxy();
  }

  const getNeon = () => {
    if (!neonClient) {
      const url = process.env.DATABASE_URL;
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
