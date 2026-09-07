import Link from "next/link";
import { requireStaff } from "@/lib/authz";
import { db, isoDate } from "@/lib/db";
import { DURATIONS, freeSlots, isClosed } from "@/lib/scheduling";
import { NewAppointmentForm } from "@/components/clinical-forms";
import { AppointmentDatePicker } from "@/components/appointment-date-picker";

/**
 * Book an appointment into the signed-in clinician diary.
 *
 * Length is chosen with a link rather than a control inside the form, because
 * changing it changes which times are free and that is computed on the server.
 */

export const dynamic = "force-dynamic";

type Patient = { id: string; name: string; mrn: string };

const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default async function NewAppointmentPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; slot?: string; duration?: string }>;
}) {
  const user = await requireStaff("/clinic/schedule/new");
  const params = await searchParams;

  const date = params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : isoDate();
  const requested = Number(params.duration ?? 30);
  const duration = DURATIONS.includes(requested as (typeof DURATIONS)[number]) ? requested : 30;

  const patients = (await db()`
    SELECT id, name, mrn FROM patients ORDER BY name
  `) as unknown as Patient[];

  const slots = await freeSlots(user.clinicianId, date, duration);

  return (
    <>
      <header className="topbar">
        <div>
          <h1>New Appointment</h1>
          <p className="meta">Booking into {user.name}&apos;s surgery diary</p>
        </div>
        <div className="spacer" />
        <Link className="btn btn-secondary btn-sm" href={`/clinic/schedule?date=${date}`}>
          <i className="ph ph-x" aria-hidden="true" /> Cancel
        </Link>
      </header>

      <main className="page" id="main" style={{ maxWidth: 840 }}>
        {/* Date & Length Selectors Panel */}
        <section className="panel" style={{ padding: "var(--s-md)" }}>
          <div className="panel-body" style={{ gap: "var(--s-md)" }}>
            {/* Date Picker (Quick Cards & Custom Date Input) */}
            <AppointmentDatePicker date={date} duration={duration} minDate={isoDate()} />

            {/* Duration Pills */}
            <div className="field" style={{ marginTop: 4 }}>
              <span style={{ fontWeight: 500, display: "block", marginBottom: 6 }}>
                Appointment Length
              </span>
              <div className="chip-row">
                {DURATIONS.map((d) => (
                  <Link
                    key={d}
                    className={`apt-duration-chip ${d === duration ? "is-selected" : ""}`}
                    aria-pressed={d === duration}
                    href={`/clinic/schedule/new?date=${date}&duration=${d}`}
                  >
                    <i className="ph ph-clock" aria-hidden="true" />
                    <span>{d} min</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>

        {isClosed(date) && (
          <div className="alert alert-warning">
            <i className="ph ph-moon" aria-hidden="true" />
            <span>The practice is closed on Sundays. Please choose another date.</span>
          </div>
        )}

        {patients.length === 0 && (
          <div className="alert alert-warning">
            <i className="ph ph-warning" aria-hidden="true" />
            <span>
              No patients are registered yet.{" "}
              <Link href="/clinic/patients/new">Register a patient first</Link> to enable booking.
            </span>
          </div>
        )}

        {/* Main Appointment Form */}
        <NewAppointmentForm
          patients={patients}
          date={date}
          slots={slots}
          duration={duration}
          preselected={params.slot}
        />
      </main>
    </>
  );
}
