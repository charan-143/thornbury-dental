"use client";

import { useState } from "react";

type LayerId = "all" | "enamel" | "dentin" | "pulp" | "bone";

interface LayerInfo {
  title: string;
  subtitle: string;
  description: string;
  treatments: string[];
  color: string;
}

const LAYER_DETAILS: Record<LayerId, LayerInfo> = {
  all: {
    title: "Lower First Molar Anatomy (Tooth #19 / 36)",
    subtitle: "Interactive Structural Overview",
    description:
      "A complete cross-section of a lower first molar showing outer enamel shield, dentin matrix, pulp chamber, root canals, and supporting alveolar bone.",
    treatments: [
      "Preventive Hygiene",
      "Diagnostic X-Rays",
      "Comprehensive Exams",
    ],
    color: "#0066cc",
  },
  enamel: {
    title: "Enamel Shield & Crown",
    subtitle: "Outer Protective Layer",
    description:
      "The hardest substance in the human body, protecting the inner tooth structures from masticatory forces and bacterial acid erosion.",
    treatments: [
      "Composite Fillings",
      "Ceramic Crowns",
      "Fluoride Varnish",
      "Fissure Sealants",
    ],
    color: "#38bdf8",
  },
  dentin: {
    title: "Dentin Matrix",
    subtitle: "Mineralized Core Structure",
    description:
      "A flexible, shock-absorbing mineralized tissue containing microscopic dentinal tubules that transmit sensory signals to the pulp.",
    treatments: [
      "Deep Restorations",
      "Desensitizing Therapy",
      "Indirect Pulp Capping",
    ],
    color: "#f59e0b",
  },
  pulp: {
    title: "Pulp Chamber & Root Canals",
    subtitle: "Vascular & Neural Center",
    description:
      "Houses the vital blood supply and nerve innervation. Inflammatory response here (pulpitis) requires root canal therapy.",
    treatments: [
      "Root Canal Therapy (Endodontics)",
      "Pulpotomy",
      "Post & Core Buildup",
    ],
    color: "#ef4444",
  },
  bone: {
    title: "Periodontal Ligament & Alveolar Bone",
    subtitle: "Supporting Anchorage",
    description:
      "The osseous foundation and periodontal fibers holding the roots securely in place within the mandible.",
    treatments: [
      "Periodontal Scaling",
      "Bone Grafting",
      "Dental Implant Placement",
    ],
    color: "#10b981",
  },
};

