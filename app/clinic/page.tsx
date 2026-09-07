import Link from "next/link";
import { requireStaff } from "@/lib/authz";
import { verifyChain } from "@/lib/audit";
import { db, isoDate } from "@/lib/db";
import { dayBounds } from "@/lib/scheduling";

/**
 * Clinical day view.
 *
 * The list is scoped to the signed-in clinician, so one workspace does not show
 * another clinician list. Drafts and unreleased results are surfaced here on
 * purpose: both are states where a patient is waiting on someone, and a queue
 * nobody can see is how they get forgotten.
 */

export const dynamic = "force-dynamic";

const pad = (n: number) => String(n).padStart(2, "0");
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function formatTime(value: Date | string): string {
  const d = value instanceof Date ? value : new Date(value);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function age(dob: Date | string): number {
  const born = dob instanceof Date ? dob : new Date(dob);
  const now = new Date();
  let years = now.getFullYear() - born.getFullYear();
  const m = now.getMonth() - born.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < born.getDate())) years -= 1;
  return years;
}

type Row = {
  id: string; starts_at: Date; duration_min: number; type: string; status: string; room: string;
  patient_id: string; patient_name: string; mrn: string; dob: Date; allergy_list: string | null;
};
type Draft = { id: string; procedure: string; phase: string; patient_name: string; patient_id: string };
type Held = { id: string; title: string; kind: string; patient_name: string; patient_id: string };

