import { redirect } from "next/navigation";
import { currentUser, type Role, type SessionUser } from "./auth";
import { record } from "./audit";

/**
 * Authorisation.
 *
 * The rule this file exists to enforce: no query for health information runs
 * without first establishing who is asking. Pages call these helpers rather
 * than reading the session directly, so there is one place to audit and one
 * place to get it wrong.
 *
 * The access model, now that the product is staff-only:
 *
 * Any signed-in clinician of the practice can open any patient chart, because
 * dentistry does not work if the on-call clinician cannot see the record of
 * the person in the chair. That permissiveness is paid for with accounting
 * rather than refusal: every chart opened is written to the audit trail
 * against the clinician who opened it, which is what makes inappropriate
 * access reviewable afterwards. A multi-site deployment would narrow this to
 * an explicit care relationship.
 *
 * Admin is a clinician who can additionally invite and disable colleagues. It
 * grants no extra access to clinical records.
 */

export class AccessDenied extends Error {
  constructor(message = "Not permitted") {
    super(message);
    this.name = "AccessDenied";
  }
}

/** Signed-in caller, or a redirect to sign in. Use in pages and layouts. */
export async function requireUser(returnTo?: string): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) {
    redirect(returnTo ? `/signin?next=${encodeURIComponent(returnTo)}` : "/signin");
  }
  return user;
}

/** Every authenticated user is staff, so this is the ordinary page guard. */
export const requireStaff = requireUser;

export async function requireAdmin(returnTo?: string): Promise<SessionUser> {
  const user = await requireUser(returnTo);
  if (user.role !== "admin") {
    await record({
      actorId: user.clinicianId,
      actorRole: user.role,
      action: "attempted to open an administrator area",
      entity: "route",
      outcome: "denied",
    });
    redirect("/clinic");
  }
  return user;
}

export function isAdmin(user: SessionUser): boolean {
  return user.role === "admin";
}

/**
 * Records that a clinician opened a patient record.
 *
 * There is no id here that could belong to someone else, because staff may
 * read any chart. What this provides is the accounting that makes that
 * permission acceptable: who looked, at whose record, and when.
 */
export async function recordChartAccess(
  user: SessionUser,
  patientId: string,
  intent: string,
): Promise<void> {
  await record({
    actorId: user.clinicianId,
    actorRole: user.role,
    action: intent,
    entity: "patient",
    entityId: patientId,
    patientId,
  });
}

/** Guard for actions restricted to a specific role, written down rather than
 *  inferred from which page happened to call it. */
export async function assertRole(user: SessionUser, role: Role, intent: string): Promise<void> {
  if (user.role !== role) {
    await record({
      actorId: user.clinicianId,
      actorRole: user.role,
      action: `denied: ${intent}`,
      entity: "action",
      outcome: "denied",
    });
    throw new AccessDenied(`Only ${role === "admin" ? "an administrator" : "a clinician"} can do that.`);
  }
}
