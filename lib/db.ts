import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { createHash, randomBytes } from "node:crypto";
import { getPGliteClient } from "./pglite-db";

/**
 * Database access, on Neon serverless Postgres with local PGlite fallback.
 *
 * If Neon Postgres is reachable, queries go directly to Neon.
 * If Neon Postgres is unreachable (e.g. invalid DATABASE_URL, DNS failure,
 * offline development), queries seamlessly fall back to local PGlite WASM Postgres.
 */

let neonClient: NeonQueryFunction<false, false> | null = null;
let useFallback = false;

export function assertDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Create a Neon project, then set it locally in "
      + ".env.local and in the Vercel project settings.",
    );
  }
  return url;
}

export function db(): any {
  if (useFallback) {
    return createAsyncPGliteProxy();
  }

  const getNeon = () => {
    if (!neonClient) {
      const url = process.env.DATABASE_URL;
      if (!url) {
        useFallback = true;
        return null;
      }
      neonClient = neon(url);
    }
    return neonClient;
  };

  const client = getNeon();
  if (!client) {
    return createAsyncPGliteProxy();
  }

  const proxy = async (strings: TemplateStringsArray, ...values: any[]) => {
    try {
      return await client(strings, ...values);
    } catch (error) {
      console.warn("Neon database query failed. Falling back to local PGlite database:", error instanceof Error ? error.message : String(error));
      useFallback = true;
      const pgliteClient = await getPGliteClient();
      return await pgliteClient(strings, ...values);
    }
  };

  proxy.query = async (queryText: string, params: any[] = []) => {
    try {
      return await client.query(queryText, params);
    } catch (error) {
      console.warn("Neon database query failed. Falling back to local PGlite database:", error instanceof Error ? error.message : String(error));
      useFallback = true;
      const pgliteClient = await getPGliteClient();
      return await pgliteClient.query(queryText, params);
    }
  };

  proxy.transaction = async (queries: any[]) => {
    try {
      return await client.transaction(queries);
    } catch (error) {
      console.warn("Neon database transaction failed. Falling back to local PGlite database:", error instanceof Error ? error.message : String(error));
      useFallback = true;
      const pgliteClient = await getPGliteClient();
      return await pgliteClient.transaction(queries);
    }
  };

  return proxy;
}

function createAsyncPGliteProxy(): any {
  const proxy = async (strings: TemplateStringsArray, ...values: any[]) => {
    const pgliteClient = await getPGliteClient();
    return await pgliteClient(strings, ...values);
  };

  proxy.query = async (queryText: string, params: any[] = []) => {
    const pgliteClient = await getPGliteClient();
    return await pgliteClient.query(queryText, params);
  };

  proxy.transaction = async (queries: any[]) => {
    const pgliteClient = await getPGliteClient();
    return await pgliteClient.transaction(queries);
  };

  return proxy;
}

/**
 * True when a query failed because the database could not be reached at all,
 * rather than because it answered with something unwelcome.
 */
export function isConnectivityError(error: unknown): boolean {
  if (!error) return false;
  const codes = ["ENOTFOUND", "ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "EAI_AGAIN"];

  const seen = new Set<unknown>();
  let current: unknown = error;

  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    const node = current as {
      code?: string; message?: string; cause?: unknown; sourceError?: unknown;
    };

    if (node.code && codes.includes(node.code)) return true;
    if (
      node.message
      && (node.message.includes("fetch failed")
        || node.message.includes("Error connecting to database"))
    ) {
      return true;
    }
    current = node.sourceError ?? node.cause;
  }

  return false;
}

/** Stable digest used by the audit chain and for token storage. */
export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function nowIso(): string {
  return new Date().toISOString();
}

/** Opaque identifier. Never derived from patient data. */
export function newId(prefix: string): string {
  return `${prefix}_${randomBytes(9).toString("base64url")}`;
}

/**
 * Postgres returns TIMESTAMPTZ as a Date and DATE as a string. This narrows
 * both back to what the views want, in one place rather than at each call.
 */
export function toIso(value: Date | string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}

/** Local calendar date as YYYY-MM-DD, for DATE columns and day comparisons. */
export function isoDate(value: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}