export default async function ClinicToday() {
  const user = await requireStaff("/clinic");
  const sql = db();
  const today = isoDate();
  const { startIso, endIso } = dayBounds(today);

  // string_agg rather than a join, so a patient with two allergies does not
  // duplicate their appointment row.
  const list = (await sql`
    SELECT a.id, a.starts_at, a.duration_min, a.type, a.status, a.room,
           p.id AS patient_id, p.name AS patient_name, p.mrn, p.dob,
           (SELECT string_agg(al.substance, ', ') FROM allergies al WHERE al.patient_id = p.id) AS allergy_list
    FROM appointments a
    JOIN patients p ON p.id = a.patient_id
    WHERE a.clinician_id = ${user.clinicianId}
      AND a.starts_at >= ${startIso}
      AND a.starts_at < ${endIso}
    ORDER BY a.starts_at ASC
  `) as unknown as Row[];

  const active = list.filter((row) => row.status === "confirmed");
  const minutes = active.reduce((total, row) => total + row.duration_min, 0);

  const drafts = (await sql`
    SELECT p.id, p.procedure, p.phase, pt.name AS patient_name, pt.id AS patient_id
    FROM plans p JOIN patients pt ON pt.id = p.patient_id
    WHERE p.clinician_id = ${user.clinicianId} AND p.published_at IS NULL
  `) as unknown as Draft[];

  const held = (await sql`
    SELECT r.id, r.title, r.kind, pt.name AS patient_name, pt.id AS patient_id
    FROM reports r JOIN patients pt ON pt.id = r.patient_id
    WHERE r.clinician_id = ${user.clinicianId} AND r.released_at IS NULL
  `) as unknown as Held[];

  const chain = await verifyChain();

  return (
    <>
      <header className="topbar">
        <h1>Today</h1>
      </header>

      <main className="page" id="main">
        <section className="tiles">
          <div className="tile tile-accent">
            <div className="k"><i className="ph ph-calendar-check" aria-hidden="true" /> Booked today</div>
            <div className="v">{active.length}</div>
            <div className="n">{list.length - active.length} cancelled or already seen</div>
          </div>
          <div className="tile">
            <div className="k"><i className="ph ph-note-pencil" aria-hidden="true" /> Plans awaiting publication</div>
            <div className="v">{drafts.length}</div>
            <div className="n">Drafts are not shared with anyone yet</div>
          </div>
          <div className="tile">
            <div className="k"><i className="ph ph-file-text" aria-hidden="true" /> Results not yet released</div>
            <div className="v">{held.length}</div>
            <div className="n">Read, then release into the record</div>
          </div>
          <div className="tile">
            <div className="k"><i className="ph ph-clock" aria-hidden="true" /> Chair time booked</div>
            <div className="v">{minutes}m</div>
            <div className="n">Minutes across today</div>
          </div>
        </section>

        <div className="cols-side">
          <section className="panel">
            <div className="panel-head">
              <h2>Your list for {DAYS[new Date().getDay()]}</h2>
            </div>
            {list.length ? (
              <div className="rows">
                {list.map((row) => (
                  <div className="row" key={row.id}>
                    <div className="row-when">
                      <div className="d">{formatTime(row.starts_at)}</div>
                      <div className="m">{row.duration_min} min</div>
                    </div>
                    <div className="row-main">
                      <strong>{row.patient_name}, {age(row.dob)}</strong>
                      <span>
                        {row.type}, {row.room}. Record {row.mrn}
                        {row.allergy_list ? `, allergy to ${row.allergy_list}` : ""}
                      </span>
                    </div>
                    <div className="row-side">
                      {row.status === "confirmed" && <span className="badge badge-success">Confirmed</span>}
                      {row.status === "completed" && <span className="badge badge-info">Seen</span>}
                      {row.status === "cancelled" && <span className="badge badge-error">Cancelled</span>}
                      <Link className="btn btn-secondary btn-sm" href={`/clinic/patients/${row.patient_id}`}>
                        Open chart
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="panel-body">
                <div className="empty">
                  <i className="ph ph-calendar-blank" aria-hidden="true" />
                  <h3>Nothing booked today</h3>
                  <p>Appointments added from the schedule appear here.</p>
                </div>
              </div>
            )}
          </section>

          <div style={{ display: "grid", gap: 24 }}>
            <section className="panel">
              <div className="panel-head"><h3>Record integrity</h3></div>
              <div className="panel-body">
                <div className={chain.ok ? "alert alert-success" : "alert alert-critical"}>
                  <i className={`ph ph-${chain.ok ? "check-circle" : "warning-octagon"}`} aria-hidden="true" />
                  <span>
                    {chain.ok ? (
                      <>
                        <strong>Audit chain intact.</strong> {chain.checked} entries verified end to end.
                        Every entry commits to the one before it, so a deleted or edited row would show here.
                      </>
                    ) : (
                      <>
                        <strong>Audit chain broken at entry {chain.brokenAtSeq}.</strong>{" "}
                        The trail has been altered. Escalate before relying on it.
                      </>
                    )}
                  </span>
                </div>
                <Link className="btn btn-secondary btn-sm" href="/clinic/audit">Open the audit trail</Link>
              </div>
            </section>

            {drafts.length > 0 && (
              <section className="panel">
                <div className="panel-head"><h3>Finish these drafts</h3></div>
                <div className="panel-body">
                  {drafts.map((plan) => (
                    <Link
                      className="card card-soft"
                      key={plan.id}
                      href={`/clinic/patients/${plan.patient_id}`}
                      style={{ textDecoration: "none", display: "grid", gap: 6 }}
                    >
                      <strong style={{ font: "var(--title-sm)", color: "var(--ink)" }}>
                        {plan.phase === "pre" ? "Pre" : "Post"}-treatment, {plan.patient_name}
                      </strong>
                      <span className="meta">{plan.procedure}</span>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {held.length > 0 && (
              <section className="panel">
                <div className="panel-head"><h3>Results to release</h3></div>
                <div className="panel-body">
                  {held.map((report) => (
                    <Link
                      className="card card-soft"
                      key={report.id}
                      href={`/clinic/patients/${report.patient_id}`}
                      style={{ textDecoration: "none", display: "grid", gap: 6 }}
                    >
                      <strong style={{ font: "var(--title-sm)", color: "var(--ink)" }}>{report.title}</strong>
                      <span className="meta">{report.patient_name}, {report.kind}</span>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
