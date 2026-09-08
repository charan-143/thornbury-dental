import { randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { db, newId, nowIso, sha256 } from "./db";
import { record } from "./audit";
import { burnTime, hashPassword, verifyPassword, passwordIssues } from "./password";

export { passwordIssues, PASSWORD_RULES } from "./password";

/**
 * Authentication, for practice staff only.
 *
 * There are no patient accounts. Patients exist as clinical records that
 * clinicians manage; nobody outside the practice can sign in, which removes an
 * entire class of exposure from a system holding health records.
 *
 * Accounts are created by invitation, never by self-registration, because a
 * public sign-up form on a clinical system is a way for strangers to obtain a
 * staff login.
 *
 * Everything runs on the server: the password arrives in the request body and
 * is never handed to client JavaScript, derivation happens where the client
 * cannot see it, and the session is a database row that can be revoked.
 */

export const SESSION_COOKIE = "td_session";
export const SESSION_IDLE_MS = 15 * 60 * 1000;
export const SESSION_ABSOLUTE_MS = 8 * 60 * 60 * 1000;

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;
const THROTTLE_LIMIT = 10;
const THROTTLE_WINDOW_MS = 15 * 60 * 1000;
const RESET_TTL_MS = 30 * 60 * 1000;

export type Role = "clinician" | "admin";

export type Account = {
  id: string;
  email: string;
  role: Role;
  clinician_id: string;
  password_hash: string;
  password_salt: string;
  kdf: string;
  failed_attempts: number;
  locked_until: Date | null;
  disabled_at: Date | null;
};

export type SessionUser = {
  accountId: string;
  sessionId: string;
  role: Role;
  clinicianId: string;
  email: string;
  name: string;
};

const normalise = (email: string) => String(email ?? "").trim().toLowerCase();

// ---------------------------------------------------------------------------
// throttling
// ---------------------------------------------------------------------------

/**
 * Fixed-window counter kept in the database, so it survives a restart and is
 * shared across serverless instances. An in-memory counter would be useless on
 * Vercel, where each request may land on a different one.
 */
async function throttled(key: string): Promise<boolean> {
  const sql = db();
  try {
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS auth_throttle (
          key       TEXT PRIMARY KEY,
          hits      INTEGER NOT NULL DEFAULT 0,
          window_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
      `;
    } catch (e) {}

    const rows = (await sql`
      SELECT hits, window_at FROM auth_throttle WHERE key = ${key}
    `) as Array<{ hits: number; window_at: Date }>;
    const row = rows[0];

    if (!row || Date.now() - new Date(row.window_at).getTime() > THROTTLE_WINDOW_MS) {
      await sql`
        INSERT INTO auth_throttle (key, hits, window_at) VALUES (${key}, 1, now())
        ON CONFLICT (key) DO UPDATE SET hits = 1, window_at = now()
      `;
      return false;
    }

    if (row.hits >= THROTTLE_LIMIT) return true;
    await sql`UPDATE auth_throttle SET hits = hits + 1 WHERE key = ${key}`;
    return false;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("auth_throttle notice (throttling bypassed on DB error):", msg);
    return false;
  }
}

/** Digest of the client address, so the throttle table holds no raw addresses. */
async function clientKey(): Promise<string> {
  const head = await headers();
  const forwarded = head.get("x-forwarded-for") ?? "";
  const address = forwarded.split(",")[0]?.trim() || "local";
  return `ip:${sha256(address).slice(0, 32)}`;
}

// ---------------------------------------------------------------------------
// accounts
// ---------------------------------------------------------------------------

export async function findAccountByEmail(email: string): Promise<Account | undefined> {
  const rows = (await db()`
    SELECT * FROM accounts WHERE email = ${normalise(email)}
  `) as unknown as Account[];
  return rows[0];
}

export async function createAccount(input: {
  email: string;
  password: string;
  role: Role;
  clinicianId: string;
}): Promise<Account> {
  const { hash, salt, kdf } = hashPassword(input.password);
  const id = newId("ac");

  await db()`
    INSERT INTO accounts (id, email, role, clinician_id, password_hash, password_salt, kdf)
    VALUES (${id}, ${normalise(input.email)}, ${input.role}, ${input.clinicianId}, ${hash}, ${salt}, ${kdf})
  `;

  const rows = (await db()`SELECT * FROM accounts WHERE id = ${id}`) as unknown as Account[];
  return rows[0]!;
}

// ---------------------------------------------------------------------------
// sessions
// ---------------------------------------------------------------------------

async function issueSession(account: Account): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_ABSOLUTE_MS);
  const head = await headers();

  await db()`
    INSERT INTO sessions (id, account_id, token_hash, expires_at, user_agent)
    VALUES (${newId("se")}, ${account.id}, ${sha256(token)}, ${expiresAt.toISOString()},
            ${(head.get("user-agent") ?? "").slice(0, 200)})
  `;

  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

/**
 * Resolves the caller from the session cookie, enforcing both expiry limits on
 * every request. Returns null rather than throwing, so callers choose between
 * redirecting and refusing.
 */
export async function currentUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const sql = db();
  const rows = (await sql`
    SELECT s.id AS session_id, s.expires_at, s.last_seen_at, s.revoked_at,
           a.id AS account_id, a.role, a.clinician_id, a.email, a.disabled_at,
           c.name AS name
    FROM sessions s
    JOIN accounts a ON a.id = s.account_id
    JOIN clinicians c ON c.id = a.clinician_id
    WHERE s.token_hash = ${sha256(token)}
  `) as Array<{
    session_id: string;
    expires_at: Date;
    last_seen_at: Date;
    revoked_at: Date | null;
    account_id: string;
    role: Role;
    clinician_id: string;
    email: string;
    disabled_at: Date | null;
    name: string;
  }>;

  const row = rows[0];
  if (!row || row.revoked_at) return null;

  // A disabled account loses access immediately, without waiting for the
  // session to expire on its own.
  if (row.disabled_at) {
    await sql`UPDATE sessions SET revoked_at = now() WHERE id = ${row.session_id}`;
    return null;
  }

  const now = Date.now();
  const expired = now > new Date(row.expires_at).getTime();
  const idle = now - new Date(row.last_seen_at).getTime() > SESSION_IDLE_MS;

  if (expired || idle) {
    await sql`UPDATE sessions SET revoked_at = now() WHERE id = ${row.session_id}`;
    return null;
  }

  // Push the idle window forward, but at most once a minute, so a burst of
  // requests does not write on every one.
  if (now - new Date(row.last_seen_at).getTime() > 60_000) {
    await sql`UPDATE sessions SET last_seen_at = now() WHERE id = ${row.session_id}`;
  }

  return {
    accountId: row.account_id,
    sessionId: row.session_id,
    role: row.role,
    clinicianId: row.clinician_id,
    email: row.email,
    name: row.name,
  };
}

export async function signOut(): Promise<void> {
  try {
    const user = await currentUser();
    if (user) {
      await db()`UPDATE sessions SET revoked_at = now() WHERE id = ${user.sessionId}`;
      await record({
        actorId: user.clinicianId,
        actorRole: user.role,
        action: "signed out",
        entity: "session",
        entityId: user.sessionId,
      });
    }
  } catch (err) {
    console.warn("signOut database notice:", err instanceof Error ? err.message : String(err));
  } finally {
    try {
      const jar = await cookies();
      jar.delete(SESSION_COOKIE);
    } catch (e) {}
  }
}

/** Ends every session for an account, used after a password change or reset. */
export async function revokeAllSessions(accountId: string): Promise<void> {
  await db()`
    UPDATE sessions SET revoked_at = now()
    WHERE account_id = ${accountId} AND revoked_at IS NULL
  `;
}

// ---------------------------------------------------------------------------
// sign in
// ---------------------------------------------------------------------------

export type SignInResult = { ok: true } | { ok: false; error: string };

const GENERIC = "That email and password combination was not recognised.";

export async function signIn(email: string, password: string): Promise<SignInResult> {
  const address = normalise(email);

  if ((await throttled(await clientKey())) || (await throttled(`email:${address}`))) {
    await record({ actorId: null, actorRole: null, action: "sign in throttled", entity: "account", outcome: "denied" });
    return { ok: false, error: "Too many attempts from here. Wait a few minutes and try again." };
  }

  const account = await findAccountByEmail(address);

  if (!account || account.disabled_at) {
    // Derive anyway so a missing or disabled account does not answer
    // measurably faster than a wrong password.
    burnTime(password);
    await record({ actorId: null, actorRole: null, action: "failed sign in", entity: "account", outcome: "failed" });
    return { ok: false, error: GENERIC };
  }

  if (account.locked_until && Date.now() < new Date(account.locked_until).getTime()) {
    const mins = Math.ceil((new Date(account.locked_until).getTime() - Date.now()) / 60000);
    await record({
      actorId: account.clinician_id, actorRole: account.role,
      action: "sign in refused, account locked", entity: "account", entityId: account.id, outcome: "denied",
    });
    return {
      ok: false,
      error: `This account is locked after ${MAX_FAILED_ATTEMPTS} failed attempts. Try again in ${mins} minute${mins === 1 ? "" : "s"}, or reset the password.`,
    };
  }

  if (!verifyPassword(password, account)) {
    const attempts = account.failed_attempts + 1;

    if (attempts >= MAX_FAILED_ATTEMPTS) {
      await db()`
        UPDATE accounts SET failed_attempts = 0,
          locked_until = ${new Date(Date.now() + LOCKOUT_MINUTES * 60000).toISOString()}
        WHERE id = ${account.id}
      `;
      await record({
        actorId: account.clinician_id, actorRole: account.role,
        action: "account locked after repeated failures", entity: "account", entityId: account.id, outcome: "denied",
      });
      return { ok: false, error: `Too many failed attempts. This account is locked for ${LOCKOUT_MINUTES} minutes.` };
    }

    await db()`UPDATE accounts SET failed_attempts = ${attempts} WHERE id = ${account.id}`;
    await record({
      actorId: account.clinician_id, actorRole: account.role,
      action: "failed sign in", entity: "account", entityId: account.id, outcome: "failed",
    });
    const left = MAX_FAILED_ATTEMPTS - attempts;
    return { ok: false, error: `${GENERIC} ${left} attempt${left === 1 ? "" : "s"} left before the account locks.` };
  }

  await db()`
    UPDATE accounts SET failed_attempts = 0, locked_until = NULL, last_sign_in_at = now()
    WHERE id = ${account.id}
  `;

  await issueSession(account);
  await record({
    actorId: account.clinician_id, actorRole: account.role,
    action: "signed in", entity: "session", entityId: account.id,
  });
  return { ok: true };
}

/** Used straight after an invite is accepted, which already proved the password. */
export async function startSessionFor(account: Account): Promise<void> {
  await issueSession(account);
  await record({
    actorId: account.clinician_id, actorRole: account.role,
    action: "signed in", entity: "session", entityId: account.id,
  });
}

// ---------------------------------------------------------------------------
// open registration
// ---------------------------------------------------------------------------

/**
 * Self-registration.
 *
 * This is open by explicit request: anyone who reaches /signup can create a
 * staff account, and a staff account reads every patient chart. The mitigation
 * is accounting rather than refusal, exactly as it is for chart access
 * generally: the account is named, and every record it opens is written to the
 * audit trail against that name.
 *
 * The first account created becomes the administrator, so the practice does
 * not end up with nobody able to manage roles. Everyone after that is a
 * clinician, and an administrator can change that later.
 *
 * If this ever needs tightening, the smallest useful change is to create the
 * account disabled and have an administrator enable it: currentUser already
 * refuses a disabled account, so the rest of the system needs no changes.
 */
export async function registerOpen(input: {
  name: string;
  email: string;
  password: string;
  credentials?: string;
  specialty?: string;
}): Promise<{ ok: true; account: Account } | { ok: false; error: string }> {
  const address = normalise(input.email);
  const name = input.name.trim();

  if (!name) return { ok: false, error: "Enter the name you want to appear under." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
    return { ok: false, error: "Enter an email address in the form name@practice.example." };
  }
  if (passwordIssues(input.password).length) {
    return { ok: false, error: "That password does not meet every requirement listed below." };
  }
  if (await findAccountByEmail(address)) {
    return { ok: false, error: "An account already exists for that address. Sign in instead, or reset the password." };
  }

  const sql = db();
  const existing = (await sql`SELECT count(*)::int AS n FROM accounts`) as Array<{ n: number }>;
  const role: Role = (existing[0]?.n ?? 0) === 0 ? "admin" : "clinician";

  const clinicianId = newId("cl");
  await sql`
    INSERT INTO clinicians (id, name, credentials, specialty, room)
    VALUES (${clinicianId}, ${name}, ${input.credentials?.trim() ?? ""}, ${input.specialty?.trim() ?? ""}, ${""})
  `;

  const account = await createAccount({ email: address, password: input.password, role, clinicianId });

  await record({
    actorId: clinicianId,
    actorRole: role,
    action: role === "admin" ? "registered the first account, as administrator" : "registered an account",
    entity: "account",
    entityId: account.id,
  });

  await startSessionFor(account);
  return { ok: true, account };
}

// ---------------------------------------------------------------------------
// invitations
// ---------------------------------------------------------------------------

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Invites a colleague. Only an administrator reaches this.
 *
 * Creates the clinician profile and a single-use token. The raw token is
 * returned once so the caller can deliver it; only its digest is stored, so a
 * database disclosure does not hand over pending invitations.
 */
export async function createInvite(input: {
  email: string;
  name: string;
  role: Role;
  credentials?: string;
  specialty?: string;
  room?: string;
  invitedByAccountId: string;
  invitedByClinicianId: string;
  invitedByRole: Role;
}): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  const address = normalise(input.email);

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
    return { ok: false, error: "Enter an email address in the form name@practice.example." };
  }
  if (await findAccountByEmail(address)) {
    return { ok: false, error: "An account already exists for that address." };
  }
  if (!input.name.trim()) {
    return { ok: false, error: "Enter the name this clinician should appear under." };
  }

  const sql = db();
  const clinicianId = newId("cl");
  await sql`
    INSERT INTO clinicians (id, name, credentials, specialty, room)
    VALUES (${clinicianId}, ${input.name.trim()}, ${input.credentials ?? ""},
            ${input.specialty ?? ""}, ${input.room ?? ""})
  `;

  const token = randomBytes(24).toString("base64url");
  await sql`
    INSERT INTO invites (id, email, role, clinician_id, token_hash, invited_by, expires_at)
    VALUES (${newId("in")}, ${address}, ${input.role}, ${clinicianId}, ${sha256(token)},
            ${input.invitedByAccountId}, ${new Date(Date.now() + INVITE_TTL_MS).toISOString()})
  `;

  await record({
    actorId: input.invitedByClinicianId,
    actorRole: input.invitedByRole,
    action: `invited a ${input.role}`,
    entity: "invite",
    entityId: clinicianId,
  });

  return { ok: true, token };
}

export type PendingInvite = { email: string; role: Role; clinicianId: string; name: string };

/** Resolves a token to a pending invitation, or null. Never says why it failed. */
export async function readInvite(token: string): Promise<PendingInvite | null> {
  const rows = (await db()`
    SELECT i.email, i.role, i.clinician_id, c.name AS clinician_name
    FROM invites i JOIN clinicians c ON c.id = i.clinician_id
    WHERE i.token_hash = ${sha256(String(token ?? "").trim())}
      AND i.accepted_at IS NULL AND i.revoked_at IS NULL AND i.expires_at > now()
  `) as Array<{ email: string; role: Role; clinician_id: string; clinician_name: string }>;

  const row = rows[0];
  if (!row) return null;
  return { email: row.email, role: row.role, clinicianId: row.clinician_id, name: row.clinician_name };
}

/** Accepts an invitation, creating the account and signing the person in. */
export async function acceptInvite(
  token: string,
  password: string,
): Promise<{ ok: boolean; error?: string }> {
  const invite = await readInvite(token);
  if (!invite) return { ok: false, error: "That invitation is not valid or has expired." };
  if (passwordIssues(password).length) {
    return { ok: false, error: "That password does not meet every requirement listed below." };
  }
  if (await findAccountByEmail(invite.email)) {
    return { ok: false, error: "An account already exists for that address." };
  }

  const account = await createAccount({
    email: invite.email,
    password,
    role: invite.role,
    clinicianId: invite.clinicianId,
  });

  await db()`
    UPDATE invites SET accepted_at = now() WHERE token_hash = ${sha256(String(token).trim())}
  `;

  await record({
    actorId: account.clinician_id,
    actorRole: account.role,
    action: "accepted an invitation",
    entity: "account",
    entityId: account.id,
  });

  await startSessionFor(account);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// password reset
// ---------------------------------------------------------------------------

/**
 * Issues a single-use code valid for thirty minutes. The response is identical
 * whether or not the address exists, so this cannot be used to discover which
 * staff addresses are registered.
 */
export async function requestPasswordReset(email: string): Promise<{ code: string | null }> {
  const account = await findAccountByEmail(email);
  if (!account || account.disabled_at) return { code: null };

  const code = randomBytes(5).toString("hex").toUpperCase();
  await db()`
    INSERT INTO password_resets (code_hash, account_id, expires_at)
    VALUES (${sha256(code)}, ${account.id}, ${new Date(Date.now() + RESET_TTL_MS).toISOString()})
  `;

  await record({
    actorId: account.clinician_id, actorRole: account.role,
    action: "requested a password reset", entity: "account", entityId: account.id,
  });
  return { code };
}

export async function resetPassword(code: string, nextPassword: string): Promise<{ ok: boolean; error?: string }> {
  if (passwordIssues(nextPassword).length) {
    return { ok: false, error: "The new password does not meet every requirement." };
  }

  const sql = db();
  const rows = (await sql`
    SELECT code_hash, account_id, expires_at, used_at FROM password_resets
    WHERE code_hash = ${sha256(String(code ?? "").trim().toUpperCase())}
  `) as Array<{ code_hash: string; account_id: string; expires_at: Date; used_at: Date | null }>;

  const row = rows[0];
  if (!row || row.used_at) return { ok: false, error: "That reset code is not valid." };
  if (Date.now() > new Date(row.expires_at).getTime()) {
    return { ok: false, error: "That reset code has expired. Request a new one." };
  }

  const { hash, salt, kdf } = hashPassword(nextPassword);
  await sql`
    UPDATE accounts SET password_hash = ${hash}, password_salt = ${salt}, kdf = ${kdf},
      password_changed_at = now(), failed_attempts = 0, locked_until = NULL
    WHERE id = ${row.account_id}
  `;
  await sql`UPDATE password_resets SET used_at = now() WHERE code_hash = ${row.code_hash}`;

  // A reset invalidates every existing session for that account.
  await revokeAllSessions(row.account_id);

  const owner = (await sql`
    SELECT clinician_id, role FROM accounts WHERE id = ${row.account_id}
  `) as Array<{ clinician_id: string; role: Role }>;
  await record({
    actorId: owner[0]?.clinician_id ?? null,
    actorRole: owner[0]?.role ?? null,
    action: "reset password", entity: "account", entityId: row.account_id,
  });

  return { ok: true };
}