export function HeroDentalModel() {
  const [activeLayer, setActiveLayer] = useState<LayerId>("all");
  const [hoveredHotspot, setHoveredHotspot] = useState<string | null>(null);

  const info = LAYER_DETAILS[activeLayer];

  return (
    <div className="hero-model-card">
      <div className="hero-model-header">
        <div className="hero-model-badge">
          <i className="ph-fill ph-tooth" aria-hidden="true" />
          <span>Interactive Dental Anatomy</span>
        </div>
        <div className="hero-model-tabs" role="tablist" aria-label="Anatomical Layers">
          <button
            type="button"
            className={`hero-tab ${activeLayer === "all" ? "active" : ""}`}
            onClick={() => setActiveLayer("all")}
          >
            All Layers
          </button>
          <button
            type="button"
            className={`hero-tab ${activeLayer === "enamel" ? "active" : ""}`}
            onClick={() => setActiveLayer("enamel")}
          >
            Crown / Enamel
          </button>
          <button
            type="button"
            className={`hero-tab ${activeLayer === "dentin" ? "active" : ""}`}
            onClick={() => setActiveLayer("dentin")}
          >
            Dentin
          </button>
          <button
            type="button"
            className={`hero-tab ${activeLayer === "pulp" ? "active" : ""}`}
            onClick={() => setActiveLayer("pulp")}
          >
            Pulp & Canals
          </button>
          <button
            type="button"
            className={`hero-tab ${activeLayer === "bone" ? "active" : ""}`}
            onClick={() => setActiveLayer("bone")}
          >
            Jawbone Support
          </button>
        </div>
      </div>

      <div className="hero-model-body">
        <div className="hero-svg-wrapper">
          <svg
            viewBox="0 0 400 440"
            className="hero-tooth-svg"
            role="img"
            aria-label="Lower First Molar Anatomy Diagram"
          >
            <defs>
              <linearGradient id="enamelGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#e0f2fe" />
                <stop offset="100%" stopColor="#7dd3fc" />
              </linearGradient>
              <linearGradient id="dentinGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#fef3c7" />
                <stop offset="100%" stopColor="#fde047" />
              </linearGradient>
              <linearGradient id="pulpGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#fca5a5" />
                <stop offset="100%" stopColor="#ef4444" />
              </linearGradient>
              <linearGradient id="boneGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#e2e8f0" />
                <stop offset="100%" stopColor="#cbd5e1" />
              </linearGradient>

              <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Jawbone / Alveolar Foundation */}
            <path
              d="M 30 250 Q 70 230 140 235 T 260 235 Q 330 230 370 250 L 370 410 C 300 425 100 425 30 410 Z"
              fill="url(#boneGrad)"
              stroke="#94a3b8"
              strokeWidth="2"
              opacity={activeLayer === "all" || activeLayer === "bone" ? 0.95 : 0.25}
              className="tooth-part-transition"
              style={{ cursor: "pointer" }}
              onClick={() => setActiveLayer("bone")}
              onMouseEnter={() => setHoveredHotspot("Bone & Periodontium")}
              onMouseLeave={() => setHoveredHotspot(null)}
            />
            {/* Bone Texture Details */}
            <g opacity={activeLayer === "all" || activeLayer === "bone" ? 0.6 : 0.1}>
              <circle cx="80" cy="300" r="3" fill="#64748b" />
              <circle cx="120" cy="330" r="4" fill="#64748b" />
              <circle cx="150" cy="280" r="2.5" fill="#64748b" />
              <circle cx="250" cy="290" r="3.5" fill="#64748b" />
              <circle cx="290" cy="340" r="4" fill="#64748b" />
              <circle cx="330" cy="310" r="3" fill="#64748b" />
            </g>

            {/* Dentin Layer */}
            <path
              d="M 90 130 C 90 90, 110 50, 150 45 C 170 42, 190 55, 200 55 C 210 55, 230 42, 250 45 C 290 50, 310 90, 310 130 C 310 180, 290 270, 275 350 C 265 390, 245 390, 240 350 C 235 300, 215 200, 200 200 C 185 200, 165 300, 160 350 C 155 390, 135 390, 125 350 C 110 270, 90 180, 90 130 Z"
              fill="url(#dentinGrad)"
              stroke="#d97706"
              strokeWidth="2.5"
              opacity={activeLayer === "all" || activeLayer === "dentin" ? 1 : 0.25}
              className="tooth-part-transition"
              style={{ cursor: "pointer" }}
              onClick={() => setActiveLayer("dentin")}
              onMouseEnter={() => setHoveredHotspot("Dentin Matrix")}
              onMouseLeave={() => setHoveredHotspot(null)}
            />

            {/* Enamel Crown Shell */}
            <path
              d="M 80 130 C 80 80, 105 30, 150 25 C 175 22, 195 40, 200 40 C 205 40, 225 22, 250 25 C 295 30, 320 80, 320 130 C 320 150, 315 170, 310 185 C 300 150, 290 110, 250 55 C 230 50, 210 65, 200 65 C 190 65, 170 50, 150 55 C 110 110, 100 150, 90 185 C 85 170, 80 150, 80 130 Z"
              fill="url(#enamelGrad)"
              stroke="#0284c7"
              strokeWidth="2.5"
              opacity={activeLayer === "all" || activeLayer === "enamel" ? 1 : 0.25}
              className="tooth-part-transition"
              style={{ cursor: "pointer" }}
              onClick={() => setActiveLayer("enamel")}
              onMouseEnter={() => setHoveredHotspot("Enamel Crown")}
              onMouseLeave={() => setHoveredHotspot(null)}
            />

            {/* Occlusal Fissure Lines */}
            <path
              d="M 150 48 Q 200 70 250 48"
              fill="none"
              stroke="#0369a1"
              strokeWidth="2"
              strokeDasharray="3 3"
              opacity={activeLayer === "all" || activeLayer === "enamel" ? 0.8 : 0.1}
            />

            {/* Pulp Chamber & Root Canals */}
            <path
              d="M 140 120 C 140 100, 160 90, 200 90 C 240 90, 260 100, 260 120 C 260 140, 250 160, 245 200 C 240 240, 245 310, 242 340 C 240 350, 235 350, 234 340 C 230 290, 215 160, 200 160 C 185 160, 170 290, 166 340 C 165 350, 160 350, 158 340 C 155 310, 160 240, 155 200 C 150 160, 140 140, 140 120 Z"
              fill="url(#pulpGrad)"
              stroke="#b91c1c"
              strokeWidth="2"
              opacity={activeLayer === "all" || activeLayer === "pulp" ? 1 : 0.25}
              className="tooth-part-transition"
              style={{ cursor: "pointer" }}
              onClick={() => setActiveLayer("pulp")}
              onMouseEnter={() => setHoveredHotspot("Pulp & Root Canals")}
              onMouseLeave={() => setHoveredHotspot(null)}
            />

            {/* Interactive Pointer Hotspots */}
            <g className="hotspots">
              {/* Crown Hotspot */}
              <circle
                cx="200"
                cy="35"
                r="10"
                className={`hotspot-dot ${activeLayer === "enamel" ? "pulse" : ""}`}
                fill="#0284c7"
                stroke="#ffffff"
                strokeWidth="2"
                onClick={() => setActiveLayer("enamel")}
              />
              <text x="200" y="39" textAnchor="middle" fill="#ffffff" fontSize="10" fontWeight="bold">
                1
              </text>

              {/* Dentin Hotspot */}
              <circle
                cx="130"
                cy="110"
                r="10"
                className={`hotspot-dot ${activeLayer === "dentin" ? "pulse" : ""}`}
                fill="#d97706"
                stroke="#ffffff"
                strokeWidth="2"
                onClick={() => setActiveLayer("dentin")}
              />
              <text x="130" y="114" textAnchor="middle" fill="#ffffff" fontSize="10" fontWeight="bold">
                2
              </text>

              {/* Pulp Hotspot */}
              <circle
                cx="200"
                cy="125"
                r="10"
                className={`hotspot-dot ${activeLayer === "pulp" ? "pulse" : ""}`}
                fill="#ef4444"
                stroke="#ffffff"
                strokeWidth="2"
                onClick={() => setActiveLayer("pulp")}
              />
              <text x="200" y="129" textAnchor="middle" fill="#ffffff" fontSize="10" fontWeight="bold">
                3
              </text>

              {/* Bone Hotspot */}
              <circle
                cx="310"
                cy="300"
                r="10"
                className={`hotspot-dot ${activeLayer === "bone" ? "pulse" : ""}`}
                fill="#10b981"
                stroke="#ffffff"
                strokeWidth="2"
                onClick={() => setActiveLayer("bone")}
              />
              <text x="310" y="304" textAnchor="middle" fill="#ffffff" fontSize="10" fontWeight="bold">
                4
              </text>
            </g>
          </svg>

          {hoveredHotspot && (
            <div className="svg-hover-badge">
              <i className="ph ph-cursor" aria-hidden="true" /> {hoveredHotspot}
            </div>
          )}
        </div>

        <div className="hero-model-info">
          <div className="info-header" style={{ borderLeftColor: info.color }}>
            <span className="info-tag" style={{ backgroundColor: `${info.color}18`, color: info.color }}>
              {info.subtitle}
            </span>
            <h3>{info.title}</h3>
            <p>{info.description}</p>
          </div>

          <div className="info-treatments">
            <h4>Common Practice Procedures</h4>
            <ul>
              {info.treatments.map((tx) => (
                <li key={tx}>
                  <i className="ph-bold ph-check" style={{ color: info.color }} aria-hidden="true" />
                  <span>{tx}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="info-footer">
            <p className="meta-text">
              <i className="ph ph-info" aria-hidden="true" /> Click any tab or anatomical layer number above to inspect structural details.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
