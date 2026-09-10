import { requireStaff, isAdmin } from "@/lib/authz";
import { signOutAction } from "@/actions/auth";
import { ClinicShell } from "@/components/clinic-shell";

export const dynamic = "force-dynamic";

const SECTIONS = [
  ["", "house", "Today"],
  ["schedule", "calendar-check", "Schedule"],
  ["patients", "users-three", "Patients"],
  ["audit", "scroll", "Audit trail"],
] as const;

export default async function ClinicLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaff("/clinic");

  return (
    <ClinicShell
      userName={user.name}
      userRole={user.role}
      userRoom={user.room}
      userPhoto={user.photo}
      isAdmin={isAdmin(user)}
      sections={SECTIONS}
      signOutAction={signOutAction}
    >
      {children}
    </ClinicShell>
  );
}
