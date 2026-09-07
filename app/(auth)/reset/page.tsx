"use client";

import { useActionState } from "react";
import Link from "next/link";
import { requestResetAction, resetPasswordAction, type FormState } from "@/actions/auth";
import { PasswordRules } from "@/components/password-rules";

/**
 * Password reset, in two steps on one page.
 *
 * Step one asks for the address and returns the same reassurance whether or
 * not an account exists, so the form cannot be used to discover which staff
 * addresses are registered. Step two takes the code and the new password.
 *
 * The code appears on screen here because this build has no mail transport.
 * A deployment sends it by email and never renders it; the note on the page
 * says so rather than leaving the reader to assume this is normal.
 */

export default function ResetPage() {
  const [requestState, requestAction, requesting] = useActionState<FormState, FormData>(requestResetAction, {});
  const [setState, setAction, setting] = useActionState<FormState, FormData>(resetPasswordAction, {});

  return (
    <div className="auth">
      <aside className="auth-brand">
        <Link className="brand" href="/">
          <span className="brand-mark"><i className="ph-fill ph-tooth" aria-hidden="true" /></span>
          <span className="brand-name">Thornbury Dental</span>
        </Link>
        <h1>Reset your password.</h1>
        <p>
          Ask for a code, then choose a new password. Resetting signs you out of every
          device the old password was used on.
        </p>
        <Link className="btn btn-ghost auth-back" href="/signin">
          <i className="ph ph-arrow-left" aria-hidden="true" /> Back to sign in
        </Link>
      </aside>

      <main className="auth-main" id="main">
        <div className="auth-inner">
          <form className="auth-form" action={requestAction}>
            <h2>Request a code</h2>

            {requestState.error && (
              <div className="alert alert-critical" role="alert">
                <i className="ph ph-warning-octagon" aria-hidden="true" />
                <span>{requestState.error}</span>
              </div>
            )}
            {requestState.notice && (
              <div className="alert alert-success" role="status">
                <i className="ph ph-key" aria-hidden="true" />
                <span>{requestState.notice}</span>
              </div>
            )}

            <div className="field">
              <label htmlFor="reset-email">Email address</label>
              <input className="input" id="reset-email" name="email" type="email" autoComplete="username" required />
            </div>

            <button className="btn btn-secondary" type="submit" disabled={requesting}>
              {requesting ? "Sending" : "Send a reset code"}
            </button>
          </form>

          <div className="divider" style={{ margin: "28px 0" }} />

          <form className="auth-form" action={setAction}>
            <h2>Set a new password</h2>

            {setState.error && (
              <div className="alert alert-critical" role="alert">
                <i className="ph ph-warning-octagon" aria-hidden="true" />
                <span>{setState.error}</span>
              </div>
            )}

            <div className="field">
              <label htmlFor="reset-code">Reset code</label>
              <input className="input mono" id="reset-code" name="code" autoComplete="one-time-code" required />
            </div>

            <div className="field">
              <label htmlFor="reset-password">New password</label>
              <input className="input" id="reset-password" name="password" type="password" autoComplete="new-password" required />
              <PasswordRules />
            </div>

            <div className="field">
              <label htmlFor="reset-confirm">Repeat the new password</label>
              <input className="input" id="reset-confirm" name="confirm" type="password" autoComplete="new-password" required />
            </div>

            <button className="btn btn-primary btn-block" type="submit" disabled={setting}>
              {setting ? "Saving" : "Set the new password"}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
