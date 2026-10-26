# Automatic agency data backup

## User workflow

Settings → Data backup → Automatic data backup. Owner/Admin can enable or disable
the daily job, run Backup now, and download a successful JSON copy. Enabling starts
the first copy immediately. Other agency members see only the status in the bottom
bar. Each agency starts OFF; configuration is agency-wide, not per browser.

Storage: private R2 bucket `pomaaalodesk-agency-backups`, under
`agencies/<agency-id>/<UTC-date>/<run-id>.json`. No public bucket URL or browser
storage credential. The application supplies the authenticated download.

Daily job runs after 02:00 UTC. Cloudflare checks every 15 minutes and retries
incomplete days, even when all browsers are closed. Retention is 30 days, including
manual copies. A timestamp advances only after an R2 read-back has the same SHA-256.

## Contents and recovery boundary

The version-2 JSON envelope preserves the existing manual export format and contains
agency settings, properties, guests, reservations, blocks, tasks, cleaning tasks,
external calendars, conflicts, memberships, profile contact details, property access,
image metadata, same-stay acknowledgements, and override audit records.

Photo binary files and Supabase Auth accounts/passwords are NOT included. This is an
agency data backup, not a replacement for the repository/schema/infrastructure backup.
The existing importer restores its supported operational tables; memberships must be
invited again. Image metadata, same-stay acknowledgements and audit records are present
in the file for administrator recovery; the current UI importer does not restore them.
Do not describe the current importer as a complete one-click disaster recovery tool.

## Files

- `worker/agency-backups.ts`: authenticated endpoint, cron, R2 writes/read-back, retention.
- `wrangler.backups.jsonc`: separate Worker; does not change the image Worker.
- `src/lib/auto-backup.ts`: UI requests and agency status refresh.
- `src/components/AutoBackup.tsx`: settings and status bar.
- `supabase/migrations/20260916142642_automatic_agency_backups.sql`
- `supabase/migrations/20260923120246_harden_backup_rpc_grants.sql`

## Security

Database tables live in private schema with RLS and no client grants. The status RPC
requires an active membership in the current agency. Data-management requests require
Owner/Admin, checked by the database after the Worker validates the Supabase JWT.
The Worker has no service-role key. Its random 256-bit backup-only capability is a
Cloudflare secret; the database stores only SHA-256. The secret-gated worker RPC is
deliberately granted to `anon` because it is called server-to-server using a publishable
API key. Authenticated clients have no execute grant. A missing/wrong capability fails
before any action. Supabase advisor flags the intentional SECURITY DEFINER endpoint;
do not remove its key validation or expose the capability to frontend code.

Secrets: `DATABASE_BACKUP_KEY` and `SUPABASE_PUBLISHABLE_KEY` in the backup Worker.
Initial provisioning file `.backup-secrets.local` is gitignored and must be deleted
after successful `wrangler secret bulk`; never commit or distribute it.

## Deployment

Database migrations, Worker, secrets, cron and frontend were deployed on 2026-09-23.
Jolie Agency is enabled. New agencies remain OFF until an Owner/Admin enables them.
For a fresh installation, prepare a new backup capability and matching database hash
before provisioning the Worker secrets. Run from C:\BOOKWEB:

```powershell
npx.cmd wrangler login
npx.cmd wrangler deploy --config wrangler.backups.jsonc
npx.cmd wrangler secret bulk .backup-secrets.local --config wrangler.backups.jsonc
```

After success, remove only `.backup-secrets.local`. Build/deploy the frontend only after
the backend is available. Use Backup now as an Owner, download the result, compare the
manifest counts and SHA-256, and verify rejection for unauthenticated/other-agency calls.
Check the next scheduled run with the app closed. Do not claim these live steps passed
based only on unit tests or a Worker dry run.

Live verification completed: the scheduled handler ran against production resources
through Wrangler's test-scheduled endpoint. R2 read-back and a separate authenticated
CLI download matched SHA-256. Snapshot: 13 properties, 18 guests, 25 reservations,
2,775,290 bytes, matching database counts. The public download endpoint returned 401
without a session. First run ID: `6aa491fc-d3a7-482d-a6fe-25dd1c66c549`.
This verified the scheduled handler, not a next-day cron occurrence or a full restore.

Tests: `npx.cmd vitest run src/auto-backup-worker.test.ts`; frontend: `npm.cmd run build`;
Worker packaging: `npx.cmd wrangler deploy --config wrangler.backups.jsonc --dry-run`.
Rollback-only database checks cover invalid secrets, outsider denial, table grants,
snapshot counts, duplicate-run prevention, required checksum, and completion timestamp.

Current snapshot cap: 40 MB JSON. Larger snapshots fail explicitly without advancing
the success date; use streaming/partitioned archives before raising this limit.
