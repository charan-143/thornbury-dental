"use client";

import { useState, useEffect } from "react";
import { saveToothChartAction, getToothChartAction } from "@/actions/clinical";

export type ToothCondition = string;

export type ToothInfo = {
  num: number;
  fdi: string;
  name: string;
  quadrant: "UR" | "UL" | "LL" | "LR";
  condition: ToothCondition;
  notes?: string;
};

const TOOTH_NAMES: Record<number, { fdi: string; name: string; quad: "UR" | "UL" | "LL" | "LR" }> = {
  // Upper Right (1-8)
  1: { fdi: "18", name: "Upper Right 3rd Molar", quad: "UR" },
  2: { fdi: "17", name: "Upper Right 2nd Molar", quad: "UR" },
  3: { fdi: "16", name: "Upper Right 1st Molar", quad: "UR" },
  4: { fdi: "15", name: "Upper Right 2nd Premolar", quad: "UR" },
  5: { fdi: "14", name: "Upper Right 1st Premolar", quad: "UR" },
  6: { fdi: "13", name: "Upper Right Canine", quad: "UR" },
  7: { fdi: "12", name: "Upper Right Lateral Incisor", quad: "UR" },
  8: { fdi: "11", name: "Upper Right Central Incisor", quad: "UR" },

  // Upper Left (9-16)
  9: { fdi: "21", name: "Upper Left Central Incisor", quad: "UL" },
  10: { fdi: "22", name: "Upper Left Lateral Incisor", quad: "UL" },
  11: { fdi: "23", name: "Upper Left Canine", quad: "UL" },
  12: { fdi: "24", name: "Upper Left 1st Premolar", quad: "UL" },
  13: { fdi: "25", name: "Upper Left 2nd Premolar", quad: "UL" },
  14: { fdi: "26", name: "Upper Left 1st Molar", quad: "UL" },
  15: { fdi: "27", name: "Upper Left 2nd Molar", quad: "UL" },
  16: { fdi: "28", name: "Upper Left 3rd Molar", quad: "UL" },

  // Lower Left (17-24)
  17: { fdi: "38", name: "Lower Left 3rd Molar", quad: "LL" },
  18: { fdi: "37", name: "Lower Left 2nd Molar", quad: "LL" },
  19: { fdi: "36", name: "Lower Left 1st Molar", quad: "LL" },
  20: { fdi: "35", name: "Lower Left 2nd Premolar", quad: "LL" },
  21: { fdi: "34", name: "Lower Left 1st Premolar", quad: "LL" },
  22: { fdi: "33", name: "Lower Left Canine", quad: "LL" },
  23: { fdi: "32", name: "Lower Left Lateral Incisor", quad: "LL" },
  24: { fdi: "31", name: "Lower Left Central Incisor", quad: "LL" },

  // Lower Right (25-32)
  25: { fdi: "41", name: "Lower Right Central Incisor", quad: "LR" },
  26: { fdi: "42", name: "Lower Right Lateral Incisor", quad: "LR" },
  27: { fdi: "43", name: "Lower Right Canine", quad: "LR" },
  28: { fdi: "44", name: "Lower Right 1st Premolar", quad: "LR" },
  29: { fdi: "45", name: "Lower Right 2nd Premolar", quad: "LR" },
  30: { fdi: "46", name: "Lower Right 1st Molar", quad: "LR" },
  31: { fdi: "47", name: "Lower Right 2nd Molar", quad: "LR" },
  32: { fdi: "48", name: "Lower Right 3rd Molar", quad: "LR" },
};

const PRESET_CONDITIONS: Record<string, { bg: string; text: string; label: string }> = {
  sound: { bg: "var(--surface-soft)", text: "var(--body-strong)", label: "Sound" },
  caries: { bg: "var(--error-wash)", text: "var(--error)", label: "Caries / Decay" },
  restored: { bg: "var(--info-wash)", text: "var(--accent-teal)", label: "Restored" },
  crown: { bg: "var(--surface-cream-strong)", text: "var(--primary-text)", label: "Crown Fit" },
  implant: { bg: "var(--success-wash)", text: "var(--success)", label: "Implant" },
};

