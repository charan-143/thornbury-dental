"use client";

import { useState } from "react";
import { IssuePrescriptionModal } from "@/components/issue-prescription-modal";
import { PrintablePrescriptionModal, type PrintableRxData } from "@/components/printable-prescription";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const asDate = (v: Date | string) => (v instanceof Date ? v : new Date(v));
const day = (v: Date | string | null) =>
  v ? `${asDate(v).getDate()} ${MONTHS[asDate(v).getMonth()]} ${asDate(v).getFullYear()}` : "not recorded";

export type RxItem = {
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
  override_reason: string | null;
  clinician_name: string;
};

interface PrescriptionsViewProps {
  patientId: string;
  patientName: string;
  patientMrn: string;
  patientOpNo?: string | null;
  patientAddress?: string | null;
  allergies: Array<{ substance: string; reaction: string; severity: string }>;
  rxs: RxItem[];
}

export function PrescriptionsView({
  patientId,
  patientName,
  patientMrn,
  patientOpNo,
  patientAddress,
  allergies,
  rxs,
}: PrescriptionsViewProps) {
  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);
  const [printingRx, setPrintingRx] = useState<PrintableRxData | null>(null);

  return (
    <>
      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Prescriptions</h2>
            <p className="meta" style={{ margin: 0 }}>Issued medications and clinical prescription records</p>
          </div>
          <div className="spacer" />
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setIsIssueModalOpen(true)}
          >
            <i className="ph ph-plus-circle" aria-hidden="true" /> Issue Prescriptions
          </button>
        </div>

        <div className="panel-body">
          {rxs.length ? (
            rxs.map((rx) => (
              <div className="card card-soft" key={`rx-${rx.id}`} style={{ display: "grid", gap: 8 }}>
                <div style={{ display: "flex", gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
                  <strong style={{ font: "var(--title-sm)", color: "var(--ink)" }}>
                    {rx.drug} {rx.dose} {rx.form ? `(${rx.form})` : ""}
                  </strong>
                  <span className="meta">{rx.frequency}, {rx.duration_days} days</span>
                  <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: "0.75rem", padding: "2px 8px" }}
                      onClick={() =>
                        setPrintingRx({
                          ...rx,
                          patient_name: patientName,
                          patient_mrn: patientMrn,
                          patient_op_no: patientOpNo,
                          patient_address: patientAddress,
                        })
                      }
                    >
                      <i className="ph ph-printer" aria-hidden="true" /> Print Rx Sheet
                    </button>
                    <span className="locked">
                      <i className="ph ph-lock-simple" aria-hidden="true" /> {day(rx.issued_at)}
                    </span>
                  </div>
                </div>

                <span className="meta">
                  {rx.indication}. Prescribed by <strong>{rx.clinician_name}</strong>.
                </span>

                {rx.override_reason && (
                  <div className="alert alert-warning" style={{ marginTop: 4 }}>
                    <i className="ph ph-warning" aria-hidden="true" />
                    <span>
                      <strong>Issued over a safety alert:</strong> {rx.override_reason}
                    </span>
                  </div>
                )}
              </div>
            ))
          ) : (
            <p className="meta">No prescriptions issued yet for this patient.</p>
          )}
        </div>
      </section>

      {/* Issue Prescription Form Modal */}
      {isIssueModalOpen && (
        <IssuePrescriptionModal
          patientId={patientId}
          patientName={patientName}
          allergies={allergies}
          isOpen={isIssueModalOpen}
          onClose={() => setIsIssueModalOpen(false)}
        />
      )}

      {/* Printable Prescription Modal */}
      {printingRx && (
        <PrintablePrescriptionModal
          rx={printingRx}
          onClose={() => setPrintingRx(null)}
        />
      )}
    </>
  );
}
