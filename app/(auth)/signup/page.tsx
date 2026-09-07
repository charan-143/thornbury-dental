"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signUpAction, type FormState } from "@/actions/auth";
import { PasswordRules } from "@/components/password-rules";

/**
 * Open registration.
 *
 * Anyone who reaches this page can create a staff account, and a staff account
 * reads every patient chart. That is the requested behaviour, and the page
 * says so plainly rather than quietly implying an approval step that does not
 * exist. The accounting that makes it survivable is the audit trail: the
 * account is named, and every record it opens is recorded against that name.
 *
 * The first account created becomes the administrator.
 */

export default function SignUpPage() {
  const [state, action, pending] = useActionState<FormState, FormData>(signUpAction, {});

  return (
    <div className="auth">
      <aside className="auth-brand">
        <Link className="brand" href="/">
          <span className="brand-mark"><i className="ph-fill ph-tooth" aria-hidden="true" /></span>
          <span className="brand-name">Thornbury Dental</span>
        </Link>
        <h1>Create a staff account.</h1>
        <p>
          Registration is open. The first account created becomes the practice
          administrator and can manage everyone else.
        </p>
        <Link className="btn btn-ghost auth-back" href="/signin">
          <i className="ph ph-arrow-left" aria-hidden="true" /> I already have an account
        </Link>
      </aside>

      <main className="auth-main" id="main">
        <div className="auth-inner">
          <form className="auth-form" action={action}>
            <h2>Register</h2>
            <p className="meta">This creates a clinical account with access to patient records.</p>

            {state.error && (
              <div className="alert alert-critical" role="alert">
                <i className="ph ph-warning-octagon" aria-hidden="true" />
                <span>{state.error}</span>
              </div>
            )}

            <div className="field">
              <label htmlFor="su-name">Full name</label>
              <input className="input" id="su-name" name="name" autoComplete="name" required />
              <p className="hint">Shown to colleagues, and recorded against everything you do.</p>
            </div>

            <div className="cols-2" style={{ gap: 16 }}>
              <div className="field">
                <label htmlFor="su-credentials">Credentials</label>
                <input className="input" id="su-credentials" name="credentials" placeholder="BDS, MSc" />
              </div>
              <div className="field">
                <label htmlFor="su-specialty">Specialty</label>
                <input className="input" id="su-specialty" name="specialty" placeholder="Periodontics" />
              </div>
            </div>

            <div className="field">
              <label htmlFor="su-email">Email address</label>
              <input className="input" id="su-email" name="email" type="email" autoComplete="username" required />
            </div>

            <div className="field">
              <label htmlFor="su-password">Choose a password</label>
              <input className="input" id="su-password" name="password" type="password" autoComplete="new-password" required />
              <PasswordRules />
            </div>

            <div className="field">
              <label htmlFor="su-confirm">Repeat the password</label>
              <input className="input" id="su-confirm" name="confirm" type="password" autoComplete="new-password" required />
            </div>

            <button className="btn btn-primary btn-block" type="submit" disabled={pending}>
              {pending ? "Creating your account" : "Create my account"}
            </button>
          </form>

          <p className="alert alert-warning" style={{ marginTop: 24 }}>
            <i className="ph ph-warning" aria-hidden="true" />
            <span>
              <strong>This account can read every patient record in the practice.</strong>{" "}
              Access is logged against your name. Do not register on a system holding real
              patient data unless the practice intends registration to be open.
            </span>
          </p>
        </div>
      </main>
    </div>
  );
}
