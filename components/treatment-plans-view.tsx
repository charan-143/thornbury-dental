"use client";

import { useState, useActionState } from "react";
import {
  updateTreatmentPlanAction,
  updateSpecificDiagnosisElementAction,
} from "@/actions/clinical";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const asDate = (v: Date | string) => (v instanceof Date ? v : new Date(v));
const day = (v: Date | string | null) =>
  v ? `${asDate(v).getDate()} ${MONTHS[asDate(v).getMonth()]} ${asDate(v).getFullYear()}` : "not recorded";

export type PlanItem = {
  id: string;
  procedure: string;
  phase: string;
  published_at: Date | string | null;
  clinician_name: string;
};

export type StepItem = {
  plan_id: string;
  title: string;
  detail: string;
};

export type AddendumItem = {
  plan_id: string;
  body: string;
  created_at: Date | string;
};

interface TreatmentPlansViewProps {
  patientId: string;
  conditions: Array<{ label: string }>;
  plans: PlanItem[];
  steps: StepItem[];
  addenda: AddendumItem[];
}

export function TreatmentPlansView({
  patientId,
  conditions,
  plans,
  steps,
  addenda,
}: TreatmentPlansViewProps) {
  const [editingElement, setEditingElement] = useState<string | null>(null);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);

  const [elemState, elemAction, isElemPending] = useActionState(updateSpecificDiagnosisElementAction, {});
  const [planState, planAction, isPlanPending] = useActionState(updateTreatmentPlanAction, {});

  // Parse current conditions for structured inputs
  let parsedStains = "";
  let parsedCalculus = "";
  let parsedPockets = "";
  let parsedPocketTeeth = "";
  let parsedRecession = "";
  let parsedRecessionTeeth = "";
  let parsedGingival = "";
  let parsedTmj = "";
  let parsedTmjNotes = "";
  const parsedOther: string[] = [];

  for (const c of conditions) {
    const label = c.label.trim();
    if (label.toLowerCase().startsWith("stains:")) {
      parsedStains = label.substring(label.indexOf(":") + 1).trim();
    } else if (label.toLowerCase().startsWith("calculus:")) {
      parsedCalculus = label.substring(label.indexOf(":") + 1).trim();
    } else if (label.toLowerCase().startsWith("pockets:")) {
      const rest = label.substring(label.indexOf(":") + 1).trim();
      if (rest.toLowerCase().startsWith("generalized")) {
        parsedPockets = "Generalized";
        const match = rest.match(/\(teeth:\s*([^)]+)\)/i);
        if (match && match[1]) parsedPocketTeeth = match[1].trim();
      } else if (rest.toLowerCase().startsWith("localised") || rest.toLowerCase().startsWith("localized")) {
        parsedPockets = "Localised";
      } else {
        parsedPockets = rest;
      }
    } else if (label.toLowerCase().startsWith("recession:")) {
      const rest = label.substring(label.indexOf(":") + 1).trim();
      const match = rest.match(/^(Mild|Moderate|Severe|Present)(?:\s*\(teeth:\s*([^)]+)\))?/i);
      if (match) {
        if (match[1]) parsedRecession = match[1];
        if (match[2]) parsedRecessionTeeth = match[2].trim();
      } else {
        parsedRecession = rest;
      }
    } else if (label.toLowerCase().startsWith("gingival:") || label.toLowerCase().startsWith("gingivitis")) {
      parsedGingival = label.includes(":") ? label.substring(label.indexOf(":") + 1).trim() : label;
    } else if (label.toLowerCase().startsWith("tmj:")) {
      const rest = label.substring(label.indexOf(":") + 1).trim();
      const match = rest.match(/^([^(]+)(?:\s*\(([^)]+)\))?/);
      if (match) {
        if (match[1]) parsedTmj = match[1].trim();
        if (match[2]) parsedTmjNotes = match[2].trim();
      } else {
        parsedTmj = rest;
      }
    } else {
      parsedOther.push(label);
    }
  }

  const [pocketsVal, setPocketsVal] = useState<string | null>(null);
  const [recessionVal, setRecessionVal] = useState<string | null>(null);

  const selectedPockets = pocketsVal !== null ? pocketsVal : parsedPockets;
  const selectedRecession = recessionVal !== null ? recessionVal : parsedRecession;

  return (
    <div style={{ display: "grid", gap: 24 }}>
      {/* 1. Clinical Diagnosis Section */}
      <section className="panel">
        <div className="panel-head">
          <h2>
            <i className="ph ph-stethoscope" aria-hidden="true" style={{ color: "var(--primary)", marginRight: 8 }} />
            Clinical Diagnosis & Active Conditions
          </h2>
          <div className="spacer" />
          <span className="badge">{conditions.length} findings recorded</span>
        </div>

        <div className="panel-body" style={{ display: "grid", gap: 14 }}>
          {elemState?.error && (
            <div className="alert alert-warning">
              <i className="ph ph-warning" aria-hidden="true" />
              <span>{elemState.error}</span>
            </div>
          )}

          {/* 1. Stains Element */}
          <div className="card card-soft" style={{ display: "grid", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <i className="ph ph-drop" aria-hidden="true" style={{ color: "var(--primary)", fontSize: "1.2rem" }} />
              <strong style={{ font: "var(--title-sm)", color: "var(--ink)" }}>1. Stains</strong>
              <span className="spacer" />
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setEditingElement(editingElement === "stains" ? null : "stains")}
              >
                <i className={`ph ph-${editingElement === "stains" ? "x" : "note-pencil"}`} aria-hidden="true" />
                {editingElement === "stains" ? "Cancel" : "Edit Stains"}
              </button>
            </div>

            {editingElement === "stains" ? (
              <form action={elemAction} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", paddingTop: 6 }}>
                <input type="hidden" name="patientId" value={patientId} />
                <input type="hidden" name="element" value="stains" />
                <select name="stains" className="select input-sm" defaultValue={parsedStains} style={{ minWidth: 160 }}>
                  <option value="">-- None / Clear --</option>
                  <option value="Mild">Mild</option>
                  <option value="Moderate">Moderate</option>
                  <option value="Severe">Severe</option>
                </select>
                <button type="submit" className="btn btn-primary btn-sm" disabled={isElemPending}>
                  <i className="ph ph-check" aria-hidden="true" /> {isElemPending ? "Saving..." : "Save Stains"}
                </button>
              </form>
            ) : (
              <div style={{ paddingLeft: 26 }}>
                {parsedStains ? (
                  <span className="badge badge-info" style={{ fontSize: "0.85rem" }}>{parsedStains}</span>
                ) : (
                  <span className="meta">Not recorded (Click &quot;Edit Stains&quot; to specify)</span>
                )}
              </div>
            )}
          </div>

          {/* 2. Calculus Element */}
          <div className="card card-soft" style={{ display: "grid", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <i className="ph ph-circles-four" aria-hidden="true" style={{ color: "var(--primary)", fontSize: "1.2rem" }} />
              <strong style={{ font: "var(--title-sm)", color: "var(--ink)" }}>2. Calculus</strong>
              <span className="spacer" />
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setEditingElement(editingElement === "calculus" ? null : "calculus")}
              >
                <i className={`ph ph-${editingElement === "calculus" ? "x" : "note-pencil"}`} aria-hidden="true" />
                {editingElement === "calculus" ? "Cancel" : "Edit Calculus"}
              </button>
            </div>

            {editingElement === "calculus" ? (
              <form action={elemAction} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", paddingTop: 6 }}>
                <input type="hidden" name="patientId" value={patientId} />
                <input type="hidden" name="element" value="calculus" />
                <select name="calculus" className="select input-sm" defaultValue={parsedCalculus} style={{ minWidth: 160 }}>
                  <option value="">-- None / Clear --</option>
                  <option value="Mild">Mild</option>
                  <option value="Moderate">Moderate</option>
                  <option value="Severe">Severe</option>
                </select>
                <button type="submit" className="btn btn-primary btn-sm" disabled={isElemPending}>
                  <i className="ph ph-check" aria-hidden="true" /> {isElemPending ? "Saving..." : "Save Calculus"}
                </button>
              </form>
            ) : (
              <div style={{ paddingLeft: 26 }}>
                {parsedCalculus ? (
                  <span className="badge badge-info" style={{ fontSize: "0.85rem" }}>{parsedCalculus}</span>
                ) : (
                  <span className="meta">Not recorded (Click &quot;Edit Calculus&quot; to specify)</span>
                )}
              </div>
            )}
          </div>

          {/* 3. Pockets Element */}
          <div className="card card-soft" style={{ display: "grid", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <i className="ph ph-arrows-in-line-vertical" aria-hidden="true" style={{ color: "var(--primary)", fontSize: "1.2rem" }} />
              <strong style={{ font: "var(--title-sm)", color: "var(--ink)" }}>3. Pockets</strong>
              <span className="spacer" />
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setEditingElement(editingElement === "pockets" ? null : "pockets")}
              >
                <i className={`ph ph-${editingElement === "pockets" ? "x" : "note-pencil"}`} aria-hidden="true" />
                {editingElement === "pockets" ? "Cancel" : "Edit Pockets"}
              </button>
            </div>

            {editingElement === "pockets" ? (
              <form action={elemAction} style={{ display: "grid", gap: 10, paddingTop: 6 }}>
                <input type="hidden" name="patientId" value={patientId} />
                <input type="hidden" name="element" value="pockets" />
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <select
                    name="pockets"
                    className="select input-sm"
                    value={selectedPockets}
                    onChange={(e) => setPocketsVal(e.target.value)}
                    style={{ minWidth: 160 }}
                  >
                    <option value="">-- None / Clear --</option>
                    <option value="Localised">Localised</option>
                    <option value="Generalized">Generalized</option>
                  </select>
                </div>

                {selectedPockets === "Generalized" && (
                  <div style={{ display: "grid", gap: 4 }}>
                    <label htmlFor="pocket-teeth-input" style={{ font: "var(--caption)", color: "var(--primary)", fontWeight: 600 }}>
                      Specify Tooth Numbers (Generalized):
                    </label>
                    <input
                      id="pocket-teeth-input"
                      name="pocketTeeth"
                      className="input input-sm"
                      defaultValue={parsedPocketTeeth}
                      placeholder="e.g. 16, 17, 26, 36, 46"
                    />
                  </div>
                )}

                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditingElement(null)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary btn-sm" disabled={isElemPending}>
                    <i className="ph ph-check" aria-hidden="true" /> {isElemPending ? "Saving..." : "Save Pockets"}
                  </button>
                </div>
              </form>
            ) : (
              <div style={{ paddingLeft: 26 }}>
                {parsedPockets ? (
                  <span className="badge badge-info" style={{ fontSize: "0.85rem" }}>
                    {parsedPockets === "Generalized" && parsedPocketTeeth
                      ? `Generalized (Teeth: ${parsedPocketTeeth})`
                      : parsedPockets}
                  </span>
                ) : (
                  <span className="meta">Not recorded (Click &quot;Edit Pockets&quot; to specify)</span>
                )}
              </div>
            )}
          </div>

          {/* 4. Recession Element */}
          <div className="card card-soft" style={{ display: "grid", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <i className="ph ph-trend-down" aria-hidden="true" style={{ color: "var(--primary)", fontSize: "1.2rem" }} />
              <strong style={{ font: "var(--title-sm)", color: "var(--ink)" }}>4. Recession</strong>
              <span className="spacer" />
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setEditingElement(editingElement === "recession" ? null : "recession")}
              >
                <i className={`ph ph-${editingElement === "recession" ? "x" : "note-pencil"}`} aria-hidden="true" />
                {editingElement === "recession" ? "Cancel" : "Edit Recession"}
              </button>
            </div>

            {editingElement === "recession" ? (
              <form action={elemAction} style={{ display: "grid", gap: 10, paddingTop: 6 }}>
                <input type="hidden" name="patientId" value={patientId} />
                <input type="hidden" name="element" value="recession" />
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <select
                    name="recession"
                    className="select input-sm"
                    value={selectedRecession}
                    onChange={(e) => setRecessionVal(e.target.value)}
                    style={{ minWidth: 160 }}
                  >
                    <option value="">-- None / Clear --</option>
                    <option value="Mild">Mild</option>
                    <option value="Moderate">Moderate</option>
                    <option value="Severe">Severe</option>
                    <option value="Present">Present</option>
                  </select>
                </div>

                {Boolean(selectedRecession) && (
                  <div style={{ display: "grid", gap: 4 }}>
                    <label htmlFor="recession-teeth-input" style={{ font: "var(--caption)", color: "var(--primary)", fontWeight: 600 }}>
                      Tooth Numbers / Location (Optional):
                    </label>
                    <input
                      id="recession-teeth-input"
                      name="recessionTeeth"
                      className="input input-sm"
                      defaultValue={parsedRecessionTeeth}
                      placeholder="e.g. Tooth 14, 24..."
                    />
                  </div>
                )}

                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditingElement(null)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary btn-sm" disabled={isElemPending}>
                    <i className="ph ph-check" aria-hidden="true" /> {isElemPending ? "Saving..." : "Save Recession"}
                  </button>
                </div>
              </form>
            ) : (
              <div style={{ paddingLeft: 26 }}>
                {parsedRecession ? (
                  <span className="badge badge-info" style={{ fontSize: "0.85rem" }}>
                    {parsedRecessionTeeth ? `${parsedRecession} (Teeth: ${parsedRecessionTeeth})` : parsedRecession}
                  </span>
                ) : (
                  <span className="meta">Not recorded (Click &quot;Edit Recession&quot; to specify)</span>
                )}
              </div>
            )}
          </div>

          {/* 5. Gingival Status Element */}
          <div className="card card-soft" style={{ display: "grid", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <i className="ph ph-first-aid" aria-hidden="true" style={{ color: "var(--primary)", fontSize: "1.2rem" }} />
              <strong style={{ font: "var(--title-sm)", color: "var(--ink)" }}>5. Gingival Status</strong>
              <span className="spacer" />
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setEditingElement(editingElement === "gingival" ? null : "gingival")}
              >
                <i className={`ph ph-${editingElement === "gingival" ? "x" : "note-pencil"}`} aria-hidden="true" />
                {editingElement === "gingival" ? "Cancel" : "Edit Gingival"}
              </button>
            </div>

            {editingElement === "gingival" ? (
              <form action={elemAction} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", paddingTop: 6 }}>
                <input type="hidden" name="patientId" value={patientId} />
                <input type="hidden" name="element" value="gingival" />
                <select name="gingival" className="select input-sm" defaultValue={parsedGingival} style={{ minWidth: 180 }}>
                  <option value="">-- None / Clear --</option>
                  <option value="Normal">Normal</option>
                  <option value="Mild Gingivitis">Mild Gingivitis</option>
                  <option value="Moderate Gingivitis">Moderate Gingivitis</option>
                  <option value="Severe Gingivitis">Severe Gingivitis</option>
                  <option value="Bleeding on Probing">Bleeding on Probing</option>
                  <option value="Edematous / Swollen">Edematous / Swollen</option>
                </select>
                <button type="submit" className="btn btn-primary btn-sm" disabled={isElemPending}>
                  <i className="ph ph-check" aria-hidden="true" /> {isElemPending ? "Saving..." : "Save Gingival"}
                </button>
              </form>
            ) : (
              <div style={{ paddingLeft: 26 }}>
                {parsedGingival ? (
                  <span className="badge badge-info" style={{ fontSize: "0.85rem" }}>{parsedGingival}</span>
                ) : (
                  <span className="meta">Not recorded (Click &quot;Edit Gingival&quot; to specify)</span>
                )}
              </div>
            )}
          </div>

          {/* 6. TMJ Element */}
          <div className="card card-soft" style={{ display: "grid", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <i className="ph ph-pulse" aria-hidden="true" style={{ color: "var(--primary)", fontSize: "1.2rem" }} />
              <strong style={{ font: "var(--title-sm)", color: "var(--ink)" }}>6. TMJ (Temporomandibular Joint)</strong>
              <span className="spacer" />
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setEditingElement(editingElement === "tmj" ? null : "tmj")}
              >
                <i className={`ph ph-${editingElement === "tmj" ? "x" : "note-pencil"}`} aria-hidden="true" />
                {editingElement === "tmj" ? "Cancel" : "Edit TMJ"}
              </button>
            </div>

            {editingElement === "tmj" ? (
              <form action={elemAction} style={{ display: "grid", gap: 10, paddingTop: 6 }}>
                <input type="hidden" name="patientId" value={patientId} />
                <input type="hidden" name="element" value="tmj" />
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <select name="tmj" className="select input-sm" defaultValue={parsedTmj} style={{ minWidth: 180 }}>
                    <option value="">-- None / Clear --</option>
                    <option value="Normal">Normal</option>
                    <option value="Clicking">Clicking</option>
                    <option value="Tenderness">Tenderness</option>
                    <option value="Crepitus">Crepitus</option>
                    <option value="Pain on Movement">Pain on Movement</option>
                    <option value="Limited Opening (< 35mm)">Limited Opening (&lt; 35mm)</option>
                    <option value="Deviation on Opening">Deviation on Opening</option>
                  </select>
                </div>
                <div style={{ display: "grid", gap: 4 }}>
                  <label htmlFor="tmj-notes-input" style={{ font: "var(--caption)", color: "var(--primary)", fontWeight: 600 }}>
                    TMJ Details / Notes (Optional):
                  </label>
                  <input
                    id="tmj-notes-input"
                    name="tmjNotes"
                    className="input input-sm"
                    defaultValue={parsedTmjNotes}
                    placeholder="e.g. Right side clicking during jaw opening..."
                  />
                </div>
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditingElement(null)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary btn-sm" disabled={isElemPending}>
                    <i className="ph ph-check" aria-hidden="true" /> {isElemPending ? "Saving..." : "Save TMJ"}
                  </button>
                </div>
              </form>
            ) : (
              <div style={{ paddingLeft: 26 }}>
                {parsedTmj ? (
                  <span className="badge badge-info" style={{ fontSize: "0.85rem" }}>
                    {parsedTmjNotes ? `${parsedTmj} (${parsedTmjNotes})` : parsedTmj}
                  </span>
                ) : (
                  <span className="meta">Not recorded (Click &quot;Edit TMJ&quot; to specify)</span>
                )}
              </div>
            )}
          </div>

          {/* 7. Additional Clinical Diagnoses */}
          <div className="card card-soft" style={{ display: "grid", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <i className="ph ph-list-bullets" aria-hidden="true" style={{ color: "var(--primary)", fontSize: "1.2rem" }} />
              <strong style={{ font: "var(--title-sm)", color: "var(--ink)" }}>7. Additional Diagnoses / Conditions</strong>
              <span className="spacer" />
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setEditingElement(editingElement === "other" ? null : "other")}
              >
                <i className={`ph ph-${editingElement === "other" ? "x" : "note-pencil"}`} aria-hidden="true" />
                {editingElement === "other" ? "Cancel" : "Edit Diagnoses"}
              </button>
            </div>

            {editingElement === "other" ? (
              <form action={elemAction} style={{ display: "grid", gap: 10, paddingTop: 6 }}>
                <input type="hidden" name="patientId" value={patientId} />
                <input type="hidden" name="element" value="other" />
                <textarea
                  name="otherConditions"
                  className="textarea"
                  rows={3}
                  defaultValue={parsedOther.join("\n")}
                  placeholder="Type any custom diagnoses line by line (e.g. Irreversible pulpitis)..."
                />
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditingElement(null)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary btn-sm" disabled={isElemPending}>
                    <i className="ph ph-check" aria-hidden="true" /> {isElemPending ? "Saving..." : "Save Diagnoses"}
                  </button>
                </div>
              </form>
            ) : (
              <div style={{ paddingLeft: 26 }}>
                {parsedOther.length ? (
                  <div style={{ display: "grid", gap: 6 }}>
                    {parsedOther.map((item, idx) => (
                      <div key={`other-${idx}`} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <i className="ph ph-dot-outline" aria-hidden="true" style={{ color: "var(--primary)" }} />
                        <strong style={{ font: "var(--body-md)", color: "var(--ink)" }}>{item}</strong>
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className="meta">No custom diagnoses recorded (Click &quot;Edit Diagnoses&quot; to add)</span>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 2. Treatment Plans & Advice Instructions Section */}
      <section className="panel">
        <div className="panel-head">
          <h2>
            <i className="ph ph-clipboard-text" aria-hidden="true" style={{ color: "var(--primary)", marginRight: 8 }} />
            Treatment Plans & Advice Instructions
          </h2>
          <div className="spacer" />
          <span className="badge">{plans.length} total</span>
        </div>

        <div className="panel-body">
          {plans.length ? (
            plans.map((plan) => {
              const isEditingThisPlan = editingPlanId === plan.id;
              const planSteps = steps.filter((s) => s.plan_id === plan.id);
              const planAddenda = addenda.filter((a) => a.plan_id === plan.id);

              const defaultStepsText = planSteps.length
                ? planSteps
                    .map((s) => {
                      const lower = s.title.toLowerCase();
                      return lower.startsWith("advice to") ? s.title : `Advice to ${s.title}`;
                    })
                    .join("\n")
                : `Advice to avoid chewing hard foods on the affected side\nAdvice to take prescribed analgesics with meals as needed\nAdvice to maintain gentle warm salt water rinses after eating`;

              return (
                <article className="card" key={`plan-${plan.id}`} style={{ display: "grid", gap: 14, marginBottom: 16 }}>
                  <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                    <span className={`badge ${plan.phase === "pre" ? "badge-info" : "badge-success"}`}>
                      {plan.phase === "pre" ? "Before Procedure" : "After Procedure"}
                    </span>
                    <strong style={{ font: "var(--title-md)", color: "var(--ink)" }}>
                      {plan.procedure}
                    </strong>
                    <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => setEditingPlanId(isEditingThisPlan ? null : plan.id)}
                      >
                        <i className={`ph ph-${isEditingThisPlan ? "x" : "note-pencil"}`} aria-hidden="true" />
                        {isEditingThisPlan ? "Cancel" : "Edit Treatment Plan"}
                      </button>
                    </div>
                  </div>

                  {isEditingThisPlan ? (
                    <form action={planAction} className="card card-soft" style={{ display: "grid", gap: 12 }}>
                      <input type="hidden" name="planId" value={plan.id} />
                      <input type="hidden" name="patientId" value={patientId} />

                      {planState?.error && (
                        <div className="alert alert-warning">
                          <i className="ph ph-warning" aria-hidden="true" />
                          <span>{planState.error}</span>
                        </div>
                      )}

                      <div style={{ display: "grid", gap: 6 }}>
                        <label htmlFor={`proc-${plan.id}`} style={{ font: "var(--caption)", color: "var(--muted)", fontWeight: 600 }}>
                          Procedure / Plan Title:
                        </label>
                        <input
                          id={`proc-${plan.id}`}
                          name="procedure"
                          className="input input-sm"
                          defaultValue={plan.procedure}
                          required
                        />
                      </div>

                      <div style={{ display: "grid", gap: 6 }}>
                        <label style={{ font: "var(--caption)", color: "var(--muted)", fontWeight: 600 }}>
                          Phase / Timing:
                        </label>
                        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                          <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", font: "var(--body-sm)" }}>
                            <input type="radio" name="phase" value="pre" defaultChecked={plan.phase === "pre"} />
                            <span>Before Procedure (Pre-op Advice)</span>
                          </label>
                          <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", font: "var(--body-sm)" }}>
                            <input type="radio" name="phase" value="post" defaultChecked={plan.phase === "post"} />
                            <span>After Procedure (Post-op Advice)</span>
                          </label>
                        </div>
                      </div>

                      <div style={{ display: "grid", gap: 6 }}>
                        <label htmlFor={`steps-${plan.id}`} style={{ font: "var(--caption)", color: "var(--muted)", fontWeight: 600 }}>
                          Edit Advice & Steps (Bullet Points - Pre-added with &quot;Advice to&quot;):
                        </label>
                        <textarea
                          id={`steps-${plan.id}`}
                          name="stepsText"
                          className="textarea"
                          rows={5}
                          defaultValue={defaultStepsText}
                          placeholder="Advice to..."
                          required
                        />
                        <span className="caption" style={{ color: "var(--muted)" }}>
                          💡 Tip: Type each advice line on a new line. Lines will be saved as bullet points pre-added with &quot;Advice to&quot;.
                        </span>
                      </div>

                      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditingPlanId(null)}>
                          Cancel
                        </button>
                        <button type="submit" className="btn btn-primary btn-sm" disabled={isPlanPending}>
                          <i className="ph ph-check" aria-hidden="true" />
                          {isPlanPending ? "Saving..." : "Save Changes"}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div key={`plan-view-${plan.id}`} style={{ display: "grid", gap: 12 }}>
                      {/* Bullet Points Display */}
                      {planSteps.length > 0 ? (
                        <div className="steps" style={{ display: "grid", gap: 8, paddingLeft: 4 }}>
                          {planSteps.map((s, idx) => {
                            const lower = s.title.toLowerCase();
                            const hasAdviceTo = lower.startsWith("advice to");
                            const adviceContent = hasAdviceTo ? s.title.slice(9).trim() : s.title;

                            return (
                              <div
                                className="step"
                                key={`step-${plan.id}-${idx}`}
                                style={{ display: "flex", alignItems: "flex-start", gap: 10 }}
                              >
                                <i
                                  className="ph ph-dot-outline"
                                  aria-hidden="true"
                                  style={{ color: "var(--primary)", fontSize: "1.25rem", marginTop: 2, flexShrink: 0 }}
                                />
                                <div>
                                  <span
                                    className="badge badge-info"
                                    style={{
                                      display: "inline-block",
                                      marginRight: 8,
                                      padding: "2px 6px",
                                      fontSize: "0.75rem",
                                      fontWeight: 600,
                                    }}
                                  >
                                    Advice to
                                  </span>
                                  <strong style={{ color: "var(--ink)" }}>{adviceContent}</strong>
                                  {s.detail ? <p style={{ marginTop: 2, font: "var(--body-sm)", color: "var(--muted)" }}>{s.detail}</p> : null}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="meta">No advice steps listed for this plan.</p>
                      )}
                    </div>
                  )}

                  {/* Addenda Notes */}
                  {planAddenda.map((a, idx) => (
                    <div className="alert" key={`add-${plan.id}-${idx}`}>
                      <i className="ph ph-note-pencil" aria-hidden="true" />
                      <span>
                        <strong>{day(a.created_at)}.</strong> {a.body}
                      </span>
                    </div>
                  ))}

                  <p className="meta" style={{ font: "var(--caption)", color: "var(--muted)" }}>
                    Written by {plan.clinician_name}.
                  </p>
                </article>
              );
            })
          ) : (
            <p className="meta" style={{ padding: "16px 0" }}>
              No treatment plans recorded.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
