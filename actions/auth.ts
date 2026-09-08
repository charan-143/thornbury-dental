"use server";

import { redirect } from "next/navigation";
import {
  acceptInvite,
  registerOpen,
  passwordIssues,
  requestPasswordReset,
  resetPassword,
  signIn,
  signOut,
} from "@/lib/auth";

/**
 * Authentication server actions.
 *
 * These run on the server, so the password arrives in the request body and is
 * never handed to client JavaScript. The returned state carries a message and
 * nothing else: no field echoes, no account details, and no indication of
 * whether the address exists.
 */

export type FormState = {
  error?: string;
  notice?: string;
};

/** Only allow relative in-app paths, so `next` cannot become an open redirect. */
function safeNext(value: FormDataEntryValue | null): string | null {
  const raw = typeof value === "string" ? value : "";
  if (!raw.startsWith("/") || raw.startsWith("//")) return null;
  return raw;
}

export async function signInAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNext(formData.get("next"));

  if (!email || !password) {
    return { error: "Enter both your email address and your password." };
  }

  const result = await signIn(email, password);
  if (!result.ok) return { error: result.error };

  redirect(next ?? "/clinic");
}

export async function signOutAction(): Promise<void> {
  try {
    await signOut();
  } catch (err) {
    console.warn("signOutAction notice:", err instanceof Error ? err.message : String(err));
  }
  redirect("/");
}

export async function requestResetAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "Enter the email address on your account." };

  const { code } = await requestPasswordReset(email);

  // The same reassurance either way, so this form cannot be used to discover
  // which addresses are registered. The code itself appears only because this
  // demonstration has no mail transport.
  return {
    notice: code
      ? `If that address has an account, a reset code has been sent. For this demonstration the code is ${code}, valid for 30 minutes and usable once.`
      : "If that address has an account, a reset code has been sent to it.",
  };
}

/**
 * Completes an invitation: sets the password and signs the new clinician in.
 *
 * This is what account creation looks like in a clinical system. There is no
 * open sign-up form, because one would let a stranger issue themselves a staff
 * login. The token is the proof that an administrator intended this person to
 * have access.
 */
export async function acceptInviteAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const token = String(formData.get("token") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (!token) return { error: "That invitation link is incomplete. Ask for a new one." };
  if (password !== confirm) return { error: "The two passwords do not match." };

  const issues = passwordIssues(password);
  if (issues.length) return { error: `That password ${issues.length === 1 ? "fails one requirement" : "fails several requirements"} listed below.` };

  const result = await acceptInvite(token, password);
  if (!result.ok) return { error: result.error ?? "That invitation is not valid." };

  redirect("/clinic");
}

/**
 * Open self-registration.
 *
 * Deliberately open, by request. The account is created and signed in at once;
 * the first one ever created becomes the administrator.
 */
export async function signUpAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const name = String(formData.get('name') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const confirm = String(formData.get('confirm') ?? '');
  const credentials = String(formData.get('credentials') ?? '').trim();
  const specialty = String(formData.get('specialty') ?? '').trim();

  if (password !== confirm) return { error: 'The two passwords do not match.' };

  const result = await registerOpen({ name, email, password, credentials, specialty });
  if (!result.ok) return { error: result.error };

  redirect('/clinic');
}

export async function resetPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const code = String(formData.get("code") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (!code) return { error: "Enter the reset code." };
  if (password !== confirm) return { error: "The two passwords do not match." };

  const result = await resetPassword(code, password);
  if (!result.ok) return { error: result.error ?? "That reset code is not valid." };

  redirect("/signin?reset=1");
}
