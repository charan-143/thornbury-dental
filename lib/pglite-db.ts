import fs from "node:fs";
import path from "node:path";
import { createHash, randomBytes } from "node:crypto";
import { hashPassword } from "./password";

let pgliteInstance: any = null;
let pgliteInitPromise: Promise<any> | null = null;

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function newId(prefix: string): string {
  return `${prefix}_${randomBytes(9).toString("base64url")}`;
}

const pad = (n: number) => String(n).padStart(2, "0");
const DAY = 86_400_000;

function at(dayOffset: number, hhmm: string): string {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  const [h, m] = hhmm.split(":").map(Number);
  d.setHours(h ?? 0, m ?? 0, 0, 0);
  return d.toISOString();
}

function on(dayOffset: number): string {
  const d = new Date(Date.now() + dayOffset * DAY);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

async function initPGlite(): Promise<any> {
  if (pgliteInstance) return pgliteInstance;

  let PGliteModule: any;
  try {
    PGliteModule = await import("@electric-sql/pglite");
  } catch {
    const dynamicImport = new Function("m", "return import(m)");
    PGliteModule = await dynamicImport("@electric-sql/pglite");
  }
  const PGlite = PGliteModule.PGlite ?? PGliteModule.default ?? PGliteModule;

  const dataDir = path.join(process.cwd(), ".data", "pglite");
  try {
    fs.mkdirSync(dataDir, { recursive: true });
    pgliteInstance = new PGlite(dataDir);
    await pgliteInstance.waitReady;
  } catch (err) {
    console.warn("PGlite file directory locked or unavailable, using in-memory WASM database:", err instanceof Error ? err.message : String(err));
    pgliteInstance = new PGlite();
    await pgliteInstance.waitReady;
  }

  // Apply migrations
  const migrationPath = path.join(process.cwd(), "migrations", "0001_init.sql");
  if (fs.existsSync(migrationPath)) {
    const migrationSql = fs.readFileSync(migrationPath, "utf8");
    await pgliteInstance.exec(migrationSql);
  }

  // Ensure patient demographic columns and dental_chart table exist for existing databases
  await pgliteInstance.exec(`
    ALTER TABLE patients ADD COLUMN IF NOT EXISTS op_no TEXT;
    ALTER TABLE patients ADD COLUMN IF NOT EXISTS address TEXT;
    ALTER TABLE patients ADD COLUMN IF NOT EXISTS medical_history TEXT;
    ALTER TABLE patients ADD COLUMN IF NOT EXISTS family_history TEXT;
    ALTER TABLE patients ADD COLUMN IF NOT EXISTS past_dental_history TEXT;

    ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS refills INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS override_reason TEXT;

    CREATE TABLE IF NOT EXISTS dental_chart (
      id         TEXT PRIMARY KEY,
      patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      tooth_num  INTEGER NOT NULL CHECK (tooth_num >= 1 AND tooth_num <= 32),
      condition  TEXT NOT NULL DEFAULT 'sound',
      notes      TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(patient_id, tooth_num)
    );
  `);

  // Seed demo data if clinicians table is empty
  const res = await pgliteInstance.query("SELECT count(*)::int AS n FROM clinicians");
  const count = (res.rows[0] as { n: number })?.n ?? 0;

  if (count === 0) {
    const sql = createClientWrapper(pgliteInstance);
    await seedDemoData(sql);
  }

  return pgliteInstance;
}

async function seedDemoData(sql: any) {
  const clinicians = [
    { id: "c1", name: "Dr. Ingrid Halvorsen", credentials: "BDS, MSc Perio", specialty: "Periodontics and gum health", room: "Surgery 1", bio: "Leads the practice and treats gum disease, recession and implant maintenance." },
    { id: "c2", name: "Dr. Tomas Ferreira", credentials: "DDS, Endodontics", specialty: "Root canal treatment", room: "Surgery 2", bio: "Handles retreatment and cracked-tooth cases under the operating microscope." },
    { id: "c3", name: "Dr. Anaya Krishnamurthy", credentials: "BDS, MFDS", specialty: "Restorative and implants", room: "Surgery 3", bio: "Crowns, bridges and single-tooth implants, including same-day temporaries." },
  ];
  for (const c of clinicians) {
    await sql`
      INSERT INTO clinicians (id, name, credentials, specialty, room, photo, bio)
      VALUES (${c.id}, ${c.name}, ${c.credentials}, ${c.specialty}, ${c.room},
              ${`https://picsum.photos/seed/${c.id}-clinician/240/240`}, ${c.bio})
    `;
  }

  const patients = [
    {
      id: "p1",
      mrn: "TD-40182",
      op_no: "OP-40182",
      name: "Rosalind Achebe",
      dob: "1984-03-11",
      phone: "+1 (503) 224-7719",
      email: "rosalind.achebe@example.org",
      address: "742 Evergreen Terrace, Suite 4B, Portland, OR 97201",
      medical_history: "Type 2 diabetes, diet controlled. Penicillin allergy.",
      family_history: "Father had early onset periodontitis and hypertension; Mother has Type 2 Diabetes.",
      past_dental_history: "Root canal treatment on tooth 36 (2023), regular hygiene scaling, crown on tooth 46.",
      last: on(-21),
    },
    {
      id: "p2",
      mrn: "TD-40219",
      op_no: "OP-40219",
      name: "Dmitri Vollmer",
      dob: "1971-11-02",
      phone: "+1 (503) 917-4402",
      email: "d.vollmer@example.org",
      address: "1284 Oakridge Lane, Apt 12, Portland, OR 97205",
      medical_history: "Anticoagulant therapy (apixaban) following deep vein thrombosis in 2022.",
      family_history: "History of cardiovascular disease in father; mother treated for osteoporosis.",
      past_dental_history: "Surgical extraction of wisdom tooth 48 (2024), amalgam restorations placed in 2018.",
      last: on(-3),
    },
    {
      id: "p3",
      mrn: "TD-40233",
      op_no: "OP-40233",
      name: "Kavitha Nambiar",
      dob: "1996-06-24",
      phone: "+1 (971) 288-6153",
      email: "k.nambiar@example.org",
      address: "350 NW Couch Street, Suite 802, Portland, OR 97209",
      medical_history: "Moderate latex allergy. Mild asthma managed with salbutamol inhaler as needed.",
      family_history: "No significant systemic medical history reported; dental fluorosis reported in siblings.",
      past_dental_history: "Orthodontic treatment with fixed braces (2010–2012), composite fillings on molars 16 & 26.",
      last: on(-58),
    },
    {
      id: "p4",
      mrn: "TD-40251",
      op_no: "OP-40251",
      name: "Owen Blackwood",
      dob: "1958-01-19",
      phone: "+1 (503) 661-2087",
      email: "o.blackwood@example.org",
      address: "910 SW Alder Street, Portland, OR 97205",
      medical_history: "Hypertension, Bisphosphonate therapy for bone density preservation.",
      family_history: "Mother had rheumatoid arthritis; father had history of stroke at age 72.",
      past_dental_history: "Multiple ceramic crowns, history of periodontal maintenance every 4 months, full mouth debridement.",
      last: on(-9),
    },
    {
      id: "p5",
      mrn: "TD-40266",
      op_no: "OP-40266",
      name: "Marisol Cabrera-Reyes",
      dob: "2001-09-30",
      phone: "+1 (971) 402-9338",
      email: "m.cabrera@example.org",
      address: "4820 SE Hawthorne Blvd, Portland, OR 97215",
      medical_history: "No chronic systemic conditions. No known drug allergies.",
      family_history: "Maternal grandmother had type 1 diabetes; no early tooth loss in family.",
      past_dental_history: "Routine preventive care, pit and fissure sealants placed in childhood, wisdom teeth monitored.",
      last: on(-140),
    },
  ];
  for (const p of patients) {
    await sql`
      INSERT INTO patients (id, mrn, op_no, name, dob, phone, email, address, medical_history, family_history, past_dental_history, photo, last_visit)
      VALUES (${p.id}, ${p.mrn}, ${p.op_no}, ${p.name}, ${p.dob}, ${p.phone}, ${p.email}, ${p.address}, ${p.medical_history}, ${p.family_history}, ${p.past_dental_history},
              ${`https://picsum.photos/seed/${p.id}-patient/240/240`}, ${p.last})
    `;
  }

  for (const a of [
    { p: "p1", substance: "Penicillin", reaction: "Urticarial rash", severity: "severe" },
    { p: "p3", substance: "Latex", reaction: "Contact dermatitis", severity: "moderate" },
  ]) {
    await sql`
      INSERT INTO allergies (id, patient_id, substance, reaction, severity)
      VALUES (${newId("al")}, ${a.p}, ${a.substance}, ${a.reaction}, ${a.severity})
    `;
  }

  for (const c of [
    { p: "p1", label: "Type 2 diabetes, diet controlled" },
    { p: "p2", label: "Anticoagulant therapy, apixaban" },
    { p: "p4", label: "Hypertension" },
    { p: "p4", label: "Bisphosphonate therapy" },
  ]) {
    await sql`INSERT INTO conditions (id, patient_id, label) VALUES (${newId("cn")}, ${c.p}, ${c.label})`;
  }

  for (const a of [
    { id: "a1", p: "p1", c: "c2", at: at(1, "09:30"), min: 60, type: "Root canal, tooth 36", status: "confirmed", room: "Surgery 2" },
    { id: "a2", p: "p2", c: "c1", at: at(1, "11:00"), min: 30, type: "Post-extraction review", status: "confirmed", room: "Surgery 1" },
    { id: "a3", p: "p4", c: "c3", at: at(1, "14:00"), min: 45, type: "Crown fit, tooth 46", status: "confirmed", room: "Surgery 3" },
    { id: "a4", p: "p3", c: "c1", at: at(1, "15:30"), min: 30, type: "Hygiene and scaling", status: "cancelled", room: "Surgery 1" },
    { id: "a5", p: "p1", c: "c2", at: at(0, "10:00"), min: 45, type: "Root canal, second visit", status: "confirmed", room: "Surgery 2" },
    { id: "a6", p: "p5", c: "c3", at: at(0, "09:00"), min: 30, type: "New patient examination", status: "confirmed", room: "Surgery 3" },
    { id: "a7", p: "p2", c: "c1", at: at(0, "08:30"), min: 45, type: "Surgical extraction, tooth 48", status: "completed", room: "Surgery 1" },
    { id: "a8", p: "p1", c: "c1", at: at(-21, "16:00"), min: 30, type: "Emergency assessment", status: "completed", room: "Surgery 1" },
  ]) {
    await sql`
      INSERT INTO appointments (id, patient_id, clinician_id, starts_at, duration_min, type, status, room)
      VALUES (${a.id}, ${a.p}, ${a.c}, ${a.at}, ${a.min}, ${a.type}, ${a.status}, ${a.room})
    `;
  }

  const plans: Array<{
    id: string; p: string; c: string; procedure: string;
    phase: "pre" | "post"; published: string | null; steps: Array<[string, string]>;
  }> = [
    {
      id: "tp1", p: "p1", c: "c2", phase: "pre", published: at(-6, "17:40"),
      procedure: "Root canal treatment, lower left first molar (tooth 36)",
      steps: [
        ["Eat a normal meal beforehand", "The appointment runs about an hour and your mouth will be numb afterwards."],
        ["Keep taking your usual medicines", "Including your diabetes medication. Do not skip a dose to prepare for this visit."],
        ["Take 400mg ibuprofen one hour before", "Only if you already tolerate it. This reduces tenderness during the first day."],
        ["Confirm the penicillin allergy on arrival", "It is on your record. We say it out loud together before any prescribing decision."],
      ],
    },
    {
      id: "tp2", p: "p1", c: "c2", phase: "post", published: null,
      procedure: "Root canal treatment, lower left first molar (tooth 36)",
      steps: [
        ["Do not chew on that side until the crown is fitted", "The temporary filling is softer than enamel and can fracture the weakened cusp."],
        ["Expect tenderness for three to five days", "Biting pressure will feel bruised. Throbbing that wakes you at night is not expected."],
        ["Take ibuprofen 400mg with food, up to three times daily", "Stop after five days. Do not exceed 1200mg in 24 hours without asking us."],
        ["Rinse with warm salt water from tomorrow", "Half a teaspoon of salt in a cup of warm water, twice a day, after meals."],
      ],
    },
    {
      id: "tp3", p: "p2", c: "c1", phase: "post", published: at(-3, "09:25"),
      procedure: "Surgical extraction, lower right wisdom tooth (tooth 48)",
      steps: [
        ["Bite on the gauze for 30 minutes", "Firm continuous pressure. Replace it once if it soaks through, then stop."],
        ["No rinsing, spitting or straws for 24 hours", "Disturbing the clot is what causes a dry socket."],
        ["Hold your apixaban dose only if we told you to", "We agreed this with your cardiology team beforehand."],
        ["Return in one week for review", "Sooner if you get a foul taste, spreading swelling, or worsening pain after day three."],
      ],
    },
  ];

  for (const plan of plans) {
    await sql`
      INSERT INTO plans (id, patient_id, clinician_id, procedure, phase, published_at, locked_at)
      VALUES (${plan.id}, ${plan.p}, ${plan.c}, ${plan.procedure}, ${plan.phase},
              ${plan.published}, ${plan.published})
    `;
    for (let i = 0; i < plan.steps.length; i += 1) {
      const step = plan.steps[i]!;
      await sql`
        INSERT INTO plan_steps (id, plan_id, ordinal, title, detail)
        VALUES (${newId("st")}, ${plan.id}, ${i}, ${step[0]}, ${step[1]})
      `;
    }
  }

  await sql`
    INSERT INTO plan_addenda (id, plan_id, author_id, body, created_at)
    VALUES (${newId("ad")}, ${"tp3"}, ${"c1"},
            ${"Patient rang about oozing at 22:00. Advised firm gauze pressure for 20 minutes, which settled it."},
            ${at(-2, "11:10")})
  `;

  for (const r of [
    { id: "rx1", p: "p1", c: "c2", drug: "Ibuprofen", form: "tablet", dose: "400mg", route: "oral", freq: "Three times daily with food", days: 5, ind: "Post-endodontic pain", issued: at(-6, "17:45") },
    { id: "rx2", p: "p1", c: "c2", drug: "Chlorhexidine gluconate 0.2%", form: "mouthwash", dose: "10ml", route: "topical rinse", freq: "Twice daily after brushing", days: 7, ind: "Plaque control around the temporary restoration", issued: at(-6, "17:46") },
    { id: "rx3", p: "p2", c: "c1", drug: "Amoxicillin", form: "capsule", dose: "500mg", route: "oral", freq: "Three times daily", days: 5, ind: "Prophylaxis after surgical extraction", issued: at(-3, "09:30") },
  ]) {
    await sql`
      INSERT INTO prescriptions (id, patient_id, clinician_id, drug, form, dose, route, frequency, duration_days, indication, issued_at)
      VALUES (${r.id}, ${r.p}, ${r.c}, ${r.drug}, ${r.form}, ${r.dose}, ${r.route}, ${r.freq}, ${r.days}, ${r.ind}, ${r.issued})
    `;
  }

  for (const r of [
    { id: "rm1", rx: "rx1", p: "p1", times: ["08:00", "14:00", "20:00"], from: on(-6), to: on(-1) },
    { id: "rm2", rx: "rx2", p: "p1", times: ["08:30", "21:00"], from: on(-6), to: on(1) },
    { id: "rm3", rx: "rx3", p: "p2", times: ["07:00", "15:00", "23:00"], from: on(-3), to: on(2) },
  ]) {
    await sql`
      INSERT INTO reminders (id, prescription_id, patient_id, times, starts_on, ends_on)
      VALUES (${r.id}, ${r.rx}, ${r.p}, ${JSON.stringify(r.times)}, ${r.from}, ${r.to})
    `;
  }

  const doses: Array<[string, string, string, boolean]> = [
    ["rm1", on(-2), "08:00", true], ["rm1", on(-2), "14:00", true], ["rm1", on(-2), "20:00", false],
    ["rm1", on(-1), "08:00", true], ["rm1", on(-1), "14:00", true], ["rm1", on(-1), "20:00", true],
    ["rm2", on(-1), "08:30", true], ["rm2", on(0), "08:30", true],
    ["rm3", on(-1), "07:00", true], ["rm3", on(0), "07:00", true],
  ];
  for (const [reminder, date, slot, taken] of doses) {
    await sql`
      INSERT INTO dose_log (id, reminder_id, on_date, slot, taken)
      VALUES (${newId("dl")}, ${reminder}, ${date}, ${slot}, ${taken})
    `;
  }

  for (const r of [
    { id: "rp1", p: "p1", c: "c1", kind: "Radiograph", title: "Periapical radiograph, tooth 36", taken: at(-21, "16:20"), released: at(-21, "18:00"), summary: "Well defined periapical radiolucency at the mesial root, roughly 4mm across. Consistent with irreversible pulpitis progressing to apical periodontitis.", image: "https://picsum.photos/seed/thornbury-periapical/640/420" },
    { id: "rp2", p: "p1", c: "c1", kind: "Charting", title: "Six point periodontal chart", taken: at(-21, "16:35"), released: at(-21, "18:00"), summary: "Generalised probing depths of 2mm to 3mm. Isolated 5mm pocket distal to tooth 36 with bleeding on probing.", image: null },
    { id: "rp3", p: "p2", c: "c1", kind: "Radiograph", title: "Panoramic radiograph", taken: at(-10, "10:05"), released: at(-10, "12:30"), summary: "Impacted lower right wisdom tooth in mesioangular position, roots clear of the inferior alveolar canal.", image: "https://picsum.photos/seed/thornbury-panoramic/640/420" },
    { id: "rp4", p: "p1", c: "c2", kind: "Chairside test", title: "Pulp sensibility test summary", taken: at(-21, "16:45"), released: null, summary: "Cold test: lingering response over 30 seconds at tooth 36. Percussion tender at 36.", image: null },
  ]) {
    await sql`
      INSERT INTO reports (id, patient_id, clinician_id, kind, title, summary, image, taken_at, released_at)
      VALUES (${r.id}, ${r.p}, ${r.c}, ${r.kind}, ${r.title}, ${r.summary}, ${r.image}, ${r.taken}, ${r.released})
    `;
  }

  const logins: Array<{ email: string; password: string; role: string; clinician: string }> = [
    { email: "i.halvorsen@thornbury.example", password: "Cusp-Lantern-72", role: "admin", clinician: "c1" },
    { email: "t.ferreira@thornbury.example", password: "Apex-Meridian-19", role: "clinician", clinician: "c2" },
    { email: "a.krishnamurthy@thornbury.example", password: "Bridge-Quarry-55", role: "clinician", clinician: "c3" },
  ];
  for (const login of logins) {
    const { hash, salt, kdf } = hashPassword(login.password);
    await sql`
      INSERT INTO accounts (id, email, role, clinician_id, password_hash, password_salt, kdf)
      VALUES (${newId("ac")}, ${login.email}, ${login.role}, ${login.clinician}, ${hash}, ${salt}, ${kdf})
    `;
  }
}

function createClientWrapper(pglite: any) {
  const templateFn = async (strings: TemplateStringsArray, ...values: any[]) => {
    let text = strings[0]!;
    const params = [];
    for (let i = 0; i < values.length; i++) {
      params.push(values[i]);
      text += `$${i + 1}` + strings[i + 1];
    }
    const res = await pglite.query(text, params);
    return res.rows;
  };

  templateFn.query = async (queryText: string, params: any[] = []) => {
    const res = await pglite.query(queryText, params);
    return res.rows;
  };

  templateFn.transaction = async (queries: any[]) => {
    return await pglite.transaction(async (tx: any) => {
      const results = [];
      for (const q of queries) {
        if (typeof q === "function") {
          results.push(await q(tx));
        } else if (q && typeof q.then === "function") {
          results.push(await q);
        }
      }
      return results;
    });
  };

  return templateFn;
}

export async function getPGliteClient() {
  if (!pgliteInitPromise) {
    pgliteInitPromise = initPGlite().catch((err) => {
      console.error("Failed to initialize PGlite database:", err instanceof Error ? err.message : String(err));
      pgliteInitPromise = null;
      throw err;
    });
  }
  const pglite = await pgliteInitPromise;
  return createClientWrapper(pglite);
}
