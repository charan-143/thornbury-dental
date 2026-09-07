"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/authz";
import { record } from "@/lib/audit";
import { db, newId } from "@/lib/db";
import { isClosed, minutesOf, OPENING } from "@/lib/scheduling";

/**
 * Clinical writes.
 *
 * Every one of these establishes who is asking before it touches a row, and
 * records what happened afterwards. The audit entry names the patient the
 * record belongs to, so a patient can later be shown everyone who touched
 * their record.
 */

/**
 * The error, plus whatever was submitted.
 *
 * Returning the values back matters: a server action re-renders the form, and
 * without them every field a clinician typed is wiped by a single validation
 * message. Losing a filled-in patient record to one bad date is the kind of
 * small cruelty that makes people avoid the system.
 */
export type ClinicalFormState = {
  error?: string;
  values?: Record<string, string>;
};

function submitted(formData: FormData, keys: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of keys) out[key] = String(formData.get(key) ?? "");
  return out;
}

const trimmed = (data: FormData, key: string) => String(data.get(key) ?? "").trim();

// ---------------------------------------------------------------------------
// patients
// ---------------------------------------------------------------------------

/**
 * Registers a patient with the practice.
 *
 * The medical record number is generated rather than typed. Letting staff key
 * it invites collisions and transcription errors, and the number is meaningless
 * outside this system anyway.
 */
export async function createPatientAction(
  _prev: ClinicalFormState,
  formData: FormData,
): Promise<ClinicalFormState> {
  const user = await requireStaff("/clinic/patients/new");

  const name = trimmed(formData, "name");
  const dob = trimmed(formData, "dob");
  const phone = trimmed(formData, "phone");
  const email = trimmed(formData, "email");
  const allergyText = trimmed(formData, "allergies");
  const conditionText = trimmed(formData, "conditions");
  const values = submitted(formData, ["name", "dob", "phone", "email", "allergies", "conditions"]);

  if (!name) return { error: "Enter the patient name.", values };
  if (!dob) return { error: "Enter a date of birth.", values };

  const born = new Date(`${dob}T12:00:00`);
  if (Number.isNaN(born.getTime()) || born > new Date()) {
    return { error: "Enter a date of birth in the past.", values };
  }
  if (born < new Date("1900-01-01")) {
    return { error: "That date of birth looks wrong. Check the year.", values };
  }

  const sql = db();
  const id = newId("p");

  // Sequential within the practice, and unique because the column says so.
  const seq = (await sql`SELECT count(*)::int AS n FROM patients`) as Array<{ n: number }>;
  const mrn = `TD-${40000 + (seq[0]?.n ?? 0) + 1}`;

  try {
    await sql`
      INSERT INTO patients (id, mrn, name, dob, phone, email)
      VALUES (${id}, ${mrn}, ${name}, ${dob}, ${phone || null}, ${email || null})
    `;
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("patients_mrn_key")) {
      return { error: "That record number was just taken by someone else. Try again.", values };
    }
    console.error("patient create failed:", message || "unknown");
    return { error: "The patient could not be created. Try again.", values };
  }

  // One allergy or condition per line, so staff are not fighting a comma parser.
  for (const line of allergyText.split("\n").map((l) => l.trim()).filter(Boolean)) {
    const [substance, reaction] = line.split(",").map((s) => s.trim());
    await sql`
      INSERT INTO allergies (id, patient_id, substance, reaction, severity)
      VALUES (${newId("al")}, ${id}, ${substance ?? line}, ${reaction || "Reaction not recorded"}, ${"severe"})
    `;
  }
  for (const line of conditionText.split("\n").map((l) => l.trim()).filter(Boolean)) {
    await sql`INSERT INTO conditions (id, patient_id, label) VALUES (${newId("cn")}, ${id}, ${line})`;
  }

  await record({
    actorId: user.clinicianId,
    actorRole: user.role,
    action: "registered a patient",
    entity: "patient",
    entityId: id,
    patientId: id,
  });

  revalidatePath("/clinic/patients");
  redirect(`/clinic/patients/${id}`);
}

// ---------------------------------------------------------------------------
// appointments
// ---------------------------------------------------------------------------