function getConditionStyle(condKey: string): { bg: string; text: string; label: string } {
  if (PRESET_CONDITIONS[condKey]) {
    return PRESET_CONDITIONS[condKey];
  }
  const presetEntry = Object.values(PRESET_CONDITIONS).find(
    (c) => c.label.toLowerCase() === condKey.toLowerCase(),
  );
  if (presetEntry) return presetEntry;

  return {
    bg: "var(--info-wash)",
    text: "var(--primary-text)",
    label: condKey,
  };
}

function getLocalChartStorage(pId: string): Record<number, { condition: string; notes: string }> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(`dental_chart_v2_${pId}`);
    if (raw) return JSON.parse(raw);
  } catch (err) {}
  return {};
}

function saveLocalChartStorage(pId: string, teethData: Record<number, ToothInfo>) {
  if (typeof window === "undefined") return;
  try {
    const payload: Record<number, { condition: string; notes: string }> = {};
    for (let i = 1; i <= 32; i++) {
      const tooth = teethData[i];
      if (tooth) {
        payload[i] = {
          condition: tooth.condition,
          notes: tooth.notes || "",
        };
      }
    }
    localStorage.setItem(`dental_chart_v2_${pId}`, JSON.stringify(payload));
  } catch (err) {}
}

function getLocalCustomConditions(pId: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(`dental_custom_conds_v2_${pId}`);
    if (raw) return JSON.parse(raw);
  } catch (err) {}
  return [];
}

function saveLocalCustomConditions(pId: string, conds: string[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`dental_custom_conds_v2_${pId}`, JSON.stringify(conds));
  } catch (err) {}
}

interface DentalChartProps {
  patientId: string;
  initialChart?: Array<{ tooth_num: number; condition: string; notes: string | null }>;
}

