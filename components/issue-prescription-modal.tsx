"use client";

import { useState, useActionState, useEffect } from "react";
import { issueMultiplePrescriptionsAction, type ClinicalFormState } from "@/actions/clinical";

export type RxDraftRow = {
  id: string;
  drug: string;
  form: string;
  dose: string;
  route: string;
  frequency: string;
  durationDays: string;
  refills: string;
  indication: string;
  overrideReason: string;
};

export type RxPresetItem = {
  drug: string;
  form: string;
  dose: string;
  route: string;
  frequency: string;
  durationDays: number;
  refills: number;
  indication: string;
};

export type RxCombinationPack = {
  name: string;
  description: string;
  badge: string;
  items: RxPresetItem[];
};

const AMOXICILLIN_PRESET: RxPresetItem = {
  drug: "Amoxicillin",
  form: "Capsule",
  dose: "500 mg",
  route: "Oral",
  frequency: "Three times daily (q8h)",
  durationDays: 5,
  refills: 0,
  indication: "Acute odontogenic infection prophylaxis",
};

const METRONIDAZOLE_PRESET: RxPresetItem = {
  drug: "Metronidazole",
  form: "Tablet",
  dose: "400 mg",
  route: "Oral",
  frequency: "Three times daily with food (q8h)",
  durationDays: 5,
  refills: 0,
  indication: "ANUG / Pericoronitis / Anaerobic infection",
};

const IBUPROFEN_PRESET: RxPresetItem = {
  drug: "Ibuprofen",
  form: "Tablet",
  dose: "400 mg",
  route: "Oral",
  frequency: "Three times daily after food",
  durationDays: 5,
  refills: 0,
  indication: "Post-operative dental pain & inflammation",
};

const PARACETAMOL_PRESET: RxPresetItem = {
  drug: "Paracetamol",
  form: "Tablet",
  dose: "1000 mg",
  route: "Oral",
  frequency: "Four times daily (q6h, max 4g/day)",
  durationDays: 5,
  refills: 0,
  indication: "Mild to moderate dental pain management",
};

const CHLORHEXIDINE_PRESET: RxPresetItem = {
  drug: "Chlorhexidine Gluconate",
  form: "Mouthwash",
  dose: "0.2% (10ml)",
  route: "Topical / Rinse",
  frequency: "Twice daily rinse for 1 minute",
  durationDays: 7,
  refills: 1,
  indication: "Post-surgical plaque control / Periodontal care",
};

const CLINDAMYCIN_PRESET: RxPresetItem = {
  drug: "Clindamycin",
  form: "Capsule",
  dose: "300 mg",
  route: "Oral",
  frequency: "Four times daily (q6h)",
  durationDays: 5,
  refills: 0,
  indication: "Dental infection (Penicillin-allergic patient)",
};

const SINGLE_PRESETS: Array<{ label: string; item: RxPresetItem }> = [
  { label: "Amoxicillin 500mg", item: AMOXICILLIN_PRESET },
  { label: "Metronidazole 400mg", item: METRONIDAZOLE_PRESET },
  { label: "Ibuprofen 400mg", item: IBUPROFEN_PRESET },
  { label: "Paracetamol 1000mg", item: PARACETAMOL_PRESET },
  { label: "Chlorhexidine 0.2%", item: CHLORHEXIDINE_PRESET },
  { label: "Clindamycin 300mg", item: CLINDAMYCIN_PRESET },
];

