# PomaaaloStay — CURRENT STATUS

Date of handoff: 2026-09-07

## Verified deactivation fix — 2026-09-07

- Applied `supabase/007_inactive_user_access.sql` to `jawcaedeynlbyntjolrg`.
- All seven application tables now require an active account through a restrictive RLS policy. Existing permissive policies cannot bypass this requirement.
- `has_property_access` now rejects inactive/missing profiles even when property assignments remain.
- Real database regression: `supabase/tests/inactive-user-access.sql` reproduced four inactive-role failures before the fix; all eight active/inactive role cases passed in a rollback-only preview and again after deployment.
- Tests use temporary synthetic users/properties and roll back every fixture and write. Select the entire script before Run selected in the SQL Editor.
- Local regression: 46 test files / 123 tests passed. A pre-existing worker shutdown timeout warning remains for `properties-page.test.tsx`.
- TypeScript and Vite build passed using native config loading; bundle warning remains at approximately 568 kB.
- Full master DOCX supplied by the user is now stored in `docs/`.
- This is the database deactivation fix only. UI access-denied handling, Cleaning guest-data restriction, missing permissive policies for iCal/conflicts, auth recovery, and other audit findings remain outstanding. No frontend deployment was made.

## Repository

## V2 Operations implementation — 2026-09-08

- Added availability blocks with database-level overlap protection and calendar display.
- Added Reservations search and filters for reference, guest, source, status, upcoming/current and conflicts.
- Added guest contacts and cards with contact details and linked stay history; repeat guest is derived from stays.
- Added arrival details, adult/child counts, nightly rate and automatic total price calculation.
- Added property-level tasks for Cleaning, Maintenance, Inspection, Linen, Repair, Delivery, Supplies and Other.
- Cleaning users receive operational task data only; guest contacts remain unavailable to them.
- Applied `supabase/009_operations.sql` and `supabase/010_operations_completion.sql` to the hosted project.
- Hosted rollback regression passed for blocks, imported conflicts, rates, cleaning rescheduling, contacts, task access and deactivation.
- Local regression: 52 test files / 142 tests passed. Production build passed. Non-blocking worker shutdown warnings remain in calendar tests.

Local project:
`C:\BOOKWEB`

Existing Git history should be preserved during migration.

Vercel:
- Project: `bookweb`
- Production URL: `https://bookweb-tan.vercel.app`

Supabase:
- Project name: `Booking Manager Web 2`
- Project ID: `jawcaedeynlbyntjolrg`
- Region: `eu-west-1`

## Latest implementation checkpoint

Revision 3 / Rev2.8 work has established:
- Supabase authentication and operational data
- Home operational overview
- continuous Calendar timeline
- reservation editing and resizing
- conflict rules and persistent conflicts
- property-scoped iCal model
- current Properties UI
- admin-user Edge Function deployment

Latest known test checkpoint:
- 46/46 test files passing
- 123/123 tests passing

Latest known build checkpoint:
- production build passes
- Vite emits a non-blocking JavaScript chunk >500 kB warning

## Needs functional verification

Do not assume these are complete merely because the backend exists:
- People UI real-world create/edit/activation/property-access flow
- end-to-end iCal sync behaviour against real Airbnb/Booking feeds
- full visual responsive verification after subsequent local changes
- any new feature added after this checkpoint

## Safe continuation rule

Before implementing the next feature:
1. inspect repository;
2. inspect current tests;
3. read this handoff and Master Specification;
4. make a small plan;
5. add/update tests first where behaviour changes;
6. implement;
7. run focused tests;
8. run full regression;
9. run production build;
10. visually verify relevant user flow.
