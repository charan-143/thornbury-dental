"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import {
  createAppointmentAction,
  createPatientAction,
  type ClinicalFormState,
} from "@/actions/clinical";

function ErrorAlert({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div className="alert alert-critical" role="alert">
      <i className="ph ph-warning-octagon" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}

/**
 * Registering a patient.
 *
 * Allergies are one per line rather than a comma-separated field, because
 * "Penicillin, rash" is two facts and a single box invites people to run them
 * together. The record number is not asked for: it is generated.
 */
export function NewPatientForm() {
  const [state, action, pending] = useActionState<ClinicalFormState, FormData>(createPatientAction, {});
  // key forces React to remount the inputs with the returned values after an
  // error, so nothing typed is lost to a single validation message.
  const kept = state.values ?? {};

  return (
    <form className="panel" action={action}>
      <div className="panel-head"><h2>New patient</h2></div>
      <div className="panel-body">
        <ErrorAlert message={state.error} />

        <div className="field">
          <label htmlFor="np-name">Full name <span className="req" aria-hidden="true">*</span></label>
          <input className="input" id="np-name" name="name" autoComplete="off" required defaultValue={kept.name ?? ""} key={"n" + (kept.name ?? "")} />
        </div>

        <div className="cols-2" style={{ gap: 16 }}>
          <div className="field">
            <label htmlFor="np-dob">Date of birth <span className="req" aria-hidden="true">*</span></label>
            <input className="input" id="np-dob" name="dob" type="date" required defaultValue={kept.dob ?? ""} key={"d" + (kept.dob ?? "")} />
          </div>
          <div className="field">
            <label htmlFor="np-phone">Telephone</label>
            <input className="input" id="np-phone" name="phone" type="tel" autoComplete="off" defaultValue={kept.phone ?? ""} key={"p" + (kept.phone ?? "")} />
          </div>
        </div>

        <div className="field">
          <label htmlFor="np-email">Email</label>
          <input className="input" id="np-email" name="email" type="email" autoComplete="off" defaultValue={kept.email ?? ""} key={"e" + (kept.email ?? "")} />
          <p className="hint">Used for appointment reminders only.</p>
        </div>

        <div className="field">
          <label htmlFor="np-allergies">Allergies</label>
          <textarea
            className="textarea"
            id="np-allergies"
            name="allergies"
            rows={3}
            defaultValue={kept.allergies ?? ""}
            key={"a" + (kept.allergies ?? "")}
            placeholder={"Penicillin, urticarial rash\nLatex, contact dermatitis"}
          />
          <p className="hint">
            One per line, as substance then reaction. These show as a blocking alert on the
            chart and are checked before anything is prescribed.
          </p>
        </div>

        <div className="field">
          <label htmlFor="np-conditions">Ongoing conditions</label>
          <textarea
            className="textarea"
            id="np-conditions"
            name="conditions"
            rows={3}
            defaultValue={kept.conditions ?? ""}
            key={"c" + (kept.conditions ?? "")}
            placeholder={"Type 2 diabetes, diet controlled\nAnticoagulant therapy, apixaban"}
          />
          <p className="hint">One per line.</p>
        </div>
      </div>
      <div className="modal-foot">
        <button className="btn btn-primary" type="submit" disabled={pending}>
          {pending ? "Registering" : "Register patient"}
        </button>
      </div>
    </form>
  );
}

const PRESET_PROCEDURES = [
  "Examination & Assessment",
  "Hygiene & Scaling",
  "Root Canal Treatment",
  "Surgical Extraction",
  "Crown & Bridge Fit",
  "Emergency Pain Relief",
  "Implant Consultation",
];

function getEndTime(startSlot: string, durationMin: number): string {
  const [h, m] = startSlot.split(":").map(Number);
  if (h === undefined || m === undefined || Number.isNaN(h) || Number.isNaN(m)) return "";
  const totalMin = h * 60 + m + durationMin;
  const endH = Math.floor(totalMin / 60);
  const endM = totalMin % 60;
  return `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;
}

/**
 * Booking an appointment.
 *
 * Enhanced appointment booking form with instant patient search, quick procedure
 * presets, time-of-day grouped slot selection, live end-time calculation, and
 * a booking confirmation summary.
 */
export function NewAppointmentForm({
  patients,
  date,
  slots,
  duration,
  preselected,
}: {
  patients: Array<{ id: string; name: string; mrn: string }>;
  date: string;
  slots: string[];
  duration: number;
  preselected?: string;
}) {
  const [state, action, pending] = useActionState<ClinicalFormState, FormData>(createAppointmentAction, {});
  const kept = state.values ?? {};
  
  const [patientId, setPatientId] = useState(kept.patientId ?? "");
  const [searchQuery, setSearchQuery] = useState("");
  const [type, setType] = useState(kept.type || "Examination & Assessment");
  const [slot, setSlot] = useState(
    kept.slot && slots.includes(kept.slot)
      ? kept.slot
      : preselected && slots.includes(preselected)
        ? preselected
        : "",
  );

  const filteredPatients = patients.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.mrn.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const selectedPatient = patients.find((p) => p.id === patientId);

  const morningSlots = slots.filter((s) => parseInt(s.split(":")[0] ?? "0", 10) < 12);
  const afternoonSlots = slots.filter((s) => parseInt(s.split(":")[0] ?? "0", 10) >= 12);

  return (
    <form className="panel apt-form-panel" action={action}>
      <div className="panel-head">
        <h2><i className="ph ph-calendar-check" aria-hidden="true" /> Book Appointment</h2>
        <div className="spacer" />
        <span className="badge badge-info">{duration} min duration</span>
      </div>

      <div className="panel-body">
        <ErrorAlert message={state.error} />

        <input type="hidden" name="date" value={date} />
        <input type="hidden" name="duration" value={duration} />
        <input type="hidden" name="slot" value={slot} />
        <input type="hidden" name="patientId" value={patientId} />

        {/* Step 1: Patient Selection with Search */}
        <div className="field">
          <label htmlFor="na-patient-select">
            Patient Record <span className="req" aria-hidden="true">*</span>
          </label>
          
          {patients.length > 5 && (
            <div className="apt-search-box" style={{ marginBottom: 8 }}>
              <i className="ph ph-magnifying-glass" aria-hidden="true" />
              <input
                className="input"
                type="text"
                placeholder="Search patient by name or MRN..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          )}

          <select
            className="select"
            id="na-patient-select"
            required
            value={patientId}
            onChange={(e) => setPatientId(e.target.value)}
          >
            <option value="" disabled>Select patient record...</option>
            {filteredPatients.map((p) => (
              <option key={p.id} value={p.id}>{p.name} ({p.mrn})</option>
            ))}
          </select>

          {patients.length === 0 && (
            <p className="err">No patients are registered yet. Register one first.</p>
          )}

          {selectedPatient && (
            <div className="apt-patient-preview">
              <i className="ph ph-user-circle" aria-hidden="true" style={{ fontSize: "1.5rem" }} />
              <div>
                <strong>{selectedPatient.name}</strong>
                <span className="meta">MRN: {selectedPatient.mrn}</span>
              </div>
              <div className="spacer" />
              <Link href={`/clinic/patients/${selectedPatient.id}`} target="_blank" className="btn btn-ghost btn-sm">
                View Chart <i className="ph ph-arrow-square-out" aria-hidden="true" />
              </Link>
            </div>
          )}
        </div>

        {/* Step 2: Visit Reason & Presets */}
        <div className="field">
          <label htmlFor="na-type">Reason for the Visit <span className="req" aria-hidden="true">*</span></label>
          <input
            className="input"
            id="na-type"
            name="type"
            required
            value={type}
            onChange={(e) => setType(e.target.value)}
            placeholder="e.g. Examination & Assessment"
          />

          <div className="apt-presets-wrapper" style={{ marginTop: 8 }}>
            <span className="caption" style={{ display: "block", marginBottom: 6, color: "var(--muted)" }}>
              Quick presets:
            </span>
            <div className="chip-row">
              {PRESET_PROCEDURES.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className={`apt-preset-chip ${type === preset ? "is-active" : ""}`}
                  onClick={() => setType(preset)}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Step 3: Slot Grid grouped by Morning / Afternoon */}
        <div className="field">
          <span id="na-slot-label" style={{ fontWeight: 500, display: "block", marginBottom: 8 }}>
            Available Start Times ({slots.length} open slots for {duration} mins)
          </span>

          {slots.length === 0 ? (
            <div className="alert" style={{ background: "var(--surface-soft)" }}>
              <i className="ph ph-clock-slash" aria-hidden="true" />
              <span>No continuous {duration}-minute slots are open on this date. Try selecting another date or shorter duration.</span>
            </div>
          ) : (
            <div className="apt-slots-container">
              {morningSlots.length > 0 && (
                <div className="apt-time-section">
                  <div className="apt-time-header">
                    <i className="ph ph-sun" aria-hidden="true" />
                    <span>Morning ({morningSlots.length})</span>
                  </div>
                  <div className="slot-grid">
                    {morningSlots.map((s) => (
                      <button
                        key={s}
                        type="button"
                        className="slot-pick apt-slot-pick"
                        aria-pressed={slot === s}
                        onClick={() => setSlot(s)}
                      >
                        <i className="ph ph-clock" aria-hidden="true" />
                        <span>{s}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {afternoonSlots.length > 0 && (
                <div className="apt-time-section" style={{ marginTop: 16 }}>
                  <div className="apt-time-header">
                    <i className="ph ph-sun-dim" aria-hidden="true" />
                    <span>Afternoon ({afternoonSlots.length})</span>
                  </div>
                  <div className="slot-grid">
                    {afternoonSlots.map((s) => (
                      <button
                        key={s}
                        type="button"
                        className="slot-pick apt-slot-pick"
                        aria-pressed={slot === s}
                        onClick={() => setSlot(s)}
                      >
                        <i className="ph ph-clock" aria-hidden="true" />
                        <span>{s}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {!slot && slots.length > 0 && (
            <p className="hint" style={{ marginTop: 8 }}>Select an available time slot above to proceed.</p>
          )}
        </div>

        {/* Step 4: Summary Card */}
        {slot && selectedPatient && (
          <div className="apt-summary-box">
            <div className="apt-summary-header">
              <i className="ph ph-check-circle" aria-hidden="true" />
              <strong>Appointment Summary</strong>
            </div>
            <div className="apt-summary-grid">
              <div>
                <span className="lbl">Patient</span>
                <strong>{selectedPatient.name} ({selectedPatient.mrn})</strong>
              </div>
              <div>
                <span className="lbl">Date & Time</span>
                <strong>{date} @ {slot} – {getEndTime(slot, duration)} ({duration}m)</strong>
              </div>
              <div>
                <span className="lbl">Clinical Reason</span>
                <span>{type}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="modal-foot">
        <button
          className="btn btn-primary btn-cta"
          type="submit"
          disabled={pending || !slot || !patientId}
          style={{ minWidth: 160 }}
        >
          {pending ? (
            <>
              <i className="ph ph-spinner spinner" aria-hidden="true" /> Booking...
            </>
          ) : (
            <>
              <i className="ph ph-calendar-plus" aria-hidden="true" /> Book Appointment
            </>
          )}
        </button>
      </div>
    </form>
  );
}
