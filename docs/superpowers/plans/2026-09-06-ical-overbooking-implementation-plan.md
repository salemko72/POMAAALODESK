# Rev2.8 iCal & Overbooking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement property-scoped iCal feeds, idempotent synchronization, a central conflict engine, persistent OVERBOOK/CONFLICT records, and clear Calendar/Home remediation UI.

**Architecture:** `external_calendars` belongs to `properties`; synced reservations and manual reservations share the same `reservations` table; conflict detection creates independent `booking_conflicts` rows. Open conflicts are visualized on Calendar and surfaced by Home Action Center until explicitly resolved.

**Tech Stack:** React + TypeScript, Supabase/Postgres, existing repository modules, Vitest/Testing Library, existing Calendar/Home UI.

**Spec:** `docs/superpowers/specs/2026-09-06-ical-overbooking-design.md`

## Global Constraints

- Never reject a reservation only because a conflict exists.
- Never delete a manual reservation because of an iCal sync.
- Never model iCal as a global agent/account feed.
- Every external calendar is attached to exactly one property.
- Cancelled reservations do not create active conflicts.
- `booking_conflicts.status` is `open` or `resolved`.
- Source identity must remain visible in reservation data and UI.
- Existing manual booking, edit reservation, property access and role semantics remain intact.
- Every production behavior change gets a failing test first, then the smallest implementation.
- No service-role secret is exposed to browser code.

---

### Task 1: Database model for property-scoped external calendars

**Files:**
- Create: `supabase/004_ical_overbooking.sql`
- Test: `src/lib/ical-model.test.ts`

**Interfaces:**
- Produces table `public.external_calendars` with `property_id`, `source`, `feed_url`, `is_active`, `last_synced_at`, `sync_status`, timestamps.
- Produces table `public.booking_conflicts` with `property_id`, two reservation references, `conflict_type`, `status`, `detected_at`, `resolved_at`, `resolved_by`.

- [ ] **Step 1: Write failing tests** asserting the repository types contain property-scoped external calendar data and conflict status values `open | resolved`.
- [ ] **Step 2: Run the focused test and verify it fails because the new repository model is absent.
- [ ] **Step 3: Add the SQL migration with foreign keys to `properties`, `reservations`, and `profiles`, plus indexes on `(property_id, is_active)` and `(status, property_id)`.
- [ ] **Step 4: Add repository types matching the SQL schema.
- [ ] **Step 5: Run the focused test and verify it passes.
- [ ] **Step 6: Commit the migration and repository model.

---

### Task 2: Reservation source normalization and sync identity

**Files:**
- Modify: `src/lib/reservations-repository.ts`
- Create: `src/lib/ical-repository.ts`
- Test: `src/lib/ical-repository.test.ts`

**Interfaces:**
- `ReservationSource` includes `airbnb_ical`, `booking_ical`, `direct`, `agency`.
- `ExternalCalendar` includes `id`, `property_id`, `source`, `feed_url`, `is_active`, `last_synced_at`, `sync_status`.
- `upsertSyncedReservation(calendarId, reservation)` uses the external calendar id plus `external_id` as the idempotency key.

- [ ] **Step 1: Write a failing test proving two sync runs with the same external id do not create duplicate logical reservations.
- [ ] **Step 2: Run only `src/lib/ical-repository.test.ts` and verify RED.
- [ ] **Step 3: Implement the smallest typed repository functions and source normalization.
- [ ] **Step 4: Run the focused test and verify GREEN.
- [ ] **Step 5: Add tests for manual reservations remaining untouched by an iCal sync.
- [ ] **Step 6: Run the focused suite.
- [ ] **Step 7: Commit.

---

### Task 3: Central conflict detector

**Files:**
- Create: `src/lib/booking-conflicts.ts`
- Create: `src/lib/booking-conflicts.test.ts`

**Interfaces:**
- `type ConflictReservation = { id:string; property_id:string; check_in:string; check_out:string; status:string; source:string }`
- `findReservationConflicts(reservations: ConflictReservation[]): Array<{ reservationAId:string; reservationBId:string; propertyId:string }>`
- `isConflictOpen(...)` and pair normalization keep conflict records deterministic.

- [ ] **Step 1: Write failing tests for Airbnb↔Booking, iCal↔Manual, Manual↔Manual, same-day checkout/check-in allowed, and cancelled ignored.
- [ ] **Step 2: Run the focused tests and verify RED.
- [ ] **Step 3: Implement deterministic pairwise overlap detection using the existing timestamp semantics.
- [ ] **Step 4: Verify GREEN.
- [ ] **Step 5: Add regression test with three overlapping reservations producing three unique conflict pairs.
- [ ] **Step 6: Run focused suite and commit.

---

### Task 4: Persist and resolve conflicts

**Files:**
- Create: `src/lib/booking-conflicts-repository.ts`
- Test: `src/lib/booking-conflicts-repository.test.ts`

**Interfaces:**
- `getOpenConflicts(propertyId?: string): Promise<BookingConflict[]>`
- `syncOpenConflicts(propertyId: string, reservations: ConflictReservation[]): Promise<BookingConflict[]>`
- `resolveConflict(conflictId: string, userId: string): Promise<void>`

