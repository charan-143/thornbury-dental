import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/**
 * Password derivation and policy.
 *
 * Separated from auth.ts so the seed script can create accounts without
 * importing next/headers, and so there is exactly one definition of the KDF
 * parameters. Two copies of these constants is how a system ends up with
 * accounts nobody can sign in to.
 *
 * scrypt at N=65536, r=8, p=2 is the OWASP interactive parameter set: about
 * 64MB and a fraction of a second per attempt. The cost is the feature.
 */

const SCRYPT = { N: 65536, r: 8, p: 2, keylen: 64 } as const;
const MAXMEM = 160 * 1024 * 1024;

export const KDF_ID = `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${SCRYPT.keylen}`;

export function derive(password: string, saltHex: string): string {
  return scryptSync(
    String(password ?? "").normalize("NFKC"),
    Buffer.from(saltHex, "hex"),
    SCRYPT.keylen,
    { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p, maxmem: MAXMEM },
  ).toString("hex");
}

export function hashPassword(password: string): { hash: string; salt: string; kdf: string } {
  const salt = randomBytes(32).toString("hex");
  return { hash: derive(password, salt), salt, kdf: KDF_ID };
}

export function verifyPassword(
  password: string,
  stored: { password_hash: string; password_salt: string },
): boolean {
  const candidate = Buffer.from(derive(password, stored.password_salt), "hex");
  const known = Buffer.from(stored.password_hash, "hex");
  if (candidate.length !== known.length) return false;
  return timingSafeEqual(candidate, known);
}

/** Derives against a throwaway salt, so a missing account costs the same time. */
export function burnTime(password: string): void {
  derive(password, randomBytes(32).toString("hex"));
}

export { PASSWORD_RULES, passwordIssues } from "./password-policy";
