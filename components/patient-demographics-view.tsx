"use client";

import { useState, useActionState, useEffect } from "react";
import { updatePatientDemographicsAction, type ClinicalFormState } from "@/actions/clinical";

export type PatientDemographics = {
  id: string;
  mrn: string;
  op_no: string | null;
  name: string;
  dob: Date | string;
  phone: string | null;
  email: string | null;
  address: string | null;
  medical_history: string | null;
  family_history: string | null;
  past_dental_history: string | null;
  photo: string | null;
  last_visit: Date | string | null;
  allergies: Array<{ substance: string; reaction: string; severity: string }>;
  conditions: Array<{ label: string }>;
};

type FieldKey =
  | "opNo"
  | "name"
  | "phone"
  | "address"
  | "medicalHistory"
  | "familyHistory"
  | "pastDentalHistory";

function age(dob: Date | string): number {
  const born = dob instanceof Date ? dob : new Date(dob);
  const now = new Date();
  let y = now.getFullYear() - born.getFullYear();
  const m = now.getMonth() - born.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < born.getDate())) y -= 1;
  return y;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function day(v: Date | string | null): string {
  if (!v) return "not recorded";
  const d = v instanceof Date ? v : new Date(v);
  if (isNaN(d.getTime())) return "not recorded";
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function parseBullets(text: string | null | undefined): string[] {
  if (!text) return [];
  const lines = text.split(/\n+/);
  const items: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    // Strip leading bullet markers: '-', '*', '•' or numbered markers like '1.' or '1)'
    const cleaned = trimmed.replace(/^(\s*[\-*•]\s*|\s*\d+[\.\)]\s*)/, "").trim();
    if (cleaned) {
      items.push(cleaned);
    }
  }

  if (items.length <= 1 && text.includes(".")) {
    const sentences = text.split(/\.\s+/).map((s) => s.trim().replace(/\.$/, "")).filter(Boolean);
    if (sentences.length > 1) {
      return sentences;
    }
  }

  return items.length > 0 ? items : [text.trim()];
}

