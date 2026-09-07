import { requireAdmin } from "@/lib/authz";
import { db } from "@/lib/db";
import { StaffManagementView, StaffAccountItem, StaffInviteItem } from "@/components/staff-management-view";

export const dynamic = "force-dynamic";

type Account = {
  id: string; email: string; role: string; name: string; specialty: string;
  created_at: Date; last_sign_in_at: Date | null; locked_until: Date | null; disabled_at: Date | null;
  live_sessions: number;
};
type Invite = { email: string; role: string; name: string; created_at: Date; expires_at: Date };

export default async function StaffPage() {
  await requireAdmin("/clinic/staff");
  const sql = db();

  const accounts = (await sql`
    SELECT a.id, a.email, a.role, c.name, c.specialty,
           a.created_at, a.last_sign_in_at, a.locked_until, a.disabled_at,
           (SELECT count(*)::int FROM sessions s
             WHERE s.account_id = a.id AND s.revoked_at IS NULL AND s.expires_at > now()) AS live_sessions
    FROM accounts a JOIN clinicians c ON c.id = a.clinician_id
    ORDER BY a.created_at
  `) as unknown as Account[];

  const invites = (await sql`
    SELECT i.email, i.role, c.name, i.created_at, i.expires_at
    FROM invites i JOIN clinicians c ON c.id = i.clinician_id
    WHERE i.accepted_at IS NULL AND i.revoked_at IS NULL AND i.expires_at > now()
    ORDER BY i.created_at DESC
  `) as unknown as Invite[];

  const formattedAccounts: StaffAccountItem[] = accounts.map((a) => ({
    id: a.id,
    email: a.email,
    role: a.role,
    name: a.name,
    specialty: a.specialty,
    created_at: a.created_at instanceof Date ? a.created_at.toISOString() : String(a.created_at),
    last_sign_in_at: a.last_sign_in_at ? (a.last_sign_in_at instanceof Date ? a.last_sign_in_at.toISOString() : String(a.last_sign_in_at)) : null,
    locked_until: a.locked_until ? (a.locked_until instanceof Date ? a.locked_until.toISOString() : String(a.locked_until)) : null,
    disabled_at: a.disabled_at ? (a.disabled_at instanceof Date ? a.disabled_at.toISOString() : String(a.disabled_at)) : null,
    live_sessions: a.live_sessions,
  }));

  const formattedInvites: StaffInviteItem[] = invites.map((i) => ({
    email: i.email,
    role: i.role,
    name: i.name,
    created_at: i.created_at instanceof Date ? i.created_at.toISOString() : String(i.created_at),
    expires_at: i.expires_at instanceof Date ? i.expires_at.toISOString() : String(i.expires_at),
  }));

  return (
    <>
      <header className="topbar"><h1>Staff</h1></header>

      <main className="page" id="main">
        <div className="alert alert-warning">
          <i className="ph ph-warning" aria-hidden="true" />
          <span>
            <strong>Registration is open.</strong> Anyone who reaches the sign-up page can
            create an account that reads every patient record. This list is the record of who
            has done so. To close registration, remove the /signup route and invite colleagues
            instead.
          </span>
        </div>

        <section className="panel">
          <StaffManagementView accounts={formattedAccounts} invites={formattedInvites} />
        </section>
      </main>
    </>
  );
}
