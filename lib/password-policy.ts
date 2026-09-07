/**
 * Password policy: which passwords are acceptable.
 *
 * Deliberately free of Node imports. The rules are rendered by a client
 * component so the person choosing a password can see what is required, and
 * pulling node:crypto into the browser bundle to do that would fail the build.
 * Derivation lives next door in password.ts, which is server only.
 *
 * The split keeps one definition of the policy. Duplicating these four rules
 * into the form is how a system ends up rejecting a password it just told
 * someone was fine.
 */

const WEAK_FRAGMENTS = ["password", "thornbury", "dental", "letmein", "qwerty", "123456", "admin"];

export const PASSWORD_RULES = [
  { id: "length", label: "At least 12 characters", test: (p: string) => p.length >= 12 },
  { id: "letter", label: "Contains a letter", test: (p: string) => /[a-z]/i.test(p) },
  { id: "number", label: "Contains a number", test: (p: string) => /\d/.test(p) },
  {
    id: "common",
    label: "Not built around a guessable word",
    test: (p: string) => !WEAK_FRAGMENTS.some((w) => p.toLowerCase().includes(w)),
  },
] as const;

/** The rules a candidate password fails, in display order. */
export function passwordIssues(password: string): string[] {
  const value = String(password ?? "");
  return PASSWORD_RULES.filter((rule) => !rule.test(value)).map((rule) => rule.label);
}
