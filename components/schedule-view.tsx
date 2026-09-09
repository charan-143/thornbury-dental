"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

const pad = (n: number) => String(n).padStart(2, "0");

function slotOf(value: Date | string): string {
  const d = value instanceof Date ? value : new Date(value);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export type ScheduleAppointment = {
  id: string;
  starts_at: string | Date;
  duration_min: number;
  type: string;
  status: string;
  room: string;
  patient_id: string;
  patient_name: string;
  allergy_count: number;
};

interface ScheduleViewProps {
  iso: string;
  heading: string;
  closed: boolean;
  slots: string[];
  appointments: ScheduleAppointment[];
  coveredSlotsSet: string[];
  setAppointmentStatusAction: (formData: FormData) => Promise<void>;
}

export function ScheduleView({
  iso,
  heading,
  closed,
  slots,
  appointments,
  coveredSlotsSet,
  setAppointmentStatusAction,
}: ScheduleViewProps) {
  const [statusFilter, setStatusFilter] = useState<"all" | "confirmed" | "completed" | "cancelled">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAppt, setSelectedAppt] = useState<ScheduleAppointment | null>(null);

  const coveredSet = useMemo(() => new Set(coveredSlotsSet), [coveredSlotsSet]);

  const live = useMemo(() => appointments.filter((r) => r.status !== "cancelled"), [appointments]);
  const completedCount = useMemo(() => appointments.filter((r) => r.status === "completed").length, [appointments]);
  const cancelledCount = useMemo(() => appointments.filter((r) => r.status === "cancelled").length, [appointments]);
  const totalMinutes = useMemo(() => live.reduce((m, r) => m + r.duration_min, 0), [live]);

  const filteredAppointments = useMemo(() => {
    return appointments.filter((r) => {
      // Status filter
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = r.patient_name.toLowerCase().includes(q);
        const matchesType = r.type.toLowerCase().includes(q);
        if (!matchesName && !matchesType) return false;
      }
      return true;
    });
  }, [appointments, statusFilter, searchQuery]);

  return (
    <div className="schedule-dashboard">
      {/* Top Filter and KPI Bar */}
      <div className="schedule-toolbar">
        <div className="schedule-kpi-group">
          <div className="kpi-chip">
            <span className="kpi-value">{live.length}</span>
            <span className="kpi-label">Booked</span>
          </div>
          <div className="kpi-chip">
            <span className="kpi-value">{totalMinutes}m</span>
            <span className="kpi-label">Chair Time</span>
          </div>
          <div className="kpi-chip kpi-success">
            <span className="kpi-value">{completedCount}</span>
            <span className="kpi-label">Seen</span>
          </div>
          {cancelledCount > 0 && (
            <div className="kpi-chip kpi-danger">
              <span className="kpi-value">{cancelledCount}</span>
              <span className="kpi-label">Cancelled</span>
            </div>
          )}
        </div>

        <div className="schedule-filter-group">
          <div className="search-box">
            <i className="ph ph-magnifying-glass" aria-hidden="true" />
            <input
              type="text"
              placeholder="Search patient or type..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input input-sm"
            />
            {searchQuery && (
              <button
                type="button"
                className="btn-clear"
                onClick={() => setSearchQuery("")}
                aria-label="Clear search"
              >
                <i className="ph ph-x" aria-hidden="true" />
              </button>
            )}
          </div>

          <div className="segmented-control" role="group" aria-label="Filter schedule by status">
            <button
              type="button"
              className={`seg-btn ${statusFilter === "all" ? "active" : ""}`}
              onClick={() => setStatusFilter("all")}
            >
              All
            </button>
            <button
              type="button"
              className={`seg-btn ${statusFilter === "confirmed" ? "active" : ""}`}
              onClick={() => setStatusFilter("confirmed")}
            >
              Confirmed
            </button>
            <button
              type="button"
              className={`seg-btn ${statusFilter === "completed" ? "active" : ""}`}
              onClick={() => setStatusFilter("completed")}
            >
              Seen
            </button>
            <button
              type="button"
              className={`seg-btn ${statusFilter === "cancelled" ? "active" : ""}`}
              onClick={() => setStatusFilter("cancelled")}
            >
              Cancelled
            </button>
          </div>
        </div>
      </div>

      {closed && (
        <div className="alert" style={{ marginBottom: 16 }}>
          <i className="ph ph-moon" aria-hidden="true" />
          <span>The practice is closed on Sundays.</span>
        </div>
      )}

      {/* Grid view */}
      <div className="day">
        {slots.map((slot) => {
          const starting = filteredAppointments.filter(
            (r) => r.status !== "cancelled" && slotOf(r.starts_at) === slot
          );
          const cancelled = filteredAppointments.filter(
            (r) => r.status === "cancelled" && slotOf(r.starts_at) === slot
          );
          const isCovered = coveredSet.has(slot);
          const isFree =
            !starting.length &&
            !cancelled.length &&
            !isCovered &&
            !closed &&
            statusFilter === "all" &&
            !searchQuery;

          return (
            <div key={slot} style={{ display: "contents" }}>
              <div className="day-hour">{slot}</div>
              <div className="day-slot">
                {starting.map((r) => (
                  <div
                    key={r.id}
                    className={`appt appt-interactive ${selectedAppt?.id === r.id ? "selected" : ""}`}
                    data-status={r.status}
                    style={{ minHeight: Math.max(44, Math.ceil(r.duration_min / 30) * 44) }}
                  >
                    <div className="appt-header">
                      <Link
                        href={`/clinic/patients/${r.patient_id}`}
                        className="patient-name-link"
                      >
                        <strong>{slotOf(r.starts_at)}, {r.patient_name}</strong>
                      </Link>
                      <button
                        type="button"
                        className="btn-icon"
                        title="View details"
                        onClick={() => setSelectedAppt(r)}
                      >
                        <i className="ph ph-info" aria-hidden="true" />
                      </button>
                    </div>

                    <div className="appt-meta">
                      <span>{r.type} &bull; {r.duration_min}m</span>
                      {r.allergy_count > 0 && (
                        <span className="badge badge-warning badge-xs" style={{ marginLeft: 6 }}>
                          <i className="ph-bold ph-warning" aria-hidden="true" /> Allergy
                        </span>
                      )}
                    </div>

                    <div className="chip-row" style={{ marginTop: 8 }}>
                      {r.status === "confirmed" && (
                        <div key={`actions-${r.id}`} style={{ display: "inline-flex", gap: 6 }}>
                          <form action={setAppointmentStatusAction} style={{ display: "inline" }}>
                            <input type="hidden" name="id" value={r.id} />
                            <input type="hidden" name="status" value="completed" />
                            <input type="hidden" name="date" value={iso} />
                            <button className="btn btn-ghost btn-sm" type="submit">
                              <i className="ph-bold ph-check" aria-hidden="true" /> Mark seen
                            </button>
                          </form>
                          <form action={setAppointmentStatusAction} style={{ display: "inline" }}>
                            <input type="hidden" name="id" value={r.id} />
                            <input type="hidden" name="status" value="cancelled" />
                            <input type="hidden" name="date" value={iso} />
                            <button className="btn btn-danger btn-sm" type="submit">
                              Cancel
                            </button>
                          </form>
                        </div>
                      )}
                      {r.status === "completed" && (
                        <span className="badge badge-info">
                          <i className="ph-fill ph-check-circle" aria-hidden="true" /> Seen
                        </span>
                      )}
                    </div>
                  </div>
                ))}

                {cancelled.map((r) => (
                  <div className="appt" key={r.id} data-status="cancelled">
                    <div className="appt-header">
                      <strong style={{ textDecoration: "line-through" }}>
                        {slotOf(r.starts_at)}, {r.patient_name}
                      </strong>
                      <span className="badge badge-danger badge-xs">Cancelled</span>
                    </div>
                    <span>{r.type}</span>
                  </div>
                ))}

                {isCovered && <div className="slot-covered" aria-hidden="true" />}

                {isFree && (
                  <Link
                    className="slot-free"
                    href={`/clinic/schedule/new?date=${iso}&slot=${slot}`}
                    aria-label={`Book an appointment at ${slot} on ${heading}`}
                  >
                    <i className="ph ph-plus" aria-hidden="true" />
                    <span>Free</span>
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Appointment Detail Slide-Over / Modal */}
      {selectedAppt && (
        <div className="drawer-overlay" onClick={() => setSelectedAppt(null)}>
          <div className="drawer-card" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-header">
              <h3>Appointment Details</h3>
              <button
                type="button"
                className="btn-icon"
                onClick={() => setSelectedAppt(null)}
                aria-label="Close drawer"
              >
                <i className="ph ph-x" aria-hidden="true" />
              </button>
            </div>

            <div className="drawer-body">
              <div className="drawer-row">
                <span className="label">Patient:</span>
                <Link
                  href={`/clinic/patients/${selectedAppt.patient_id}`}
                  className="value-link"
                >
                  <strong>{selectedAppt.patient_name}</strong>
                  <i className="ph ph-arrow-square-out" aria-hidden="true" />
                </Link>
              </div>

              <div className="drawer-row">
                <span className="label">Time:</span>
                <span className="value">
                  {slotOf(selectedAppt.starts_at)} ({selectedAppt.duration_min} minutes)
                </span>
              </div>

              <div className="drawer-row">
                <span className="label">Procedure:</span>
                <span className="value">{selectedAppt.type}</span>
              </div>

              <div className="drawer-row">
                <span className="label">Room:</span>
                <span className="value">{selectedAppt.room || "Surgery 1"}</span>
              </div>

              <div className="drawer-row">
                <span className="label">Status:</span>
                <span className="value">
                  <span className={`badge badge-${selectedAppt.status === "completed" ? "info" : selectedAppt.status === "cancelled" ? "danger" : "primary"}`}>
                    {selectedAppt.status}
                  </span>
                </span>
              </div>

              {selectedAppt.allergy_count > 0 && (
                <div className="alert alert-critical" style={{ marginTop: 16 }}>
                  <i className="ph ph-warning-octagon" aria-hidden="true" />
                  <div>
                    <strong>Medical Allergy Warning</strong>
                    <p style={{ margin: 0, fontSize: "0.85rem" }}>
                      Patient has {selectedAppt.allergy_count} active allergy alert(s) on file. Check record before administering local anesthesia or prescribing.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="drawer-footer">
              <Link
                href={`/clinic/patients/${selectedAppt.patient_id}`}
                className="btn btn-secondary"
              >
                Open Medical Chart
              </Link>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setSelectedAppt(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
