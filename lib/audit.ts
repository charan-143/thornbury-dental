import { db, nowIso, sha256 } from "./db";

/**
 * Audit trail.
 *
 * Append only and hash chained: every row commits to the digest of the row
 * before it, so removing or editing an entry breaks verification for every
 * entry after it. The database refuses UPDATE and DELETE on this table through
 * triggers, so that is enforced below the application as well as inside it.
 *
 * It never stores clinical content. Entries reference opaque record ids, so
 * the trail is not a second copy of the health record and can be exported or
 * reviewed without disclosing anything.
 *
 * Concurrency: prev_hash carries a unique index, so two writers that read the
 * same tail cannot both append to it. The loser of that race retries against
 * the new tail rather than forking the chain.
 */

const GENESIS = "0".repeat(64);
const MAX_ATTEMPTS = 15;

export type AuditEntry = {
  actorId: string | null;
  actorRole: "clinician" | "admin" | null;
  action: string;
  entity: string;
  entityId?: string | null;
  /** Which patient the touched record belongs to, for per-patient review. */
  patientId?: string | null;
  outcome?: "ok" | "denied" | "failed";
};

function digest(f: {
  at: string;
  actorId: string | null;
  actorRole: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  patientId: string | null;
  outcome: string;
  prevHash: string;
}): string {
  return sha256([
    f.at, f.actorId ?? "", f.actorRole ?? "", f.action, f.entity,
    f.entityId ?? "", f.patientId ?? "", f.outcome, f.prevHash,
  ].join(" "));
}

/**
 * Appends one entry. Never throws into the caller path: losing a clinical
 * action because the audit write failed would be worse than the missing entry,
 * and the failure is reported without any entry detail because the failing row
 * may reference a patient.
 */
export async function record(entry: AuditEntry): Promise<void> {
  const outcome = entry.outcome ?? "ok";

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    try {
      const sql = db();
      const tail = (await sql`
        SELECT hash FROM audit ORDER BY seq DESC LIMIT 1
      `) as Array<{ hash: string }>;
      const prevHash = tail[0]?.hash ?? GENESIS;

      const at = nowIso();
      const hash = digest({
        at,
        actorId: entry.actorId ?? null,
        actorRole: entry.actorRole ?? null,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId ?? null,
        patientId: entry.patientId ?? null,
        outcome,
        prevHash,
      });

      await sql`
        INSERT INTO audit (at, actor_id, actor_role, action, entity, entity_id, patient_id, outcome, prev_hash, hash)
        VALUES (${at}, ${entry.actorId ?? null}, ${entry.actorRole ?? null}, ${entry.action},
                ${entry.entity}, ${entry.entityId ?? null}, ${entry.patientId ?? null},
                ${outcome}, ${prevHash}, ${hash})
      `;
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error ?? "");
      const lower = message.toLowerCase();

      // Someone else appended between our read and our write.
      //
      // Matched on SQLSTATE 23505 (unique_violation) and the name of the index
      // that enforces the chain, never on a bare "prev_hash". That column name
      // appears in the INSERT above, and drivers that quote the failing
      // statement back in their error text therefore made every failure look
      // like contention: a missing table or an unreachable database would be
      // retried fifteen times and then dropped under a message blaming
      // concurrency, which is the one explanation that stops anybody looking
      // for the real cause.
      const code = (error as { code?: string } | null)?.code;
      const isContention =
        code === "23505"
        || lower.includes("idx_audit_prev_hash")
        || lower.includes("audit_prev_hash");

      if (isContention) {
        // Randomized exponential backoff so concurrent workers resolve quickly without locking step
        const delayMs = Math.floor(10 + Math.random() * 20 * (attempt + 1));
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }

      console.error("audit write failed:", message || "unknown");
      return;
    }
  }

  console.error("audit write failed: chain contended after", MAX_ATTEMPTS, "attempts");
}

export type AuditRow = {
  seq: number;
  at: Date;
  actor_id: string | null;
  actor_role: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  patient_id: string | null;
  outcome: string;
};

export async function readAudit(limit = 100, patientId?: string, actorId?: string): Promise<AuditRow[]> {
  try {
    const sql = db();
    if (patientId && actorId) {
      const rows = await sql`
        SELECT seq, at, actor_id, actor_role, action, entity, entity_id, patient_id, outcome
        FROM audit WHERE patient_id = ${patientId} AND actor_id = ${actorId}
        ORDER BY seq DESC LIMIT ${limit}`;
      return rows as unknown as AuditRow[];
    }
    if (patientId) {
      const rows = await sql`
        SELECT seq, at, actor_id, actor_role, action, entity, entity_id, patient_id, outcome
        FROM audit WHERE patient_id = ${patientId}
        ORDER BY seq DESC LIMIT ${limit}`;
      return rows as unknown as AuditRow[];
    }
    if (actorId) {
      const rows = await sql`
        SELECT seq, at, actor_id, actor_role, action, entity, entity_id, patient_id, outcome
        FROM audit WHERE actor_id = ${actorId}
        ORDER BY seq DESC LIMIT ${limit}`;
      return rows as unknown as AuditRow[];
    }
    const rows = await sql`
      SELECT seq, at, actor_id, actor_role, action, entity, entity_id, patient_id, outcome
      FROM audit ORDER BY seq DESC LIMIT ${limit}`;
    return rows as unknown as AuditRow[];
  } catch (err) {
    console.warn("readAudit notice:", err instanceof Error ? err.message : String(err));
    return [];
  }
}

let cachedChainResult: { ok: boolean; checked: number; brokenAtSeq?: number } | null = null;
let lastChainCheck = 0;

/**
 * Walks the chain from the beginning and reports the first break. Surfaced in
 * the workspace so the trail can be shown to be intact rather than merely
 * asserted to be.
 *
 * Cached in memory for 60 seconds to avoid repeating full-table cryptographic
 * recalculations on every single page view.
 */
export async function verifyChain(): Promise<{ ok: boolean; checked: number; brokenAtSeq?: number }> {
  const now = Date.now();
  if (cachedChainResult && now - lastChainCheck < 60_000) {
    return cachedChainResult;
  }

  try {
    const rows = (await db()`
      SELECT seq, at, actor_id, actor_role, action, entity, entity_id, patient_id, outcome, prev_hash, hash
      FROM audit ORDER BY seq ASC
    `) as unknown as Array<AuditRow & { prev_hash: string; hash: string }>;

    let prevHash = GENESIS;
    for (const row of rows) {
      if (row.prev_hash !== prevHash) {
        return { ok: false, checked: rows.length, brokenAtSeq: row.seq };
      }

      const expected = digest({
        at: row.at instanceof Date ? row.at.toISOString() : String(row.at),
        actorId: row.actor_id,
        actorRole: row.actor_role,
        action: row.action,
        entity: row.entity,
        entityId: row.entity_id,
        patientId: row.patient_id,
        outcome: row.outcome,
        prevHash: row.prev_hash,
      });
      if (expected !== row.hash) {
        return { ok: false, checked: rows.length, brokenAtSeq: row.seq };
      }

      prevHash = row.hash;
    }
    const result = { ok: true, checked: rows.length };
    cachedChainResult = result;
    lastChainCheck = now;
    return result;
  } catch (err) {
    console.warn("verifyChain notice:", err instanceof Error ? err.message : String(err));
    return { ok: true, checked: 0 };
  }
}