export function DentalChart({ patientId, initialChart }: DentalChartProps) {
  const [customConditions, setCustomConditions] = useState<string[]>(() => {
    const custom: string[] = [];
    if (initialChart && initialChart.length > 0) {
      for (const row of initialChart) {
        if (
          row.condition &&
          !PRESET_CONDITIONS[row.condition] &&
          !Object.values(PRESET_CONDITIONS).some(
            (c) => c.label.toLowerCase() === row.condition.toLowerCase(),
          )
        ) {
          if (!custom.includes(row.condition)) {
            custom.push(row.condition);
          }
        }
      }
    }
    return custom;
  });

  const [newConditionInput, setNewConditionInput] = useState("");

  // Initialize 32 teeth deterministically for SSR/hydration safety
  const [teeth, setTeeth] = useState<Record<number, ToothInfo>>(() => {
    const initial: Record<number, ToothInfo> = {};
    const dbSavedMap = new Map<number, { condition: string; notes: string | null }>();
    if (initialChart && initialChart.length > 0) {
      for (const row of initialChart) {
        dbSavedMap.set(row.tooth_num, { condition: row.condition, notes: row.notes });
      }
    }

    for (let i = 1; i <= 32; i++) {
      const meta = TOOTH_NAMES[i]!;
      const dbSaved = dbSavedMap.get(i);

      let condition: ToothCondition = dbSaved ? dbSaved.condition : "sound";
      let notes = dbSaved ? (dbSaved.notes || "") : "";

      if (!dbSaved) {
        if (patientId === "p1") {
          if (i === 19) { condition = "caries"; notes = "Deep distal caries (tooth 36)"; }
          if (i === 30) { condition = "restored"; notes = "Composite restoration"; }
        } else if (patientId === "p2") {
          if (i === 14) { condition = "crown"; notes = "Porcelain fused to metal crown"; }
        }
      }

      initial[i] = {
        num: i,
        fdi: meta.fdi,
        name: meta.name,
        quadrant: meta.quad,
        condition,
        notes,
      };
    }
    return initial;
  });

  // Client-side hydration of localStorage cache & fresh database sync
  useEffect(() => {
    let active = true;
    const localSavedMap = getLocalChartStorage(patientId);
    const localCustoms = getLocalCustomConditions(patientId);

    if (localCustoms.length > 0) {
      setCustomConditions((prev) => {
        const merged = [...prev];
        for (const lc of localCustoms) {
          if (!merged.some((c) => c.toLowerCase() === lc.toLowerCase())) {
            merged.push(lc);
          }
        }
        return merged;
      });
    }

    const processChartRows = (chartRows?: Array<{ tooth_num: number; condition: string; notes: string | null }>) => {
      const savedMap = new Map<number, { condition: string; notes: string | null }>();
      const savedCustoms: string[] = [];

      if (chartRows && chartRows.length > 0) {
        for (const row of chartRows) {
          savedMap.set(row.tooth_num, { condition: row.condition, notes: row.notes });
          if (
            row.condition &&
            !PRESET_CONDITIONS[row.condition] &&
            !Object.values(PRESET_CONDITIONS).some(
              (c) => c.label.toLowerCase() === row.condition.toLowerCase(),
            )
          ) {
            if (!savedCustoms.includes(row.condition)) {
              savedCustoms.push(row.condition);
            }
          }
        }
      }

      if (savedCustoms.length > 0) {
        setCustomConditions((prev) => {
          const merged = [...prev];
          for (const sc of savedCustoms) {
            if (!merged.some((c) => c.toLowerCase() === sc.toLowerCase())) {
              merged.push(sc);
            }
          }
          saveLocalCustomConditions(patientId, merged);
          return merged;
        });
      }

      setTeeth((prevTeeth) => {
        const updated = { ...prevTeeth };
        let changed = false;
        for (let i = 1; i <= 32; i++) {
          const dbSaved = savedMap.get(i);
          const localSaved = localSavedMap[i];

          const targetCondition = localSaved?.condition || dbSaved?.condition;
          const targetNotes = localSaved?.notes !== undefined ? localSaved.notes : (dbSaved?.notes || undefined);

          if (targetCondition !== undefined || targetNotes !== undefined) {
            const current = updated[i];
            const nextCond = targetCondition || current?.condition || "sound";
            const nextNotes = targetNotes !== undefined ? targetNotes : (current?.notes || "");

            if (!current || current.condition !== nextCond || current.notes !== nextNotes) {
              const meta = TOOTH_NAMES[i]!;
              updated[i] = {
                num: i,
                fdi: meta.fdi,
                name: meta.name,
                quadrant: meta.quad,
                condition: nextCond,
                notes: nextNotes,
              };
              changed = true;
            }
          }
        }
        if (changed) {
          saveLocalChartStorage(patientId, updated);
        }
        return changed ? updated : prevTeeth;
      });
    };

    // Hydrate local storage and initialChart on client mount
    processChartRows(initialChart);

    // Fetch fresh database records
    getToothChartAction(patientId)
      .then((rows) => {
        if (active && rows && rows.length > 0) {
          processChartRows(rows);
        }
      })
      .catch((err) => console.error("Error fetching tooth chart:", err));

    return () => {
      active = false;
    };
  }, [patientId, initialChart]);

  const [selectedNum, setSelectedNum] = useState<number | null>(19);
  const selectedTooth = selectedNum ? teeth[selectedNum] : null;

  // Instant update + Auto-save to DB on condition button click
  const updateCondition = (cond: string, newNotes?: string) => {
    if (!selectedNum) return;
    const currentTooth = teeth[selectedNum];
    if (!currentTooth) return;

    const finalNotes = newNotes !== undefined ? newNotes : (currentTooth.notes || "");

    const newTeeth = {
      ...teeth,
      [selectedNum]: { ...currentTooth, condition: cond, notes: finalNotes },
    };

    setTeeth(newTeeth);
    saveLocalChartStorage(patientId, newTeeth);

    // Auto save instantly to database
    saveToothChartAction({
      patientId,
      toothNum: selectedNum,
      condition: cond,
      notes: finalNotes,
    }).catch((err) => console.error("Auto save tooth chart failed:", err));
  };

  // Instant update + Auto-save on custom note change
  const handleNotesChange = (val: string) => {
    if (!selectedNum || !teeth[selectedNum]) return;
    const currentTooth = teeth[selectedNum];

    const newTeeth = {
      ...teeth,
      [selectedNum]: { ...currentTooth, notes: val },
    };

    setTeeth(newTeeth);
    saveLocalChartStorage(patientId, newTeeth);

    // Auto save instantly to database
    saveToothChartAction({
      patientId,
      toothNum: selectedNum,
      condition: currentTooth.condition,
      notes: val,
    }).catch((err) => console.error("Auto save tooth notes failed:", err));
  };

  const handleAddCustomCondition = () => {
    const trimmed = newConditionInput.trim();
    if (!trimmed) return;

    const existsInPresets = Object.values(PRESET_CONDITIONS).some(
      (c) => c.label.toLowerCase() === trimmed.toLowerCase(),
    );

    if (!existsInPresets && !customConditions.some((c) => c.toLowerCase() === trimmed.toLowerCase())) {
      const nextCustoms = [...customConditions, trimmed];
      setCustomConditions(nextCustoms);
      saveLocalCustomConditions(patientId, nextCustoms);
    }

    if (selectedNum) {
      updateCondition(trimmed);
    }

    setNewConditionInput("");
  };

  // 4 Quadrants
  const q1MaxillaryRight = [1, 2, 3, 4, 5, 6, 7, 8];
  const q2MaxillaryLeft = [9, 10, 11, 12, 13, 14, 15, 16];
  const q4MandibularRight = [32, 31, 30, 29, 28, 27, 26, 25];
  const q3MandibularLeft = [24, 23, 22, 21, 20, 19, 18, 17];

  const renderToothButton = (num: number) => {
    const t = teeth[num]!;
    const condStyle = getConditionStyle(t.condition);
    const isSelected = selectedNum === num;
    const hasNotes = Boolean(t.notes && t.notes.trim().length > 0);

    return (
      <button
        key={num}
        type="button"
        className={`tooth-btn ${isSelected ? "is-active" : ""}`}
        style={{
          backgroundColor: condStyle.bg,
          color: condStyle.text,
          borderColor: isSelected ? "var(--primary)" : "var(--hairline)",
        }}
        onClick={() => setSelectedNum(selectedNum === num ? null : num)}
        title={`#${t.num} (FDI ${t.fdi}) - ${t.name}\nSaved Condition: ${condStyle.label}${hasNotes ? `\nSaved Notes: ${t.notes}` : ""}`}
      >
        <div style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center" }}>
          <span className="tooth-fdi">{t.fdi}</span>
          <span className="tooth-num">#{t.num}</span>
        </div>

        <i className="ph-fill ph-tooth tooth-icon" />

        <span
          className="tooth-cond-tag"
          style={{
            color: condStyle.text,
          }}
        >
          {condStyle.label}
        </span>

        {hasNotes && (
          <span className="tooth-notes-tag" title={t.notes}>
            <i className="ph ph-note-pencil" style={{ flexShrink: 0 }} />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.notes}</span>
          </span>
        )}
      </button>
    );
  };

  const renderInspectorCardForQuadrant = (quadKey: "UR" | "UL" | "LL" | "LR") => {
    if (!selectedTooth || selectedTooth.quadrant !== quadKey) return null;

    return (
      <div className="tooth-inspector-card" style={{ marginTop: 12 }}>
        <div className="inspector-head">
          <div>
            <strong>Tooth #{selectedTooth.num} (FDI {selectedTooth.fdi})</strong>
            <span className="meta">{selectedTooth.name}</span>
          </div>
          <span
            className="badge"
            style={{
              backgroundColor: getConditionStyle(selectedTooth.condition).bg,
              color: getConditionStyle(selectedTooth.condition).text,
            }}
          >
            {getConditionStyle(selectedTooth.condition).label}
          </span>
        </div>

        <div className="inspector-body" style={{ display: "grid", gap: 14 }}>
          <div>
            <span className="caption" style={{ color: "var(--muted)", display: "block", marginBottom: 6 }}>
              Select Condition Button (Auto-Saves on Click):
            </span>

            <div className="chip-row" style={{ flexWrap: "wrap", gap: 6 }}>
              {Object.keys(PRESET_CONDITIONS).map((condKey) => {
                const style = PRESET_CONDITIONS[condKey]!;
                const isSelected = selectedTooth.condition === condKey;
                return (
                  <button
                    key={condKey}
                    type="button"
                    className={`apt-preset-chip ${isSelected ? "is-active" : ""}`}
                    onClick={() => updateCondition(condKey)}
                  >
                    {style.label}
                  </button>
                );
              })}

              {customConditions.map((customLabel) => {
                const isSelected = selectedTooth.condition === customLabel;
                return (
                  <button
                    key={customLabel}
                    type="button"
                    className={`apt-preset-chip ${isSelected ? "is-active" : ""}`}
                    style={{
                      borderColor: isSelected ? "var(--primary)" : "var(--accent-teal)",
                      color: isSelected ? "var(--primary-text)" : "var(--ink)",
                    }}
                    onClick={() => updateCondition(customLabel)}
                  >
                    <i className="ph ph-tag-simple" aria-hidden="true" style={{ marginRight: 4 }} />
                    {customLabel}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <section className="panel odontogram-panel">
      <div className="panel-head">
        <h2>
          <i className="ph ph-tooth" aria-hidden="true" style={{ color: "var(--primary)" }} />
          32-Tooth 4-Quadrant Dental Odontogram
        </h2>
        <div className="spacer" />
        <span className="badge badge-info">FDI 4-Quadrant View</span>
      </div>

      <div className="panel-body">
        {/* Odontogram Top Toolbar: Visual Condition Key & Add Custom Condition Button */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
            padding: "12px 16px",
            background: "var(--surface-soft)",
            borderRadius: "var(--r-card)",
            marginBottom: 20,
            border: "1px solid var(--hairline)",
          }}
        >
          {/* Saved Condition Key */}
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", fontSize: "0.8125rem" }}>
            <strong style={{ color: "var(--ink)", display: "flex", alignItems: "center", gap: 6 }}>
              <i className="ph ph-info" style={{ color: "var(--primary)" }} />
              Saved Condition Key:
            </strong>
            {Object.entries(PRESET_CONDITIONS).map(([key, style]) => (
              <div key={key} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    backgroundColor: style.bg,
                    border: `1.5px solid ${style.text}`,
                    display: "inline-block",
                  }}
                />
                <span style={{ color: "var(--ink)", fontWeight: 500 }}>{style.label}</span>
              </div>
            ))}
            {customConditions.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    backgroundColor: "var(--info-wash)",
                    border: "1.5px solid var(--primary-text)",
                    display: "inline-block",
                  }}
                />
                <span style={{ color: "var(--ink)", fontWeight: 500 }}>
                  Custom: {customConditions.join(", ")}
                </span>
              </div>
            )}
          </div>

          {/* Whole Odontogram Add Custom Condition Input */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <label
              htmlFor="add-custom-cond-odontogram"
              style={{ font: "var(--caption)", color: "var(--muted)", fontWeight: 600, whiteSpace: "nowrap" }}
            >
              Add Custom Condition:
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                id="add-custom-cond-odontogram"
                className="input input-sm"
                style={{ minWidth: 200 }}
                value={newConditionInput}
                onChange={(e) => setNewConditionInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddCustomCondition();
                  }
                }}
                placeholder="e.g. Fissure Sealant, Sensitivity..."
              />
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleAddCustomCondition}
                disabled={!newConditionInput.trim()}
              >
                <i className="ph ph-plus" aria-hidden="true" /> Add Button
              </button>
            </div>
          </div>
        </div>

        <div className="odontogram-layout">
          {/* Main 4-Quadrant Arch Container */}
          <div style={{ display: "grid", gap: 20 }}>
            {/* Maxillary Arch (Upper Arch - 2 Quadrants) */}
            <div className="card card-soft" style={{ padding: 16, display: "grid", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, font: "var(--title-sm)", color: "var(--primary)" }}>
                <i className="ph ph-squares-four" aria-hidden="true" />
                <strong>Maxillary Arch (Upper Teeth)</strong>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
                {/* Maxillary Right Quadrant (Q1) */}
                <div style={{ background: "var(--canvas)", padding: 12, borderRadius: "var(--r-card)", border: "1px solid var(--border)" }}>
                  <div style={{ font: "var(--caption)", color: "var(--muted)", marginBottom: 8, fontWeight: 600 }}>
                    Maxillary Right (Q1)
                  </div>
                  <div className="arch-teeth-row" style={{ justifyContent: "flex-start", flexWrap: "wrap", gap: 6 }}>
                    {q1MaxillaryRight.map(renderToothButton)}
                  </div>
                  {renderInspectorCardForQuadrant("UR")}
                </div>

                {/* Maxillary Left Quadrant (Q2) */}
                <div style={{ background: "var(--canvas)", padding: 12, borderRadius: "var(--r-card)", border: "1px solid var(--border)" }}>
                  <div style={{ font: "var(--caption)", color: "var(--muted)", marginBottom: 8, fontWeight: 600 }}>
                    Maxillary Left (Q2)
                  </div>
                  <div className="arch-teeth-row" style={{ justifyContent: "flex-start", flexWrap: "wrap", gap: 6 }}>
                    {q2MaxillaryLeft.map(renderToothButton)}
                  </div>
                  {renderInspectorCardForQuadrant("UL")}
                </div>
              </div>
            </div>

            {/* Mandibular Arch (Lower Arch - 2 Quadrants) */}
            <div className="card card-soft" style={{ padding: 16, display: "grid", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, font: "var(--title-sm)", color: "var(--primary)" }}>
                <i className="ph ph-squares-four" aria-hidden="true" />
                <strong>Mandibular Arch (Lower Teeth)</strong>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
                {/* Mandibular Right Quadrant (Q4) */}
                <div style={{ background: "var(--canvas)", padding: 12, borderRadius: "var(--r-card)", border: "1px solid var(--border)" }}>
                  <div style={{ font: "var(--caption)", color: "var(--muted)", marginBottom: 8, fontWeight: 600 }}>
                    Mandibular Right (Q4)
                  </div>
                  <div className="arch-teeth-row" style={{ justifyContent: "flex-start", flexWrap: "wrap", gap: 6 }}>
                    {q4MandibularRight.map(renderToothButton)}
                  </div>
                  {renderInspectorCardForQuadrant("LR")}
                </div>

                {/* Mandibular Left Quadrant (Q3) */}
                <div style={{ background: "var(--canvas)", padding: 12, borderRadius: "var(--r-card)", border: "1px solid var(--border)" }}>
                  <div style={{ font: "var(--caption)", color: "var(--muted)", marginBottom: 8, fontWeight: 600 }}>
                    Mandibular Left (Q3)
                  </div>
                  <div className="arch-teeth-row" style={{ justifyContent: "flex-start", flexWrap: "wrap", gap: 6 }}>
                    {q3MandibularLeft.map(renderToothButton)}
                  </div>
                  {renderInspectorCardForQuadrant("LL")}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
