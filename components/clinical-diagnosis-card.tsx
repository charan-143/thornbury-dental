"use client";

import { useState, useActionState, useEffect } from "react";
import { updateSpecificDiagnosisElementAction } from "@/actions/clinical";

interface ClinicalDiagnosisCardProps {
  patientId: string;
  conditions?: Array<{ label: string }>;
}

export function ClinicalDiagnosisCard({
  patientId,
  conditions = [],
}: ClinicalDiagnosisCardProps) {
  const [editingElement, setEditingElement] = useState<string | null>(null);
  const [elemState, elemAction, isElemPending] = useActionState(
    updateSpecificDiagnosisElementAction,
    null,
  );

  // Close element editing drawer upon successful save
  useEffect(() => {
    if (elemState?.success) {
      setEditingElement(null);
    }
  }, [elemState]);

  // Parse existing conditions for examination section
  const findPrefix = (prefix: string) =>
    conditions.find((c) => c.label.startsWith(prefix))?.label.slice(prefix.length).trim() || "";

  const parsedStains = findPrefix("Stains: ");
  const parsedCalculus = findPrefix("Calculus: ");

  const rawPockets = findPrefix("Pockets: ");
  const pocketsHasTeeth = rawPockets.includes("(Teeth:");
  const parsedPockets = pocketsHasTeeth ? "Generalized" : rawPockets;
  const parsedPocketTeeth = pocketsHasTeeth
    ? rawPockets.match(/\(Teeth:\s*([^)]+)\)/)?.[1]?.trim() || ""
    : "";

  const [selectedPockets, setPocketsVal] = useState(parsedPockets);

  const rawRecession = findPrefix("Recession: ");
  const recessionHasTeeth = rawRecession.includes("(Teeth:");
  let parsedRecession = rawRecession;
  let parsedRecessionTeeth = "";
  if (recessionHasTeeth) {
    const match = rawRecession.match(/^([^(]+)\s*\(Teeth:\s*([^)]+)\)/);
    if (match) {
      parsedRecession = match[1]?.trim() || "";
      parsedRecessionTeeth = match[2]?.trim() || "";
    }
  }
  const [selectedRecession, setRecessionVal] = useState(parsedRecession);

  // Keep state in sync if server props change
  useEffect(() => {
    setPocketsVal(parsedPockets);
  }, [parsedPockets]);

  useEffect(() => {
    setRecessionVal(parsedRecession);
  }, [parsedRecession]);

  const rawTmj = findPrefix("TMJ: ");
  let parsedTmj = rawTmj;
  let parsedTmjNotes = "";
  if (rawTmj.includes("(") && rawTmj.endsWith(")")) {
    const match = rawTmj.match(/^([^(]+)\s*\(([^)]+)\)$/);
    if (match) {
      parsedTmj = match[1]?.trim() || "";
      parsedTmjNotes = match[2]?.trim() || "";
    }
  }

  const parsedOther = conditions
    .map((c) => c.label)
    .filter(
      (l) =>
        !l.startsWith("Stains:") &&
        !l.startsWith("Calculus:") &&
        !l.startsWith("Pockets:") &&
        !l.startsWith("Recession:") &&
        !l.startsWith("TMJ:"),
    );

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>
          <i className="ph ph-stethoscope" aria-hidden="true" style={{ color: "var(--primary)", marginRight: 8 }} />
          Clinical Examination Findings & Diagnoses
        </h2>
        <div className="spacer" />
        <span className="badge">{conditions.length} recorded</span>
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
                  <label htmlFor="diag-pocket-teeth-input" style={{ font: "var(--caption)", color: "var(--primary)", fontWeight: 600 }}>
                    Specify Tooth Numbers (Generalized):
                  </label>
                  <input
                    id="diag-pocket-teeth-input"
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
                  <label htmlFor="diag-recession-teeth-input" style={{ font: "var(--caption)", color: "var(--primary)", fontWeight: 600 }}>
                    Tooth Numbers / Location (Optional):
                  </label>
                  <input
                    id="diag-recession-teeth-input"
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

        {/* 5. TMJ Element */}
        <div className="card card-soft" style={{ display: "grid", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <i className="ph ph-pulse" aria-hidden="true" style={{ color: "var(--primary)", fontSize: "1.2rem" }} />
            <strong style={{ font: "var(--title-sm)", color: "var(--ink)" }}>5. TMJ (Temporomandibular Joint)</strong>
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
                <label htmlFor="diag-tmj-notes-input" style={{ font: "var(--caption)", color: "var(--primary)", fontWeight: 600 }}>
                  TMJ Details / Notes (Optional):
                </label>
                <input
                  id="diag-tmj-notes-input"
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

        {/* 6. Additional Diagnoses / Conditions */}
        <div className="card card-soft" style={{ display: "grid", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <i className="ph ph-list-bullets" aria-hidden="true" style={{ color: "var(--primary)", fontSize: "1.2rem" }} />
            <strong style={{ font: "var(--title-sm)", color: "var(--ink)" }}>6. Additional Diagnoses / Conditions</strong>
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
  );
}
