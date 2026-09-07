"use client";

import { Suspense, useActionState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { signInAction, type FormState } from "@/actions/auth";

/**
 * Staff sign in.
 *
 * The form posts to a server action, so the password is never in reach of
 * client JavaScript and there is no client-side check to bypass.
 *
 * There is no credential list on this page. Registration is open at /signup by
 * request of the practice, and invitations still work for anyone sent one.
 */

function SignInForm() {
  const params = useSearchParams();
  const next = params.get("next") ?? "";
  const justReset = params.get("reset") === "1";
  const [state, action, pending] = useActionState<FormState, FormData>(signInAction, {});

  return (
    <div className="auth">
      <aside className="auth-brand">
        <Link className="brand" href="/">
          <span className="brand-mark"><i className="ph-fill ph-tooth" aria-hidden="true" /></span>
          <span className="brand-name">Thornbury Dental</span>
        </Link>
        <h1>Clinical workspace.</h1>
        <p>
          Schedules, charts, treatment plans, prescribing checks and the audit trail.
          For practice staff only.
        </p>
        <Link className="btn btn-ghost auth-back" href="/">
          <i className="ph ph-arrow-left" aria-hidden="true" /> Back to the practice site
        </Link>
      </aside>

      <main className="auth-main" id="main">
        <div className="auth-inner">
          <form className="auth-form" action={action}>
            <h2>Sign in</h2>
            <p className="meta">Use your staff account, or create one.</p>

            {justReset && (
              <div className="alert alert-success" role="status">
                <i className="ph ph-check-circle" aria-hidden="true" />
                <span>Password updated. Sign in with the new one.</span>
              </div>
            )}

            {state.error && (
              <div className="alert alert-critical" role="alert">
                <i className="ph ph-warning-octagon" aria-hidden="true" />
                <span>{state.error}</span>
              </div>
            )}

            <input type="hidden" name="next" value={next} />

            <div className="field">
              <label htmlFor="email">Email address</label>
              <input className="input" id="email" name="email" type="email" autoComplete="username" required />
            </div>

            <div className="field">
              <label htmlFor="password">Password</label>
              <input className="input" id="password" name="password" type="password" autoComplete="current-password" required />
            </div>

            <button className="btn btn-primary btn-block" type="submit" disabled={pending}>
              {pending ? "Checking" : "Sign in"}
            </button>

            <div className="auth-alt">
              <Link className="btn btn-ghost btn-sm" href="/reset">Forgot your password</Link>
              <Link className="btn btn-ghost btn-sm" href="/signup">Create an account</Link>
            </div>
          </form>

          <p className="alert" style={{ marginTop: 24 }}>
            <i className="ph ph-shield-warning" aria-hidden="true" />
            <span>
              Access is logged. Opening a patient record is recorded against your name in the
              audit trail.
            </span>
          </p>
        </div>
      </main>
    </div>
  );
}

export default function SignInPage() {
  // useSearchParams needs a Suspense boundary during prerender.
  return (
    <Suspense fallback={<div className="wrap" style={{ paddingBlock: 64 }}>Loading</div>}>
      <SignInForm />
    </Suspense>
  );
}