function BulletList({ items, emptyMessage }: { items: string[]; emptyMessage: string }) {
  if (items.length === 0) {
    return (
      <p style={{ font: "var(--body-md)", color: "var(--muted)", margin: 0, fontStyle: "italic" }}>
        {emptyMessage}
      </p>
    );
  }

  return (
    <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
      {items.map((item, idx) => (
        <li
          key={idx}
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
            font: "var(--body-md)",
            color: "var(--ink)",
          }}
        >
          <i
            className="ph ph-dot-outline"
            aria-hidden="true"
            style={{ fontSize: "1.2rem", color: "var(--primary)", marginTop: 2, flexShrink: 0 }}
          />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function PatientDemographicsView({ patient }: { patient: PatientDemographics }) {
  const [editingField, setEditingField] = useState<FieldKey | null>(null);

  const [state, action, pending] = useActionState<ClinicalFormState, FormData>(
    updatePatientDemographicsAction,
    {},
  );

  useEffect(() => {
    if (state && !state.error && !pending) {
      setEditingField(null);
    }
  }, [state, pending]);

  const displayOpNo = patient.op_no || patient.mrn;

  // Convert medical conditions to bullet array fallback if medical_history is empty
  const defaultMedHistory =
    patient.medical_history ||
    (patient.conditions.length > 0
      ? patient.conditions.map((c) => c.label).join("\n")
      : "");

  const medBullets = parseBullets(defaultMedHistory);
  const famBullets = parseBullets(patient.family_history);
  const dentalBullets = parseBullets(patient.past_dental_history);

  return (
    <div style={{ display: "grid", gap: 24 }}>
      {/* Allergy Warning Alerts */}
      {patient.allergies.length > 0 ? (
        patient.allergies.map((a, idx) => (
          <div className="alert alert-critical" key={`alg-${a.substance}-${idx}`} role="alert">
            <i className="ph ph-warning-octagon" aria-hidden="true" />
            <span>
              <strong>ALLERGY ALERT: {a.substance}, {a.severity}.</strong> {a.reaction}.
              Check before prescribing or administering treatment.
            </span>
          </div>
        ))
      ) : (
        <div className="alert">
          <i className="ph ph-info" aria-hidden="true" />
          <span>No allergies recorded on file.</span>
        </div>
      )}

      {/* Main Demographics Panel */}
      <section className="panel">
        <div className="panel-head">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <i
              className="ph ph-identification-card"
              style={{ fontSize: "1.5rem", color: "var(--primary)" }}
              aria-hidden="true"
            />
            <h2>Patient Demographics & Overview</h2>
          </div>
          <div className="spacer" />
          <span className="badge badge-info">{age(patient.dob)} yrs</span>
          <span className="badge badge-success">OP: {displayOpNo}</span>
        </div>

        <div className="panel-body" style={{ display: "grid", gap: 24 }}>
          {state?.error && (
            <div className="alert alert-critical" role="alert">
              <i className="ph ph-warning-octagon" aria-hidden="true" />
              <span>{state.error}</span>
            </div>
          )}

          {/* Section 1: Demographics Grid (Individual Field Editors) */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 16,
            }}
          >
            {/* OP No Field */}
            <div className="card card-soft" style={{ display: "grid", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    color: "var(--muted)",
                    font: "var(--title-sm)",
                  }}
                >
                  <i className="ph ph-hash" aria-hidden="true" />
                  <span>OP No.</span>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setEditingField(editingField === "opNo" ? null : "opNo")}
                  title="Edit OP No."
                >
                  <i className={`ph ph-${editingField === "opNo" ? "x" : "pencil-simple"}`} aria-hidden="true" />
                  {editingField === "opNo" ? "Cancel" : "Edit"}
                </button>
              </div>

              {editingField === "opNo" ? (
                <form action={action} style={{ display: "grid", gap: 10 }}>
                  <input type="hidden" name="patientId" value={patient.id} />
                  <input
                    className="input input-sm"
                    name="opNo"
                    defaultValue={displayOpNo}
                    placeholder="Enter OP No."
                    autoFocus
                    required
                  />
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="btn btn-primary btn-sm" type="submit" disabled={pending}>
                      {pending ? "Saving..." : "Save OP No."}
                    </button>
                  </div>
                </form>
              ) : (
                <div>
                  <strong style={{ font: "var(--title-md)", color: "var(--ink)" }} className="mono">
                    {displayOpNo}
                  </strong>
                  <div className="caption" style={{ color: "var(--muted)", marginTop: 2 }}>
                    System MRN: {patient.mrn}
                  </div>
                </div>
              )}
            </div>

            {/* Patient Name Field */}
            <div className="card card-soft" style={{ display: "grid", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    color: "var(--muted)",
                    font: "var(--title-sm)",
                  }}
                >
                  <i className="ph ph-user-circle" aria-hidden="true" />
                  <span>Patient Name</span>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setEditingField(editingField === "name" ? null : "name")}
                  title="Edit Name"
                >
                  <i className={`ph ph-${editingField === "name" ? "x" : "pencil-simple"}`} aria-hidden="true" />
                  {editingField === "name" ? "Cancel" : "Edit"}
                </button>
              </div>

              {editingField === "name" ? (
                <form action={action} style={{ display: "grid", gap: 10 }}>
                  <input type="hidden" name="patientId" value={patient.id} />
                  <input
                    className="input input-sm"
                    name="name"
                    defaultValue={patient.name}
                    placeholder="Enter patient full name"
                    autoFocus
                    required
                  />
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="btn btn-primary btn-sm" type="submit" disabled={pending}>
                      {pending ? "Saving..." : "Save Name"}
                    </button>
                  </div>
                </form>
              ) : (
                <div>
                  <strong style={{ font: "var(--title-md)", color: "var(--ink)" }}>
                    {patient.name}
                  </strong>
                  <div className="caption" style={{ color: "var(--muted)", marginTop: 2 }}>
                    DOB: {day(patient.dob)} ({age(patient.dob)} yrs old)
                  </div>
                </div>
              )}
            </div>

            {/* Phone & Email Field */}
            <div className="card card-soft" style={{ display: "grid", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    color: "var(--muted)",
                    font: "var(--title-sm)",
                  }}
                >
                  <i className="ph ph-phone" aria-hidden="true" />
                  <span>Phone No. & Email</span>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setEditingField(editingField === "phone" ? null : "phone")}
                  title="Edit Phone & Email"
                >
                  <i className={`ph ph-${editingField === "phone" ? "x" : "pencil-simple"}`} aria-hidden="true" />
                  {editingField === "phone" ? "Cancel" : "Edit"}
                </button>
              </div>

              {editingField === "phone" ? (
                <form action={action} style={{ display: "grid", gap: 10 }}>
                  <input type="hidden" name="patientId" value={patient.id} />
                  <input
                    className="input input-sm"
                    name="phone"
                    defaultValue={patient.phone ?? ""}
                    placeholder="Phone number"
                    autoFocus
                  />
                  <input
                    className="input input-sm"
                    name="email"
                    type="email"
                    defaultValue={patient.email ?? ""}
                    placeholder="Email address"
                  />
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="btn btn-primary btn-sm" type="submit" disabled={pending}>
                      {pending ? "Saving..." : "Save Phone & Email"}
                    </button>
                  </div>
                </form>
              ) : (
                <div>
                  <strong style={{ font: "var(--title-md)", color: "var(--ink)" }}>
                    {patient.phone ?? "Not recorded"}
                  </strong>
                  <div className="caption" style={{ color: "var(--muted)", marginTop: 2 }}>
                    Email: {patient.email ?? "Not recorded"}
                  </div>
                </div>
              )}
            </div>

            {/* Address Field */}
            <div
              className="card card-soft"
              style={{ display: "grid", gap: 8, gridColumn: "1 / -1" }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    color: "var(--muted)",
                    font: "var(--title-sm)",
                  }}
                >
                  <i className="ph ph-map-pin" aria-hidden="true" />
                  <span>Address</span>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setEditingField(editingField === "address" ? null : "address")}
                  title="Edit Address"
                >
                  <i className={`ph ph-${editingField === "address" ? "x" : "pencil-simple"}`} aria-hidden="true" />
                  {editingField === "address" ? "Cancel" : "Edit"}
                </button>
              </div>

              {editingField === "address" ? (
                <form action={action} style={{ display: "grid", gap: 10 }}>
                  <input type="hidden" name="patientId" value={patient.id} />
                  <input
                    className="input input-sm"
                    name="address"
                    defaultValue={patient.address ?? ""}
                    placeholder="Full street address, city, zip code..."
                    autoFocus
                  />
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="btn btn-primary btn-sm" type="submit" disabled={pending}>
                      {pending ? "Saving..." : "Save Address"}
                    </button>
                  </div>
                </form>
              ) : (
                <p style={{ font: "var(--body-md)", color: "var(--ink)", margin: 0 }}>
                  {patient.address ?? "No address recorded on file."}
                </p>
              )}
            </div>
          </div>

          <hr style={{ border: 0, borderTop: "1px solid var(--border)", margin: 0 }} />

          {/* Section 2: Clinical Histories (Medical, Family, Past Dental History - Bullet Point Format) */}
          <div style={{ display: "grid", gap: 20 }}>
            {/* Medical History Card */}
            <div className="card card-soft" style={{ display: "grid", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    color: "var(--primary)",
                    font: "var(--title-sm)",
                  }}
                >
                  <i className="ph ph-first-aid" aria-hidden="true" />
                  <strong>Medical History</strong>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setEditingField(editingField === "medicalHistory" ? null : "medicalHistory")}
                >
                  <i className={`ph ph-${editingField === "medicalHistory" ? "x" : "pencil-simple"}`} aria-hidden="true" />
                  {editingField === "medicalHistory" ? "Cancel" : "Edit Medical History"}
                </button>
              </div>

              {editingField === "medicalHistory" ? (
                <form action={action} style={{ display: "grid", gap: 10 }}>
                  <input type="hidden" name="patientId" value={patient.id} />
                  <textarea
                    className="textarea"
                    name="medicalHistory"
                    rows={4}
                    defaultValue={medBullets.join("\n")}
                    placeholder={"Type each item on a new line for bullet points:\n• Type 2 Diabetes\n• Hypertension\n• Penicillin allergy"}
                    autoFocus
                  />
                  <p className="hint">Enter each condition or medical event on a new line to render as a bullet point.</p>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="btn btn-primary btn-sm" type="submit" disabled={pending}>
                      {pending ? "Saving..." : "Save Medical History"}
                    </button>
                  </div>
                </form>
              ) : (
                <BulletList
                  items={medBullets}
                  emptyMessage="No medical conditions or systemic illnesses recorded."
                />
              )}
            </div>

            {/* Family History Card */}
            <div className="card card-soft" style={{ display: "grid", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    color: "var(--primary)",
                    font: "var(--title-sm)",
                  }}
                >
                  <i className="ph ph-users" aria-hidden="true" />
                  <strong>Family History</strong>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setEditingField(editingField === "familyHistory" ? null : "familyHistory")}
                >
                  <i className={`ph ph-${editingField === "familyHistory" ? "x" : "pencil-simple"}`} aria-hidden="true" />
                  {editingField === "familyHistory" ? "Cancel" : "Edit Family History"}
                </button>
              </div>

              {editingField === "familyHistory" ? (
                <form action={action} style={{ display: "grid", gap: 10 }}>
                  <input type="hidden" name="patientId" value={patient.id} />
                  <textarea
                    className="textarea"
                    name="familyHistory"
                    rows={4}
                    defaultValue={famBullets.join("\n")}
                    placeholder={"Type each item on a new line for bullet points:\n• Father had early onset periodontitis\n• Mother has Type 2 Diabetes"}
                    autoFocus
                  />
                  <p className="hint">Enter each family history item on a new line to render as a bullet point.</p>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="btn btn-primary btn-sm" type="submit" disabled={pending}>
                      {pending ? "Saving..." : "Save Family History"}
                    </button>
                  </div>
                </form>
              ) : (
                <BulletList
                  items={famBullets}
                  emptyMessage="No hereditary or family medical/dental history recorded."
                />
              )}
            </div>

            {/* Past Dental History Card */}
            <div className="card card-soft" style={{ display: "grid", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    color: "var(--primary)",
                    font: "var(--title-sm)",
                  }}
                >
                  <i className="ph ph-tooth" aria-hidden="true" />
                  <strong>Past Dental History</strong>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setEditingField(editingField === "pastDentalHistory" ? null : "pastDentalHistory")}
                >
                  <i className={`ph ph-${editingField === "pastDentalHistory" ? "x" : "pencil-simple"}`} aria-hidden="true" />
                  {editingField === "pastDentalHistory" ? "Cancel" : "Edit Dental History"}
                </button>
              </div>

              {editingField === "pastDentalHistory" ? (
                <form action={action} style={{ display: "grid", gap: 10 }}>
                  <input type="hidden" name="patientId" value={patient.id} />
                  <textarea
                    className="textarea"
                    name="pastDentalHistory"
                    rows={4}
                    defaultValue={dentalBullets.join("\n")}
                    placeholder={"Type each item on a new line for bullet points:\n• Root canal treatment on tooth 36 (2023)\n• Regular hygiene scaling\n• Fixed orthodontic braces in adolescence"}
                    autoFocus
                  />
                  <p className="hint">Enter each dental procedure or event on a new line to render as a bullet point.</p>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="btn btn-primary btn-sm" type="submit" disabled={pending}>
                      {pending ? "Saving..." : "Save Dental History"}
                    </button>
                  </div>
                </form>
              ) : (
                <BulletList
                  items={dentalBullets}
                  emptyMessage="No past dental treatments, extractions, or surgeries recorded."
                />
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
