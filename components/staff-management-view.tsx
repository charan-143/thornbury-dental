"use client";

import { useState, useMemo } from "react";

export type StaffAccountItem = {
  id: string;
  email: string;
  role: string;
  name: string;
  specialty: string;
  created_at: string | Date;
  last_sign_in_at: string | Date | null;
  locked_until: string | Date | null;
  disabled_at: string | Date | null;
  live_sessions: number;
};

export type StaffInviteItem = {
  email: string;
  role: string;
  name: string;
  created_at: string | Date;
  expires_at: string | Date;
};

interface StaffManagementViewProps {
  accounts: StaffAccountItem[];
  invites: StaffInviteItem[];
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pad = (n: number) => String(n).padStart(2, "0");

function stamp(v: Date | string | null): string {
  if (!v) return "never";
  const d = v instanceof Date ? v : new Date(v);
  if (isNaN(d.getTime())) return "never";
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function StaffManagementView({ accounts, invites }: StaffManagementViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "admin" | "clinician" | "active">("all");

  const liveSessionsCount = useMemo(
    () => accounts.reduce((acc, a) => acc + (a.live_sessions > 0 ? 1 : 0), 0),
    [accounts]
  );
  const adminCount = useMemo(() => accounts.filter((a) => a.role === "admin").length, [accounts]);

  const filteredAccounts = useMemo(() => {
    return accounts.filter((a) => {
      // Role filter
      if (roleFilter === "admin" && a.role !== "admin") return false;
      if (roleFilter === "clinician" && a.role !== "clinician") return false;
      if (roleFilter === "active" && a.live_sessions === 0) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = a.name.toLowerCase().includes(q);
        const matchesEmail = a.email.toLowerCase().includes(q);
        const matchesSpecialty = a.specialty ? a.specialty.toLowerCase().includes(q) : false;

        if (!matchesName && !matchesEmail && !matchesSpecialty) return false;
      }

      return true;
    });
  }, [accounts, roleFilter, searchQuery]);

  return (
    <div className="staff-dashboard">
      <div className="panel-head" style={{ flexWrap: "wrap", gap: 12 }}>
        <h2>Staff Accounts ({accounts.length})</h2>
        <div className="spacer" />
        <div className="chip-row">
          <span className="badge badge-success">{liveSessionsCount} with live sessions</span>
          <span className="badge badge-coral">{adminCount} Administrators</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="audit-toolbar">
        <div className="audit-filters-row">
          <div className="search-box" style={{ flex: 1 }}>
            <i className="ph ph-magnifying-glass" aria-hidden="true" />
            <input
              type="text"
              placeholder="Search clinician by name, email, or specialty..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input input-sm"
              style={{ width: "100%" }}
            />
            {searchQuery && (
              <button type="button" className="btn-clear" onClick={() => setSearchQuery("")}>
                <i className="ph ph-x" aria-hidden="true" />
              </button>
            )}
          </div>

          <div className="segmented-control" role="group" aria-label="Filter staff accounts">
            <button
              type="button"
              className={`seg-btn ${roleFilter === "all" ? "active" : ""}`}
              onClick={() => setRoleFilter("all")}
            >
              All Staff
            </button>
            <button
              type="button"
              className={`seg-btn ${roleFilter === "admin" ? "active" : ""}`}
              onClick={() => setRoleFilter("admin")}
            >
              Admins
            </button>
            <button
              type="button"
              className={`seg-btn ${roleFilter === "clinician" ? "active" : ""}`}
              onClick={() => setRoleFilter("clinician")}
            >
              Clinicians
            </button>
            <button
              type="button"
              className={`seg-btn ${roleFilter === "active" ? "active" : ""}`}
              onClick={() => setRoleFilter("active")}
            >
              Active Now
            </button>
          </div>
        </div>
      </div>

      <div className="panel-body flush">
        {filteredAccounts.length ? (
          <div className="rows">
            {filteredAccounts.map((a) => {
              const locked = a.locked_until && new Date(a.locked_until).getTime() > Date.now();
              return (
                <div className="row" key={a.id} style={{ gridTemplateColumns: "1fr auto" }}>
                  <div className="row-main">
                    <strong>
                      {a.name}
                      {a.specialty ? `, ${a.specialty}` : ""}
                    </strong>
                    <span>
                      {a.email}. Joined {stamp(a.created_at)}. Last signed in {stamp(a.last_sign_in_at)}.
                    </span>
                  </div>
                  <div className="row-side">
                    {a.live_sessions > 0 && (
                      <span className="badge badge-success">
                        <i className="ph-fill ph-circle" aria-hidden="true" style={{ fontSize: "0.6rem" }} />{" "}
                        {a.live_sessions} live
                      </span>
                    )}
                    {locked && <span className="badge badge-warning">Locked</span>}
                    {a.disabled_at && <span className="badge badge-error">Disabled</span>}
                    <span className={a.role === "admin" ? "badge badge-coral" : "badge"}>{a.role}</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="empty" style={{ margin: 24 }}>
            <i className="ph ph-funnel-x" aria-hidden="true" />
            <h3>No accounts match your query</h3>
            <p>Try searching for a different name or changing your filter selection.</p>
          </div>
        )}
      </div>

      {/* Pending Invitations Section */}
      <div className="panel-head" style={{ marginTop: 24, borderTop: "1px solid var(--hairline)" }}>
        <h2>Pending Invitations</h2>
        <div className="spacer" />
        <span className="badge">{invites.length} pending</span>
      </div>
      <div className="panel-body">
        {invites.length ? (
          <div className="rows">
            {invites.map((i) => (
              <div className="row" key={i.email} style={{ gridTemplateColumns: "1fr auto" }}>
                <div className="row-main">
                  <strong>{i.name}</strong>
                  <span>
                    {i.email}. Sent {stamp(i.created_at)}, expires {stamp(i.expires_at)}.
                  </span>
                </div>
                <span className="badge">{i.role}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="meta" style={{ margin: 0 }}>
            No pending invitations outstanding.
          </p>
        )}
      </div>
    </div>
  );
}
