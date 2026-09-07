import Link from "next/link";
import { requireStaff } from "@/lib/authz";
import { NewPatientForm } from "@/components/clinical-forms";

/**
 * Register a patient.
 *
 * Any staff member can do this: a receptionist taking details over the phone
 * is the normal path into the record, and gating it behind an administrator
 * would just move the work.
 */

export const dynamic = "force-dynamic";

export default async function NewPatientPage() {
  await requireStaff("/clinic/patients/new");

  return (
    <>
      <header className="topbar">
        <h1>Register a patient</h1>
        <div className="spacer" />
        <Link className="btn btn-secondary btn-sm" href="/clinic/patients">Cancel</Link>
      </header>

      <main className="page" id="main" style={{ maxWidth: 720 }}>
        <p className="page-intro">
          The record number is generated. Everything except the name and date of birth can be
          filled in later from the chart.
        </p>
        <NewPatientForm />
      </main>
    </>
  );
}