const COMBINATION_PACKS: RxCombinationPack[] = [
  {
    name: "Endodontic / Severe Infection Pack",
    description: "Triple Therapy: Amoxicillin 500mg + Metronidazole 400mg + Ibuprofen 400mg",
    badge: "3 Meds",
    items: [AMOXICILLIN_PRESET, METRONIDAZOLE_PRESET, IBUPROFEN_PRESET],
  },
  {
    name: "Periodontal & Surgical Pack",
    description: "Post-op Care: Chlorhexidine Rinse + Metronidazole 400mg + Ibuprofen 400mg",
    badge: "3 Meds",
    items: [CHLORHEXIDINE_PRESET, METRONIDAZOLE_PRESET, IBUPROFEN_PRESET],
  },
  {
    name: "Dual Analgesic Pain Pack",
    description: "Synergistic Pain Relief: Paracetamol 1000mg + Ibuprofen 400mg",
    badge: "2 Meds",
    items: [PARACETAMOL_PRESET, IBUPROFEN_PRESET],
  },
  {
    name: "Penicillin-Allergic Infection Pack",
    description: "Safe Alternative: Clindamycin 300mg + Ibuprofen 400mg",
    badge: "2 Meds",
    items: [CLINDAMYCIN_PRESET, IBUPROFEN_PRESET],
  },
];

const createEmptyRow = (id?: string): RxDraftRow => ({
  id: id || `rx-row-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
  drug: "",
  form: "Tablet",
  dose: "",
  route: "Oral",
  frequency: "",
  durationDays: "5",
  refills: "0",
  indication: "Clinical indication recorded",
  overrideReason: "",
});

const presetToRow = (p: RxPresetItem): RxDraftRow => ({
  id: `rx-row-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
  drug: p.drug,
  form: p.form,
  dose: p.dose,
  route: p.route,
  frequency: p.frequency,
  durationDays: String(p.durationDays),
  refills: String(p.refills),
  indication: p.indication,
  overrideReason: "",
});

interface IssuePrescriptionModalProps {
  patientId: string;
  patientName: string;
  allergies: Array<{ substance: string; reaction: string; severity: string }>;
  isOpen: boolean;
  onClose: () => void;
}

