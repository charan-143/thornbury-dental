import Link from "next/link";
import { requireStaff } from "@/lib/authz";
import { db } from "@/lib/db";
import { PatientRosterView, RosterPatient } from "@/components/patient-roster-view";

export const dynamic = "force-dynamic";

type Row = {
  id: string; mrn: string; name: string; dob: Date; photo: string | null;
  last_visit: Date | null; allergy_count: number; next_visit: Date | null;
};

export default async function PatientsPage() {
  await requireStaff("/clinic/patients");

  let patients: Row[] = [];
  try {
    patients = (await db()`
      SELECT p.id, p.mrn, p.name, p.dob, p.photo, p.last_visit,
             (SELECT count(*)::int FROM allergies a WHERE a.patient_id = p.id) AS allergy_count,
             (SELECT min(ap.starts_at) FROM appointments ap
               WHERE ap.patient_id = p.id AND ap.status = 'confirmed' AND ap.starts_at >= now()) AS next_visit
      FROM patients p
      ORDER BY p.name
    `) as unknown as Row[];
  } catch (err) {
    try {
      patients = (await db()`
        SELECT p.id, p.mrn, p.name, p.dob, NULL AS photo, NULL AS last_visit,
               0 AS allergy_count, NULL AS next_visit
        FROM patients p ORDER BY p.name
      `) as unknown as Row[];
    } catch (e2) {
      patients = [];
    }
  }

  const formattedPatients: RosterPatient[] = patients.map((p) => ({
    id: p.id,
    mrn: p.mrn,
    name: p.name,
    dob: p.dob instanceof Date ? p.dob.toISOString() : String(p.dob),
    photo: p.photo,
    last_visit: p.last_visit ? (p.last_visit instanceof Date ? p.last_visit.toISOString() : String(p.last_visit)) : null,
    allergy_count: p.allergy_count,
    next_visit: p.next_visit ? (p.next_visit instanceof Date ? p.next_visit.toISOString() : String(p.next_visit)) : null,
  }));

  return (
    <>
      <header className="topbar">
        <h1>Patients</h1>
        <div className="spacer" />
        <Link className="btn btn-primary btn-sm" href="/clinic/patients/new">
          <i className="ph ph-plus" aria-hidden="true" /> Register a patient
        </Link>
      </header>

      <main className="page" id="main">
        <p className="page-intro">
          Everyone registered with the practice. Opening a chart is recorded in the audit
          trail against your name.
        </p>

        <section className="panel">
          <PatientRosterView patients={formattedPatients} />
        </section>
      </main>
    </>
  );
}
