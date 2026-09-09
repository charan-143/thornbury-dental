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
  const user = await requireStaff("/clinic/patients");

  // Filter so each clinician only sees their own patients (assigned or treated)
  const isAdmin = user.role === "admin";
  const patients = (await db()`
    SELECT p.id, p.mrn, p.name, p.dob, p.photo, p.last_visit,
           COALESCE(al.allergy_count, 0)::int AS allergy_count,
           ap.next_visit
    FROM patients p
    LEFT JOIN (
      SELECT patient_id, count(*)::int AS allergy_count
      FROM allergies
      GROUP BY patient_id
    ) al ON al.patient_id = p.id
    LEFT JOIN (
      SELECT patient_id, min(starts_at) AS next_visit
      FROM appointments
      WHERE status = 'confirmed' AND starts_at >= now()
      GROUP BY patient_id
    ) ap ON ap.patient_id = p.id
    WHERE (${isAdmin}::boolean = true) OR (
      p.primary_clinician_id = ${user.clinicianId}
      OR EXISTS (SELECT 1 FROM appointments a WHERE a.patient_id = p.id AND a.clinician_id = ${user.clinicianId})
      OR EXISTS (SELECT 1 FROM plans pl WHERE pl.patient_id = p.id AND pl.clinician_id = ${user.clinicianId})
      OR EXISTS (SELECT 1 FROM prescriptions pr WHERE pr.patient_id = p.id AND pr.clinician_id = ${user.clinicianId})
      OR EXISTS (SELECT 1 FROM reports rp WHERE rp.patient_id = p.id AND rp.clinician_id = ${user.clinicianId})
    )
    ORDER BY p.name
  `) as unknown as Row[];

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
          {isAdmin
            ? "Practice-wide patient registry. Opening a chart is recorded in the audit trail against your name."
            : "Your assigned patients and patients under your clinical care. Opening a chart is recorded in the audit trail against your name."}
        </p>

        <section className="panel">
          <PatientRosterView patients={formattedPatients} />
        </section>
      </main>
    </>
  );
}
