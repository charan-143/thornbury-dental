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
  success?: boolean;
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
  const customOpNo = trimmed(formData, "opNo");
  const address = trimmed(formData, "address");
  const medicalHistory = trimmed(formData, "medicalHistory");
  const familyHistory = trimmed(formData, "familyHistory");
  const pastDentalHistory = trimmed(formData, "pastDentalHistory");
  const allergyText = trimmed(formData, "allergies");
  const conditionText = trimmed(formData, "conditions");
  const values = submitted(formData, [
    "name", "dob", "phone", "email", "opNo", "address",
    "medicalHistory", "familyHistory", "pastDentalHistory", "allergies", "conditions"
  ]);

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
  const opNo = customOpNo || `OP-${40000 + (seq[0]?.n ?? 0) + 1}`;

  try {
    await sql`
      INSERT INTO patients (id, mrn, op_no, name, dob, phone, email, address, medical_history, family_history, past_dental_history)
      VALUES (${id}, ${mrn}, ${opNo}, ${name}, ${dob}, ${phone || null}, ${email || null},
              ${address || null}, ${medicalHistory || null}, ${familyHistory || null}, ${pastDentalHistory || null})
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

/**
 * Updates an existing patient's demographics & medical history.
 */
export async function updatePatientDemographicsAction(
  _prev: ClinicalFormState,
  formData: FormData,
): Promise<ClinicalFormState> {
  const patientId = trimmed(formData, "patientId");
  const user = await requireStaff(`/clinic/patients/${patientId}`);

  if (!patientId) return { error: "Missing patient identifier." };

  const sql = db();
  const found = (await sql`SELECT name, op_no, phone, email, address, medical_history, family_history, past_dental_history FROM patients WHERE id = ${patientId}`) as Array<any>;
  if (!found[0]) return { error: "Patient record not found." };
  const p = found[0];

  const name = formData.has("name") ? trimmed(formData, "name") : p.name;
  const opNo = formData.has("opNo") ? trimmed(formData, "opNo") : p.op_no;
  const phone = formData.has("phone") ? trimmed(formData, "phone") : p.phone;
  const email = formData.has("email") ? trimmed(formData, "email") : p.email;
  const address = formData.has("address") ? trimmed(formData, "address") : p.address;
  const medicalHistory = formData.has("medicalHistory") ? trimmed(formData, "medicalHistory") : p.medical_history;
  const familyHistory = formData.has("familyHistory") ? trimmed(formData, "familyHistory") : p.family_history;
  const pastDentalHistory = formData.has("pastDentalHistory") ? trimmed(formData, "pastDentalHistory") : p.past_dental_history;

  if (!name) return { error: "Patient name is required." };

  try {
    await sql`
      UPDATE patients
      SET name = ${name},
          op_no = ${opNo || null},
          phone = ${phone || null},
          email = ${email || null},
          address = ${address || null},
          medical_history = ${medicalHistory || null},
          family_history = ${familyHistory || null},
          past_dental_history = ${pastDentalHistory || null}
      WHERE id = ${patientId}
    `;
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    console.error("patient update failed:", message || "unknown");
    return { error: "Could not update patient demographics. Try again." };
  }

  await record({
    actorId: user.clinicianId,
    actorRole: user.role,
    action: "updated patient demographics",
    entity: "patient",
    entityId: patientId,
    patientId: patientId,
  });

  revalidatePath(`/clinic/patients/${patientId}`);
  revalidatePath("/clinic/patients");
  return {};
}

/**
 * Saves or updates a patient's tooth condition and findings in the dental chart.
 */
export async function saveToothChartAction(data: {
  patientId: string;
  toothNum: number;
  condition: string;
  notes?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const user = await requireStaff(`/clinic/patients/${data.patientId}`);
  const sql = db();
  const id = newId("dc");

  try {
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS dental_chart (
          id         TEXT PRIMARY KEY,
          patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
          tooth_num  INTEGER NOT NULL CHECK (tooth_num >= 1 AND tooth_num <= 32),
          condition  TEXT NOT NULL DEFAULT 'sound',
          notes      TEXT,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          UNIQUE(patient_id, tooth_num)
        );
      `;
    } catch (e) {}

    await sql`
      INSERT INTO dental_chart (id, patient_id, tooth_num, condition, notes, updated_at)
      VALUES (${id}, ${data.patientId}, ${data.toothNum}, ${data.condition}, ${data.notes || null}, now())
      ON CONFLICT (patient_id, tooth_num) DO UPDATE SET
        condition = EXCLUDED.condition,
        notes = EXCLUDED.notes,
        updated_at = now()
    `;

    await record({
      actorId: user.clinicianId,
      actorRole: user.role,
      action: `updated tooth #${data.toothNum} condition to ${data.condition}`,
      entity: "patient",
      entityId: data.patientId,
      patientId: data.patientId,
    });

    revalidatePath(`/clinic/patients/${data.patientId}`);
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    console.error("tooth chart save failed:", message || "unknown");
    return { ok: false, error: "Failed to save tooth record." };
  }
}

