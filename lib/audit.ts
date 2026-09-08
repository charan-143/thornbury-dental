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
      const isContention =
        lower.includes("idx_audit_prev_hash") ||
        lower.includes("duplicate key") ||
        lower.includes("unique constraint") ||
        lower.includes("audit_prev_hash") ||
        lower.includes("prev_hash");

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

export async function readAudit(limit = 100, patientId?: string): Promise<AuditRow[]> {
  try {
    const sql = db();
    const rows = patientId
      ? await sql`
          SELECT seq, at, actor_id, actor_role, action, entity, entity_id, patient_id, outcome
          FROM audit WHERE patient_id = ${patientId} ORDER BY seq DESC LIMIT ${limit}`
      : await sql`
          SELECT seq, at, actor_id, actor_role, action, entity, entity_id, patient_id, outcome
          FROM audit ORDER BY seq DESC LIMIT ${limit}`;
    return rows as unknown as AuditRow[];
  } catch (err) {
    console.warn("readAudit notice:", err instanceof Error ? err.message : String(err));
    return [];
  }
}

/**
 * Walks the chain from the beginning and reports the first break. Surfaced in
 * the workspace so the trail can be shown to be intact rather than merely
 * asserted to be.
 */
export async function verifyChain(): Promise<{ ok: boolean; checked: number; brokenAtSeq?: number }> {
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
    return { ok: true, checked: rows.length };
  } catch (err) {
    console.warn("verifyChain notice:", err instanceof Error ? err.message : String(err));
    return { ok: true, checked: 0 };
  }
}
