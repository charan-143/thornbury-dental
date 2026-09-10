"use client";

import { useState } from "react";
import Link from "next/link";

export function PublicHeader() {
  const [isOpen, setIsOpen] = useState(false);

  const closeMenu = () => setIsOpen(false);

  return (
    <header className="nav">
      <div className="wrap nav-inner">
        <Link className="brand" href="/" onClick={closeMenu}>
          <span className="brand-mark"><i className="ph-fill ph-tooth" aria-hidden="true" /></span>
          <span className="brand-name">Thornbury Dental</span>
        </Link>

        {/* Desktop Links & Mobile Slide-down Drawer */}
        <nav
          className={`nav-links ${isOpen ? "is-open" : ""}`}
          aria-label="Main navigation"
          hidden={!isOpen}
        >
          <a href="#care" onClick={closeMenu}>Care</a>
          <a href="#team" onClick={closeMenu}>Clinicians</a>
          <a href="#visit" onClick={closeMenu}>Visiting us</a>
          <div className="nav-mobile-cta">
            <Link className="btn btn-primary btn-block btn-sm" href="/signin" onClick={closeMenu}>
              Staff sign in
            </Link>
          </div>
        </nav>

        <div className="nav-actions">
          <Link className="btn btn-primary btn-cta" href="/signin">Staff sign in</Link>
          <button
            type="button"
            className="icon-btn nav-toggle"
            aria-label={isOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={isOpen}
            onClick={() => setIsOpen((prev) => !prev)}
          >
            <i className={`ph ph-${isOpen ? "x" : "list"}`} aria-hidden="true" style={{ fontSize: "1.25rem" }} />
          </button>
        </div>
      </div>
    </header>
  );
}
