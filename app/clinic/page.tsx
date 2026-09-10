import Link from "next/link";
import { requireStaff } from "@/lib/authz";
import { db, isoDate } from "@/lib/db";
import { dayBounds } from "@/lib/scheduling";
import { setAppointmentStatusAction } from "@/actions/clinical";
import { TodayView, TodayAppointment } from "@/components/today-view";

export const dynamic = "force-dynamic";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

type Row = {
  id: string;
  starts_at: Date;
  duration_min: number;
  type: string;
  status: string;
  room: string;
  patient_id: string;
  patient_name: string;
  mrn: string;
  dob: Date;
  allergy_list: string | null;
  allergy_count: number;
};
type Draft = { id: string; procedure: string; phase: string; patient_name: string; patient_id: string };
type Held = { id: string; title: string; kind: string; patient_name: string; patient_id: string };

export default async function ClinicToday() {
  const user = await requireStaff("/clinic");
  const sql = db();
  const today = isoDate();
  const { startIso, endIso } = dayBounds(today);

  // Run queries in parallel for instant data availability
  const [list, drafts, held] = await Promise.all([
    sql`
      SELECT a.id, a.starts_at, a.duration_min, a.type, a.status, a.room,
             p.id AS patient_id, p.name AS patient_name, p.mrn, p.dob,
             (SELECT string_agg(al.substance, ', ') FROM allergies al WHERE al.patient_id = p.id) AS allergy_list,
             (SELECT count(*)::int FROM allergies al WHERE al.patient_id = p.id) AS allergy_count
      FROM appointments a
      JOIN patients p ON p.id = a.patient_id
      WHERE a.clinician_id = ${user.clinicianId}
        AND a.starts_at >= ${startIso}
        AND a.starts_at < ${endIso}
      ORDER BY a.starts_at ASC
    ` as unknown as Promise<Row[]>,

    sql`
      SELECT p.id, p.procedure, p.phase, pt.name AS patient_name, pt.id AS patient_id
      FROM plans p JOIN patients pt ON pt.id = p.patient_id
      WHERE p.clinician_id = ${user.clinicianId} AND p.published_at IS NULL
    ` as unknown as Promise<Draft[]>,

    sql`
      SELECT r.id, r.title, r.kind, pt.name AS patient_name, pt.id AS patient_id
      FROM reports r JOIN patients pt ON pt.id = r.patient_id
      WHERE r.clinician_id = ${user.clinicianId} AND r.released_at IS NULL
    ` as unknown as Promise<Held[]>,
  ]);

  const now = new Date();
  const active = list.filter((row) => row.status === "confirmed");
  const completed = list.filter((row) => row.status === "completed");
  const minutes = active.reduce((total, row) => total + (row.duration_min || 30), 0);
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const dateFormatted = `${DAYS[now.getDay()]}, ${now.getDate()} ${MONTHS[now.getMonth()]} ${now.getFullYear()}`;

  const formattedAppointments: TodayAppointment[] = list.map((row) => ({
    id: row.id,
    starts_at: row.starts_at instanceof Date ? row.starts_at.toISOString() : String(row.starts_at),
    duration_min: row.duration_min || 30,
    type: row.type,
    status: row.status,
    room: row.room || user.room || "Surgery 1",
    patient_id: row.patient_id,
    patient_name: row.patient_name,
    mrn: row.mrn,
    dob: row.dob instanceof Date ? row.dob.toISOString() : String(row.dob),
    allergy_list: row.allergy_list,
    allergy_count: row.allergy_count || 0,
  }));

  return (
    <>
      <header className="topbar">
        <div>
          <h1>{greeting}, {user.name}</h1>
          <p className="meta" style={{ marginTop: 2 }}>
            {dateFormatted} &bull; {user.room || "Surgery"} &bull; {active.length} appointments remaining today
          </p>
        </div>
        <div className="spacer" />
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Link className="btn btn-secondary btn-sm" href={`/clinic/schedule?date=${today}`}>
            <i className="ph ph-calendar" aria-hidden="true" /> View Schedule
          </Link>
          <Link className="btn btn-primary btn-sm" href={`/clinic/schedule/new?date=${today}`}>
            <i className="ph ph-plus" aria-hidden="true" /> New Appointment
          </Link>
        </div>
      </header>

      <main className="page" id="main">
        {/* KPI Summary Tiles */}
        <section className="tiles">
          <div className="tile tile-accent">
            <div className="k">
              <i className="ph ph-calendar-check" aria-hidden="true" /> Remaining Today
            </div>
            <div className="v">{active.length}</div>
            <div className="n">{completed.length} seen &bull; {list.length} total scheduled</div>
          </div>
          <div className="tile">
            <div className="k">
              <i className="ph ph-clock" aria-hidden="true" /> Chair Time Booked
            </div>
            <div className="v">{minutes}m</div>
            <div className="n">Active treatment minutes today</div>
          </div>
          <div className="tile">
            <div className="k">
              <i className="ph ph-note-pencil" aria-hidden="true" /> Draft Plans
            </div>
            <div className="v">{drafts.length}</div>
            <div className="n">Awaiting clinician publication</div>
          </div>
          <div className="tile">
            <div className="k">
              <i className="ph ph-file-text" aria-hidden="true" /> Results to Release
            </div>
            <div className="v">{held.length}</div>
            <div className="n">Diagnostics pending review</div>
          </div>
        </section>

        {/* Main Work Area: Day List on Left, Action Queue on Right */}
        <div className="cols-side">
          <section className="panel">
            <div className="panel-head">
              <h2>Appointments ({list.length})</h2>
              <div className="spacer" />
              <span className="badge badge-info" style={{ fontVariantNumeric: "tabular-nums" }}>
                {active.length} active
              </span>
            </div>
            <div className="panel-body flush">
              <TodayView
                dateIso={today}
                appointments={formattedAppointments}
                setAppointmentStatusAction={setAppointmentStatusAction}
              />
            </div>
          </section>

          {/* Right Column: Pending Action Queue & Quick Shortcuts */}
          <div style={{ display: "grid", gap: 24 }}>
            {/* Quick Actions Shortcuts */}
            <section className="panel">
              <div className="panel-head">
                <h3>Quick Shortcuts</h3>
              </div>
              <div className="panel-body" style={{ gap: 8 }}>
                <Link className="quick-action-link" href={`/clinic/schedule/new?date=${today}`}>
                  <i className="ph ph-calendar-plus" aria-hidden="true" />
                  <span>Book Appointment</span>
                </Link>
                <Link className="quick-action-link" href="/clinic/patients/new">
                  <i className="ph ph-user-plus" aria-hidden="true" />
                  <span>Register Patient</span>
                </Link>
                <Link className="quick-action-link" href="/clinic/patients">
                  <i className="ph ph-users-three" aria-hidden="true" />
                  <span>Find Patient Record</span>
                </Link>
              </div>
            </section>

            {/* Finish Drafts Panel */}
            {drafts.length > 0 && (
              <section className="panel">
                <div className="panel-head">
                  <h3>Draft Treatment Plans ({drafts.length})</h3>
                </div>
                <div className="panel-body">
                  {drafts.map((plan) => (
                    <Link
                      className="card card-soft"
                      key={plan.id}
                      href={`/clinic/patients/${plan.patient_id}`}
                      style={{ textDecoration: "none", display: "grid", gap: 6, transition: "transform 0.15s ease" }}
                    >
                      <strong style={{ font: "var(--title-sm)", color: "var(--ink)" }}>
                        {plan.phase === "pre" ? "Pre" : "Post"}-treatment &bull; {plan.patient_name}
                      </strong>
                      <span className="meta">{plan.procedure}</span>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Results to Release Panel */}
            {held.length > 0 && (
              <section className="panel">
                <div className="panel-head">
                  <h3>Results to Release ({held.length})</h3>
                </div>
                <div className="panel-body">
                  {held.map((report) => (
                    <Link
                      className="card card-soft"
                      key={report.id}
                      href={`/clinic/patients/${report.patient_id}`}
                      style={{ textDecoration: "none", display: "grid", gap: 6, transition: "transform 0.15s ease" }}
                    >
                      <strong style={{ font: "var(--title-sm)", color: "var(--ink)" }}>{report.title}</strong>
                      <span className="meta">{report.patient_name} &bull; {report.kind}</span>
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
