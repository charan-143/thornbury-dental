import { requireStaff } from "@/lib/authz";
import { readAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { AuditFilterView, AuditEntryItem } from "@/components/audit-filter-view";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  const user = await requireStaff("/clinic/audit");

  // Audit trail is tailored specifically to each user: only show entries where actor is this clinician
  const entries = await readAudit(200, undefined, user.clinicianId);

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

        <section className="panel">
          <AuditFilterView entries={formattedEntries} clinicians={names} isAdmin={false} />
        </section>
      </main>
    </>
  );
}
