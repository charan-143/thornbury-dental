"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

export type TodayAppointment = {
  id: string;
  starts_at: string | Date;
  duration_min: number;
  type: string;
  status: string;
  room: string;
  patient_id: string;
  patient_name: string;
  mrn: string;
  dob: string | Date;
  allergy_list: string | null;
  allergy_count: number;
};

interface TodayViewProps {
  dateIso: string;
  appointments: TodayAppointment[];
  setAppointmentStatusAction: (formData: FormData) => Promise<void>;
}

const pad = (n: number) => String(n).padStart(2, "0");

function formatTime(value: Date | string): string {
  const d = value instanceof Date ? value : new Date(value);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function age(dob: Date | string): number {
  const born = dob instanceof Date ? dob : new Date(dob);
  const now = new Date();
  let years = now.getFullYear() - born.getFullYear();
  const m = now.getMonth() - born.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < born.getDate())) years -= 1;
  return years;
}

export function TodayView({ dateIso, appointments, setAppointmentStatusAction }: TodayViewProps) {
  const [filterMode, setFilterMode] = useState<"all" | "confirmed" | "completed" | "cancelled">("all");
  const [searchQuery, setSearchQuery] = useState("");

  const confirmedList = useMemo(() => appointments.filter((a) => a.status === "confirmed"), [appointments]);
  const completedList = useMemo(() => appointments.filter((a) => a.status === "completed"), [appointments]);
  const cancelledList = useMemo(() => appointments.filter((a) => a.status === "cancelled"), [appointments]);

  // Find the next upcoming confirmed appointment
  const nextAppt = useMemo(() => {
    return confirmedList.length > 0 ? confirmedList[0] : null;
  }, [confirmedList]);

  // Filter appointments
  const filteredAppointments = useMemo(() => {
    return appointments.filter((row) => {
      if (filterMode !== "all" && row.status !== filterMode) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = row.patient_name.toLowerCase().includes(q);
        const matchesMrn = row.mrn.toLowerCase().includes(q);
        const matchesType = row.type.toLowerCase().includes(q);
        const matchesRoom = row.room.toLowerCase().includes(q);
        if (!matchesName && !matchesMrn && !matchesType && !matchesRoom) return false;
      }
      return true;
    });
  }, [appointments, filterMode, searchQuery]);

  return (
    <div className="today-view-container">
      {/* Next Up Spotlight Banner */}
      {nextAppt && (
        <div className="today-spotlight">
          <div className="today-spotlight-badge">
            <span className="pulse-dot" /> Next Patient Up
          </div>
          <div className="today-spotlight-content">
            <div className="today-spotlight-time">
              <span className="time-val">{formatTime(nextAppt.starts_at)}</span>
              <span className="time-dur">{nextAppt.duration_min} min</span>
            </div>
            <div className="today-spotlight-info">
              <h3>
                {nextAppt.patient_name} <span className="spotlight-age">({age(nextAppt.dob)} yrs)</span>
              </h3>
              <p>
                <strong>{nextAppt.type}</strong> &bull; {nextAppt.room} &bull; MRN: {nextAppt.mrn}
                {nextAppt.allergy_list && (
                  <span className="spotlight-allergy">
                    <i className="ph-bold ph-warning" aria-hidden="true" /> Allergy: {nextAppt.allergy_list}
                  </span>
                )}
              </p>
            </div>
            <div className="today-spotlight-actions">
              <Link className="btn btn-primary btn-sm" href={`/clinic/patients/${nextAppt.patient_id}`}>
                <i className="ph ph-folder-open" aria-hidden="true" /> Open Chart
              </Link>
              <form action={setAppointmentStatusAction} style={{ display: "inline" }}>
                <input type="hidden" name="id" value={nextAppt.id} />
                <input type="hidden" name="status" value="completed" />
                <input type="hidden" name="date" value={dateIso} />
                <button className="btn btn-secondary btn-sm" type="submit">
                  <i className="ph-bold ph-check" aria-hidden="true" /> Mark Seen
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Toolbar: Search and Status Filters */}
      <div className="today-toolbar">
        <div className="segmented-control">
          <button
            type="button"
            className={`seg-btn ${filterMode === "all" ? "active" : ""}`}
            onClick={() => setFilterMode("all")}
          >
            All ({appointments.length})
          </button>
          <button
            type="button"
            className={`seg-btn ${filterMode === "confirmed" ? "active" : ""}`}
            onClick={() => setFilterMode("confirmed")}
          >
            Upcoming ({confirmedList.length})
          </button>
          <button
            type="button"
            className={`seg-btn ${filterMode === "completed" ? "active" : ""}`}
            onClick={() => setFilterMode("completed")}
          >
            Seen ({completedList.length})
          </button>
          {cancelledList.length > 0 && (
            <button
              type="button"
              className={`seg-btn ${filterMode === "cancelled" ? "active" : ""}`}
              onClick={() => setFilterMode("cancelled")}
            >
              Cancelled ({cancelledList.length})
            </button>
          )}
        </div>

        <div className="search-box">
          <i className="ph ph-magnifying-glass" aria-hidden="true" />
          <input
            type="search"
            className="input input-sm"
            placeholder="Search patient, MRN, type..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
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
      </div>

      {/* Appointment Rows List */}
      {filteredAppointments.length > 0 ? (
        <div className="rows">
          {filteredAppointments.map((row) => {
            const isConfirmed = row.status === "confirmed";
            const isCompleted = row.status === "completed";
            const isCancelled = row.status === "cancelled";

            return (
              <div className={`row today-row ${isCancelled ? "row-cancelled" : ""}`} key={row.id}>
                <div className="row-when">
                  <div className="d">{formatTime(row.starts_at)}</div>
                  <div className="m">{row.duration_min} min</div>
                </div>

                <div className="row-main">
                  <div className="patient-headline">
                    <Link
                      href={`/clinic/patients/${row.patient_id}`}
                      className="patient-name-link"
                    >
                      <strong>{row.patient_name}</strong>
                    </Link>
                    <span className="patient-demog">
                      {age(row.dob)} yrs &bull; MRN: {row.mrn}
                    </span>
                    {row.allergy_list && (
                      <span className="badge badge-warning" title={row.allergy_list} style={{ fontSize: "0.7rem", padding: "2px 8px" }}>
                        <i className="ph-bold ph-warning" aria-hidden="true" /> Allergy: {row.allergy_list}
                      </span>
                    )}
                  </div>
                  <span className="appt-desc">
                    <span className="procedure-tag">{row.type}</span>
                    <span className="meta">&bull; Room: {row.room}</span>
                  </span>
                </div>

                <div className="row-side">
                  {/* Status Badges */}
                  {isConfirmed && <span className="badge badge-success">Upcoming</span>}
                  {isCompleted && (
                    <span className="badge badge-info">
                      <i className="ph-fill ph-check-circle" aria-hidden="true" /> Seen
                    </span>
                  )}
                  {isCancelled && <span className="badge badge-error">Cancelled</span>}

                  {/* Actions */}
                  <div className="today-row-actions">
                    <Link className="btn btn-secondary btn-sm" href={`/clinic/patients/${row.patient_id}`}>
                      Open Chart
                    </Link>

                    {isConfirmed && (
                      <>
                        <form action={setAppointmentStatusAction} style={{ display: "inline" }}>
                          <input type="hidden" name="id" value={row.id} />
                          <input type="hidden" name="status" value="completed" />
                          <input type="hidden" name="date" value={dateIso} />
                          <button
                            className="btn btn-ghost btn-sm"
                            type="submit"
                            title="Mark appointment as seen"
                          >
                            <i className="ph-bold ph-check" aria-hidden="true" /> Seen
                          </button>
                        </form>
                        <form action={setAppointmentStatusAction} style={{ display: "inline" }}>
                          <input type="hidden" name="id" value={row.id} />
                          <input type="hidden" name="status" value="cancelled" />
                          <input type="hidden" name="date" value={dateIso} />
                          <button
                            className="btn btn-danger btn-sm"
                            type="submit"
                            title="Cancel appointment"
                          >
                            Cancel
                          </button>
                        </form>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="panel-body">
          <div className="empty" style={{ padding: "3rem 1rem" }}>
            <i className="ph ph-magnifying-glass" aria-hidden="true" />
            <h3>No appointments found</h3>
            <p>
              {searchQuery || filterMode !== "all"
                ? "Try adjusting your search filter or clear search terms."
                : "No appointments scheduled for today yet."}
            </p>
            {(searchQuery || filterMode !== "all") && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setFilterMode("all");
                  setSearchQuery("");
                }}
              >
                Reset filters
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
