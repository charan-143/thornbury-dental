"use client";

import { useState, useActionState, useEffect } from "react";
import {
  updateTreatmentPlanAction,
  createTreatmentPlanAction,
  updateDiagnosisTextAction,
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
  plans: PlanItem[];
  steps: StepItem[];
  addenda: AddendumItem[];
  conditions?: Array<{ label: string }>;
}

export function TreatmentPlansView({
  patientId,
  plans,
  steps,
  addenda,
  conditions,
}: TreatmentPlansViewProps) {
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const [planState, planAction, isPlanPending] = useActionState(updateTreatmentPlanAction, null);
  const [createState, createAction, isCreatePending] = useActionState(createTreatmentPlanAction, null);
  const [diagState, diagAction, isDiagPending] = useActionState(updateDiagnosisTextAction, null);
  const [isEditingDiagnosis, setIsEditingDiagnosis] = useState(false);
  const [diagSaved, setDiagSaved] = useState(false);

  // Close create drawer upon successful creation
  useEffect(() => {
    if (createState?.success) {
      setIsCreating(false);
    }
  }, [createState]);

  // Close edit drawer upon successful save
  useEffect(() => {
    if (planState?.success) {
      setEditingPlanId(null);
    }
  }, [planState]);

  // Close diagnosis editor upon successful save and show "Saved" badge
  useEffect(() => {
    if (diagState?.success) {
      setIsEditingDiagnosis(false);
      setDiagSaved(true);
      const timer = setTimeout(() => setDiagSaved(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [diagState]);

  const defaultDiagnosisText = conditions && conditions.length > 0
    ? conditions.map((c) => c.label).join("\n")
    : "";

  return (
    <div style={{ display: "grid", gap: 24 }}>
      {/* 1. Diagnosis Section */}
      <section className="panel">
        <div className="panel-head">
          <h2>
            <i className="ph ph-stethoscope" aria-hidden="true" style={{ color: "var(--primary)", marginRight: 8 }} />
            Diagnosis
          </h2>
          <div className="spacer" />
          {diagSaved && (
            <span className="badge badge-success" style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <i className="ph ph-check-circle" /> Saved
            </span>
          )}
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setIsEditingDiagnosis(!isEditingDiagnosis)}
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            <i className={`ph ph-${isEditingDiagnosis ? "x" : "note-pencil"}`} aria-hidden="true" />
            <span>
              {isEditingDiagnosis
                ? "Cancel"
                : conditions && conditions.length > 0
                  ? "Edit Diagnosis"
                  : "Add Diagnosis"}
            </span>
          </button>
        </div>

        <div className="panel-body">
          {isEditingDiagnosis ? (
            <form action={diagAction} style={{ display: "grid", gap: 12 }}>
              <input type="hidden" name="patientId" value={patientId} />

              {diagState?.error && (
                <div className="alert alert-warning">
                  <i className="ph ph-warning" aria-hidden="true" />
                  <span>{diagState.error}</span>
                </div>
              )}

              <div style={{ display: "grid", gap: 6 }}>
                <label htmlFor="patient-diagnosis-text" style={{ font: "var(--caption)", color: "var(--muted)", fontWeight: 600 }}>
                  Patient Diagnosis:
                </label>
                <textarea
                  id="patient-diagnosis-text"
                  name="diagnosis"
                  className="textarea"
                  rows={5}
                  defaultValue={defaultDiagnosisText}
                  placeholder="Type patient diagnosis here (e.g. Chronic generalized periodontitis, Irreversible pulpitis tooth 16)..."
                  autoFocus
                />
                <span className="caption" style={{ color: "var(--muted)" }}>
                  💡 Tip: Type or edit diagnoses line by line. Click &quot;Save Diagnosis&quot; to update the patient record.
                </span>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setIsEditingDiagnosis(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn-sm" disabled={isDiagPending}>
                  <i className="ph ph-check" aria-hidden="true" />
                  {isDiagPending ? "Saving Diagnosis..." : "Save Diagnosis"}
                </button>
              </div>
            </form>
          ) : (
            <div>
              {conditions && conditions.length > 0 ? (
                <div style={{ display: "grid", gap: 8 }}>
                  {conditions.map((c, idx) => (
                    <div
                      key={`diag-item-${idx}`}
                      style={{ display: "flex", alignItems: "flex-start", gap: 10 }}
                    >
                      <i
                        className="ph ph-dot-outline"
                        aria-hidden="true"
                        style={{ color: "var(--primary)", fontSize: "1.2rem", marginTop: 2, flexShrink: 0 }}
                      />
                      <span style={{ font: "var(--body-md)", color: "var(--ink)" }}>{c.label}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span className="meta">No diagnosis recorded yet. Click &quot;Add Diagnosis&quot; to specify.</span>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => setIsEditingDiagnosis(true)}
                    style={{ display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <i className="ph ph-plus" aria-hidden="true" />
                    <span>Add Diagnosis</span>
                  </button>
                </div>
              )}
            </div>
          )}
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
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setIsCreating(!isCreating)}
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            <i className={`ph ph-${isCreating ? "x" : "plus"}`} aria-hidden="true" />
            <span>{isCreating ? "Cancel" : "New Treatment Plan"}</span>
          </button>
          <span className="badge">{plans.length} total</span>
        </div>

        <div className="panel-body">
          {/* New Treatment Plan Form Drawer */}
          {isCreating && (
            <form
              action={createAction}
              className="card card-soft"
              style={{
                marginBottom: 20,
                padding: 16,
                border: "1.5px solid var(--primary)",
                display: "grid",
                gap: 14,
                backgroundColor: "var(--surface)",
              }}
            >
              <input type="hidden" name="patientId" value={patientId} />

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong style={{ font: "var(--title-sm)", color: "var(--ink)", display: "flex", alignItems: "center", gap: 8 }}>
                  <i className="ph ph-plus-circle" style={{ color: "var(--primary)" }} />
                  Create New Treatment Plan
                </strong>
                <span className="badge badge-info">Immediate Patient Plan</span>
              </div>

              {createState?.error && (
                <div className="alert alert-warning">
                  <i className="ph ph-warning" aria-hidden="true" />
                  <span>{createState.error}</span>
                </div>
              )}

              <div style={{ display: "grid", gap: 6 }}>
                <label htmlFor="new-plan-proc" style={{ font: "var(--caption)", color: "var(--muted)", fontWeight: 600 }}>
                  Procedure / Plan Title:
                </label>
                <input
                  id="new-plan-proc"
                  name="procedure"
                  className="input input-sm"
                  placeholder="e.g. Crown Prep Tooth 16 / Root Canal Treatment / Scaling & Polishing"
                  required
                />
              </div>

              <div style={{ display: "grid", gap: 6 }}>
                <label htmlFor="new-plan-steps" style={{ font: "var(--caption)", color: "var(--muted)", fontWeight: 600 }}>
                  Advice & Steps (Bullet Points - Pre-added with &quot;Advice to&quot;):
                </label>
                <textarea
                  id="new-plan-steps"
                  name="stepsText"
                  className="textarea"
                  rows={4}
                  defaultValue={
                    "Advice to avoid chewing hard foods on the affected side\nAdvice to take prescribed analgesics with meals as needed\nAdvice to maintain gentle warm salt water rinses after eating"
                  }
                  placeholder="Type advice bullet points line by line..."
                  required
                />
                <span className="caption" style={{ color: "var(--muted)" }}>
                  💡 Tip: Type each advice line on a new line. Lines will be saved as bullet points pre-added with &quot;Advice to&quot;.
                </span>
              </div>

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setIsCreating(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn-sm" disabled={isCreatePending}>
                  <i className="ph ph-check" aria-hidden="true" />
                  {isCreatePending ? "Creating Plan..." : "Create Treatment Plan"}
                </button>
              </div>
            </form>
          )}
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
            <div className="card card-soft" style={{ textAlign: "center", padding: "32px 16px", display: "grid", gap: 12, placeItems: "center" }}>
              <i className="ph ph-clipboard-text" style={{ fontSize: "2rem", color: "var(--muted)" }} />
              <div>
                <strong style={{ display: "block", color: "var(--ink)", font: "var(--title-sm)" }}>No treatment plans recorded yet</strong>
                <p className="meta" style={{ marginTop: 4 }}>
                  Create a customized pre-procedure or post-procedure treatment plan with automated advice bullet points.
                </p>
              </div>
              {!isCreating && (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => setIsCreating(true)}
                  style={{ display: "flex", alignItems: "center", gap: 6 }}
                >
                  <i className="ph ph-plus" aria-hidden="true" />
                  <span>Create First Treatment Plan</span>
                </button>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
