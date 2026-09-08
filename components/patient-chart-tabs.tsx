"use client";

import { useState, type ReactNode } from "react";

type TabKey = "overview" | "odontogram" | "plans" | "rxs" | "reports" | "appts";

interface PatientChartTabsProps {
  overviewContent: ReactNode;
  odontogramContent: ReactNode;
  plansContent: ReactNode;
  rxsContent: ReactNode;
  reportsContent: ReactNode;
  apptsContent: ReactNode;
  counts: {
    plans: number;
    rxs: number;
    reports: number;
    appts: number;
  };
}

export function PatientChartTabs({
  overviewContent,
  odontogramContent,
  plansContent,
  rxsContent,
  reportsContent,
  apptsContent,
  counts,
}: PatientChartTabsProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("overview");

  const tabs: Array<{ key: TabKey; label: string; icon: string; count?: number }> = [
    { key: "overview", label: "Demographics / Overview", icon: "identification-card" },
    { key: "odontogram", label: "Dental Odontogram", icon: "tooth" },
    { key: "plans", label: "Diagnosis & Treatment Plans", icon: "clipboard-text", count: counts.plans },
    { key: "rxs", label: "Prescriptions", icon: "first-aid-kit", count: counts.rxs },
    { key: "reports", label: "Reports & Imaging", icon: "file-image", count: counts.reports },
    { key: "appts", label: "Visit History", icon: "calendar-blank", count: counts.appts },
  ];

  return (
    <div className="chart-tabs-wrapper">
      {/* Navigation Tab Bar */}
      <div className="chart-tab-bar" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.key}
            className={`chart-tab-btn ${activeTab === tab.key ? "is-active" : ""}`}
            onClick={() => setActiveTab(tab.key)}
          >
            <i className={`ph ph-${tab.icon}`} aria-hidden="true" />
            <span>{tab.label}</span>
            {typeof tab.count === "number" && (
              <span className="chart-tab-badge">{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Panels */}
      <div className="chart-tab-content">
        <div key="tab-panel-overview" style={{ display: activeTab === "overview" ? "block" : "none" }}>
          {overviewContent}
        </div>
        <div key="tab-panel-odontogram" style={{ display: activeTab === "odontogram" ? "block" : "none" }}>
          {odontogramContent}
        </div>
        <div key="tab-panel-plans" style={{ display: activeTab === "plans" ? "block" : "none" }}>
          {plansContent}
        </div>
        <div key="tab-panel-rxs" style={{ display: activeTab === "rxs" ? "block" : "none" }}>
          {rxsContent}
        </div>
        <div key="tab-panel-reports" style={{ display: activeTab === "reports" ? "block" : "none" }}>
          {reportsContent}
        </div>
        <div key="tab-panel-appts" style={{ display: activeTab === "appts" ? "block" : "none" }}>
          {apptsContent}
        </div>
      </div>
    </div>
  );
}
