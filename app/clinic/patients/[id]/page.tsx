import Link from "next/link";
import { notFound } from "next/navigation";
import { recordChartAccess, requireStaff } from "@/lib/authz";
import { db } from "@/lib/db";
import { DentalChart } from "@/components/dental-chart";
import { PatientChartTabs } from "@/components/patient-chart-tabs";

/**
 * Patient chart.
 *
 * Enhanced encounter view with interactive 32-tooth odontogram, tabbed section
 * navigation, and high-visibility medical safety warnings.
 */

export const dynamic = "force-dynamic";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pad = (n: number) => String(n).padStart(2, "0");

const asDate = (v: Date | string) => (v instanceof Date ? v : new Date(v));
const day = (v: Date | string | null) =>
  v ? `${asDate(v).getDate()} ${MONTHS[asDate(v).getMonth()]} ${asDate(v).getFullYear()}` : "not recorded";
const time = (v: Date | string) => `${pad(asDate(v).getHours())}:${pad(asDate(v).getMinutes())}`;

function age(dob: Date | string): number {
  const born = asDate(dob);
  const now = new Date();
  let y = now.getFullYear() - born.getFullYear();
  const m = now.getMonth() - born.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < born.getDate())) y -= 1;
  return y;
}

type Patient = { id: string; mrn: string; name: string; dob: Date; phone: string | null; email: string | null; photo: string | null; last_visit: Date | null };
type Allergy = { substance: string; reaction: string; severity: string };
type Appt = { id: string; starts_at: Date; duration_min: number; type: string; status: string; clinician_name: string };
type Plan = { id: string; procedure: string; phase: string; published_at: Date | null; clinician_name: string };
type Step = { plan_id: string; title: string; detail: string };
type Addendum = { plan_id: string; body: string; created_at: Date };
type Rx = { id: string; drug: string; dose: string; frequency: string; duration_days: number; indication: string; issued_at: Date; override_reason: string | null; clinician_name: string };
type Report = { id: string; kind: string; title: string; summary: string; taken_at: Date; released_at: Date | null };

