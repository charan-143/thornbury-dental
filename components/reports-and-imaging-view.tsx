"use client";

import { useState, useTransition, useRef, type MouseEvent, type ChangeEvent } from "react";
import {
  createReportAction,
  updateReportAction,
  toggleReportReleaseAction,
  deleteReportAction,
  type ClinicalFormState,
} from "@/actions/clinical";

export type ReportItem = {
  id: string;
  kind: string;
  title: string;
  summary: string;
  image: string | null;
  taken_at: Date | string;
  released_at: Date | string | null;
  clinician_id?: string | null;
  clinician_name?: string | null;
};

export type ClinicianItem = {
  id: string;
  name: string;
};

interface ReportsAndImagingViewProps {
  patientId: string;
  patientName: string;
  reports: ReportItem[];
  clinicians: ClinicianItem[];
}

const KINDS = [
  "All",
  "Radiograph",
  "Intraoral Photo",
  "Lab Report",
  "Chairside test",
  "Charting",
  "CBCT",
];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function formatDate(v: Date | string | null | undefined): string {
  if (!v) return "Date not recorded";
  const d = v instanceof Date ? v : new Date(v);
  if (isNaN(d.getTime())) return String(v);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function ReportsAndImagingView({
  patientId,
  patientName,
  reports,
  clinicians,
}: ReportsAndImagingViewProps) {
  const [isPending, startTransition] = useTransition();

  // Filters
  const [selectedKind, setSelectedKind] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [releaseFilter, setReleaseFilter] = useState<"all" | "released" | "held">("all");

  // Modals & Lightbox
  const [lightboxReport, setLightboxReport] = useState<ReportItem | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingReport, setEditingReport] = useState<ReportItem | null>(null);
  const [deletingReport, setDeletingReport] = useState<ReportItem | null>(null);

  // Form State
  const [formState, setFormState] = useState<ClinicalFormState>({});
  const [customImage, setCustomImage] = useState<string>("");

  // Lightbox Image Diagnostic Controls
  const [zoom, setZoom] = useState(1.0);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [isInverted, setIsInverted] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [showGrid, setShowGrid] = useState(false);

  // Lightbox Pan offset
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const resetLightboxControls = () => {
    setZoom(1.0);
    setBrightness(100);
    setContrast(100);
    setIsInverted(false);
    setRotation(0);
    setShowGrid(false);
    setPan({ x: 0, y: 0 });
  };

  const openLightbox = (report: ReportItem) => {
    resetLightboxControls();
    setLightboxReport(report);
  };

  // Filtered reports calculation
  const filteredReports = reports.filter((r) => {
    if (selectedKind !== "All" && r.kind.toLowerCase() !== selectedKind.toLowerCase()) {
      return false;
    }
    if (releaseFilter === "released" && !r.released_at) return false;
    if (releaseFilter === "held" && r.released_at) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = r.title.toLowerCase().includes(q);
      const matchSummary = r.summary.toLowerCase().includes(q);
      const matchKind = r.kind.toLowerCase().includes(q);
      const matchClinician = (r.clinician_name || "").toLowerCase().includes(q);
      if (!matchTitle && !matchSummary && !matchKind && !matchClinician) return false;
    }

    return true;
  });

  // Handle Drag / Pan in Lightbox
  const handleMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Image Upload File Handler
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        if (evt.target?.result) {
          setCustomImage(String(evt.target.result));
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Server action dispatchers
  const handleCreateSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    if (customImage) {
      formData.set("image", customImage);
    }
    startTransition(async () => {
      const res = await createReportAction({}, formData);
      setFormState(res);
      if (res.success) {
        setIsCreateOpen(false);
        setCustomImage("");
        setFormState({});
      }
    });
  };

  const handleUpdateSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    if (customImage) {
      formData.set("image", customImage);
    }
    startTransition(async () => {
      const res = await updateReportAction({}, formData);
      setFormState(res);
      if (res.success) {
        setEditingReport(null);
        setCustomImage("");
        setFormState({});
      }
    });
  };

  const handleToggleRelease = (report: ReportItem) => {
    const formData = new FormData();
    formData.append("reportId", report.id);
    formData.append("patientId", patientId);

    startTransition(async () => {
      await toggleReportReleaseAction(formData);
      if (lightboxReport && lightboxReport.id === report.id) {
        setLightboxReport((prev) =>
          prev
            ? {
                ...prev,
                released_at: prev.released_at ? null : new Date().toISOString(),
              }
            : null
        );
      }
    });
  };

  const handleDeleteSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!deletingReport) return;
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      await deleteReportAction(formData);
      setDeletingReport(null);
      if (lightboxReport?.id === deletingReport.id) {
        setLightboxReport(null);
      }
    });
  };

  return (
    <div className="reports-imaging-container" style={{ display: "grid", gap: 24 }}>
      {/* Top Header & Actions Bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <div>
          <h2 style={{ font: "var(--title-lg)", color: "var(--ink)", margin: 0 }}>
            Reports & Diagnostic Imaging
          </h2>
          <p className="meta" style={{ margin: "4px 0 0 0" }}>
            View radiographs, intraoral scans, lab tests, and manage patient release permissions.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            setFormState({});
            setCustomImage("");
            setIsCreateOpen(true);
          }}
        >
          <i className="ph ph-cloud-arrow-up" aria-hidden="true" />
          <span>Upload / Add Imaging Report</span>
        </button>
      </div>

      {/* Filter and Search Section */}
      <div className="card card-soft" style={{ display: "grid", gap: 16, padding: 16 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
          {/* Category Tabs */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {KINDS.map((kind) => (
              <button
                key={kind}
                type="button"
                className={`btn btn-sm ${
                  selectedKind === kind ? "btn-primary" : "btn-secondary"
                }`}
                onClick={() => setSelectedKind(kind)}
              >
                {kind}
              </button>
            ))}
          </div>

          <div style={{ marginLeft: "auto", display: "flex", gap: 12, flexWrap: "wrap" }}>
            {/* Search Input */}
            <div style={{ position: "relative", minWidth: 220 }}>
              <i
                className="ph ph-magnifying-glass"
                style={{
                  position: "absolute",
                  left: 10,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--muted)",
                }}
                aria-hidden="true"
              />
              <input
                type="text"
                className="input"
                style={{ paddingLeft: 32, minHeight: 36, fontSize: "0.875rem" }}
                placeholder="Search reports..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Release Status Filter */}
            <select
              className="select"
              style={{ width: "auto", minHeight: 36, fontSize: "0.875rem" }}
              value={releaseFilter}
              onChange={(e) => setReleaseFilter(e.target.value as any)}
            >
              <option value="all">All Release States</option>
              <option value="released">Released to Patient</option>
              <option value="held">Held for Review</option>
            </select>
          </div>
        </div>
      </div>

      {/* Reports Grid Listing */}
      {filteredReports.length > 0 ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: 20,
          }}
        >
          {filteredReports.map((report) => (
            <div
              key={report.id}
              className="card"
              style={{
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                border: "1px solid var(--hairline)",
                transition: "box-shadow 0.2s var(--ease)",
              }}
            >
              {/* Image Preview Thumbnail */}
              <div
                style={{
                  position: "relative",
                  height: 180,
                  backgroundColor: "var(--surface-dark)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: report.image ? "pointer" : "default",
                  overflow: "hidden",
                }}
                onClick={() => report.image && openLightbox(report)}
              >
                {report.image ? (
                  <img
                    src={report.image}
                    alt={report.title}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      transition: "transform 0.3s var(--ease)",
                    }}
                  />
                ) : (
                  <div style={{ textAlign: "center", color: "var(--on-dark-soft)", padding: 16 }}>
                    <i className="ph ph-file-text" style={{ fontSize: 40, opacity: 0.6 }} />
                    <p style={{ margin: "4px 0 0 0", font: "var(--caption)" }}>Document / Non-Image Record</p>
                  </div>
                )}

                {/* Badges on Thumbnail */}
                <div
                  style={{
                    position: "absolute",
                    top: 10,
                    left: 10,
                    display: "flex",
                    gap: 6,
                  }}
                >
                  <span className="badge badge-info">{report.kind}</span>
                </div>

                <div
                  style={{
                    position: "absolute",
                    top: 10,
                    right: 10,
                  }}
                >
                  {report.released_at ? (
                    <span className="badge badge-success">Released</span>
                  ) : (
                    <span className="badge badge-warning">Held</span>
                  )}
                </div>

                {report.image && (
                  <div
                    style={{
                      position: "absolute",
                      bottom: 8,
                      right: 8,
                      backgroundColor: "rgba(0,0,0,0.7)",
                      color: "#fff",
                      borderRadius: "var(--r-xs)",
                      padding: "4px 8px",
                      fontSize: "0.75rem",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <i className="ph ph-arrows-out-simple" aria-hidden="true" />
                    <span>Open Lightbox</span>
                  </div>
                )}
              </div>

              {/* Card Body Details */}
              <div style={{ padding: 16, display: "flex", flexDirection: "column", flex: 1, gap: 8 }}>
                <h3
                  style={{
                    font: "var(--title-sm)",
                    color: "var(--ink)",
                    margin: 0,
                    lineHeight: 1.3,
                  }}
                >
                  {report.title}
                </h3>

                <p
                  className="meta"
                  style={{
                    margin: 0,
                    fontSize: "0.875rem",
                    display: "-webkit-box",
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                    flex: 1,
                  }}
                >
                  {report.summary}
                </p>

                <div
                  style={{
                    fontSize: "0.75rem",
                    color: "var(--muted)",
                    display: "flex",
                    justifyContent: "space-between",
                    borderTop: "1px solid var(--hairline-soft)",
                    paddingTop: 10,
                    marginTop: 4,
                  }}
                >
                  <span>
                    <i className="ph ph-calendar" aria-hidden="true" style={{ marginRight: 4 }} />
                    {formatDate(report.taken_at)}
                  </span>
                  <span>
                    <i className="ph ph-user-md" aria-hidden="true" style={{ marginRight: 4 }} />
                    {report.clinician_name || "Clinician"}
                  </span>
                </div>

                {/* Card Action Buttons */}
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    marginTop: 8,
                    alignItems: "center",
                  }}
                >
                  {report.image && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ flex: 1 }}
                      onClick={() => openLightbox(report)}
                    >
                      <i className="ph ph-eye" aria-hidden="true" /> View
                    </button>
                  )}

                  <button
                    type="button"
                    className={`btn btn-sm ${report.released_at ? "btn-secondary" : "btn-primary"}`}
                    title={report.released_at ? "Hold for review" : "Release to patient portal"}
                    disabled={isPending}
                    onClick={() => handleToggleRelease(report)}
                  >
                    <i
                      className={`ph ph-${report.released_at ? "lock" : "lock-key-open"}`}
                      aria-hidden="true"
                    />
                    <span>{report.released_at ? "Hold" : "Release"}</span>
                  </button>

                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    title="Edit report"
                    onClick={() => {
                      setFormState({});
                      setCustomImage("");
                      setEditingReport(report);
                    }}
                  >
                    <i className="ph ph-pencil-simple" aria-hidden="true" />
                  </button>

                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    title="Delete report"
                    style={{ color: "var(--error)" }}
                    onClick={() => setDeletingReport(report)}
                  >
                    <i className="ph ph-trash" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div
          className="panel"
          style={{
            textAlign: "center",
            padding: "48px 24px",
            backgroundColor: "var(--surface-soft)",
            borderRadius: "var(--r-card)",
          }}
        >
          <i
            className="ph ph-file-x"
            style={{ fontSize: 48, color: "var(--muted)", marginBottom: 12 }}
            aria-hidden="true"
          />
          <h3 style={{ font: "var(--title-md)", color: "var(--ink)", margin: "0 0 6px 0" }}>
            No reports or diagnostic imaging found
          </h3>
          <p className="meta" style={{ maxWidth: 420, margin: "0 auto 20px auto" }}>
            No records matched your selected category or search filters. You can upload new radiographs, lab reports, or intraoral photos for this patient.
          </p>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => {
              setFormState({});
              setCustomImage("");
              setIsCreateOpen(true);
            }}
          >
            <i className="ph ph-plus" aria-hidden="true" /> Add First Report / X-Ray
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* INTERACTIVE LIGHTBOX RADIOGRAPH / MEDICAL IMAGING VIEWER                  */}
      {/* ========================================================================= */}
      {lightboxReport && (
        <div
          className="modal-scrim"
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9990,
            backgroundColor: "rgba(0, 0, 0, 0.88)",
            backdropFilter: "blur(6px)",
            display: "flex",
            flexDirection: "column",
            padding: 0,
          }}
        >
          {/* Lightbox Top Navigation Bar */}
          <div
            style={{
              height: 60,
              padding: "0 20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderBottom: "1px solid rgba(255, 255, 255, 0.15)",
              color: "#fff",
              backgroundColor: "var(--surface-dark)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <i className="ph ph-file-image" style={{ fontSize: 24, color: "var(--primary)" }} />
              <div>
                <strong style={{ fontSize: "1rem", color: "#fff" }}>{lightboxReport.title}</strong>
                <span style={{ fontSize: "0.75rem", color: "var(--on-dark-soft)", marginLeft: 12 }}>
                  {lightboxReport.kind} • {formatDate(lightboxReport.taken_at)}
                </span>
              </div>
            </div>

            {/* Quick Diagnostic Controls in Top Bar */}
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button
                type="button"
                className={`btn btn-sm ${isInverted ? "btn-primary" : "btn-secondary"}`}
                style={{ height: 36, padding: "0 12px" }}
                onClick={() => setIsInverted(!isInverted)}
                title="Invert color / Negate X-Ray (Black/White reversal for root canal analysis)"
              >
                <i className="ph ph-square-half" aria-hidden="true" />
                <span>{isInverted ? "Inverted (On)" : "Invert Color"}</span>
              </button>

              <button
                type="button"
                className={`btn btn-sm ${showGrid ? "btn-primary" : "btn-secondary"}`}
                style={{ height: 36, padding: "0 12px" }}
                onClick={() => setShowGrid(!showGrid)}
                title="Toggle Measurement Grid Overlay"
              >
                <i className="ph ph-grid-four" aria-hidden="true" />
                <span>Grid</span>
              </button>

              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ height: 36, padding: "0 12px" }}
                onClick={resetLightboxControls}
                title="Reset zoom and filters"
              >
                <i className="ph ph-arrows-counter-clockwise" aria-hidden="true" />
                <span>Reset</span>
              </button>

              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{
                  height: 36,
                  width: 36,
                  padding: 0,
                  borderRadius: "50%",
                  color: "#fff",
                }}
                onClick={() => setLightboxReport(null)}
                aria-label="Close lightbox"
              >
                <i className="ph ph-x" style={{ fontSize: 20 }} aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Main Lightbox Body Split View: Canvas + Drawer */}
          <div style={{ flex: 1, display: "flex", overflow: "hidden", position: "relative" }}>
            {/* Image Manipulation Canvas Viewport */}
            <div
              style={{
                flex: 1,
                position: "relative",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                cursor: isDragging ? "grabbing" : "grab",
                userSelect: "none",
              }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              {/* Optional Grid Overlay */}
              {showGrid && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    pointerEvents: "none",
                    backgroundImage: `
                      linear-gradient(to right, rgba(255,255,255,0.12) 1px, transparent 1px),
                      linear-gradient(to bottom, rgba(255,255,255,0.12) 1px, transparent 1px)
                    `,
                    backgroundSize: "40px 40px",
                    zIndex: 10,
                  }}
                />
              )}

              {lightboxReport.image ? (
                <img
                  src={lightboxReport.image}
                  alt={lightboxReport.title}
                  draggable={false}
                  style={{
                    maxHeight: "85%",
                    maxWidth: "85%",
                    objectFit: "contain",
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) rotate(${rotation}deg)`,
                    filter: `brightness(${brightness}%) contrast(${contrast}%) ${
                      isInverted ? "invert(1)" : ""
                    }`,
                    transition: isDragging ? "none" : "transform 0.15s ease-out, filter 0.15s ease-out",
                  }}
                />
              ) : (
                <div style={{ color: "#fff", textAlign: "center" }}>
                  <i className="ph ph-file-text" style={{ fontSize: 64, opacity: 0.5 }} />
                  <p>No preview image attached to this report.</p>
                </div>
              )}

              {/* Floating Bottom Control Bar for Zoom & Filter Adjustments */}
              <div
                style={{
                  position: "absolute",
                  bottom: 24,
                  left: "50%",
                  transform: "translateX(-50%)",
                  backgroundColor: "rgba(20, 20, 20, 0.88)",
                  backdropFilter: "blur(10px)",
                  padding: "10px 20px",
                  borderRadius: "var(--r-pill)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  display: "flex",
                  alignItems: "center",
                  gap: 20,
                  color: "#fff",
                  boxShadow: "var(--shadow-lg)",
                  zIndex: 20,
                }}
              >
                {/* Zoom Controls */}
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button
                    type="button"
                    style={{
                      background: "none",
                      border: "none",
                      color: "#fff",
                      cursor: "pointer",
                      padding: 4,
                    }}
                    onClick={() => setZoom((z) => Math.max(0.5, z - 0.2))}
                    title="Zoom Out"
                  >
                    <i className="ph ph-magnifying-glass-minus" style={{ fontSize: 18 }} />
                  </button>
                  <span style={{ fontSize: "0.85rem", width: 44, textAlign: "center" }}>
                    {Math.round(zoom * 100)}%
                  </span>
                  <button
                    type="button"
                    style={{
                      background: "none",
                      border: "none",
                      color: "#fff",
                      cursor: "pointer",
                      padding: 4,
                    }}
                    onClick={() => setZoom((z) => Math.min(4.0, z + 0.2))}
                    title="Zoom In"
                  >
                    <i className="ph ph-magnifying-glass-plus" style={{ fontSize: 18 }} />
                  </button>
                </div>

                <div style={{ width: 1, height: 20, backgroundColor: "rgba(255,255,255,0.2)" }} />

                {/* Brightness Slider */}
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <i className="ph ph-sun" style={{ fontSize: 16, color: "var(--on-dark-soft)" }} title="Brightness" />
                  <input
                    type="range"
                    min="30"
                    max="200"
                    value={brightness}
                    onChange={(e) => setBrightness(Number(e.target.value))}
                    style={{ width: 80, accentColor: "var(--primary)" }}
                  />
                  <span style={{ fontSize: "0.75rem", width: 36, color: "var(--on-dark-soft)" }}>{brightness}%</span>
                </div>

                {/* Contrast Slider */}
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <i
                    className="ph ph-circle-half-tilt"
                    style={{ fontSize: 16, color: "var(--on-dark-soft)" }}
                    title="Contrast"
                  />
                  <input
                    type="range"
                    min="30"
                    max="200"
                    value={contrast}
                    onChange={(e) => setContrast(Number(e.target.value))}
                    style={{ width: 80, accentColor: "var(--primary)" }}
                  />
                  <span style={{ fontSize: "0.75rem", width: 36, color: "var(--on-dark-soft)" }}>{contrast}%</span>
                </div>

                <div style={{ width: 1, height: 20, backgroundColor: "rgba(255,255,255,0.2)" }} />

                {/* Rotation Control */}
                <button
                  type="button"
                  style={{
                    background: "none",
                    border: "none",
                    color: "#fff",
                    cursor: "pointer",
                    padding: 4,
                  }}
                  onClick={() => setRotation((r) => (r + 90) % 360)}
                  title="Rotate 90 deg"
                >
                  <i className="ph ph-arrows-clockwise" style={{ fontSize: 18 }} />
                </button>
              </div>
            </div>

            {/* Right Drawer: Diagnostic Report & Notes Details */}
            <div
              style={{
                width: 360,
                backgroundColor: "var(--surface-dark-elevated)",
                borderLeft: "1px solid rgba(255, 255, 255, 0.12)",
                padding: 24,
                display: "flex",
                flexDirection: "column",
                gap: 20,
                color: "var(--on-dark)",
                overflowY: "auto",
              }}
            >
              <div>
                <span className="badge badge-info" style={{ marginBottom: 8 }}>
                  {lightboxReport.kind}
                </span>
                <h3 style={{ font: "var(--title-md)", color: "#fff", margin: "4px 0 8px 0" }}>
                  {lightboxReport.title}
                </h3>
                <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--on-dark-soft)" }}>
                  Taken on {formatDate(lightboxReport.taken_at)} by{" "}
                  <strong>{lightboxReport.clinician_name || "Clinician"}</strong>
                </p>
              </div>

              <div
                style={{
                  padding: 16,
                  borderRadius: "var(--r-control)",
                  backgroundColor: "rgba(255, 255, 255, 0.05)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                }}
              >
                <h4 style={{ fontSize: "0.85rem", color: "var(--primary)", margin: "0 0 8px 0" }}>
                  Diagnostic Summary & Findings
                </h4>
                <p style={{ margin: 0, fontSize: "0.9rem", lineHeight: 1.6, color: "var(--on-dark)" }}>
                  {lightboxReport.summary}
                </p>
              </div>

              {/* Release Status & Actions */}
              <div
                style={{
                  padding: 16,
                  borderRadius: "var(--r-control)",
                  backgroundColor: "rgba(255, 255, 255, 0.03)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  display: "grid",
                  gap: 12,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "0.85rem", color: "var(--on-dark-soft)" }}>Portal Release</span>
                  {lightboxReport.released_at ? (
                    <span className="badge badge-success">Released</span>
                  ) : (
                    <span className="badge badge-warning">Held for Review</span>
                  )}
                </div>

                <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--on-dark-soft)" }}>
                  {lightboxReport.released_at
                    ? `Released on ${formatDate(lightboxReport.released_at)}. Visible in patient portal.`
                    : "Held internally for clinician evaluation before patient access."}
                </p>

                <button
                  type="button"
                  className={`btn ${lightboxReport.released_at ? "btn-secondary" : "btn-primary"}`}
                  disabled={isPending}
                  onClick={() => handleToggleRelease(lightboxReport)}
                >
                  <i
                    className={`ph ph-${lightboxReport.released_at ? "lock" : "lock-key-open"}`}
                    aria-hidden="true"
                  />
                  <span>
                    {lightboxReport.released_at ? "Hold Report for Review" : "Release Report to Patient"}
                  </span>
                </button>
              </div>

              <div style={{ marginTop: "auto", display: "grid", gap: 10 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    window.print();
                  }}
                >
                  <i className="ph ph-printer" aria-hidden="true" />
                  <span>Print Report Summary</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CREATE REPORT MODAL                                                       */}
      {/* ========================================================================= */}
      {isCreateOpen && (
        <div className="modal-scrim" role="dialog" aria-modal="true">
          <div
            className="modal"
            style={{
              maxWidth: 640,
              width: "95vw",
              maxHeight: "90dvh",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            <div
              className="modal-head"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "var(--s-md) var(--s-lg)",
                borderBottom: "1px solid var(--hairline)",
                background: "var(--surface-soft)",
              }}
            >
              <div>
                <h2 style={{ margin: 0, font: "var(--title-md)", color: "var(--ink)" }}>
                  Add New Report / Radiograph
                </h2>
                <p className="meta" style={{ margin: "2px 0 0" }}>
                  Patient: <strong>{patientName}</strong>
                </p>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setIsCreateOpen(false)}
                aria-label="Close modal"
              >
                <i className="ph ph-x" aria-hidden="true" style={{ fontSize: 20 }} />
              </button>
            </div>

            <form
              onSubmit={handleCreateSubmit}
              style={{
                display: "flex",
                flexDirection: "column",
                flex: 1,
                overflowY: "auto",
              }}
            >
              <div className="modal-body">
                <input type="hidden" name="patientId" value={patientId} />

                {formState.error && (
                  <div className="alert alert-error">
                    <i className="ph ph-warning-circle" aria-hidden="true" />
                    <span>{formState.error}</span>
                  </div>
                )}

                <div className="field">
                  <label htmlFor="rep-title">
                    Report / Radiograph Title <span className="req">*</span>
                  </label>
                  <input
                    id="rep-title"
                    name="title"
                    type="text"
                    className="input"
                    placeholder="e.g., Periapical radiograph, tooth 36"
                    required
                  />
                </div>

                <div className="cols-2">
                  <div className="field">
                    <label htmlFor="rep-kind">
                      Category / Kind <span className="req">*</span>
                    </label>
                    <select id="rep-kind" name="kind" className="select" defaultValue="Radiograph">
                      <option value="Radiograph">Radiograph (X-Ray)</option>
                      <option value="Intraoral Photo">Intraoral Photo</option>
                      <option value="Lab Report">Lab Report</option>
                      <option value="Chairside test">Chairside Test</option>
                      <option value="Charting">Periodontal Charting</option>
                      <option value="CBCT">CBCT 3D Scan</option>
                    </select>
                  </div>

                  <div className="field">
                    <label htmlFor="rep-clinician">Attending Clinician</label>
                    <select id="rep-clinician" name="clinicianId" className="select">
                      {clinicians.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="field">
                  <label htmlFor="rep-summary">
                    Diagnostic Findings & Summary Notes <span className="req">*</span>
                  </label>
                  <textarea
                    id="rep-summary"
                    name="summary"
                    className="textarea"
                    rows={4}
                    placeholder="Describe periapical radiolucencies, bone loss, pulp vitality, or lab test values..."
                    required
                  />
                </div>

                {/* Image Selection Section */}
                <div className="field">
                  <label>Imaging File / Photo</label>
                  <div style={{ display: "grid", gap: 10 }}>
                    <input
                      type="file"
                      accept="image/*"
                      className="input"
                      style={{ padding: 6, height: "auto" }}
                      onChange={handleFileChange}
                    />

                    <input
                      type="text"
                      name="image"
                      className="input"
                      placeholder="Or paste image URL (https://...)"
                      value={customImage}
                      onChange={(e) => setCustomImage(e.target.value)}
                    />
                  </div>
                </div>

                <div className="cols-2">
                  <div className="field">
                    <label htmlFor="rep-takenAt">Date Taken</label>
                    <input
                      id="rep-takenAt"
                      name="takenAt"
                      type="date"
                      className="input"
                      defaultValue={new Date().toISOString().split("T")[0]}
                    />
                  </div>

                  <div className="field" style={{ justifyContent: "flex-end" }}>
                    <label className="checkline" style={{ cursor: "pointer", marginTop: 24 }}>
                      <input
                        type="checkbox"
                        name="releaseImmediately"
                        value="true"
                        defaultChecked={false}
                      />
                      <span>Release to Patient Portal immediately</span>
                    </label>
                  </div>
                </div>
              </div>

              <div
                className="modal-foot"
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  alignItems: "center",
                  gap: "var(--s-xs)",
                  padding: "var(--s-md) var(--s-lg)",
                  borderTop: "1px solid var(--hairline)",
                  background: "var(--surface-soft)",
                }}
              >
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsCreateOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isPending}>
                  {isPending ? "Saving..." : "Create Report"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* EDIT REPORT MODAL                                                         */}
      {/* ========================================================================= */}
      {editingReport && (
        <div className="modal-scrim" role="dialog" aria-modal="true">
          <div
            className="modal"
            style={{
              maxWidth: 640,
              width: "95vw",
              maxHeight: "90dvh",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            <div
              className="modal-head"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "var(--s-md) var(--s-lg)",
                borderBottom: "1px solid var(--hairline)",
                background: "var(--surface-soft)",
              }}
            >
              <div>
                <h2 style={{ margin: 0, font: "var(--title-md)", color: "var(--ink)" }}>
                  Edit Clinical Report
                </h2>
                <p className="meta" style={{ margin: "2px 0 0" }}>
                  Patient: <strong>{patientName}</strong>
                </p>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setEditingReport(null)}
                aria-label="Close modal"
              >
                <i className="ph ph-x" aria-hidden="true" style={{ fontSize: 20 }} />
              </button>
            </div>

            <form
              onSubmit={handleUpdateSubmit}
              style={{
                display: "flex",
                flexDirection: "column",
                flex: 1,
                overflowY: "auto",
              }}
            >
              <div className="modal-body">
                <input type="hidden" name="reportId" value={editingReport.id} />
                <input type="hidden" name="patientId" value={patientId} />

                {formState.error && (
                  <div className="alert alert-error">
                    <i className="ph ph-warning-circle" aria-hidden="true" />
                    <span>{formState.error}</span>
                  </div>
                )}

                <div className="field">
                  <label htmlFor="edit-title">
                    Report Title <span className="req">*</span>
                  </label>
                  <input
                    id="edit-title"
                    name="title"
                    type="text"
                    className="input"
                    defaultValue={editingReport.title}
                    required
                  />
                </div>

                <div className="cols-2">
                  <div className="field">
                    <label htmlFor="edit-kind">
                      Category / Kind <span className="req">*</span>
                    </label>
                    <select
                      id="edit-kind"
                      name="kind"
                      className="select"
                      defaultValue={editingReport.kind}
                    >
                      <option value="Radiograph">Radiograph (X-Ray)</option>
                      <option value="Intraoral Photo">Intraoral Photo</option>
                      <option value="Lab Report">Lab Report</option>
                      <option value="Chairside test">Chairside Test</option>
                      <option value="Charting">Periodontal Charting</option>
                      <option value="CBCT">CBCT 3D Scan</option>
                    </select>
                  </div>

                  <div className="field">
                    <label htmlFor="edit-clinician">Attending Clinician</label>
                    <select
                      id="edit-clinician"
                      name="clinicianId"
                      className="select"
                      defaultValue={editingReport.clinician_id || ""}
                    >
                      {clinicians.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="field">
                  <label htmlFor="edit-summary">
                    Diagnostic Findings & Summary Notes <span className="req">*</span>
                  </label>
                  <textarea
                    id="edit-summary"
                    name="summary"
                    className="textarea"
                    rows={4}
                    defaultValue={editingReport.summary}
                    required
                  />
                </div>

                <div className="field">
                  <label>Image URL / Data</label>
                  <input
                    type="text"
                    name="image"
                    className="input"
                    placeholder="https://..."
                    defaultValue={customImage || editingReport.image || ""}
                    onChange={(e) => setCustomImage(e.target.value)}
                  />
                </div>

                <div className="cols-2">
                  <div className="field">
                    <label htmlFor="edit-takenAt">Date Taken</label>
                    <input
                      id="edit-takenAt"
                      name="takenAt"
                      type="date"
                      className="input"
                      defaultValue={
                        editingReport.taken_at
                          ? new Date(editingReport.taken_at).toISOString().split("T")[0]
                          : ""
                      }
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="edit-release">Patient Portal Release Status</label>
                    <select
                      id="edit-release"
                      name="releaseStatus"
                      className="select"
                      defaultValue={editingReport.released_at ? "released" : "held"}
                    >
                      <option value="released">Released to Patient Portal</option>
                      <option value="held">Held for Clinician Review</option>
                    </select>
                  </div>
                </div>
              </div>

              <div
                className="modal-foot"
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  alignItems: "center",
                  gap: "var(--s-xs)",
                  padding: "var(--s-md) var(--s-lg)",
                  borderTop: "1px solid var(--hairline)",
                  background: "var(--surface-soft)",
                }}
              >
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setEditingReport(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isPending}>
                  {isPending ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DELETE REPORT MODAL                                                       */}
      {/* ========================================================================= */}
      {deletingReport && (
        <div className="modal-scrim" role="dialog" aria-modal="true">
          <div
            className="modal"
            style={{
              maxWidth: 480,
              width: "95vw",
            }}
          >
            <div
              className="modal-head"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "var(--s-md) var(--s-lg)",
                borderBottom: "1px solid var(--hairline)",
                background: "var(--surface-soft)",
              }}
            >
              <h2 style={{ margin: 0, font: "var(--title-md)", color: "var(--ink)" }}>
                Confirm Delete Report
              </h2>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setDeletingReport(null)}
                aria-label="Close modal"
              >
                <i className="ph ph-x" aria-hidden="true" style={{ fontSize: 20 }} />
              </button>
            </div>

            <form onSubmit={handleDeleteSubmit}>
              <div className="modal-body">
                <input type="hidden" name="reportId" value={deletingReport.id} />
                <input type="hidden" name="patientId" value={patientId} />

                <div className="alert alert-warning">
                  <i className="ph ph-warning" aria-hidden="true" />
                  <span>This action cannot be undone.</span>
                </div>

                <p style={{ margin: 0, font: "var(--body-md)", color: "var(--ink)" }}>
                  Are you sure you want to delete the report record{" "}
                  <strong>"{deletingReport.title}"</strong>?
                </p>
              </div>

              <div
                className="modal-foot"
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  alignItems: "center",
                  gap: "var(--s-xs)",
                  padding: "var(--s-md) var(--s-lg)",
                  borderTop: "1px solid var(--hairline)",
                  background: "var(--surface-soft)",
                }}
              >
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setDeletingReport(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ backgroundColor: "var(--error)", borderColor: "var(--error)" }}
                  disabled={isPending}
                >
                  {isPending ? "Deleting..." : "Delete Permanently"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
