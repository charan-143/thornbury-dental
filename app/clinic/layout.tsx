import Link from "next/link";
import { requireStaff, isAdmin } from "@/lib/authz";
import { db } from "@/lib/db";
import { signOutAction } from "@/actions/auth";

/**
 * Clinical workspace shell.
 *
 * The guard sits on the layout so every route beneath it is covered without
 * each page remembering to check. Everyone who reaches here is practice staff;
 * the Staff section is the only part gated further, to administrators.
 */

export const dynamic = "force-dynamic";

const SECTIONS = [
  ["", "house", "Today"],
  ["schedule", "calendar-check", "Schedule"],
  ["patients", "users-three", "Patients"],
  ["audit", "scroll", "Audit trail"],
] as const;

type ClinicianRow = { id: string; name: string; room: string; photo: string | null };

export default async function ClinicLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaff("/clinic");

  const rows = (await db()`
    SELECT id, name, room, photo FROM clinicians WHERE id = ${user.clinicianId}
  `) as unknown as ClinicianRow[];
  const clinician = rows[0];

  if (!clinician) {
    return (
      <main className="wrap" id="main" style={{ paddingBlock: 64 }}>
        <h1>Profile unavailable</h1>
        <p className="meta" style={{ marginTop: 12 }}>
          This account is not linked to a clinician profile. Contact the practice administrator.
        </p>
      </main>
    );
  }

  return (
    <div className="app">
      <aside className="side">
        <Link className="side-brand" href="/">
          <span className="brand-mark"><i className="ph-fill ph-tooth" aria-hidden="true" /></span>
          <span>
            <span className="brand-name">Thornbury Dental</span>
            <span className="side-role">Clinical workspace</span>
          </span>
        </Link>

        <nav className="side-nav" aria-label="Workspace sections">
          {SECTIONS.map(([slug, glyph, label]) => (
            <Link key={label} href={`/clinic/${slug}`}>
              <i className={`ph ph-${glyph}`} aria-hidden="true" />
              <span>{label}</span>
            </Link>
          ))}
          {isAdmin(user) && (
            <Link href="/clinic/staff">
              <i className="ph ph-identification-badge" aria-hidden="true" />
              <span>Staff</span>
            </Link>
          )}
        </nav>

        <div className="side-foot">
          <div className="side-user">
            {clinician.photo && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={clinician.photo} alt="" width={34} height={34} />
            )}
            <div>
              <strong>{clinician.name}</strong>
              <span>{user.role === "admin" ? "Administrator" : clinician.room || "Clinician"}</span>
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
