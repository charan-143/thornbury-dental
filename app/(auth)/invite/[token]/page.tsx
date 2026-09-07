import Link from "next/link";
import { readInvite } from "@/lib/auth";
import { isConnectivityError } from "@/lib/db";
import { AcceptInviteForm } from "@/components/accept-invite-form";

/**
 * Accepting an invitation.
 *
 * This is what account creation looks like here. There is no open sign-up
 * form, because one would let a stranger issue themselves a login to a system
 * holding health records. The token in the URL is the proof that an
 * administrator intended this particular person to have access.
 *
 * An invalid, expired, revoked or already-used token all produce the same
 * message. Saying which would tell someone probing tokens what they had found.
 */

export const dynamic = "force-dynamic";

export default async function AcceptInvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // A token that cannot be checked is not the same as a token that is wrong.
  // Saying "invalid" when the database is simply unreachable sends someone to
  // request a replacement for an invitation that is perfectly good.
  let invite: Awaited<ReturnType<typeof readInvite>> = null;
  let unreachable = false;

  try {
    invite = await readInvite(decodeURIComponent(token));
  } catch (error) {
    if (!isConnectivityError(error)) throw error;
    unreachable = true;
    console.error("invite lookup unavailable: database unreachable");
  }

  return (
    <div className="auth">
      <aside className="auth-brand">
        <Link className="brand" href="/">
          <span className="brand-mark"><i className="ph-fill ph-tooth" aria-hidden="true" /></span>
          <span className="brand-name">Thornbury Dental</span>
        </Link>
        <h1>Set up your account.</h1>
        <p>
          Choose a password and you are in. Accounts here are issued by the practice,
          never self-created, which is why you arrived through a link.
        </p>
        <Link className="btn btn-ghost auth-back" href="/signin">
          <i className="ph ph-arrow-left" aria-hidden="true" /> Back to sign in
        </Link>
      </aside>

      <main className="auth-main" id="main">
        <div className="auth-inner">
          {invite ? (
            <AcceptInviteForm
              token={decodeURIComponent(token)}
              name={invite.name}
              email={invite.email}
              role={invite.role}
            />
          ) : unreachable ? (
            <div className="auth-form">
              <h2>We cannot check this invitation right now</h2>
              <div className="alert alert-warning" role="alert">
                <i className="ph ph-warning" aria-hidden="true" />
                <span>
                  The practice records are temporarily unreachable, so this link could not
                  be looked up. <strong>Your invitation has not been used or cancelled.</strong>{" "}
                  Keep the link and open it again shortly.
                </span>
              </div>
              <Link className="btn btn-secondary" href="/signin">Go to sign in</Link>
            </div>
          ) : (
            <div className="auth-form">
              <h2>This invitation cannot be used</h2>
              <div className="alert alert-critical" role="alert">
                <i className="ph ph-warning-octagon" aria-hidden="true" />
                <span>
                  The link is invalid, has expired, or has already been used. Invitations
                  last seven days. Ask an administrator at the practice to send a new one.
                </span>
              </div>
              <Link className="btn btn-secondary" href="/signin">Go to sign in</Link>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
