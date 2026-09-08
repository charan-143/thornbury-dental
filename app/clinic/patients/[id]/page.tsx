import Link from "next/link";
import { notFound } from "next/navigation";
import { recordChartAccess, requireStaff } from "@/lib/authz";
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

  // Recorded before anything clinical is read. A chart that cannot be logged
  // is a chart that must not be shown: the access record is the only evidence
  // that this reading of the patient's notes ever happened.
  await recordChartAccess(user, patient.id, "opened a patient chart");

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
  const allergies = (await sql`
    SELECT substance, reaction, severity FROM allergies WHERE patient_id = ${id}
  `) as unknown as Allergy[];

  const conditions = (await sql`
    SELECT label FROM conditions WHERE patient_id = ${id}
  `) as unknown as Array<{ label: string }>;

  const clinicians = (await sql`
    SELECT id, name FROM clinicians ORDER BY name
  `) as unknown as Array<{ id: string; name: string }>;

  // The rest of the chart, on the same terms. Each of these fed a fallback
  // that quietly substituted wrong values for unreadable ones: a flat 30
  // minutes for every past appointment, a blank name in place of the clinician
  // who saw the patient, a prescription list with the override reasons
  // stripped out. Those are not degraded views of the record, they are a
  // different record, and nothing on the page said so.
  const appts = (await sql`
    SELECT a.id, a.starts_at, a.duration_min, a.type, a.status, c.name AS clinician_name
    FROM appointments a JOIN clinicians c ON c.id = a.clinician_id
    WHERE a.patient_id = ${id} ORDER BY a.starts_at DESC LIMIT 8
  `) as unknown as Appt[];

  const plans = (await sql`
    SELECT p.id, p.procedure, p.phase, p.published_at, c.name AS clinician_name
    FROM plans p JOIN clinicians c ON c.id = p.clinician_id
    WHERE p.patient_id = ${id} ORDER BY p.created_at DESC
  `) as unknown as Plan[];

  const steps = (await sql`
    SELECT s.plan_id, s.title, s.detail FROM plan_steps s
    JOIN plans p ON p.id = s.plan_id WHERE p.patient_id = ${id} ORDER BY s.ordinal
  `) as unknown as Step[];

  const addenda = (await sql`
    SELECT a.plan_id, a.body, a.created_at FROM plan_addenda a
    JOIN plans p ON p.id = a.plan_id WHERE p.patient_id = ${id} ORDER BY a.created_at
  `) as unknown as Addendum[];

  const rxs = (await sql`
    SELECT r.id, r.drug, r.dose, r.frequency, r.duration_days, r.indication, r.issued_at,
           r.override_reason, c.name AS clinician_name
    FROM prescriptions r JOIN clinicians c ON c.id = r.clinician_id
    WHERE r.patient_id = ${id} ORDER BY r.issued_at DESC
  `) as unknown as Rx[];

  const reports = (await sql`
    SELECT r.id, r.kind, r.title, r.summary, r.image, r.taken_at, r.released_at, r.clinician_id, c.name AS clinician_name
    FROM reports r LEFT JOIN clinicians c ON c.id = r.clinician_id
    WHERE r.patient_id = ${id} ORDER BY r.taken_at DESC
  `) as unknown as ReportItem[];

  // An empty odontogram draws all 32 teeth as sound. Falling back to it on a
  // read failure would assert a clean mouth for a patient whose charted decay
  // simply could not be loaded, and would then let a clinician chart on top of
  // that blank.
  const savedChartRows = (await sql`
    SELECT tooth_num, condition, notes FROM dental_chart WHERE patient_id = ${id}
  `) as Array<{ tooth_num: number; condition: string; notes: string | null }>;

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
      <DentalChart patientId={patient.id} initialChart={savedChartRows} />
    </div>
  );

  const plansSection = (
    <TreatmentPlansView
      key="sec-plans"
      patientId={patient.id}
      conditions={conditions}
      plans={plans}
      steps={steps}
      addenda={addenda}
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
