import { requireStaff } from "@/lib/authz";
import { readAudit, verifyChain } from "@/lib/audit";
import { db } from "@/lib/db";
import { AuditFilterView, AuditEntryItem } from "@/components/audit-filter-view";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  const user = await requireStaff("/clinic/audit");

  // Audit trail is tailored specifically to each user: only show entries where actor is this clinician
  const entries = await readAudit(200, undefined, user.clinicianId);
  const chain = await verifyChain();

  const names = (await db()`
    SELECT id, name FROM clinicians WHERE id = ${user.clinicianId}
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
          Your personal activity log. Records your appointment bookings, cancellations, completions, and patient registrations.
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
          <AuditFilterView entries={formattedEntries} clinicians={names} isAdmin={false} />
        </section>
      </main>
    </>
  );
}
