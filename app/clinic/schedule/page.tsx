import Link from "next/link";
import { requireStaff } from "@/lib/authz";
import { db, isoDate } from "@/lib/db";
import { dayBounds, isClosed, shiftDate, slotOf, SLOTS } from "@/lib/scheduling";
import { setAppointmentStatusAction } from "@/actions/clinical";
import { ScheduleView, ScheduleAppointment } from "@/components/schedule-view";

export const dynamic = "force-dynamic";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

type Row = {
  id: string; starts_at: Date; duration_min: number; type: string; status: string; room: string;
  patient_id: string; patient_name: string; allergy_count: number;
};

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const user = await requireStaff("/clinic/schedule");
  const { date } = await searchParams;

  const iso = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : isoDate();
  const closed = isClosed(iso);
  const { startIso, endIso } = dayBounds(iso);

  // No fallback. The discarded one dropped the day bounds and reported every
  // appointment ever booked as though it fell on the chosen date, flattened
  // every duration to 30 minutes, and set allergy_count to 0 — which is what
  // draws, or fails to draw, the allergy flag on each slot. The grid below
  // also uses duration_min to work out which half hours an appointment
  // already covers, so wrong durations there offer slots that are not free.
  const list = (await db()`
    SELECT a.id, a.starts_at, a.duration_min, a.type, a.status, a.room,
           p.id AS patient_id, p.name AS patient_name,
           (SELECT count(*)::int FROM allergies al WHERE al.patient_id = p.id) AS allergy_count
    FROM appointments a JOIN patients p ON p.id = a.patient_id
    WHERE a.clinician_id = ${user.clinicianId}
      AND a.starts_at >= ${startIso}
      AND a.starts_at < ${endIso}
    ORDER BY a.starts_at
  `) as unknown as Row[];

  const live = list.filter((r) => r.status !== "cancelled");

  // Half hours covered by an appointment that began earlier.
  const covered = new Set<string>();
  live.forEach((r) => {
    const [h, m] = slotOf(r.starts_at).split(":").map(Number);
    const start = (h ?? 0) * 60 + (m ?? 0);
    for (let i = 1; i < Math.ceil(r.duration_min / 30); i += 1) {
      const minute = start + i * 30;
      covered.add(`${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`);
    }
  });

  const shown = new Date(`${iso}T12:00:00`);
  const heading = `${DAYS[shown.getDay()]}, ${shown.getDate()} ${MONTHS[shown.getMonth()]} ${shown.getFullYear()}`;

  const formattedAppointments: ScheduleAppointment[] = list.map((r) => ({
    id: r.id,
    starts_at: r.starts_at.toISOString ? r.starts_at.toISOString() : String(r.starts_at),
    duration_min: r.duration_min,
    type: r.type,
    status: r.status,
    room: r.room,
    patient_id: r.patient_id,
    patient_name: r.patient_name,
    allergy_count: r.allergy_count,
  }));

  return (
    <>
      <header className="topbar">
        <h1>Schedule</h1>
        <div className="spacer" />
        <Link className="btn btn-primary btn-sm" href={`/clinic/schedule/new?date=${iso}`}>
          <i className="ph ph-plus" aria-hidden="true" /> New appointment
        </Link>
      </header>

      <main className="page" id="main">
        <p className="page-intro">
          Your own column only. Colleagues keep their lists in their own workspace, which is
          how row level access is meant to behave.
        </p>

        <section className="panel">
          <div className="panel-head" style={{ flexWrap: "wrap" }}>
            <h2>{heading}</h2>
            <div className="spacer" />
            <div className="day-nav">
              <Link className="btn btn-secondary btn-sm" href={`/clinic/schedule?date=${shiftDate(iso, -1)}`} aria-label="Previous day">
                <i className="ph ph-caret-left" aria-hidden="true" />
              </Link>
              <Link className="btn btn-secondary btn-sm" href="/clinic/schedule">Today</Link>
              <Link className="btn btn-secondary btn-sm" href={`/clinic/schedule?date=${shiftDate(iso, 1)}`} aria-label="Next day">
                <i className="ph ph-caret-right" aria-hidden="true" />
              </Link>
            </div>
          </div>

          <div className="panel-body flush">
            <ScheduleView
              iso={iso}
              heading={heading}
              closed={closed}
              slots={[...SLOTS]}
              appointments={formattedAppointments}
              coveredSlotsSet={Array.from(covered)}
              setAppointmentStatusAction={setAppointmentStatusAction}
            />
          </div>
        </section>
      </main>
    </>
  );
}
