"use client";

export type PrintableRxData = {
  id: string;
  drug: string;
  form?: string;
  dose: string;
  route?: string;
  frequency: string;
  duration_days: number;
  refills?: number;
  indication: string;
  issued_at: Date | string;
  clinician_name: string;
  patient_name: string;
  patient_mrn: string;
  patient_op_no?: string | null;
  patient_dob?: Date | string;
  patient_address?: string | null;
};

interface PrintablePrescriptionModalProps {
  rx: PrintableRxData;
  onClose: () => void;
}

export function PrintablePrescriptionModal({ rx, onClose }: PrintablePrescriptionModalProps) {
  const triggerPrint = () => {
    window.print();
  };

  const asDate = (v: Date | string | null | undefined) => {
    if (!v) return new Date();
    const d = v instanceof Date ? v : new Date(v);
    return isNaN(d.getTime()) ? new Date() : d;
  };

  const formattedDate = asDate(rx.issued_at).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="modal-backdrop print-modal-backdrop">
      <div className="modal-card print-modal-card" style={{ maxWidth: 750, width: "100%", background: "#fff" }}>
        <div className="no-print" style={{ padding: "12px 16px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontWeight: 600, color: "#1e293b" }}>Official Prescription Preview</span>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="btn btn-primary btn-sm" onClick={triggerPrint}>
              <i className="ph ph-printer" aria-hidden="true" /> Print Prescription Sheet
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
              Close
            </button>
          </div>
        </div>

        {/* Printable Rx Sheet Area */}
        <div id="printable-rx-sheet" className="printable-rx-sheet" style={{ padding: 32, fontFamily: "sans-serif", color: "#0f172a" }}>
          {/* Header */}
          <div style={{ borderBottom: "2px solid #0284c7", paddingBottom: 16, marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 700, color: "#0369a1", margin: 0 }}>THORNBURY DENTAL PRACTICE</h1>
              <p style={{ margin: "4px 0 0", fontSize: 13, color: "#475569" }}>
                124 Thornbury High Street • Bristol, BS35 2AB • Tel: 0117 987 6543
              </p>
            </div>
            <div style={{ textAlign: "right" }}>
              <span style={{ display: "inline-block", background: "#e0f2fe", color: "#0369a1", fontSize: 12, fontWeight: 700, padding: "4px 8px", borderRadius: 4, letterSpacing: 0.5 }}>
                CLINICAL PRESCRIPTION
              </span>
              <p style={{ margin: "6px 0 0", fontSize: 12, color: "#64748b" }}>Rx Ref: #{rx.id}</p>
            </div>
          </div>

          {/* Patient & Prescriber Details Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, background: "#f8fafc", padding: 16, borderRadius: 8, marginBottom: 24, fontSize: 13 }}>
            <div>
              <p style={{ margin: "0 0 4px", color: "#64748b", textTransform: "uppercase", fontSize: 11, fontWeight: 700 }}>Patient Details</p>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 15 }}>{rx.patient_name}</p>
              <p style={{ margin: "2px 0 0", color: "#334155" }}>
                OP No: <strong>{rx.patient_op_no || rx.patient_mrn}</strong> • MRN: <strong>{rx.patient_mrn}</strong>
              </p>
              {rx.patient_address && <p style={{ margin: "2px 0 0", color: "#475569" }}>{rx.patient_address}</p>}
            </div>
            <div>
              <p style={{ margin: "0 0 4px", color: "#64748b", textTransform: "uppercase", fontSize: 11, fontWeight: 700 }}>Prescriber Details</p>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 15 }}>{rx.clinician_name}</p>
              <p style={{ margin: "2px 0 0", color: "#334155" }}>Date Issued: <strong>{formattedDate}</strong></p>
              <p style={{ margin: "2px 0 0", color: "#475569" }}>GDC Registered Dental Practitioner</p>
            </div>
          </div>

          {/* Rx Symbol & Medication Body */}
          <div style={{ marginBottom: 32 }}>
            <div style={{ fontSize: 32, fontWeight: 800, color: "#0284c7", fontFamily: "serif", marginBottom: 12 }}>
              Rx
            </div>

            <div style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: 20, background: "#ffffff" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderBottom: "1px dashed #e2e8f0", paddingBottom: 12, marginBottom: 12 }}>
                <span style={{ fontSize: 18, fontWeight: 700, color: "#0f172a" }}>
                  {rx.drug} {rx.dose} {rx.form ? `(${rx.form})` : ""}
                </span>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#0369a1" }}>
                  Duration: {rx.duration_days} days
                </span>
              </div>

              <div style={{ display: "grid", gap: 8, fontSize: 14 }}>
                <p style={{ margin: 0 }}>
                  <strong>Directions / Frequency:</strong> {rx.frequency} {rx.route ? `(Route: ${rx.route})` : ""}
                </p>
                <p style={{ margin: 0, color: "#475569" }}>
                  <strong>Indication:</strong> {rx.indication}
                </p>
                {typeof rx.refills === "number" && (
                  <p style={{ margin: 0, color: "#475569" }}>
                    <strong>Refills Authorized:</strong> {rx.refills}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Footer Signature Section */}
          <div style={{ marginTop: 40, paddingTop: 24, borderTop: "1px solid #cbd5e1", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            <div style={{ fontSize: 11, color: "#64748b", maxWidth: 300 }}>
              <p style={{ margin: 0 }}>
                This is an official clinical prescription issued via Thornbury Dental electronic health records system.
              </p>
            </div>
            <div style={{ textAlign: "center", width: 220 }}>
              <div style={{ borderBottom: "1px solid #0f172a", height: 40, marginBottom: 4 }} />
              <p style={{ margin: 0, fontSize: 12, fontWeight: 600 }}>{rx.clinician_name}</p>
              <p style={{ margin: 0, fontSize: 11, color: "#64748b" }}>Clinician Signature & Date</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