- [ ] **Step 1: Write failing repository tests for creating an open conflict, preserving it after repeated sync, and resolving it.
- [ ] **Step 2: Run focused tests and verify RED.
- [ ] **Step 3: Implement repository calls against `booking_conflicts`.
- [ ] **Step 4: Verify GREEN.
- [ ] **Step 5: Add test proving a resolved conflict can be reopened when the same conflict becomes active again after data changes.
- [ ] **Step 6: Run focused suite and commit.

---

### Task 5: Calendar conflict visualization

**Files:**
- Modify: `src/pages/CalendarPage.tsx`
- Modify: `src/lib/calendar-data.ts`
- Test: `src/calendar-page.test.tsx`
- Test: `src/calendar-style.test.ts`

**Interfaces:**
- Calendar reservation rows receive `hasOpenConflict: boolean`.
- Conflict bars use the existing source/property colors plus a strong red conflict treatment; they are not converted into a different reservation source.
- Clicking a conflict indicator opens the existing Edit Reservation/detail destination.

- [ ] **Step 1: Write failing tests for a visibly marked overlapping Airbnb/Manual pair and for source labels remaining visible.
- [ ] **Step 2: Run focused Calendar tests and verify RED.
- [ ] **Step 3: Add conflict lookup to the Calendar data flow.
- [ ] **Step 4: Add a red conflict indicator and accessible label to each participating booking bar.
- [ ] **Step 5: Verify GREEN and run Calendar suite.
- [ ] **Step 6: Commit.

---

### Task 6: Home Action Center

**Files:**
- Modify: `src/pages/HomePage.tsx`
- Create or modify: `src/lib/action-center.ts`
- Test: `src/home-page.test.tsx`
- Test: `src/home-page-operational-data.test.tsx`

**Interfaces:**
- `getActionCenterItems(...)` returns open OVERBOOK/CONFLICT items plus existing actionable notifications.
- Each item contains a navigation target to property/reservation context.

- [ ] **Step 1: Write failing test for a red OVERBOOK item at top of Home.
- [ ] **Step 2: Run focused Home tests and verify RED.
- [ ] **Step 3: Implement Action Center with highest-severity open conflict first.
- [ ] **Step 4: Make item click navigate to the affected reservation/calendar context.
- [ ] **Step 5: Verify GREEN.
- [ ] **Step 6: Commit.

---

### Task 7: Calendar Sources administration UI

**Files:**
- Modify: existing Settings administration routing
- Create: `src/pages/CalendarSourcesPage.tsx`
- Test: `src/calendar-sources-page.test.tsx`

**Interfaces:**
- Show external calendars grouped by property.
- Add/edit/deactivate an iCal feed for a selected property.
- Never ask for a global account feed.

- [ ] **Step 1: Write failing tests for selecting a property and showing its Airbnb/Booking feeds.
- [ ] **Step 2: Run focused tests and verify RED.
- [ ] **Step 3: Implement property-scoped add/edit/deactivate flow.
- [ ] **Step 4: Verify GREEN.
- [ ] **Step 5: Add test that a second feed can coexist on the same property.
- [ ] **Step 6: Commit.

---

### Task 8: Sync orchestration contract

**Files:**
- Create: `supabase/functions/sync-ical/index.ts`
- Create: `src/lib/ical-sync-service.ts`
- Test: `src/lib/ical-sync-service.test.ts`

**Interfaces:**
- `syncExternalCalendar(calendarId: string): Promise<SyncResult>`
- `SyncResult = { inserted:number; updated:number; skipped:number; conflicts:number; errors:string[] }`

- [ ] **Step 1: Write failing tests for a successful parse/upsert result and for duplicate external ids being skipped/updated instead of duplicated.
- [ ] **Step 2: Run focused tests and verify RED.
- [ ] **Step 3: Implement the service boundary so browser code only invokes the safe server-side sync endpoint.
- [ ] **Step 4: Implement the Supabase Edge Function to fetch the feed URL, parse iCal records, upsert reservations, and recompute conflicts.
- [ ] **Step 5: Verify GREEN.
- [ ] **Step 6: Add an explicit test proving manual reservations are not deleted or overwritten.
- [ ] **Step 7: Commit.

---

### Task 9: RLS and role enforcement

**Files:**
- Modify: `supabase/004_ical_overbooking.sql`
- Test: `src/permissions.test.ts`
- Test: `src/lib/booking-conflicts-repository.test.ts`

- [ ] **Step 1: Add failing tests for admin/manager access, viewer read-only access, and cleaning role not seeing guest-sensitive reservation details through the new conflict UI.
- [ ] **Step 2: Verify RED.
- [ ] **Step 3: Add RLS policies tied to existing `current_user_role()` and `has_property_access()`.
- [ ] **Step 4: Ensure only admin/manager can add/edit/deactivate external calendars and resolve conflicts.
- [ ] **Step 5: Verify GREEN.
- [ ] **Step 6: Commit.

---

### Task 10: Full regression and migration handoff

**Files:**
- Modify: `README.md`
- Create: `supabase/REV2.8_DEPLOYMENT.md`

- [ ] **Step 1: Run the complete test suite.
- [ ] **Step 2: Run `npm.cmd run build`.
- [ ] **Step 3: Verify SQL migration runs cleanly in the new Supabase project.
- [ ] **Step 4: Verify manual booking, edit reservation, Calendar resize, People permissions, and Settings remain green.
- [ ] **Step 5: Document the Edge Function deployment and iCal source setup.
- [ ] **Step 6: Commit the complete Rev2.8 checkpoint.

