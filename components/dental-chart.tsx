"use client";

import { useState } from "react";

export type ToothCondition =
  | "sound"
  | "caries"
  | "restored"
  | "root-canal"
  | "crown"
  | "extracted"
  | "implant";

export type ToothInfo = {
  num: number;
  fdi: string;
  name: string;
  quadrant: "UR" | "UL" | "LL" | "LR";
  condition: ToothCondition;
  notes?: string;
  surfaces?: {
    occlusal?: boolean;
    mesial?: boolean;
    distal?: boolean;
    buccal?: boolean;
    lingual?: boolean;
  };
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

const CONDITION_COLORS: Record<ToothCondition, { bg: string; text: string; label: string }> = {
  sound: { bg: "var(--surface-soft)", text: "var(--body-strong)", label: "Sound" },
  caries: { bg: "var(--error-wash)", text: "var(--error)", label: "Caries / Decay" },
  restored: { bg: "var(--info-wash)", text: "var(--accent-teal)", label: "Restored" },
  "root-canal": { bg: "var(--warning-wash)", text: "var(--warning)", label: "Root Canal" },
  crown: { bg: "var(--surface-cream-strong)", text: "var(--primary-text)", label: "Crown Fit" },
  extracted: { bg: "var(--hairline)", text: "var(--muted)", label: "Extracted" },
  implant: { bg: "var(--success-wash)", text: "var(--success)", label: "Implant" },
};

export function DentalChart({ patientId }: { patientId: string }) {
  // Initialize 32 teeth with default conditions
  const [teeth, setTeeth] = useState<Record<number, ToothInfo>>(() => {
    const initial: Record<number, ToothInfo> = {};
    for (let i = 1; i <= 32; i++) {
      const meta = TOOTH_NAMES[i]!;
      let condition: ToothCondition = "sound";
      let notes = "";

      // Add demo conditions based on patient chart data
      if (patientId === "p1") {
        if (i === 19) { condition = "root-canal"; notes = "Root canal treatment in progress (tooth 36)"; }
        if (i === 30) { condition = "restored"; notes = "Composite restoration"; }
      } else if (patientId === "p2") {
        if (i === 32) { condition = "extracted"; notes = "Surgical extraction (tooth 48)"; }
        if (i === 14) { condition = "crown"; notes = "Porcelain fused to metal crown"; }
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

  const [selectedNum, setSelectedNum] = useState<number | null>(19);
  const selectedTooth = selectedNum ? teeth[selectedNum] : null;

  const updateCondition = (cond: ToothCondition) => {
    if (!selectedNum) return;
    setTeeth((prev) => ({
      ...prev,
      [selectedNum]: { ...prev[selectedNum]!, condition: cond },
    }));
  };

  const upperArch = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
  const lowerArch = [32, 31, 30, 29, 28, 27, 26, 25, 24, 23, 22, 21, 20, 19, 18, 17];

  return (
    <section className="panel odontogram-panel">
      <div className="panel-head">
        <h2>
          <i className="ph ph-tooth" aria-hidden="true" style={{ color: "var(--primary)" }} /> 
          32-Tooth Interactive Odontogram
        </h2>
        <div className="spacer" />
        <span className="badge badge-info">FDI & Universal System</span>
      </div>

      <div className="panel-body">
        <div className="odontogram-layout">
          {/* Main Arch Visualizer */}
          <div className="odontogram-arch-container">
            {/* Upper Arch */}
            <div className="arch-section">
              <div className="arch-label">
                <span>Maxillary (Upper Arch)</span>
              </div>
              <div className="arch-teeth-row">
                {upperArch.map((num) => {
                  const t = teeth[num]!;
                  const condStyle = CONDITION_COLORS[t.condition];
                  const isSelected = selectedNum === num;

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
                      onClick={() => setSelectedNum(num)}
                      title={`#${t.num} (${t.fdi}) - ${t.name}: ${condStyle.label}`}
                    >
                      <span className="tooth-fdi">{t.fdi}</span>
                      <i className="ph-fill ph-tooth tooth-icon" />
                      <span className="tooth-num">#{t.num}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="arch-divider" />

            {/* Lower Arch */}
            <div className="arch-section">
              <div className="arch-teeth-row">
                {lowerArch.map((num) => {
                  const t = teeth[num]!;
                  const condStyle = CONDITION_COLORS[t.condition];
                  const isSelected = selectedNum === num;

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
                      onClick={() => setSelectedNum(num)}
                      title={`#${t.num} (${t.fdi}) - ${t.name}: ${condStyle.label}`}
                    >
                      <span className="tooth-num">#{t.num}</span>
                      <i className="ph-fill ph-tooth tooth-icon" />
                      <span className="tooth-fdi">{t.fdi}</span>
                    </button>
                  );
                })}
              </div>
              <div className="arch-label" style={{ marginTop: 8 }}>
                <span>Mandibular (Lower Arch)</span>
              </div>
            </div>
          </div>

          {/* Tooth Details & Inspector Panel */}
          {selectedTooth && (
            <div className="tooth-inspector-card">
              <div className="inspector-head">
                <div>
                  <strong>Tooth #{selectedTooth.num} (FDI {selectedTooth.fdi})</strong>
                  <span className="meta">{selectedTooth.name}</span>
                </div>
                <span
                  className="badge"
                  style={{
                    backgroundColor: CONDITION_COLORS[selectedTooth.condition].bg,
                    color: CONDITION_COLORS[selectedTooth.condition].text,
                  }}
                >
                  {CONDITION_COLORS[selectedTooth.condition].label}
                </span>
              </div>

              <div className="inspector-body">
                <span className="caption" style={{ color: "var(--muted)" }}>
                  Update Tooth Condition:
                </span>
                <div className="chip-row" style={{ marginTop: 6 }}>
                  {(Object.keys(CONDITION_COLORS) as ToothCondition[]).map((condKey) => (
                    <button
                      key={condKey}
                      type="button"
                      className={`apt-preset-chip ${selectedTooth.condition === condKey ? "is-active" : ""}`}
                      onClick={() => updateCondition(condKey)}
                    >
                      {CONDITION_COLORS[condKey].label}
                    </button>
                  ))}
                </div>

                {selectedTooth.notes && (
                  <div className="alert alert-warning" style={{ marginTop: 12 }}>
                    <i className="ph ph-notebook" aria-hidden="true" />
                    <span>{selectedTooth.notes}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
