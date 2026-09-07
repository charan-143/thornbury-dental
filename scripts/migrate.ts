import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { neon } from "@neondatabase/serverless";

/**
 * Applies pending migrations, in filename order, exactly once each.
 *
 * Run before every deploy:  node --env-file=.env.local scripts/migrate.ts
 *
 * Each file is applied inside a transaction and recorded in schema_migrations,
 * so re-running is a no-op and a half-applied file cannot leave the schema in
 * an intermediate state.
 */

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set.");
  console.error("Run with:  node --env-file=.env.local scripts/migrate.ts");
  process.exit(1);
}

const sql = neon(url);
const dir = path.join(process.cwd(), "migrations");

/**
 * Splits a migration file into individual statements.
 *
 * The Neon HTTP driver sends one statement per request, so the file has to be
 * split. Splitting on semicolons alone is wrong: the audit trigger function is
 * dollar quoted and its body contains semicolons, and so do string literals
 * and comments. This tracks those states and only breaks at top level.
 */
function splitStatements(source: string): string[] {
  const out: string[] = [];
  let buf = "";
  let i = 0;
  let inSingle = false;
  let inLineComment = false;
  let inBlockComment = false;
  let dollarTag: string | null = null;

  while (i < source.length) {
    const ch = source[i]!;
    const next = source[i + 1];

    if (inLineComment) {
      if (ch === "\n") inLineComment = false;
      buf += ch; i += 1; continue;
    }
    if (inBlockComment) {
      if (ch === "*" && next === "/") { inBlockComment = false; buf += "*/"; i += 2; continue; }
      buf += ch; i += 1; continue;
    }
    if (dollarTag) {
      if (source.startsWith(dollarTag, i)) { buf += dollarTag; i += dollarTag.length; dollarTag = null; continue; }
      buf += ch; i += 1; continue;
    }
    if (inSingle) {
      if (ch === "'" && next === "'") { buf += "''"; i += 2; continue; }   // escaped quote
      if (ch === "'") inSingle = false;
      buf += ch; i += 1; continue;
    }

    if (ch === "-" && next === "-") { inLineComment = true; buf += "--"; i += 2; continue; }
    if (ch === "/" && next === "*") { inBlockComment = true; buf += "/*"; i += 2; continue; }
    if (ch === "'") { inSingle = true; buf += ch; i += 1; continue; }

    const dollar = /^\$[A-Za-z_]*\$/.exec(source.slice(i));
    if (dollar) { dollarTag = dollar[0]; buf += dollarTag; i += dollarTag.length; continue; }

    if (ch === ";") {
      const statement = buf.trim();
      if (statement) out.push(statement);
      buf = "";
      i += 1;
      continue;
    }

    buf += ch;
    i += 1;
  }

  const tail = buf.trim();
  if (tail) out.push(tail);
  return out;
}

await sql`
  CREATE TABLE IF NOT EXISTS schema_migrations (
    version    TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`;

const applied = new Set(
  ((await sql`SELECT version FROM schema_migrations`) as Array<{ version: string }>)
    .map((row) => row.version),
);

const files = readdirSync(dir).filter((name) => name.endsWith(".sql")).sort();
let count = 0;

for (const file of files) {
  if (applied.has(file)) {
    console.log(`  skip    ${file}`);
    continue;
  }

  const body = readFileSync(path.join(dir, file), "utf8");
  process.stdout.write(`  apply   ${file} ... `);

  try {
    const statements = splitStatements(body);
    // All statements plus the version record go in one transaction, so a
    // failure part way through cannot leave the schema half migrated.
    await sql.transaction([
      ...statements.map((statement) => sql.query(statement)),
      sql.query("INSERT INTO schema_migrations (version) VALUES ($1)", [file]),
    ]);
    console.log(`done (${statements.length} statements)`);
    count += 1;
  } catch (error) {
    console.log("failed");
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

console.log(count ? `\nApplied ${count} migration${count === 1 ? "" : "s"}.` : "\nSchema already up to date.");
