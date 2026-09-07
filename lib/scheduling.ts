import { db, isoDate } from "./db";

/**
 * Availability.
 *
 * One definition, used by the grid that draws free slots, the form that offers
 * them, and the action that writes the booking. Three copies of this logic is
 * how the previous version ended up offering a slot it then refused.
 *
 * This is for showing people what is free. It is not the guarantee: the
 * appointments table carries an exclusion constraint, so the database refuses
 * an overlap even if two requests race past the check below.
 */

export const OPENING = { startHour: 8, endHour: 17, stepMinutes: 30 } as const;

const pad = (n: number) => String(n).padStart(2, "0");

/** Every bookable half hour of the working day, as "HH:MM". */
export const SLOTS: string[] = (() => {
  const out: string[] = [];
  for (let m = OPENING.startHour * 60; m < OPENING.endHour * 60; m += OPENING.stepMinutes) {
    out.push(`${pad(Math.floor(m / 60))}:${pad(m % 60)}`);
  }
  return out;
})();

export const DURATIONS = [30, 45, 60, 90] as const;

export function slotOf(value: Date | string): string {
  const d = value instanceof Date ? value : new Date(value);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function minutesOf(slot: string): number {
  const [h, m] = slot.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function shiftDate(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return isoDate(d);
}

/** The practice does not open on Sundays. */
export function isClosed(iso: string): boolean {
  return new Date(`${iso}T12:00:00`).getDay() === 0;
}

/**
 * The instants a local calendar day starts and ends.
 *
 * Comparing a TIMESTAMPTZ against a bare date literal resolves that date in
 * the database session zone, not the practice zone. At a large positive offset an
 * 08:00 appointment is stored on the previous UTC day and silently drops out
 * of the schedule. Resolving both ends in the same frame the pages render in
 * removes that class of disappearance.
 */
export function dayBounds(iso: string): { startIso: string; endIso: string } {
  const start = new Date(`${iso}T00:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

type Busy = { starts_at: Date; duration_min: number };

/**
 * Slots where an appointment of `durationMin` fits without overlapping
 * anything and without running past closing. `excludeId` lets a reschedule
 * ignore the appointment being moved.
 */
export async function freeSlots(
  clinicianId: string,
  iso: string,
  durationMin: number,
  options: { excludeId?: string } = {},
): Promise<string[]> {
  if (isClosed(iso)) return [];

  const exclude = options.excludeId ?? null;
  const { startIso, endIso } = dayBounds(iso);
  const rows = (await db()`
    SELECT starts_at, duration_min FROM appointments
    WHERE clinician_id = ${clinicianId}
      AND status <> 'cancelled'
      AND (${exclude}::text IS NULL OR id <> ${exclude})
      AND starts_at >= ${startIso}
      AND starts_at < ${endIso}
  `) as unknown as Busy[];

  // Every half hour any existing appointment occupies, not just its first.
  const taken = new Set<number>();
  for (const row of rows) {
    const start = minutesOf(slotOf(row.starts_at));
    const spans = Math.max(1, Math.ceil(row.duration_min / OPENING.stepMinutes));
    for (let i = 0; i < spans; i += 1) taken.add(start + i * OPENING.stepMinutes);
  }

  const needed = Math.max(1, Math.ceil(durationMin / OPENING.stepMinutes));
  const closing = OPENING.endHour * 60;

  return SLOTS.filter((slot) => {
    const start = minutesOf(slot);
    for (let i = 0; i < needed; i += 1) {
      const minute = start + i * OPENING.stepMinutes;
      if (minute >= closing) return false;
      if (taken.has(minute)) return false;
    }
    return true;
  });
}
