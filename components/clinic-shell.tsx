"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface ClinicShellProps {
  userName: string;
  userRole: string;
  userRoom?: string | null;
  userPhoto?: string | null;
  isAdmin: boolean;
  sections: ReadonlyArray<readonly [string, string, string]>;
  signOutAction: (formData: FormData) => Promise<void>;
  children: React.ReactNode;
}

export function ClinicShell({
  userName,
  userRole,
  userRoom,
  userPhoto,
  isAdmin,
  sections,
  signOutAction,
  children,
}: ClinicShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  // Automatically close mobile sidebar on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  return (
    <div className="app">
      {/* Mobile Top App Bar (visible on <= 900px) */}
      <div className="mobile-app-bar">
        <button
          type="button"
          className="icon-btn mobile-menu-btn"
          aria-label={sidebarOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={sidebarOpen}
          onClick={() => setSidebarOpen((prev) => !prev)}
        >
          <i className={`ph ph-${sidebarOpen ? "x" : "list"}`} aria-hidden="true" style={{ fontSize: "1.25rem" }} />
        </button>

        <Link className="mobile-brand" href="/clinic">
          <span className="brand-mark"><i className="ph-fill ph-tooth" aria-hidden="true" /></span>
          <span className="brand-name">Thornbury Dental</span>
        </Link>

        <div className="mobile-user-avatar">
          {userPhoto ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={userPhoto} alt="" width={28} height={28} style={{ borderRadius: "var(--r-pill)", objectFit: "cover" }} />
          ) : (
            <span className="avatar-initials">{userName.slice(0, 1)}</span>
          )}
        </div>
      </div>

      {/* Backdrop scrim for mobile drawer */}
      {sidebarOpen && (
        <div
          className="side-scrim"
          aria-hidden="true"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar Drawer */}
      <aside className={`side ${sidebarOpen ? "is-open" : ""}`}>
        <div className="side-brand-row">
          <Link className="side-brand" href="/">
            <span className="brand-mark"><i className="ph-fill ph-tooth" aria-hidden="true" /></span>
            <span>
              <span className="brand-name">Thornbury Dental</span>
              <span className="side-role">Clinical workspace</span>
            </span>
          </Link>
          <button
            type="button"
            className="icon-btn side-close-btn"
            aria-label="Close menu"
            onClick={() => setSidebarOpen(false)}
          >
            <i className="ph ph-x" aria-hidden="true" />
          </button>
        </div>

        <nav className="side-nav" aria-label="Workspace sections">
          {sections.map(([slug, glyph, label]) => {
            const href = slug ? `/clinic/${slug}` : "/clinic";
            const isCurrent = pathname === href;
            return (
              <Link
                key={label}
                href={href}
                prefetch={true}
                aria-current={isCurrent ? "page" : undefined}
                onClick={() => setSidebarOpen(false)}
              >
                <i className={`ph ph-${glyph}`} aria-hidden="true" />
                <span>{label}</span>
              </Link>
            );
          })}
          {isAdmin && (
            <Link
              href="/clinic/staff"
              prefetch={true}
              aria-current={pathname === "/clinic/staff" ? "page" : undefined}
              onClick={() => setSidebarOpen(false)}
            >
              <i className="ph ph-identification-badge" aria-hidden="true" />
              <span>Staff</span>
            </Link>
          )}
        </nav>

        <div className="side-foot">
          <div className="side-user">
            {userPhoto && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={userPhoto} alt="" width={34} height={34} />
            )}
            <div>
              <strong>{userName}</strong>
              <span>{userRole === "admin" ? "Administrator" : userRoom || "Clinician"}</span>
            </div>
          </div>
          <form action={signOutAction}>
            <button className="btn btn-secondary btn-block btn-sm" type="submit">
              <i className="ph ph-sign-out" aria-hidden="true" /> Sign out
            </button>
          </form>
        </div>
      </aside>

      <div className="main">{children}</div>
    </div>
  );
}