export function IssuePrescriptionModal({
  patientId,
  patientName,
  allergies,
  isOpen,
  onClose,
}: IssuePrescriptionModalProps) {
  const [state, action, pending] = useActionState<ClinicalFormState, FormData>(
    issueMultiplePrescriptionsAction,
    { success: false }
  );

  const [rows, setRows] = useState<RxDraftRow[]>([createEmptyRow()]);

  // Close modal ONLY when submission was successful
  useEffect(() => {
    if (state?.success && !pending) {
      onClose();
    }
  }, [state?.success, pending, onClose]);

  if (!isOpen) return null;

  const addRow = () => {
    setRows((prev) => [...prev, createEmptyRow()]);
  };

  const removeRow = (index: number) => {
    if (rows.length <= 1) return;
    setRows((prev) => prev.filter((_, i) => i !== index));
  };

  const updateRow = (index: number, field: keyof RxDraftRow, value: string) => {
    setRows((prev) => {
      const next = [...prev];
      if (next[index]) {
        next[index] = { ...next[index], [field]: value };
      }
      return next;
    });
  };

  const applySinglePreset = (item: RxPresetItem) => {
    setRows((prev) => {
      if (prev.length === 1 && prev[0] && !prev[0].drug.trim()) {
        return [presetToRow(item)];
      }
      return [...prev, presetToRow(item)];
    });
  };

  const applyCombinationPack = (pack: RxCombinationPack) => {
    const newRows = pack.items.map((item) => presetToRow(item));
    setRows(newRows);
  };

  // Helper to check allergy conflicts for a medication
  const getMatchedAllergy = (drugName: string) => {
    const drugLower = drugName.toLowerCase().trim();
    if (!drugLower) return null;
    return allergies.find((a) => {
      const sub = a.substance.toLowerCase();
      if (drugLower.includes(sub) || sub.includes(drugLower)) return true;
      if (
        sub.includes("penicillin") &&
        (drugLower.includes("amoxicillin") ||
          drugLower.includes("ampicillin") ||
          drugLower.includes("co-amoxiclav"))
      )
        return true;
      if (
        sub.includes("nsaid") &&
        (drugLower.includes("ibuprofen") ||
          drugLower.includes("naproxen") ||
          drugLower.includes("aspirin") ||
          drugLower.includes("diclofenac"))
      )
        return true;
      if (
        sub.includes("codeine") &&
        (drugLower.includes("co-codamol") || drugLower.includes("dihydrocodeine"))
      )
        return true;
      if (
        sub.includes("sulfa") &&
        (drugLower.includes("sulfamethoxazole") || drugLower.includes("trimethoprim"))
      )
        return true;
      return false;
    });
  };

  const isAllergyAlert = state.error?.startsWith("ALLERGY_ALERT:");
  const errorMessage = isAllergyAlert ? state.error?.replace("ALLERGY_ALERT: ", "") : state.error;

  return (
    <div className="modal-scrim" role="dialog" aria-modal="true">
      <div
        className="modal"
        style={{
          maxWidth: 780,
          width: "95vw",
          maxHeight: "90dvh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          background: "var(--canvas)",
          borderColor: "var(--hairline)",
          borderRadius: "var(--r-surface)",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        {/* Sticky Theme Header */}
        <div
          className="modal-head"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "var(--s-md) var(--s-lg)",
            borderBottom: "1px solid var(--hairline)",
            background: "var(--surface-soft)",
          }}
        >
          <div>
            <h2 style={{ margin: 0, font: "var(--title-md)", color: "var(--ink)" }}>
              Issue Prescriptions ({rows.length} {rows.length === 1 ? "Item" : "Items"})
            </h2>
            <p className="meta" style={{ margin: "2px 0 0" }}>
              Patient: <strong>{patientName}</strong>
            </p>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={onClose}
            aria-label="Close modal"
          >
            <i className="ph ph-x" aria-hidden="true" style={{ fontSize: 20 }} />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form
          action={action}
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            overflowY: "auto",
            padding: "var(--s-lg)",
            gap: "var(--s-lg)",
          }}
        >
          <input type="hidden" name="patientId" value={patientId} />
          <input type="hidden" name="rxCount" value={rows.length} />

          {/* Top Error / Warning Banner */}
          {errorMessage && (
            <div className={`alert ${isAllergyAlert ? "alert-warning" : "alert-critical"}`}>
              <i className={`ph ${isAllergyAlert ? "ph-warning" : "ph-warning-octagon"}`} aria-hidden="true" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Recorded Patient Allergies Summary */}
          {allergies.length > 0 && (
            <div className="alert alert-warning">
              <i className="ph ph-warning" aria-hidden="true" />
              <span>
                <strong>Patient Recorded Allergies:</strong>{" "}
                {allergies.map((a) => `${a.substance} (${a.reaction})`).join(", ")}
              </span>
            </div>
          )}

          {/* Combination Prescription Packs */}
          <div>
            <span className="eyebrow" style={{ display: "block", marginBottom: "var(--s-xs)" }}>
              Preset Combination Packs (Multi-Rx Batch)
            </span>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(310px, 1fr))", gap: "var(--s-xs)" }}>
              {COMBINATION_PACKS.map((pack) => (
                <button
                  key={pack.name}
                  type="button"
                  onClick={() => applyCombinationPack(pack)}
                  className="card card-soft"
                  style={{
                    padding: "var(--s-sm) var(--s-md)",
                    textAlign: "left",
                    cursor: "pointer",
                    border: "1px solid var(--hairline)",
                    borderRadius: "var(--r-card)",
                    background: "var(--surface-soft)",
                    transition: "all 0.15s var(--ease)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "var(--primary)";
                    e.currentTarget.style.background = "var(--surface-card)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "var(--hairline)";
                    e.currentTarget.style.background = "var(--surface-soft)";
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <strong style={{ font: "var(--title-sm)", color: "var(--ink)" }}>
                      <i className="ph ph-squares-four" aria-hidden="true" style={{ marginRight: 6, color: "var(--primary)" }} />
                      {pack.name}
                    </strong>
                    <span className="badge" style={{ background: "var(--surface-cream-strong)", color: "var(--primary-text)" }}>
                      {pack.badge}
                    </span>
                  </div>
                  <span className="meta" style={{ fontSize: "0.8125rem" }}>
                    {pack.description}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Single Drug Presets */}
          <div>
            <span className="eyebrow" style={{ display: "block", marginBottom: "var(--s-xs)" }}>
              Add Single Drug Preset
            </span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {SINGLE_PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => applySinglePreset(p.item)}
                >
                  <i className="ph ph-plus" aria-hidden="true" /> {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="divider" />

          {/* Dynamic Prescription Rows */}
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-md)" }}>
            {rows.map((row, index) => {
              const matchedAllergy = getMatchedAllergy(row.drug);

              return (
                <div
                  key={row.id}
                  className="card"
                  style={{
                    padding: "var(--s-md) var(--s-lg)",
                    border: matchedAllergy ? "1.5px solid var(--warning)" : "1px solid var(--hairline)",
                    borderRadius: "var(--r-card)",
                    background: matchedAllergy ? "var(--warning-wash)" : "var(--canvas)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "var(--s-md)",
                  }}
                >
                  {/* Row Header */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span className="badge" style={{ background: "var(--surface-cream-strong)", color: "var(--ink)", fontWeight: 700 }}>
                        #{index + 1}
                      </span>
                      <strong style={{ font: "var(--title-sm)", color: "var(--ink)" }}>
                        {row.drug ? row.drug : `Medication ${index + 1}`}
                      </strong>
                    </div>

                    {rows.length > 1 && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        style={{ color: "var(--error)", padding: "4px 8px" }}
                        onClick={() => removeRow(index)}
                        title="Remove medication"
                      >
                        <i className="ph ph-trash" aria-hidden="true" /> Remove
                      </button>
                    )}
                  </div>

                  {/* Allergy Conflict Warning Banner for this row */}
                  {matchedAllergy && (
                    <div className="alert alert-warning">
                      <i className="ph ph-warning" aria-hidden="true" />
                      <span>
                        <strong>Allergy Alert:</strong> Patient is allergic to{" "}
                        <strong>{matchedAllergy.substance}</strong> ({matchedAllergy.reaction}). Clinical override reason is required below.
                      </span>
                    </div>
                  )}

                  {/* Fields Grid */}
                  <div className="cols-2" style={{ gap: "var(--s-md)" }}>
                    <div className="field">
                      <label htmlFor={`rx-drug-${index}`}>
                        Medication / Drug Name <span className="req">*</span>
                      </label>
                      <input
                        id={`rx-drug-${index}`}
                        name={`drug_${index}`}
                        className="input"
                        placeholder="e.g. Amoxicillin, Ibuprofen"
                        value={row.drug}
                        onChange={(e) => updateRow(index, "drug", e.target.value)}
                      />
                    </div>
                    <div className="field">
                      <label htmlFor={`rx-dose-${index}`}>
                        Dosage <span className="req">*</span>
                      </label>
                      <input
                        id={`rx-dose-${index}`}
                        name={`dose_${index}`}
                        className="input"
                        placeholder="e.g. 500 mg, 0.2%"
                        value={row.dose}
                        onChange={(e) => updateRow(index, "dose", e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="cols-2" style={{ gap: "var(--s-md)" }}>
                    <div className="field">
                      <label htmlFor={`rx-form-${index}`}>Form</label>
                      <select
                        id={`rx-form-${index}`}
                        name={`form_${index}`}
                        className="select"
                        value={row.form}
                        onChange={(e) => updateRow(index, "form", e.target.value)}
                      >
                        <option value="Tablet">Tablet</option>
                        <option value="Capsule">Capsule</option>
                        <option value="Mouthwash">Mouthwash</option>
                        <option value="Gel">Oral Gel</option>
                        <option value="Suspension">Suspension</option>
                        <option value="Solution">Solution</option>
                        <option value="Paste">Paste / Ointment</option>
                      </select>
                    </div>
                    <div className="field">
                      <label htmlFor={`rx-route-${index}`}>Route</label>
                      <input
                        id={`rx-route-${index}`}
                        name={`route_${index}`}
                        className="input"
                        placeholder="e.g. Oral, Topical"
                        value={row.route}
                        onChange={(e) => updateRow(index, "route", e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="field">
                    <label htmlFor={`rx-frequency-${index}`}>
                      Frequency & Directions <span className="req">*</span>
                    </label>
                    <input
                      id={`rx-frequency-${index}`}
                      name={`frequency_${index}`}
                      className="input"
                      placeholder="e.g. Three times daily after food (q8h)"
                      value={row.frequency}
                      onChange={(e) => updateRow(index, "frequency", e.target.value)}
                    />
                  </div>

                  <div className="cols-2" style={{ gap: "var(--s-md)" }}>
                    <div className="field">
                      <label htmlFor={`rx-duration-${index}`}>Duration (Days)</label>
                      <input
                        id={`rx-duration-${index}`}
                        name={`durationDays_${index}`}
                        type="number"
                        min="1"
                        max="365"
                        className="input"
                        value={row.durationDays}
                        onChange={(e) => updateRow(index, "durationDays", e.target.value)}
                      />
                    </div>
                    <div className="field">
                      <label htmlFor={`rx-refills-${index}`}>Refills Authorized</label>
                      <input
                        id={`rx-refills-${index}`}
                        name={`refills_${index}`}
                        type="number"
                        min="0"
                        max="12"
                        className="input"
                        value={row.refills}
                        onChange={(e) => updateRow(index, "refills", e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="field">
                    <label htmlFor={`rx-indication-${index}`}>Clinical Indication</label>
                    <input
                      id={`rx-indication-${index}`}
                      name={`indication_${index}`}
                      className="input"
                      placeholder="e.g. Post-extraction infection prophylaxis, Pain relief"
                      value={row.indication}
                      onChange={(e) => updateRow(index, "indication", e.target.value)}
                    />
                  </div>

                  {/* Clinical Override Reason field if allergy match is present */}
                  {matchedAllergy && (
                    <div className="field" style={{ background: "var(--canvas)", padding: 10, borderRadius: "var(--r-control)", border: "1px solid var(--warning)" }}>
                      <label htmlFor={`rx-override-${index}`} style={{ color: "var(--warning)", fontWeight: 600 }}>
                        <i className="ph ph-warning" aria-hidden="true" /> Clinical Override Reason <span className="req">*</span>
                      </label>
                      <input
                        id={`rx-override-${index}`}
                        name={`overrideReason_${index}`}
                        className="input"
                        placeholder="State clinical justification to override allergy warning..."
                        value={row.overrideReason}
                        onChange={(e) => updateRow(index, "overrideReason", e.target.value)}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Add Another Prescription Row Button */}
          <button
            type="button"
            className="btn btn-secondary btn-block"
            onClick={addRow}
            style={{ borderStyle: "dashed", background: "var(--surface-soft)" }}
          >
            <i className="ph ph-plus-circle" aria-hidden="true" style={{ fontSize: 18 }} />
            Add Another Medication to Prescription
          </button>

          {/* Sticky Modal Action Footer */}
          <div
            className="modal-foot"
            style={{
              display: "flex",
              justifyContent: "flex-end",
              alignItems: "center",
              gap: "var(--s-xs)",
              marginTop: "var(--s-xs)",
              paddingTop: "var(--s-md)",
              borderTop: "1px solid var(--hairline)",
              background: "var(--surface-soft)",
            }}
          >
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={pending}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={pending}>
              <i className="ph ph-paper-plane-tilt" aria-hidden="true" />
              {pending
                ? "Issuing..."
                : `Issue ${rows.length} ${rows.length === 1 ? "Prescription" : "Prescriptions"}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
