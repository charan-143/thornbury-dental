"use client";

import { useState, useTransition, type ReactNode } from "react";

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
  const [, startTransition] = useTransition();

  const handleTabChange = (key: TabKey) => {
    startTransition(() => {
      setActiveTab(key);
    });
  };

  const tabs: Array<{ key: TabKey; label: string; icon: string; count?: number }> = [
    { key: "overview", label: "Demographics / Overview", icon: "identification-card" },
    { key: "odontogram", label: "Examination", icon: "tooth" },
    { key: "reports", label: "Reports & Imaging", icon: "file-image", count: counts.reports },
    { key: "plans", label: "Diagnosis and Treatment", icon: "clipboard-text", count: counts.plans },
    { key: "rxs", label: "Prescriptions", icon: "first-aid-kit", count: counts.rxs },
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
            aria-controls={`tab-panel-${tab.key}`}
            className={`chart-tab-btn ${activeTab === tab.key ? "is-active" : ""}`}
            onClick={() => handleTabChange(tab.key)}
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
        <div
          id="tab-panel-overview"
          role="tabpanel"
          hidden={activeTab !== "overview"}
          style={{
            display: activeTab === "overview" ? "block" : "none",
            contentVisibility: activeTab === "overview" ? "visible" : "hidden",
          }}
        >
          {overviewContent}
        </div>
        <div
          id="tab-panel-odontogram"
          role="tabpanel"
          hidden={activeTab !== "odontogram"}
          style={{
            display: activeTab === "odontogram" ? "block" : "none",
            contentVisibility: activeTab === "odontogram" ? "visible" : "hidden",
          }}
        >
          {odontogramContent}
        </div>
        <div
          id="tab-panel-reports"
          role="tabpanel"
          hidden={activeTab !== "reports"}
          style={{
            display: activeTab === "reports" ? "block" : "none",
            contentVisibility: activeTab === "reports" ? "visible" : "hidden",
          }}
        >
          {reportsContent}
        </div>
        <div
          id="tab-panel-plans"
          role="tabpanel"
          hidden={activeTab !== "plans"}
          style={{
            display: activeTab === "plans" ? "block" : "none",
            contentVisibility: activeTab === "plans" ? "visible" : "hidden",
          }}
        >
          {plansContent}
        </div>
        <div
          id="tab-panel-rxs"
          role="tabpanel"
          hidden={activeTab !== "rxs"}
          style={{
            display: activeTab === "rxs" ? "block" : "none",
            contentVisibility: activeTab === "rxs" ? "visible" : "hidden",
          }}
        >
          {rxsContent}
        </div>
        <div
          id="tab-panel-appts"
          role="tabpanel"
          hidden={activeTab !== "appts"}
          style={{
            display: activeTab === "appts" ? "block" : "none",
            contentVisibility: activeTab === "appts" ? "visible" : "hidden",
          }}
        >
          {apptsContent}
        </div>
      </div>
    </div>
  );
}