export default async function PatientChartPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireStaff(`/clinic/patients/${id}`);

  const sql = db();
  const found = (await sql`
    SELECT id, mrn, name, dob, phone, email, photo, last_visit FROM patients WHERE id = ${id}
  `) as unknown as Patient[];
  const patient = found[0];
  if (!patient) notFound();

  // Recorded before anything clinical is read.
  await recordChartAccess(user, patient.id, "opened a patient chart");

  const allergies = (await sql`SELECT substance, reaction, severity FROM allergies WHERE patient_id = ${id}`) as unknown as Allergy[];
  const conditions = (await sql`SELECT label FROM conditions WHERE patient_id = ${id}`) as unknown as Array<{ label: string }>;
  const appts = (await sql`
    SELECT a.id, a.starts_at, a.duration_min, a.type, a.status, c.name AS clinician_name
    FROM appointments a JOIN clinicians c ON c.id = a.clinician_id
    WHERE a.patient_id = ${id} ORDER BY a.starts_at DESC LIMIT 8`) as unknown as Appt[];
  const plans = (await sql`
    SELECT p.id, p.procedure, p.phase, p.published_at, c.name AS clinician_name
    FROM plans p JOIN clinicians c ON c.id = p.clinician_id
    WHERE p.patient_id = ${id} ORDER BY p.created_at DESC`) as unknown as Plan[];
  const steps = (await sql`
    SELECT s.plan_id, s.title, s.detail FROM plan_steps s
    JOIN plans p ON p.id = s.plan_id WHERE p.patient_id = ${id} ORDER BY s.ordinal`) as unknown as Step[];
  const addenda = (await sql`
    SELECT a.plan_id, a.body, a.created_at FROM plan_addenda a
    JOIN plans p ON p.id = a.plan_id WHERE p.patient_id = ${id} ORDER BY a.created_at`) as unknown as Addendum[];
  const rxs = (await sql`
    SELECT r.id, r.drug, r.dose, r.frequency, r.duration_days, r.indication, r.issued_at,
           r.override_reason, c.name AS clinician_name
    FROM prescriptions r JOIN clinicians c ON c.id = r.clinician_id
    WHERE r.patient_id = ${id} ORDER BY r.issued_at DESC`) as unknown as Rx[];
  const reports = (await sql`
    SELECT id, kind, title, summary, taken_at, released_at FROM reports
    WHERE patient_id = ${id} ORDER BY taken_at DESC`) as unknown as Report[];

  const overviewSection = (
    <div key="sec-overview" style={{ display: "grid", gap: 24 }}>
      {/* 32-Tooth Odontogram */}
      <DentalChart patientId={patient.id} />

      {/* Record Demographics & Warnings */}
      <section className="panel">
        <div className="panel-head">
          <h2>Patient Demographics & Medical Safety</h2>
          <div className="spacer" />
          <span className="badge badge-info">{age(patient.dob)} years</span>
          <span className="badge">{patient.mrn}</span>
        </div>
        <div className="panel-body">
          {allergies.length > 0 ? allergies.map((a, idx) => (
            <div className="alert alert-critical" key={`alg-${a.substance}-${idx}`} role="alert">
              <i className="ph ph-warning-octagon" aria-hidden="true" />
              <span>
                <strong>ALLERGY ALERT: {a.substance}, {a.severity}.</strong> {a.reaction}.
                Check before prescribing or administering treatment.
              </span>
            </div>
          )) : (
            <div className="alert">
              <i className="ph ph-info" aria-hidden="true" />
              <span>No allergies recorded on file.</span>
            </div>
          )}

          {conditions.length > 0 && (
            <div className="alert alert-warning">
              <i className="ph ph-heartbeat" aria-hidden="true" />
              <span><strong>Medical History:</strong> {conditions.map((c) => c.label).join(". ")}.</span>
            </div>
          )}

          <dl className="dl">
            <dt>Date of birth</dt><dd>{day(patient.dob)}</dd>
            <dt>Telephone</dt><dd>{patient.phone ?? "not recorded"}</dd>
            <dt>Email</dt><dd>{patient.email ?? "not recorded"}</dd>
            <dt>Last visit</dt><dd>{day(patient.last_visit)}</dd>
          </dl>
        </div>
      </section>
    </div>
  );

  const plansSection = (
    <section key="sec-plans" className="panel">
      <div className="panel-head">
        <h2>Treatment Plans</h2>
        <div className="spacer" />
        <span className="badge">{plans.length} total</span>
      </div>
      <div className="panel-body">
        {plans.length ? plans.map((plan) => (
          <article className="card" key={`plan-${plan.id}`} style={{ display: "grid", gap: 12 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <strong style={{ font: "var(--title-md)", color: "var(--ink)" }}>
                {plan.phase === "pre" ? "Before" : "After"} {plan.procedure}
              </strong>
              <span style={{ marginLeft: "auto" }}>
                {plan.published_at
                  ? <span className="locked"><i className="ph ph-lock-simple" aria-hidden="true" /> Locked {day(plan.published_at)}</span>
                  : <span className="badge badge-warning">Draft</span>}
              </span>
            </div>
            <div className="steps">
              {steps.filter((s) => s.plan_id === plan.id).map((s, idx) => (
                <div className="step" key={`step-${plan.id}-${idx}`}>
                  <i className="ph ph-dot-outline" aria-hidden="true" />
                  <div><strong>{s.title}</strong>{s.detail ? <p>{s.detail}</p> : null}</div>
                </div>
              ))}
            </div>
            {addenda.filter((a) => a.plan_id === plan.id).map((a, idx) => (
              <div className="alert" key={`add-${plan.id}-${idx}`}>
                <i className="ph ph-note-pencil" aria-hidden="true" />
                <span><strong>{day(a.created_at)}.</strong> {a.body}</span>
              </div>
            ))}
            <p className="meta">Written by {plan.clinician_name}.</p>
          </article>
        )) : <p className="meta">No treatment plans recorded.</p>}
      </div>
    </section>
  );

  const rxsSection = (
    <section key="sec-rxs" className="panel">
      <div className="panel-head">
        <h2>Prescriptions</h2>
        <div className="spacer" />
        <span className="badge">{rxs.length} total</span>
      </div>
      <div className="panel-body">
        {rxs.length ? rxs.map((rx) => (
          <div className="card card-soft" key={`rx-${rx.id}`} style={{ display: "grid", gap: 6 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
              <strong style={{ font: "var(--title-sm)", color: "var(--ink)" }}>{rx.drug} {rx.dose}</strong>
              <span className="meta">{rx.frequency}, {rx.duration_days} days</span>
              <span className="locked" style={{ marginLeft: "auto" }}>
                <i className="ph ph-lock-simple" aria-hidden="true" /> {day(rx.issued_at)}
              </span>
            </div>
            <span className="meta">{rx.indication}. Prescribed by {rx.clinician_name}.</span>
            {rx.override_reason && (
              <div className="alert alert-warning">
                <i className="ph ph-warning" aria-hidden="true" />
                <span><strong>Issued over a blocking alert.</strong> {rx.override_reason}</span>
              </div>
            )}
          </div>
        )) : <p className="meta">Nothing issued.</p>}
      </div>
    </section>
  );

  const reportsSection = (
    <section key="sec-reports" className="panel">
      <div className="panel-head">
        <h2>Reports & Imaging</h2>
        <div className="spacer" />
        <span className="badge">{reports.length} total</span>
      </div>
      <div className="panel-body">
        {reports.length ? reports.map((r) => (
          <div className="card card-soft" key={`rep-${r.id}`} style={{ display: "grid", gap: 8 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <strong style={{ font: "var(--title-sm)", color: "var(--ink)" }}>{r.title}</strong>
              <span className="badge badge-info">{r.kind}</span>
              <span style={{ marginLeft: "auto" }}>
                {r.released_at
                  ? <span className="badge badge-success">Released {day(r.released_at)}</span>
                  : <span className="badge badge-warning">Held for review</span>}
              </span>
            </div>
            <p className="meta">{r.summary}</p>
          </div>
        )) : <p className="meta">No imaging or test records.</p>}
      </div>
    </section>
  );

  const apptsSection = (
    <section key="sec-appts" className="panel">
      <div className="panel-head">
        <h2>Visit History</h2>
        <div className="spacer" />
        <span className="badge">{appts.length} visits</span>
      </div>
      <div className="panel-body flush">
        {appts.length ? (
          <div className="rows">
            {appts.map((a) => (
              <div className="row" key={`appt-${a.id}`} style={{ gridTemplateColumns: "1fr auto" }}>
                <div className="row-main">
                  <strong>{a.type}</strong>
                  <span>{day(a.starts_at)} at {time(a.starts_at)}, {a.duration_min} min, {a.clinician_name}</span>
                </div>
                <span className="badge">{a.status}</span>
              </div>
            ))}
          </div>
        ) : <p className="meta" style={{ padding: 24 }}>No visits recorded.</p>}
      </div>
    </section>
  );

  return (
    <>
      <header className="topbar">
        <div>
          <h1>{patient.name}</h1>
          <p className="meta">MRN: {patient.mrn} • {age(patient.dob)} years old</p>
        </div>
        <div className="spacer" />
        <Link className="btn btn-primary btn-sm" href={`/clinic/schedule/new?patientId=${patient.id}`}>
          <i className="ph ph-calendar-plus" aria-hidden="true" /> Book Appointment
        </Link>
        <Link className="btn btn-secondary btn-sm" href="/clinic/patients">
          All Patients
        </Link>
      </header>

      <main className="page" id="main">
        <PatientChartTabs
          overviewContent={overviewSection}
          plansContent={plansSection}
          rxsContent={rxsSection}
          reportsContent={reportsSection}
          apptsContent={apptsSection}
          counts={{
            plans: plans.length,
            rxs: rxs.length,
            reports: reports.length,
            appts: appts.length,
          }}
        />
      </main>
    </>
  );
}
