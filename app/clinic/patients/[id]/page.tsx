import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/authz";
import { db } from "@/lib/db";
import { DentalChart } from "@/components/dental-chart";
import { PatientChartTabs } from "@/components/patient-chart-tabs";
import { PatientDemographicsView } from "@/components/patient-demographics-view";
import { TreatmentPlansView } from "@/components/treatment-plans-view";
import { PrescriptionsView } from "@/components/prescriptions-view";
import { ReportsAndImagingView, type ReportItem } from "@/components/reports-and-imaging-view";

/**
 * Patient chart.
 *
 * Enhanced encounter view with interactive 32-tooth odontogram, tabbed section
 * navigation, dedicated Demographics/Overview tab, and high-visibility medical safety warnings.
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

type Patient = {
  id: string;
  mrn: string;
  op_no: string | null;
  name: string;
  dob: Date;
  phone: string | null;
  email: string | null;
  address: string | null;
  medical_history: string | null;
  family_history: string | null;
  past_dental_history: string | null;
  photo: string | null;
  last_visit: Date | null;
};
type Allergy = { substance: string; reaction: string; severity: string };
type Appt = { id: string; starts_at: Date; duration_min: number; type: string; status: string; clinician_name: string };
type Plan = { id: string; procedure: string; phase: string; published_at: Date | null; clinician_name: string };
type Step = { plan_id: string; title: string; detail: string };
type Addendum = { plan_id: string; body: string; created_at: Date };
type Rx = { id: string; drug: string; dose: string; frequency: string; duration_days: number; indication: string; issued_at: Date; override_reason: string | null; clinician_name: string };

export default async function PatientChartPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireStaff(`/clinic/patients/${id}`);

  const sql = db();

  // No fallback: a read that fails must not collapse into an empty result.
  // notFound() below means "there is no such patient", and a swallowed error
  // would make an unreachable database say exactly that about someone whose
  // record exists.
  const found = (await sql`
    SELECT id, mrn, op_no, name, dob, phone, email, address, medical_history, family_history, past_dental_history, photo, last_visit
    FROM patients WHERE id = ${id}
  `) as unknown as Patient[];

  const patient = found[0];
  if (!patient) notFound();

  // If not admin, restrict chart access to only clinicians who treat this patient
  if (user.role !== "admin") {
    const accessCheck = (await sql`
      SELECT 1 FROM patients p
      WHERE p.id = ${id}
        AND (
          p.primary_clinician_id = ${user.clinicianId}
          OR EXISTS (SELECT 1 FROM appointments a WHERE a.patient_id = p.id AND a.clinician_id = ${user.clinicianId})
          OR EXISTS (SELECT 1 FROM plans pl WHERE pl.patient_id = p.id AND pl.clinician_id = ${user.clinicianId})
          OR EXISTS (SELECT 1 FROM prescriptions pr WHERE pr.patient_id = p.id AND pr.clinician_id = ${user.clinicianId})
          OR EXISTS (SELECT 1 FROM reports rp WHERE rp.patient_id = p.id AND rp.clinician_id = ${user.clinicianId})
        )
    `) as unknown as Array<{ "?column?": number }>;

    if (!accessCheck || accessCheck.length === 0) {
      notFound();
    }
  }

  // All independent database queries are executed in parallel via Promise.all()

  // The reads below deliberately have no fallback.
  //
  // An empty allergy list is not a neutral default. It renders as "no known
  // allergies", which is a claim about the patient rather than about the
  // database, and it is the claim the prescribing screen checks against before
  // it will warn about a conflict. Swallowing a failure here turns a database
  // outage into a silent green light to prescribe penicillin to someone
  // allergic to it. The same reasoning applies to recorded conditions.
  //
  // If any of this cannot be read the page throws and app/error.tsx says so
  // plainly. A chart that refuses to load is safe. A chart that loads looking
  // complete while missing its warnings is not.
  //
  // All independent database queries are executed in parallel via Promise.all()
  // to eliminate the async network waterfall and minimize TTFB.
  const [
    allergies,
    conditions,
    clinicians,
    appts,
    plans,
    steps,
    addenda,
    rxs,
    reports,
    savedChartRows,
  ] = await Promise.all([
    sql`
      SELECT substance, reaction, severity FROM allergies WHERE patient_id = ${id}
    ` as unknown as Promise<Allergy[]>,

    sql`
      SELECT label FROM conditions WHERE patient_id = ${id}
    ` as unknown as Promise<Array<{ label: string }>>,

    sql`
      SELECT id, name FROM clinicians ORDER BY name
    ` as unknown as Promise<Array<{ id: string; name: string }>>,

    sql`
      SELECT a.id, a.starts_at, a.duration_min, a.type, a.status, c.name AS clinician_name
      FROM appointments a JOIN clinicians c ON c.id = a.clinician_id
      WHERE a.patient_id = ${id} ORDER BY a.starts_at DESC LIMIT 8
    ` as unknown as Promise<Appt[]>,

    sql`
      SELECT p.id, p.procedure, p.phase, p.published_at, c.name AS clinician_name
      FROM plans p JOIN clinicians c ON c.id = p.clinician_id
      WHERE p.patient_id = ${id} ORDER BY p.created_at DESC
    ` as unknown as Promise<Plan[]>,

    sql`
      SELECT s.plan_id, s.title, s.detail FROM plan_steps s
      JOIN plans p ON p.id = s.plan_id WHERE p.patient_id = ${id} ORDER BY s.ordinal
    ` as unknown as Promise<Step[]>,

    sql`
      SELECT a.plan_id, a.body, a.created_at FROM plan_addenda a
      JOIN plans p ON p.id = a.plan_id WHERE p.patient_id = ${id} ORDER BY a.created_at
    ` as unknown as Promise<Addendum[]>,

    sql`
      SELECT r.id, r.drug, r.dose, r.frequency, r.duration_days, r.indication, r.issued_at,
             r.override_reason, c.name AS clinician_name
      FROM prescriptions r JOIN clinicians c ON c.id = r.clinician_id
      WHERE r.patient_id = ${id} ORDER BY r.issued_at DESC
    ` as unknown as Promise<Rx[]>,

    sql`
      SELECT r.id, r.kind, r.title, r.summary, r.image, r.taken_at, r.released_at, r.clinician_id, c.name AS clinician_name
      FROM reports r LEFT JOIN clinicians c ON c.id = r.clinician_id
      WHERE r.patient_id = ${id} ORDER BY r.taken_at DESC
    ` as unknown as Promise<ReportItem[]>,

    sql`
      SELECT tooth_num, condition, notes FROM dental_chart WHERE patient_id = ${id}
    ` as unknown as Promise<Array<{ tooth_num: number; condition: string; notes: string | null }>>,
  ]);

  const overviewSection = (
    <div key="sec-overview">
      <PatientDemographicsView
        patient={{
          ...patient,
          allergies,
          conditions,
        }}
      />
    </div>
  );

  const odontogramSection = (
    <div key="sec-odontogram" style={{ display: "grid", gap: 24 }}>
      <DentalChart
        patientId={patient.id}
        initialChart={savedChartRows}
        conditions={conditions}
      />
    </div>
  );

  const plansSection = (
    <TreatmentPlansView
      key="sec-plans"
      patientId={patient.id}
      plans={plans}
      steps={steps}
      addenda={addenda}
      conditions={conditions}
    />
  );

  const rxsSection = (
    <PrescriptionsView
      key="sec-rxs"
      patientId={patient.id}
      patientName={patient.name}
      patientMrn={patient.mrn}
      patientOpNo={patient.op_no}
      patientAddress={patient.address}
      allergies={allergies}
      rxs={rxs}
    />
  );

  const reportsSection = (
    <ReportsAndImagingView
      key="sec-reports"
      patientId={patient.id}
      patientName={patient.name}
      reports={reports}
      clinicians={clinicians}
      currentClinicianId={user.clinicianId}
    />
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

  const displayOpNo = patient.op_no || patient.mrn;

  return (
    <>
      <header className="topbar">
        <div>
          <h1>{patient.name}</h1>
          <p className="meta">OP No: {displayOpNo} • MRN: {patient.mrn} • {age(patient.dob)} years old</p>
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
          odontogramContent={odontogramSection}
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
