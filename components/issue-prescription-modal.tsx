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

const DEFAULT_PRESETS: Array<{ label: string; item: RxPresetItem }> = [
  { label: "Amoxicillin 500mg", item: AMOXICILLIN_PRESET },
  { label: "Metronidazole 400mg", item: METRONIDAZOLE_PRESET },
  { label: "Ibuprofen 400mg", item: IBUPROFEN_PRESET },
  { label: "Paracetamol 1000mg", item: PARACETAMOL_PRESET },
  { label: "Chlorhexidine 0.2%", item: CHLORHEXIDINE_PRESET },
  { label: "Clindamycin 300mg", item: CLINDAMYCIN_PRESET },
];

const CUSTOM_RX_PRESETS_STORAGE_KEY = "thornbury_custom_rx_presets_v1";

function getLocalCustomPresets(): Array<{ label: string; item: RxPresetItem }> {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CUSTOM_RX_PRESETS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.error("Failed to parse custom presets:", err);
  }
  return [];
}

function saveLocalCustomPresets(presets: Array<{ label: string; item: RxPresetItem }>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CUSTOM_RX_PRESETS_STORAGE_KEY, JSON.stringify(presets));
  } catch (err) {
    console.error("Failed to save custom presets:", err);
  }
}


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
  const [customPresets, setCustomPresets] = useState<Array<{ label: string; item: RxPresetItem }>>([]);
  const [showAddPresetForm, setShowAddPresetForm] = useState(false);
  const [showManagePresets, setShowManagePresets] = useState(false);
  const [newPresetData, setNewPresetData] = useState<RxPresetItem>({
    drug: "",
    form: "Tablet",
    dose: "",
    route: "Oral",
    frequency: "",
    durationDays: 5,
    refills: 0,
    indication: "",
  });
  const [newPresetLabel, setNewPresetLabel] = useState("");
  const [presetSaveMsg, setPresetSaveMsg] = useState<string | null>(null);

  // Load custom presets on mount
  useEffect(() => {
    setCustomPresets(getLocalCustomPresets());
  }, []);

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

  const handleSaveCustomPreset = (e: React.FormEvent) => {
    e.preventDefault();
    const drugName = newPresetData.drug.trim();
    if (!drugName) return;

    const label = newPresetLabel.trim() || `${drugName} ${newPresetData.dose.trim()}`.trim();
    const newPreset = {
      label,
      item: {
        ...newPresetData,
        drug: drugName,
      },
    };

    const updated = [...customPresets.filter((p) => p.label.toLowerCase() !== label.toLowerCase()), newPreset];
    setCustomPresets(updated);
    saveLocalCustomPresets(updated);

    // Reset form
    setNewPresetLabel("");
    setNewPresetData({
      drug: "",
      form: "Tablet",
      dose: "",
      route: "Oral",
      frequency: "",
      durationDays: 5,
      refills: 0,
      indication: "",
    });
    setShowAddPresetForm(false);
    setPresetSaveMsg(`Preset "${label}" saved!`);
    setTimeout(() => setPresetSaveMsg(null), 3000);
  };

  const handleSaveRowAsPreset = (row: RxDraftRow) => {
    if (!row.drug.trim()) return;
    const label = `${row.drug.trim()}${row.dose.trim() ? " " + row.dose.trim() : ""}`;
    const newPreset = {
      label,
      item: {
        drug: row.drug.trim(),
        form: row.form || "Tablet",
        dose: row.dose.trim() || "",
        route: row.route.trim() || "Oral",
        frequency: row.frequency.trim() || "",
        durationDays: Number(row.durationDays) || 5,
        refills: Number(row.refills) || 0,
        indication: row.indication.trim() || "",
      },
    };
    const updated = [...customPresets.filter((p) => p.label.toLowerCase() !== label.toLowerCase()), newPreset];
    setCustomPresets(updated);
    saveLocalCustomPresets(updated);
    setPresetSaveMsg(`Saved "${label}" to your presets!`);
    setTimeout(() => setPresetSaveMsg(null), 3000);
  };

  const handleDeleteCustomPreset = (labelToDelete: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = customPresets.filter((p) => p.label !== labelToDelete);
    setCustomPresets(updated);
    saveLocalCustomPresets(updated);
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

          {/* Single Drug Presets */}
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-xs)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
              <span className="eyebrow" style={{ display: "block" }}>
                Add Single Drug Preset
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <button
                  type="button"
                  className={`btn ${showManagePresets ? "btn-primary" : "btn-secondary"} btn-sm`}
                  onClick={() => {
                    setShowManagePresets((prev) => !prev);
                    if (!showManagePresets) setShowAddPresetForm(false);
                  }}
                  style={{ fontSize: "0.8125rem", padding: "4px 10px" }}
                  title="Manage your custom presets"
                >
                  <i className="ph ph-sliders-horizontal" aria-hidden="true" />
                  {showManagePresets ? "Done Managing" : `Manage Presets${customPresets.length ? ` (${customPresets.length})` : ""}`}
                </button>
                <button
                  type="button"
                  className={`btn ${showAddPresetForm ? "btn-primary" : "btn-secondary"} btn-sm`}
                  onClick={() => {
                    setShowAddPresetForm((prev) => !prev);
                    if (!showAddPresetForm) setShowManagePresets(false);
                  }}
                  style={{ fontSize: "0.8125rem", padding: "4px 10px" }}
                >
                  <i className={`ph ph-${showAddPresetForm ? "x" : "plus-circle"}`} aria-hidden="true" />
                  {showAddPresetForm ? "Cancel" : "Create New Preset"}
                </button>
              </div>
            </div>

            {/* Notification alert on preset save */}
            {presetSaveMsg && (
              <div className="alert alert-info" style={{ padding: "6px 12px", fontSize: "0.8125rem", margin: 0 }}>
                <i className="ph ph-check-circle" aria-hidden="true" />
                <span>{presetSaveMsg}</span>
              </div>
            )}

            {/* Form to create a custom preset */}
            {showAddPresetForm && (
              <div
                className="card card-soft"
                style={{
                  padding: "var(--s-md)",
                  border: "1px dashed var(--primary)",
                  borderRadius: "var(--r-card)",
                  background: "var(--surface-cream)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--s-sm)",
                  marginTop: 4,
                  marginBottom: 8,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <strong style={{ font: "var(--title-sm)", color: "var(--primary-text)" }}>
                    <i className="ph ph-bookmark-simple" aria-hidden="true" style={{ marginRight: 6 }} />
                    Create Custom Drug Preset
                  </strong>
                  <span className="meta" style={{ fontSize: "0.75rem" }}>
                    Saves to your presets for quick 1-click re-use
                  </span>
                </div>

                <div className="cols-2" style={{ gap: "var(--s-sm)" }}>
                  <div className="field">
                    <label style={{ fontSize: "0.8125rem" }}>Drug Name <span className="req">*</span></label>
                    <input
                      className="input input-sm"
                      placeholder="e.g. Doxycycline"
                      value={newPresetData.drug}
                      onChange={(e) => setNewPresetData({ ...newPresetData, drug: e.target.value })}
                      required
                    />
                  </div>
                  <div className="field">
                    <label style={{ fontSize: "0.8125rem" }}>Dosage <span className="req">*</span></label>
                    <input
                      className="input input-sm"
                      placeholder="e.g. 100 mg"
                      value={newPresetData.dose}
                      onChange={(e) => setNewPresetData({ ...newPresetData, dose: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="cols-3" style={{ gap: "var(--s-sm)" }}>
                  <div className="field">
                    <label style={{ fontSize: "0.8125rem" }}>Form</label>
                    <select
                      className="select input-sm"
                      value={newPresetData.form}
                      onChange={(e) => setNewPresetData({ ...newPresetData, form: e.target.value })}
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
                    <label style={{ fontSize: "0.8125rem" }}>Route</label>
                    <input
                      className="input input-sm"
                      placeholder="Oral"
                      value={newPresetData.route}
                      onChange={(e) => setNewPresetData({ ...newPresetData, route: e.target.value })}
                    />
                  </div>
                  <div className="field">
                    <label style={{ fontSize: "0.8125rem" }}>Button Label (Optional)</label>
                    <input
                      className="input input-sm"
                      placeholder="e.g. Doxycycline 100mg"
                      value={newPresetLabel}
                      onChange={(e) => setNewPresetLabel(e.target.value)}
                    />
                  </div>
                </div>

                <div className="field">
                  <label style={{ fontSize: "0.8125rem" }}>Frequency & Directions <span className="req">*</span></label>
                  <input
                    className="input input-sm"
                    placeholder="e.g. Take 1 capsule twice daily with water"
                    value={newPresetData.frequency}
                    onChange={(e) => setNewPresetData({ ...newPresetData, frequency: e.target.value })}
                    required
                  />
                </div>

                <div className="cols-3" style={{ gap: "var(--s-sm)" }}>
                  <div className="field">
                    <label style={{ fontSize: "0.8125rem" }}>Duration (Days)</label>
                    <input
                      type="number"
                      min="1"
                      className="input input-sm"
                      value={newPresetData.durationDays}
                      onChange={(e) => setNewPresetData({ ...newPresetData, durationDays: Number(e.target.value) || 1 })}
                    />
                  </div>
                  <div className="field">
                    <label style={{ fontSize: "0.8125rem" }}>Refills</label>
                    <input
                      type="number"
                      min="0"
                      className="input input-sm"
                      value={newPresetData.refills}
                      onChange={(e) => setNewPresetData({ ...newPresetData, refills: Number(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="field">
                    <label style={{ fontSize: "0.8125rem" }}>Indication</label>
                    <input
                      className="input input-sm"
                      placeholder="e.g. Periodontitis adjunctive therapy"
                      value={newPresetData.indication}
                      onChange={(e) => setNewPresetData({ ...newPresetData, indication: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setShowAddPresetForm(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={!newPresetData.drug.trim()}
                    onClick={handleSaveCustomPreset}
                  >
                    <i className="ph ph-check" aria-hidden="true" /> Save Preset
                  </button>
                </div>
              </div>
            )}

            {/* Manage Custom Presets Drawer */}
            {showManagePresets && (
              <div
                className="card card-soft"
                style={{
                  padding: "var(--s-md)",
                  border: "1px solid var(--hairline)",
                  borderRadius: "var(--r-card)",
                  background: "var(--surface-soft)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--s-sm)",
                  marginTop: 4,
                  marginBottom: 8,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <strong style={{ font: "var(--title-sm)", color: "var(--ink)", display: "flex", alignItems: "center", gap: 6 }}>
                    <i className="ph ph-sliders-horizontal" aria-hidden="true" style={{ color: "var(--primary)" }} />
                    Manage Presets ({customPresets.length} Custom)
                  </strong>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setShowManagePresets(false)}
                    style={{ fontSize: "0.8125rem", padding: "2px 8px" }}
                  >
                    Close
                  </button>
                </div>

                {customPresets.length === 0 ? (
                  <p className="meta" style={{ fontSize: "0.8125rem", fontStyle: "italic", padding: "8px 0" }}>
                    No custom presets created yet. You can create one by clicking &quot;Create New Preset&quot; or clicking &quot;Save as Preset&quot; on any configured medication row below.
                  </p>
                ) : (
                  <div style={{ display: "grid", gap: 6 }}>
                    {customPresets.map((p) => (
                      <div
                        key={p.label}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "8px 12px",
                          background: "var(--canvas)",
                          border: "1px solid var(--hairline)",
                          borderRadius: "var(--r-control)",
                          gap: 12,
                        }}
                      >
                        <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <strong style={{ font: "var(--body-md)", color: "var(--ink)" }}>{p.label}</strong>
                            <span className="badge" style={{ fontSize: "0.7rem", padding: "1px 6px" }}>{p.item.form}</span>
                          </div>
                          <span className="meta" style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                            {p.item.dose} • {p.item.frequency} • {p.item.durationDays} days {p.item.indication ? `• ${p.item.indication}` : ""}
                          </span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: "0.75rem", padding: "3px 8px", minHeight: "26px" }}
                            onClick={() => applySinglePreset(p.item)}
                            title={`Apply ${p.label}`}
                          >
                            <i className="ph ph-plus" aria-hidden="true" /> Apply
                          </button>
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            style={{ fontSize: "0.75rem", padding: "3px 8px", minHeight: "26px" }}
                            onClick={(e) => handleDeleteCustomPreset(p.label, e)}
                            title={`Delete preset ${p.label}`}
                          >
                            <i className="ph ph-trash" aria-hidden="true" /> Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Presets List: Default + Custom (All uniform style) */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {DEFAULT_PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => applySinglePreset(p.item)}
                  title={`Apply default preset: ${p.label}`}
                >
                  <i className="ph ph-plus" aria-hidden="true" /> {p.label}
                </button>
              ))}

              {/* User-defined Custom Presets (rendered exactly as the other preset buttons) */}
              {customPresets.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => applySinglePreset(p.item)}
                  title={`Apply custom preset: ${p.label}`}
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

                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {row.drug.trim() && (
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          style={{ fontSize: "0.8125rem", padding: "4px 8px", color: "var(--primary-text)" }}
                          onClick={() => handleSaveRowAsPreset(row)}
                          title="Save this configured medication as a custom preset"
                        >
                          <i className="ph ph-bookmark-simple" aria-hidden="true" /> Save as Preset
                        </button>
                      )}

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
