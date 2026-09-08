import { requireStaff } from "@/lib/authz";
import { readAudit, verifyChain } from "@/lib/audit";
import { db } from "@/lib/db";
import { AuditFilterView, AuditEntryItem } from "@/components/audit-filter-view";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  await requireStaff("/clinic/audit");

  const entries = await readAudit(200);
  const chain = await verifyChain();
  // Without these the trail still renders, but every actor shows as a raw id,
  // which is not a readable compliance record. readAudit and verifyChain above
  // already fail loudly; this read is no less load-bearing than they are.
  const names = (await db()`
    SELECT id, name FROM clinicians
  `) as unknown as Array<{ id: string; name: string }>;

  const formattedEntries: AuditEntryItem[] = entries.map((e) => ({
    seq: e.seq,
    at: e.at instanceof Date ? e.at.toISOString() : String(e.at),
    actor_id: e.actor_id,
    action: e.action,
    entity: e.entity,
    entity_id: e.entity_id,
    patient_id: e.patient_id,
    outcome: e.outcome,
  }));

  return (
    <>
      <header className="topbar"><h1>Audit trail</h1></header>

      <main className="page" id="main">
        <p className="page-intro">
          Every clinical write and every chart opened, with who did it and when. Entries
          reference opaque record ids rather than patient details, which is what makes the
          trail safe to read and to export.
        </p>

        <div className={chain.ok ? "alert alert-success" : "alert alert-critical"} role="status">
          <i className={`ph ph-${chain.ok ? "check-circle" : "warning-octagon"}`} aria-hidden="true" />
          <span>
            {chain.ok ? (
              <>
                <strong>Chain intact across {chain.checked} entries.</strong> Each entry commits to
                the digest of the one before it, and the database refuses updates and deletes on
                this table, so an altered or removed row would show up here.
              </>
            ) : (
              <>
                <strong>Chain broken at entry {chain.brokenAtSeq}.</strong> Entries from that point
                cannot be trusted. Escalate before relying on this trail.
              </>
            )}
          </span>
        </div>

        <section className="panel">
          <AuditFilterView entries={formattedEntries} clinicians={names} />
        </section>
      </main>
    </>
  );
}