/**
 * Retrieves a patient's saved tooth chart records from the database.
 */
export async function getToothChartAction(
  patientId: string,
): Promise<Array<{ tooth_num: number; condition: string; notes: string | null }>> {
  await requireStaff(`/clinic/patients/${patientId}`);
  const sql = db();
  try {
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS dental_chart (
          id         TEXT PRIMARY KEY,
          patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
          tooth_num  INTEGER NOT NULL CHECK (tooth_num >= 1 AND tooth_num <= 32),
          condition  TEXT NOT NULL DEFAULT 'sound',
          notes      TEXT,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          UNIQUE(patient_id, tooth_num)
        );
      `;
    } catch (e) {}

    const rows = (await sql`
      SELECT tooth_num, condition, notes FROM dental_chart WHERE patient_id = ${patientId}
    `) as Array<{ tooth_num: number; condition: string; notes: string | null }>;
    return rows;
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    console.error("tooth chart fetch failed:", message || "unknown");
    return [];
  }
}

/**
 * Creates a treatment plan for a patient with bullet point steps ("Advice to ...").
 */
export async function createTreatmentPlanAction(
  _prev: ClinicalFormState,
  formData: FormData,
): Promise<ClinicalFormState> {
  const patientId = trimmed(formData, "patientId");
  const user = await requireStaff(`/clinic/patients/${patientId}`);

  if (!patientId) return { error: "Missing patient identifier." };

  const procedure = trimmed(formData, "procedure");
  const phase = trimmed(formData, "phase") === "post" ? "post" : "pre";
  const stepsRaw = trimmed(formData, "stepsText");

  const values = submitted(formData, ["patientId", "procedure", "phase", "stepsText"]);

  if (!procedure) return { error: "Enter the procedure or plan title.", values };
  if (!stepsRaw) return { error: "Enter at least one advice step / bullet point.", values };

  const sql = db();
  const planId = newId("tp");
  const nowStr = new Date().toISOString();

  try {
    await sql`
      INSERT INTO plans (id, patient_id, clinician_id, procedure, phase, published_at, locked_at)
      VALUES (${planId}, ${patientId}, ${user.clinicianId}, ${procedure}, ${phase}, ${nowStr}, ${nowStr})
    `;

    // Process bullet point advice steps line by line
    const lines = stepsRaw
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    for (let i = 0; i < lines.length; i++) {
      let title = lines[i]!;
      // Ensure "Advice to" prefix is formatted cleanly if not already present
      if (!title.toLowerCase().startsWith("advice to")) {
        title = `Advice to ${title}`;
      }

      await sql`
        INSERT INTO plan_steps (id, plan_id, ordinal, title, detail)
        VALUES (${newId("st")}, ${planId}, ${i}, ${title}, ${""})
      `;
    }

    await record({
      actorId: user.clinicianId,
      actorRole: user.role,
      action: `created treatment plan: ${procedure}`,
      entity: "plan",
      entityId: planId,
      patientId,
    });

    revalidatePath(`/clinic/patients/${patientId}`);
    return {};
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    console.error("treatment plan creation failed:", message || "unknown");
    return { error: "Could not create treatment plan. Try again.", values };
  }
}

/**
 * Updates an existing treatment plan and its "Advice to" bullet point steps.
 */
export async function updateTreatmentPlanAction(
  _prev: ClinicalFormState,
  formData: FormData,
): Promise<ClinicalFormState> {
  const planId = trimmed(formData, "planId");
  const patientId = trimmed(formData, "patientId");
  const user = await requireStaff(`/clinic/patients/${patientId}`);

  if (!planId || !patientId) return { error: "Missing required identifiers." };

  const procedure = trimmed(formData, "procedure");
  const phase = trimmed(formData, "phase") === "post" ? "post" : "pre";
  const stepsRaw = trimmed(formData, "stepsText");

  const values = submitted(formData, ["planId", "patientId", "procedure", "phase", "stepsText"]);

  if (!procedure) return { error: "Enter the procedure or plan title.", values };
  if (!stepsRaw) return { error: "Enter at least one advice step / bullet point.", values };

  const sql = db();

  try {
    await sql`
      UPDATE plans
      SET procedure = ${procedure}, phase = ${phase}
      WHERE id = ${planId} AND patient_id = ${patientId}
    `;

    // Delete existing steps and replace with updated line-by-line advice steps
    await sql`DELETE FROM plan_steps WHERE plan_id = ${planId}`;

    const lines = stepsRaw
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    for (let i = 0; i < lines.length; i++) {
      let title = lines[i]!;
      if (!title.toLowerCase().startsWith("advice to")) {
        title = `Advice to ${title}`;
      }

      await sql`
        INSERT INTO plan_steps (id, plan_id, ordinal, title, detail)
        VALUES (${newId("st")}, ${planId}, ${i}, ${title}, ${""})
      `;
    }

    await record({
      actorId: user.clinicianId,
      actorRole: user.role,
      action: `updated treatment plan: ${procedure}`,
      entity: "plan",
      entityId: planId,
      patientId,
    });

    revalidatePath(`/clinic/patients/${patientId}`);
    return {};
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    console.error("treatment plan update failed:", message || "unknown");
    return { error: "Could not update treatment plan. Try again.", values };
  }
}

/**
 * Updates patient clinical diagnosis / conditions in bullet point lines.
 */
export async function updatePatientDiagnosisAction(
  _prev: ClinicalFormState,
  formData: FormData,
): Promise<ClinicalFormState> {
  const patientId = trimmed(formData, "patientId");
  const user = await requireStaff(`/clinic/patients/${patientId}`);

  if (!patientId) return { error: "Missing patient identifier." };

  const stains = trimmed(formData, "stains");
  const calculus = trimmed(formData, "calculus");
  const pockets = trimmed(formData, "pockets");
  const pocketTeeth = trimmed(formData, "pocketTeeth");
  const recession = trimmed(formData, "recession");
  const recessionTeeth = trimmed(formData, "recessionTeeth");
  const otherConditions = trimmed(formData, "otherConditions");

  const sql = db();

  try {
    await sql`DELETE FROM conditions WHERE patient_id = ${patientId}`;

    const newConditions: string[] = [];

    if (stains) {
      newConditions.push(`Stains: ${stains}`);
    }
    if (calculus) {
      newConditions.push(`Calculus: ${calculus}`);
    }
    if (pockets) {
      if (pockets === "Generalized" && pocketTeeth) {
        newConditions.push(`Pockets: Generalized (Teeth: ${pocketTeeth})`);
      } else {
        newConditions.push(`Pockets: ${pockets}`);
      }
    }
    if (recession) {
      if (recessionTeeth) {
        newConditions.push(`Recession: ${recession} (Teeth: ${recessionTeeth})`);
      } else {
        newConditions.push(`Recession: ${recession}`);
      }
    }

    if (otherConditions) {
      const lines = otherConditions
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      newConditions.push(...lines);
    }

    for (const label of newConditions) {
      await sql`
        INSERT INTO conditions (id, patient_id, label)
        VALUES (${newId("cn")}, ${patientId}, ${label})
      `;
    }

    await record({
      actorId: user.clinicianId,
      actorRole: user.role,
      action: "updated patient diagnosis / conditions",
      entity: "patient",
      entityId: patientId,
      patientId,
    });

    revalidatePath(`/clinic/patients/${patientId}`);
    return {};
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    console.error("diagnosis update failed:", message || "unknown");
    return { error: "Could not update diagnosis. Try again." };
  }
}

/**
 * Updates a single diagnosis element (stains, calculus, pockets, recession, or other conditions) separately.
 */
export async function updateSpecificDiagnosisElementAction(
  _prev: ClinicalFormState,
  formData: FormData,
): Promise<ClinicalFormState> {
  const patientId = trimmed(formData, "patientId");
  const element = trimmed(formData, "element");
  const user = await requireStaff(`/clinic/patients/${patientId}`);

  if (!patientId || !element) return { error: "Missing patient identifier or element key." };

  const sql = db();

  try {
    if (element === "stains") {
      const stains = trimmed(formData, "stains");
      await sql`DELETE FROM conditions WHERE patient_id = ${patientId} AND (label LIKE 'Stains:%' OR label = 'Stains')`;
      if (stains) {
        await sql`INSERT INTO conditions (id, patient_id, label) VALUES (${newId("cn")}, ${patientId}, ${`Stains: ${stains}`})`;
      }
    } else if (element === "calculus") {
      const calculus = trimmed(formData, "calculus");
      await sql`DELETE FROM conditions WHERE patient_id = ${patientId} AND (label LIKE 'Calculus:%' OR label = 'Calculus')`;
      if (calculus) {
        await sql`INSERT INTO conditions (id, patient_id, label) VALUES (${newId("cn")}, ${patientId}, ${`Calculus: ${calculus}`})`;
      }
    } else if (element === "pockets") {
      const pockets = trimmed(formData, "pockets");
      const pocketTeeth = trimmed(formData, "pocketTeeth");
      await sql`DELETE FROM conditions WHERE patient_id = ${patientId} AND (label LIKE 'Pockets:%' OR label = 'Pockets')`;
      if (pockets) {
        const label = (pockets === "Generalized" && pocketTeeth)
          ? `Pockets: Generalized (Teeth: ${pocketTeeth})`
          : `Pockets: ${pockets}`;
        await sql`INSERT INTO conditions (id, patient_id, label) VALUES (${newId("cn")}, ${patientId}, ${label})`;
      }
    } else if (element === "recession") {
      const recession = trimmed(formData, "recession");
      const recessionTeeth = trimmed(formData, "recessionTeeth");
      await sql`DELETE FROM conditions WHERE patient_id = ${patientId} AND (label LIKE 'Recession:%' OR label = 'Recession')`;
      if (recession) {
        const label = recessionTeeth
          ? `Recession: ${recession} (Teeth: ${recessionTeeth})`
          : `Recession: ${recession}`;
        await sql`INSERT INTO conditions (id, patient_id, label) VALUES (${newId("cn")}, ${patientId}, ${label})`;
      }
    } else if (element === "gingival") {
      const gingival = trimmed(formData, "gingival");
      await sql`DELETE FROM conditions WHERE patient_id = ${patientId} AND (label LIKE 'Gingival:%' OR label LIKE 'Gingivitis%')`;
      if (gingival) {
        await sql`INSERT INTO conditions (id, patient_id, label) VALUES (${newId("cn")}, ${patientId}, ${`Gingival: ${gingival}`})`;
      }
    } else if (element === "tmj") {
      const tmj = trimmed(formData, "tmj");
      const tmjNotes = trimmed(formData, "tmjNotes");
      await sql`DELETE FROM conditions WHERE patient_id = ${patientId} AND (label LIKE 'TMJ:%' OR label = 'TMJ')`;
      if (tmj) {
        const label = tmjNotes ? `TMJ: ${tmj} (${tmjNotes})` : `TMJ: ${tmj}`;
        await sql`INSERT INTO conditions (id, patient_id, label) VALUES (${newId("cn")}, ${patientId}, ${label})`;
      }
    } else if (element === "other") {
      const otherConditions = trimmed(formData, "otherConditions");
      await sql`
        DELETE FROM conditions
        WHERE patient_id = ${patientId}
          AND label NOT LIKE 'Stains:%'
          AND label NOT LIKE 'Calculus:%'
          AND label NOT LIKE 'Pockets:%'
          AND label NOT LIKE 'Recession:%'
          AND label NOT LIKE 'Gingival:%'
          AND label NOT LIKE 'Gingivitis%'
          AND label NOT LIKE 'TMJ:%'
      `;
      if (otherConditions) {
        const lines = otherConditions
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean);
        for (const line of lines) {
          await sql`INSERT INTO conditions (id, patient_id, label) VALUES (${newId("cn")}, ${patientId}, ${line})`;
        }
      }
    }

    await record({
      actorId: user.clinicianId,
      actorRole: user.role,
      action: `updated diagnosis element: ${element}`,
      entity: "patient",
      entityId: patientId,
      patientId,
    });

    revalidatePath(`/clinic/patients/${patientId}`);
    return {};
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    console.error("diagnosis element update failed:", message || "unknown");
    return { error: "Could not update diagnosis element. Try again." };
  }
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

/**
 * Issues multiple prescriptions at once for a patient.
 */
export async function issueMultiplePrescriptionsAction(
  _prev: ClinicalFormState,
  formData: FormData,
): Promise<ClinicalFormState> {
  const patientId = trimmed(formData, "patientId");
  const user = await requireStaff(`/clinic/patients/${patientId}`);

  if (!patientId) return { error: "Missing patient identifier." };

  const rxCountStr = trimmed(formData, "rxCount");
  const rxCount = parseInt(rxCountStr || "0", 10);

  if (rxCount <= 0) {
    return { error: "Add at least one prescription to issue." };
  }

  const entries: Array<{
    drug: string;
    form: string;
    dose: string;
    route: string;
    frequency: string;
    durationDays: number;
    refills: number;
    indication: string;
    overrideReason: string;
  }> = [];

  for (let i = 0; i < rxCount; i++) {
    const drug = trimmed(formData, `drug_${i}`);
    const form = trimmed(formData, `form_${i}`) || "Tablet";
    const dose = trimmed(formData, `dose_${i}`);
    const route = trimmed(formData, `route_${i}`) || "Oral";
    const frequency = trimmed(formData, `frequency_${i}`);
    const durationDaysStr = trimmed(formData, `durationDays_${i}`);
    const durationDays = parseInt(durationDaysStr || "5", 10);
    const refillsStr = trimmed(formData, `refills_${i}`);
    const refills = parseInt(refillsStr || "0", 10);
    const indication = trimmed(formData, `indication_${i}`) || "Clinical indication recorded";
    const overrideReason = trimmed(formData, `overrideReason_${i}`);

    if (drug && dose && frequency) {
      entries.push({
        drug,
        form,
        dose,
        route,
        frequency,
        durationDays: Number.isNaN(durationDays) || durationDays <= 0 ? 5 : durationDays,
        refills: Number.isNaN(refills) || refills < 0 ? 0 : refills,
        indication,
        overrideReason,
      });
    }
  }

  if (entries.length === 0) {
    return { error: "Please enter medication name, dose, and frequency for at least one prescription." };
  }

  const sql = db();

  // Check patient recorded allergies for safety across all drafted items
  const allergies = (await sql`
    SELECT substance, reaction, severity FROM allergies WHERE patient_id = ${patientId}
  `) as Array<{ substance: string; reaction: string; severity: string }>;

  for (const rx of entries) {
    const drugLower = rx.drug.toLowerCase();
    const matchedAllergy = allergies.find((a) => {
      const sub = a.substance.toLowerCase();
      if (drugLower.includes(sub) || sub.includes(drugLower)) return true;
      if (sub.includes("penicillin") && (drugLower.includes("amoxicillin") || drugLower.includes("ampicillin") || drugLower.includes("co-amoxiclav"))) return true;
      if (sub.includes("nsaid") && (drugLower.includes("ibuprofen") || drugLower.includes("naproxen") || drugLower.includes("aspirin") || drugLower.includes("diclofenac"))) return true;
      if (sub.includes("codeine") && (drugLower.includes("co-codamol") || drugLower.includes("dihydrocodeine"))) return true;
      if (sub.includes("sulfa") && (drugLower.includes("sulfamethoxazole") || drugLower.includes("trimethoprim"))) return true;
      return false;
    });

    if (matchedAllergy && !rx.overrideReason) {
      return {
        error: `ALLERGY_ALERT: Patient has a recorded allergy to "${matchedAllergy.substance}" for medication "${rx.drug}". Provide a clinical override reason before issuing.`,
      };
    }
  }

  try {
    try {
      await sql`
        ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS refills INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS override_reason TEXT;
      `;
    } catch (e) {}

    for (const rx of entries) {
      const rxId = newId("rx");
      await sql`
        INSERT INTO prescriptions (id, patient_id, clinician_id, drug, form, dose, route, frequency, duration_days, refills, indication, issued_at, override_reason)
        VALUES (${rxId}, ${patientId}, ${user.clinicianId}, ${rx.drug}, ${rx.form}, ${rx.dose}, ${rx.route}, ${rx.frequency}, ${rx.durationDays}, ${rx.refills}, ${rx.indication}, now(), ${rx.overrideReason || null})
      `;
    }

    await record({
      actorId: user.clinicianId,
      actorRole: user.role,
      action: `issued ${entries.length} prescription(s) simultaneously`,
      entity: "patient",
      entityId: patientId,
      patientId,
    });

    revalidatePath(`/clinic/patients/${patientId}`);
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    console.error("multiple prescriptions issue failed:", message || "unknown");
    return { error: "Could not issue prescriptions. Please check entries and try again." };
  }
}

/**
 * Issues a new prescription for a patient.
 *
 * Checks patient recorded allergies against the prescribed drug. If a potential
 * allergy match is detected (e.g. penicillin allergen for amoxicillin), a warning is
 * returned unless a clinical override reason is provided.
 */
export async function createPrescriptionAction(
  _prev: ClinicalFormState,
  formData: FormData,
): Promise<ClinicalFormState> {
  const patientId = trimmed(formData, "patientId");
  const user = await requireStaff(`/clinic/patients/${patientId}`);

  const drug = trimmed(formData, "drug");
  const form = trimmed(formData, "form");
  const dose = trimmed(formData, "dose");
  const route = trimmed(formData, "route");
  const frequency = trimmed(formData, "frequency");
  const durationDaysStr = trimmed(formData, "durationDays");
  const refillsStr = trimmed(formData, "refills");
  const indication = trimmed(formData, "indication");
  const overrideReason = trimmed(formData, "overrideReason");
  const createReminder = trimmed(formData, "createReminder") === "true";

  const values = submitted(formData, [
    "patientId", "drug", "form", "dose", "route", "frequency",
    "durationDays", "refills", "indication", "overrideReason"
  ]);

  if (!patientId) return { error: "Missing patient identifier.", values };
  if (!drug) return { error: "Enter the medication / drug name.", values };
  if (!form) return { error: "Select or enter the dosage form.", values };
  if (!dose) return { error: "Enter the dosage (e.g., 500 mg).", values };
  if (!route) return { error: "Enter the administration route (e.g., Oral).", values };
  if (!frequency) return { error: "Enter the dosing frequency (e.g., Three times daily).", values };
  if (!indication) return { error: "Enter the clinical indication for this prescription.", values };

  const durationDays = parseInt(durationDaysStr, 10);
  if (isNaN(durationDays) || durationDays < 1 || durationDays > 365) {
    return { error: "Duration must be between 1 and 365 days.", values };
  }

  const refills = parseInt(refillsStr || "0", 10);
  if (isNaN(refills) || refills < 0 || refills > 12) {
    return { error: "Refills must be a valid number between 0 and 12.", values };
  }

  const sql = db();

  // Check patient allergies for safety
  const allergies = (await sql`
    SELECT substance, reaction, severity FROM allergies WHERE patient_id = ${patientId}
  `) as Array<{ substance: string; reaction: string; severity: string }>;

  const drugLower = drug.toLowerCase();
  const matchedAllergy = allergies.find((a) => {
    const sub = a.substance.toLowerCase();
    if (drugLower.includes(sub) || sub.includes(drugLower)) return true;
    if (sub.includes("penicillin") && (drugLower.includes("amoxicillin") || drugLower.includes("ampicillin") || drugLower.includes("co-amoxiclav"))) return true;
    if (sub.includes("nsaid") && (drugLower.includes("ibuprofen") || drugLower.includes("naproxen") || drugLower.includes("aspirin") || drugLower.includes("diclofenac"))) return true;
    if (sub.includes("codeine") && (drugLower.includes("co-codamol") || drugLower.includes("dihydrocodeine"))) return true;
    if (sub.includes("sulfa") && (drugLower.includes("sulfamethoxazole") || drugLower.includes("trimethoprim"))) return true;
    return false;
  });

  if (matchedAllergy && !overrideReason) {
    return {
      error: `ALLERGY_ALERT: Patient has a recorded allergy to "${matchedAllergy.substance}" (${matchedAllergy.reaction}, severity: ${matchedAllergy.severity}). Provide a clinical override reason to issue this prescription.`,
      values,
    };
  }

  const id = newId("rx");

  try {
    await sql`
      INSERT INTO prescriptions (
        id, patient_id, clinician_id, drug, form, dose, route, frequency, duration_days, refills, indication, issued_at, override_reason
      ) VALUES (
        ${id}, ${patientId}, ${user.clinicianId}, ${drug}, ${form}, ${dose}, ${route}, ${frequency}, ${durationDays}, ${refills}, ${indication}, now(), ${overrideReason || null}
      )
    `;

    if (createReminder) {
      const remId = newId("rem");
      const today = new Date().toISOString().split("T")[0];
      const endDate = new Date(Date.now() + durationDays * 86400000).toISOString().split("T")[0];
      const times = ["08:00", "14:00", "20:00"];
      await sql`
        INSERT INTO reminders (id, prescription_id, patient_id, times, starts_on, ends_on)
        VALUES (${remId}, ${id}, ${patientId}, ${JSON.stringify(times)}, ${today}, ${endDate})
      `;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    console.error("prescription create failed:", message || "unknown");
    return { error: "The prescription could not be issued. Try again.", values };
  }

  await record({
    actorId: user.clinicianId,
    actorRole: user.role,
    action: matchedAllergy ? "issued a prescription over allergy alert" : "issued a prescription",
    entity: "prescription",
    entityId: id,
    patientId,
  });

  revalidatePath(`/clinic/patients/${patientId}`);
  return {};
}

// ---------------------------------------------------------------------------
// reports & imaging
// ---------------------------------------------------------------------------

/**
 * Creates a new clinical report or imaging record.
 */
export async function createReportAction(
  _prev: ClinicalFormState,
  formData: FormData,
): Promise<ClinicalFormState> {
  const patientId = trimmed(formData, "patientId");
  const user = await requireStaff(`/clinic/patients/${patientId}`);

  if (!patientId) return { error: "Missing patient identifier." };

  const kind = trimmed(formData, "kind") || "Radiograph";
  const title = trimmed(formData, "title");
  const summary = trimmed(formData, "summary");
  const image = trimmed(formData, "image") || null;
  const takenAtStr = trimmed(formData, "takenAt");
  const releaseImmediately = trimmed(formData, "releaseImmediately") === "true";
  const clinicianIdOverride = trimmed(formData, "clinicianId");
  const clinicianId = clinicianIdOverride || user.clinicianId;

  const values = submitted(formData, [
    "patientId", "kind", "title", "summary", "image", "takenAt", "releaseImmediately", "clinicianId"
  ]);

  if (!title) return { error: "Enter a title for the report or radiograph.", values };
  if (!summary) return { error: "Enter diagnostic summary findings or notes.", values };

  const sql = db();
  const id = newId("rp");
  const takenAt = takenAtStr ? new Date(takenAtStr).toISOString() : new Date().toISOString();
  const releasedAt = releaseImmediately ? new Date().toISOString() : null;

  try {
    await sql`
      INSERT INTO reports (id, patient_id, clinician_id, kind, title, summary, image, taken_at, released_at)
      VALUES (${id}, ${patientId}, ${clinicianId}, ${kind}, ${title}, ${summary}, ${image}, ${takenAt}, ${releasedAt})
    `;

    await record({
      actorId: user.clinicianId,
      actorRole: user.role,
      action: `added report/imaging: ${title} (${kind})`,
      entity: "report",
      entityId: id,
      patientId,
    });

    revalidatePath(`/clinic/patients/${patientId}`);
    revalidatePath("/clinic");
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    console.error("report create failed:", message || "unknown");
    return { error: "Could not create report. Try again.", values };
  }
}

/**
 * Updates an existing clinical report or radiograph entry.
 */
export async function updateReportAction(
  _prev: ClinicalFormState,
  formData: FormData,
): Promise<ClinicalFormState> {
  const reportId = trimmed(formData, "reportId");
  const patientId = trimmed(formData, "patientId");
  const user = await requireStaff(`/clinic/patients/${patientId}`);

  if (!reportId || !patientId) return { error: "Missing required identifiers." };

  const kind = trimmed(formData, "kind") || "Radiograph";
  const title = trimmed(formData, "title");
  const summary = trimmed(formData, "summary");
  const image = trimmed(formData, "image") || null;
  const takenAtStr = trimmed(formData, "takenAt");
  const releaseStatus = trimmed(formData, "releaseStatus"); // "released" | "held"
  const clinicianIdOverride = trimmed(formData, "clinicianId");

  const values = submitted(formData, [
    "reportId", "patientId", "kind", "title", "summary", "image", "takenAt", "releaseStatus", "clinicianId"
  ]);

  if (!title) return { error: "Enter a title for the report or radiograph.", values };
  if (!summary) return { error: "Enter diagnostic summary findings or notes.", values };

  const sql = db();

  try {
    const existing = (await sql`SELECT released_at, clinician_id FROM reports WHERE id = ${reportId}`) as Array<any>;
    if (!existing[0]) return { error: "Report record not found." };

    let releasedAt = existing[0].released_at;
    if (releaseStatus === "released" && !releasedAt) {
      releasedAt = new Date().toISOString();
    } else if (releaseStatus === "held") {
      releasedAt = null;
    }

    const clinicianId = clinicianIdOverride || existing[0].clinician_id;
    const takenAt = takenAtStr ? new Date(takenAtStr).toISOString() : new Date().toISOString();

    await sql`
      UPDATE reports
      SET kind = ${kind},
          title = ${title},
          summary = ${summary},
          image = ${image},
          taken_at = ${takenAt},
          released_at = ${releasedAt},
          clinician_id = ${clinicianId}
      WHERE id = ${reportId} AND patient_id = ${patientId}
    `;

    await record({
      actorId: user.clinicianId,
      actorRole: user.role,
      action: `updated report/imaging: ${title}`,
      entity: "report",
      entityId: reportId,
      patientId,
    });

    revalidatePath(`/clinic/patients/${patientId}`);
    revalidatePath("/clinic");
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    console.error("report update failed:", message || "unknown");
    return { error: "Could not update report. Try again.", values };
  }
}

/**
 * Toggles the release status of a report (Released to patient vs Held for clinician review).
 */
export async function toggleReportReleaseAction(formData: FormData): Promise<void> {
  const reportId = trimmed(formData, "reportId");
  const patientId = trimmed(formData, "patientId");
  const user = await requireStaff(`/clinic/patients/${patientId}`);

  if (!reportId || !patientId) return;

  const sql = db();
  const existing = (await sql`SELECT title, released_at FROM reports WHERE id = ${reportId} AND patient_id = ${patientId}`) as Array<any>;
  if (!existing[0]) return;

  const isCurrentlyReleased = Boolean(existing[0].released_at);
  const newReleasedAt = isCurrentlyReleased ? null : new Date().toISOString();

  await sql`
    UPDATE reports
    SET released_at = ${newReleasedAt}
    WHERE id = ${reportId} AND patient_id = ${patientId}
  `;

  await record({
    actorId: user.clinicianId,
    actorRole: user.role,
    action: isCurrentlyReleased
      ? `held report "${existing[0].title}" for review`
      : `released report "${existing[0].title}" to patient`,
    entity: "report",
    entityId: reportId,
    patientId,
  });

  revalidatePath(`/clinic/patients/${patientId}`);
  revalidatePath("/clinic");
}

/**
 * Deletes a report or radiograph entry.
 */
export async function deleteReportAction(formData: FormData): Promise<void> {
  const reportId = trimmed(formData, "reportId");
  const patientId = trimmed(formData, "patientId");
  const user = await requireStaff(`/clinic/patients/${patientId}`);

  if (!reportId || !patientId) return;

  const sql = db();
  const existing = (await sql`SELECT title FROM reports WHERE id = ${reportId} AND patient_id = ${patientId}`) as Array<any>;
  if (!existing[0]) return;

  await sql`DELETE FROM reports WHERE id = ${reportId} AND patient_id = ${patientId}`;

  await record({
    actorId: user.clinicianId,
    actorRole: user.role,
    action: `deleted report/imaging: "${existing[0].title}"`,
    entity: "report",
    entityId: reportId,
    patientId,
  });

  revalidatePath(`/clinic/patients/${patientId}`);
  revalidatePath("/clinic");
}


