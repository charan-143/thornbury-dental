"use client";

import { useState, useMemo } from "react";

export type AuditEntryItem = {
  seq: number;
  at: string | Date;
  actor_id: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  patient_id: string | null;
  outcome: string;
};

interface AuditFilterViewProps {
  entries: AuditEntryItem[];
  clinicians: Array<{ id: string; name: string }>;
}

const pad = (n: number) => String(n).padStart(2, "0");

function stamp(value: Date | string): string {
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return String(value);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function AuditFilterView({ entries, clinicians }: AuditFilterViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedActor, setSelectedActor] = useState<string>("all");
  const [selectedOutcome, setSelectedOutcome] = useState<string>("all");
  const [selectedActionGroup, setSelectedActionGroup] = useState<string>("all");

  const nameOf = useMemo(() => new Map(clinicians.map((c) => [c.id, c.name])), [clinicians]);

  const actionCategories = useMemo(() => {
    const categories = new Set<string>();
    entries.forEach((e) => {
      if (e.action.includes("signin")) categories.add("signin");
      else if (e.action.includes("chart")) categories.add("chart_access");
      else if (e.action.includes("appointment")) categories.add("appointment");
      else if (e.action.includes("prescription")) categories.add("prescription");
      else categories.add("other");
    });
    return Array.from(categories);
  }, [entries]);

  const filteredEntries = useMemo(() => {
    return entries.filter((e) => {
      // Outcome filter
      if (selectedOutcome !== "all" && e.outcome !== selectedOutcome) return false;

      // Actor filter
      if (selectedActor !== "all") {
        if (selectedActor === "system" && e.actor_id !== null) return false;
        if (selectedActor !== "system" && e.actor_id !== selectedActor) return false;
      }

      // Action category filter
      if (selectedActionGroup !== "all") {
        if (selectedActionGroup === "signin" && !e.action.includes("signin")) return false;
        if (selectedActionGroup === "chart_access" && !e.action.includes("chart")) return false;
        if (selectedActionGroup === "appointment" && !e.action.includes("appointment")) return false;
        if (selectedActionGroup === "prescription" && !e.action.includes("prescription")) return false;
        if (
          selectedActionGroup === "other" &&
          (e.action.includes("signin") ||
            e.action.includes("chart") ||
            e.action.includes("appointment") ||
            e.action.includes("prescription"))
        ) {
          return false;
        }
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const actorName = e.actor_id ? nameOf.get(e.actor_id) ?? e.actor_id : "System";
        const matchesActor = actorName.toLowerCase().includes(q);
        const matchesAction = e.action.toLowerCase().includes(q);
        const matchesEntity = e.entity.toLowerCase().includes(q);
        const matchesEntityId = e.entity_id ? e.entity_id.toLowerCase().includes(q) : false;
        const matchesPatientId = e.patient_id ? e.patient_id.toLowerCase().includes(q) : false;

        if (!matchesActor && !matchesAction && !matchesEntity && !matchesEntityId && !matchesPatientId) {
          return false;
        }
      }

      return true;
    });
  }, [entries, selectedOutcome, selectedActor, selectedActionGroup, searchQuery, nameOf]);

  const counts = useMemo(() => {
    return {
      total: filteredEntries.length,
      ok: filteredEntries.filter((e) => e.outcome === "ok").length,
      denied: filteredEntries.filter((e) => e.outcome === "denied").length,
      failed: filteredEntries.filter((e) => e.outcome === "failed").length,
    };
  }, [filteredEntries]);

  return (
    <div className="audit-dashboard">
      <div className="panel-head" style={{ flexWrap: "wrap", gap: 12 }}>
        <h2>Recent activity</h2>
        <div className="spacer" />
        <span className="badge">{counts.total} of {entries.length} entries shown</span>
      </div>

      {/* Filter Control Toolbar */}
      <div className="audit-toolbar">
        <div className="audit-search-box">
          <i className="ph ph-magnifying-glass" aria-hidden="true" />
          <input
            type="text"
            placeholder="Search by Patient ID, Entity, or Clinician..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input input-sm"
          />
          {searchQuery && (
            <button type="button" className="btn-clear" onClick={() => setSearchQuery("")}>
              <i className="ph ph-x" aria-hidden="true" />
            </button>
          )}
        </div>

        <div className="audit-filters-row">
          <div className="filter-select-wrapper">
            <label htmlFor="actor-filter">Actor:</label>
            <select
              id="actor-filter"
              value={selectedActor}
              onChange={(e) => setSelectedActor(e.target.value)}
              className="select select-sm"
            >
              <option value="all">All Clinicians & System</option>
              <option value="system">System Only</option>
              {clinicians.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-select-wrapper">
            <label htmlFor="category-filter">Action:</label>
            <select
              id="category-filter"
              value={selectedActionGroup}
              onChange={(e) => setSelectedActionGroup(e.target.value)}
              className="select select-sm"
            >
              <option value="all">All Actions</option>
              {actionCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat.replace("_", " ").toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          <div className="segmented-control" role="group" aria-label="Filter audit by outcome">
            <button
              type="button"
              className={`seg-btn ${selectedOutcome === "all" ? "active" : ""}`}
              onClick={() => setSelectedOutcome("all")}
            >
              All
            </button>
            <button
              type="button"
              className={`seg-btn ${selectedOutcome === "ok" ? "active" : ""}`}
              onClick={() => setSelectedOutcome("ok")}
            >
              OK ({counts.ok})
            </button>
            {entries.some((e) => e.outcome === "denied") && (
              <button
                type="button"
                className={`seg-btn ${selectedOutcome === "denied" ? "active" : ""}`}
                onClick={() => setSelectedOutcome("denied")}
              >
                Denied ({counts.denied})
              </button>
            )}
            {entries.some((e) => e.outcome === "failed") && (
              <button
                type="button"
                className={`seg-btn ${selectedOutcome === "failed" ? "active" : ""}`}
                onClick={() => setSelectedOutcome("failed")}
              >
                Failed ({counts.failed})
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Log Rows */}
      <div className="panel-body flush">
        {filteredEntries.length ? (
          <div className="rows">
            {filteredEntries.map((e) => (
              <div className="row" key={e.seq} style={{ gridTemplateColumns: "150px 1fr auto" }}>
                <div className="meta mono">{stamp(e.at)}</div>
                <div className="row-main">
                  <strong>
                    {e.actor_id ? nameOf.get(e.actor_id) ?? e.actor_id : "System"} {e.action}
                  </strong>
                  <span>
                    {e.entity}
                    {e.entity_id ? (
                      <>
                        {" "}
                        <span className="mono">{e.entity_id}</span>
                      </>
                    ) : null}
                    {e.patient_id ? (
                      <>
                        , patient <span className="mono">{e.patient_id}</span>
                      </>
                    ) : null}
                  </span>
                </div>
                <div className="row-side">
                  {e.outcome === "ok" && <span className="badge badge-success">ok</span>}
                  {e.outcome === "denied" && <span className="badge badge-error">denied</span>}
                  {e.outcome === "failed" && <span className="badge badge-warning">failed</span>}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty" style={{ margin: 24 }}>
            <i className="ph ph-funnel-x" aria-hidden="true" />
            <h3>No entries match your filters</h3>
            <p>Try broadening your search query, actor selection, or outcome tab.</p>
          </div>
        )}
      </div>
    </div>
  );
}