export async function createAppointmentAction(
  _prev: ClinicalFormState,
  formData: FormData,
): Promise<ClinicalFormState> {
  const user = await requireStaff("/clinic/schedule");

  const patientId = trimmed(formData, "patientId");
  const date = trimmed(formData, "date");
  const slot = trimmed(formData, "slot");
  const type = trimmed(formData, "type") || "Examination";
  const durationMin = Number(formData.get("duration") ?? 30);
  const values = submitted(formData, ["patientId", "date", "slot", "type"]);

  if (!patientId) return { error: "Choose a patient.", values };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Choose a date.", values };
  if (!/^\d{2}:\d{2}$/.test(slot)) return { error: "Choose a time.", values };
  if (!Number.isFinite(durationMin) || durationMin < 15 || durationMin > 480) {
    return { error: "Choose how long the appointment should be.", values };
  }
  if (isClosed(date)) return { error: "The practice is closed on Sundays.", values };
  if (minutesOf(slot) + durationMin > OPENING.endHour * 60) {
    return { error: "That appointment would run past closing time.", values };
  }

  const sql = db();
  const rooms = (await sql`SELECT room FROM clinicians WHERE id = ${user.clinicianId}`) as Array<{ room: string }>;
  const id = newId("a");

  // "09:30" means half past nine at the practice, so it has to be resolved to
  // an instant before it reaches a TIMESTAMPTZ column. Handing Postgres the
  // naive string instead makes it read the time as UTC, and every appointment
  // then renders shifted by the server offset: booking 09:30 showed 15:00.
  const startsAt = new Date(`${date}T${slot}:00`);
  if (Number.isNaN(startsAt.getTime())) {
    return { error: "That date and time could not be read.", values };
  }

  try {
    await sql`
      INSERT INTO appointments (id, patient_id, clinician_id, starts_at, duration_min, type, status, room)
      VALUES (${id}, ${patientId}, ${user.clinicianId}, ${startsAt.toISOString()}, ${durationMin},
              ${type}, ${"confirmed"}, ${rooms[0]?.room ?? ""})
    `;
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    // The database refuses overlaps itself, so a clash arrives here rather
    // than being something the form had to prevent.
    if (message.includes("appointments_no_overlap")) {
      return { error: "That time overlaps another appointment in your diary. Pick a different slot.", values };
    }
    if (message.includes("appointments_patient_id_fkey")) {
      return { error: "That patient record no longer exists.", values };
    }
    console.error("appointment create failed:", message || "unknown");
    return { error: "The appointment could not be booked. Try again.", values };
  }

  await record({
    actorId: user.clinicianId,
    actorRole: user.role,
    action: "booked an appointment",
    entity: "appointment",
    entityId: id,
    patientId,
  });

  revalidatePath("/clinic/schedule");
  revalidatePath("/clinic");
  redirect(`/clinic/schedule?date=${date}`);
}

/** Cancel, or mark as seen. Cancelling releases the slot for rebooking. */
export async function setAppointmentStatusAction(formData: FormData): Promise<void> {
  const user = await requireStaff("/clinic/schedule");

  const id = trimmed(formData, "id");
  const status = trimmed(formData, "status");
  const date = trimmed(formData, "date");

  if (!id || !["cancelled", "completed", "confirmed"].includes(status)) return;

  const sql = db();
  // Scoped to the caller: a clinician changes their own diary, not a colleague's.
  const rows = (await sql`
    UPDATE appointments SET status = ${status}
    WHERE id = ${id} AND clinician_id = ${user.clinicianId}
    RETURNING patient_id
  `) as Array<{ patient_id: string }>;

  if (!rows[0]) {
    await record({
      actorId: user.clinicianId,
      actorRole: user.role,
      action: "denied: change an appointment belonging to another clinician",
      entity: "appointment",
      entityId: id,
      outcome: "denied",
    });
    return;
  }

  await record({
    actorId: user.clinicianId,
    actorRole: user.role,
    action: status === "cancelled" ? "cancelled an appointment" : `marked an appointment ${status}`,
    entity: "appointment",
    entityId: id,
    patientId: rows[0].patient_id,
  });

  revalidatePath("/clinic/schedule");
  revalidatePath("/clinic");
  if (date) redirect(`/clinic/schedule?date=${date}`);
}
