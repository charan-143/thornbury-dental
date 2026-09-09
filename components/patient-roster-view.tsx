"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

export type RosterPatient = {
  id: string;
  mrn: string;
  name: string;
  dob: string | Date;
  photo: string | null;
  last_visit: string | Date | null;
  allergy_count: number;
  next_visit: string | Date | null;
};

interface PatientRosterViewProps {
  patients: RosterPatient[];
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function age(dob: Date | string): number {
  const born = dob instanceof Date ? dob : new Date(dob);
  const now = new Date();
  let years = now.getFullYear() - born.getFullYear();
  const m = now.getMonth() - born.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < born.getDate())) years -= 1;
  return years;
}

function shortDate(value: Date | string | null): string {
  if (!value) return "never";
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return "never";
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function PatientRosterView({ patients }: PatientRosterViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMode, setFilterMode] = useState<"all" | "allergies" | "upcoming">("all");

  const allergyCount = useMemo(() => patients.filter((p) => p.allergy_count > 0).length, [patients]);
  const upcomingCount = useMemo(() => patients.filter((p) => p.next_visit !== null).length, [patients]);

  const filteredPatients = useMemo(() => {
    return patients.filter((p) => {
      // Filter mode
      if (filterMode === "allergies" && p.allergy_count === 0) return false;
      if (filterMode === "upcoming" && p.next_visit === null) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const patientAge = age(p.dob).toString();
        const matchesName = p.name.toLowerCase().includes(q);
        const matchesMrn = p.mrn.toLowerCase().includes(q);
        const matchesAge = patientAge.includes(q);

        if (!matchesName && !matchesMrn && !matchesAge) return false;
      }

      return true;
    });
  }, [patients, filterMode, searchQuery]);

  return (
    <div className="roster-dashboard">
      {/* Roster KPI Bar */}
      <div className="roster-toolbar">
        <div className="schedule-kpi-group">
          <div className="kpi-chip">
            <span className="kpi-value">{patients.length}</span>
            <span className="kpi-label">Registered</span>
          </div>
          <div className="kpi-chip kpi-danger">
            <span className="kpi-value">{allergyCount}</span>
            <span className="kpi-label">Allergies</span>
          </div>
          <div className="kpi-chip kpi-success">
            <span className="kpi-value">{upcomingCount}</span>
            <span className="kpi-label">Upcoming</span>
          </div>
        </div>

        <div className="schedule-filter-group">
          <div className="search-box">
            <i className="ph ph-magnifying-glass" aria-hidden="true" />
            <input
              type="text"
              placeholder="Search by name, MRN, or age..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input input-sm"
              style={{ width: 240 }}
            />
            {searchQuery && (
              <button type="button" className="btn-clear" onClick={() => setSearchQuery("")}>
                <i className="ph ph-x" aria-hidden="true" />
              </button>
            )}
          </div>

          <div className="segmented-control" role="group" aria-label="Filter patient roster">
            <button
              type="button"
              className={`seg-btn ${filterMode === "all" ? "active" : ""}`}
              onClick={() => setFilterMode("all")}
            >
              All ({patients.length})
            </button>
            <button
              type="button"
              className={`seg-btn ${filterMode === "allergies" ? "active" : ""}`}
              onClick={() => setFilterMode("allergies")}
            >
              With Allergies ({allergyCount})
            </button>
            <button
              type="button"
              className={`seg-btn ${filterMode === "upcoming" ? "active" : ""}`}
              onClick={() => setFilterMode("upcoming")}
            >
              Upcoming ({upcomingCount})
            </button>
          </div>
        </div>
      </div>

      {/* Roster List */}
      <div className="panel-body flush">
        {filteredPatients.length ? (
          <div className="roster">
            {filteredPatients.map((p) => (
              <Link className="roster-row" key={p.id} href={`/clinic/patients/${p.id}`} prefetch={true}>
                {p.photo ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={p.photo} alt="" width={40} height={40} />
                ) : (
                  <span className="brand-mark" aria-hidden="true">
                    <i className="ph ph-user" />
                  </span>
                )}
                <div>
                  <strong>{p.name}</strong>
                  <span>
                    {age(p.dob)} years, record <span className="mono">{p.mrn}</span>. Last seen {shortDate(p.last_visit)}
                    {p.next_visit ? `, next ${shortDate(p.next_visit)}` : ""}
                  </span>
                </div>
                <div>
                  {p.allergy_count > 0 ? (
                    <span className="badge badge-error">
                      <i className="ph-bold ph-warning" aria-hidden="true" /> {p.allergy_count} Allergy Alert{p.allergy_count > 1 ? "s" : ""}
                    </span>
                  ) : (
                    <span className="badge">No allergies</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="empty" style={{ margin: 24 }}>
            <i className="ph ph-funnel-x" aria-hidden="true" />
            <h3>No patients match your filters</h3>
            <p>Try clearing your search query or switching filter tabs.</p>
          </div>
        )}
      </div>
    </div>
  );
}
