# Thornbury Dental, clinical workspace

A practice site with a staff-only clinical workspace behind it. Patients exist
as clinical records that clinicians manage; there are no patient accounts and
no patient-facing portal. Built on Next.js with Neon Postgres, and designed to
deploy to Vercel.

## Deploying to Vercel

### 1. Create the database

Sign in to <https://neon.tech>, create a project, and copy the **pooled**
connection string from Connection Details. It ends in `-pooler...neon.tech`.
The pooled endpoint matters: serverless functions open many short-lived
connections, and the direct endpoint will exhaust its limit.

### 2. Set up locally

```bash
cp .env.example .env.local          # then paste your DATABASE_URL into it
npm install
node --env-file=.env.local scripts/migrate.ts
```

For a walkthrough with invented clinicians and patients:

```bash
node --env-file=.env.local scripts/seed.ts
npm run dev
```

Development sign-ins created by the seed:

| Account | Email | Password |
| --- | --- | --- |
| Dr. Ingrid Halvorsen, administrator | `i.halvorsen@thornbury.example` | `Cusp-Lantern-72` |
| Dr. Tomas Ferreira, clinician | `t.ferreira@thornbury.example` | `Apex-Meridian-19` |
| Dr. Anaya Krishnamurthy, clinician | `a.krishnamurthy@thornbury.example` | `Bridge-Quarry-55` |

These exist only in the demo seed. `scripts/seed.ts` refuses to run when
`NODE_ENV=production`, so they cannot reach a live practice database.

### 3. Deploy

```bash
npm i -g vercel
vercel link
vercel env add DATABASE_URL production     # paste the pooled Neon URL
vercel --prod
```

`vercel.json` runs `node scripts/migrate.ts && next build`, so migrations are
applied on every deploy before the new code goes live.

### 4. Create the first administrator

Once, against the production database:

```bash
vercel env pull .env.production.local
ADMIN_EMAIL=you@practice.example ADMIN_NAME="Your Name" ADMIN_PASSWORD='choose-a-strong-one' \
  node --env-file=.env.production.local scripts/seed.ts --admin-only
```

It refuses to run if any account already exists, so it cannot be used to add a
back door to a running practice. Delete `ADMIN_PASSWORD` from your shell history
and environment afterwards. Sign in, then add colleagues from the Staff page.

## Accounts

Nobody self-registers. An administrator invites a colleague, which creates
their clinician profile and a single-use token valid for seven days. Only the
token digest is stored, so a database disclosure does not hand over pending
invitations. Accepting the invitation sets the password and creates the account.

Two roles. **Clinician** reaches every clinical screen. **Admin** is a
clinician who can additionally invite and disable colleagues; it grants no
extra access to clinical records.

## What is enforced

- **Nothing is trusted from the client.** Passwords are derived server-side
  with scrypt (N=65536, r=8, p=2, per-account 32-byte salt). The session is a
  database row; the cookie holds a random token and only its digest is stored.
- **Sessions expire and can be revoked.** Fifteen minute idle limit, eight hour
  absolute limit, checked on every request. Disabling an account or resetting a
  password revokes every live session immediately.
- **Sign-in is throttled** by email and by client address independently, and
  locks for fifteen minutes after five failures. A wrong password and an
  unknown address return the same message, so the form cannot be used to
  discover which staff addresses exist.
- **Records lock.** A published treatment plan is immutable; corrections are
  dated addenda. A result is held until a clinician releases it. The database
  enforces that published implies locked with a check constraint.
- **The audit trail is tamper evident.** Append only and hash chained, with a
  unique index on `prev_hash` so concurrent writes cannot fork the chain, and
  triggers that refuse UPDATE and DELETE at the database level. The Today
  screen shows live verification.
- **The audit trail holds no clinical content.** Opaque ids only, so it can be
  exported and reviewed without disclosing anything.
- **Every chart opened by a clinician is recorded** against their name. Staff
  can read any chart, which is what dentistry needs; the accounting is what
  makes that acceptable.
- **Security headers** on every response: CSP, HSTS, `X-Frame-Options: DENY`,
  `nosniff`, `Referrer-Policy: no-referrer`, Permissions-Policy. `X-Powered-By`
  removed. `unsafe-eval` is present in development only, for the HMR runtime.
- **Clinical routes are `no-store`**, so no proxy or browser cache retains a
  rendered chart.

## What is still not true

Deploying this does not make it fit to hold real patient data.

- **Vercel requires an Enterprise plan and a signed BAA** before any PHI may be
  processed there. Neon likewise offers a BAA only on its business tiers. Both
  are procurement steps, not code.
- No encryption at rest configured, no restore-tested backups, no retention or
  destruction policy, no access reviews, no penetration test, no clinical
  safety case, no breach procedure.
- The prescribing safety check covers recorded allergies, anticoagulant
  interaction with NSAIDs, and bisphosphonate therapy. It is not a drug
  database and must not be relied on as one.
- Password reset codes are shown on screen rather than emailed, because no mail
  transport is configured. Wire one up before real use.

## Layout

```
app/page.tsx              public practice site (clinician profiles only)
app/(auth)/signin         staff sign in, no credential list, no sign-up
app/clinic/               clinical workspace, guarded by requireStaff
actions/auth.ts           sign in, sign out, password reset server actions
lib/db.ts                 Neon client, id and date helpers
lib/password.ts           scrypt derivation and password policy
lib/auth.ts               sessions, throttling, lockout, invitations, resets
lib/authz.ts              route guards, admin gate, chart-access recording
lib/audit.ts              append-only hash-chained trail and verification
migrations/0001_init.sql  full schema
scripts/migrate.ts        applies pending migrations, once each
scripts/seed.ts           demo data, or --admin-only bootstrap
```

## What is not built yet

The security foundation, the schema, the public site, sign-in and the Today
screen are complete and the production build passes. These screens are
referenced by navigation but not yet implemented:

- `/clinic/schedule` day grid with booking and rescheduling
- `/clinic/patients` roster and `/clinic/patients/[id]` chart, including the
  plan composer, prescribing with the safety check, and report release
- `/clinic/audit` full trail view
- `/clinic/staff` invitations and account management (the server-side
  `createInvite`, `readInvite` and `acceptInvite` functions exist)
- `/reset` and the invitation acceptance page (their server actions exist)

Each is a view over queries and guards that are already in place. The previous
implementations are in git history at commit `69d28b1` as reference.
