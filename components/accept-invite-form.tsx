"use client";

import { useActionState } from "react";
import { acceptInviteAction, type FormState } from "@/actions/auth";
import { PasswordRules } from "./password-rules";

/**
 * Sets the password on an invited account.
 *
 * The email and role shown here are for the reader only. The server resolves
 * both from the token again when the form is submitted, so editing them in the
 * page changes nothing: nobody can promote themselves to administrator by
 * tampering with a hidden field.
 */
export function AcceptInviteForm({
  token,
  name,
  email,
  role,
}: {
  token: string;
  name: string;
  email: string;
  role: "clinician" | "admin";
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(acceptInviteAction, {});

  return (
    <form className="auth-form" action={action}>
      <h2>Welcome, {name}</h2>
      <p className="meta">
        You have been invited as {role === "admin" ? "an administrator" : "a clinician"}.
        Choose a password to finish setting up your account.
      </p>

      {state.error && (
        <div className="alert alert-critical" role="alert">
          <i className="ph ph-warning-octagon" aria-hidden="true" />
          <span>{state.error}</span>
        </div>
      )}

      <input type="hidden" name="token" value={token} />

      <div className="field">
        <label htmlFor="invite-email">Email address</label>
        <input className="input" id="invite-email" value={email} readOnly disabled />
        <p className="hint">This is the address the invitation was sent to and cannot be changed here.</p>
      </div>

      <div className="field">
        <label htmlFor="invite-password">Choose a password</label>
        <input
          className="input"
          id="invite-password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
        />
        <PasswordRules />
      </div>

      <div className="field">
        <label htmlFor="invite-confirm">Repeat the password</label>
        <input
          className="input"
          id="invite-confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
        />
      </div>

      <button className="btn btn-primary btn-block" type="submit" disabled={pending}>
        {pending ? "Creating your account" : "Create my account"}
      </button>

      <p className="meta">
        Your password is checked and stored on the server. Access to patient records is
        logged against your name from the moment you sign in.
      </p>
    </form>
  );
}
