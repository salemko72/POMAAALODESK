# PomaaaloStay UI Cleanup and Calendar Links Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the current deployed web UI in line with the approved September 2026 mobile-first design corrections while preserving the existing booking, iCal identity, conflict, and reservation behavior.

**Architecture:** Keep the current React/Vite/Supabase structure. UI concerns remain in the existing page and shell components; per-property iCal links use the existing `external_calendars` table and repository rather than adding a second local settings model. Calendar zoom separates the displayed percentage from timeline density and makes FIT an explicit toggle.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind CSS v4, lucide-react, Vitest, Testing Library, Supabase.

**Spec:** `docs/superpowers/specs/2026-09-06-ical-overbooking-design.md` plus the owner-approved UI update in this conversation.

## Global Constraints

- Default appearance is Light; Dark mode is not redesigned in this update.
- Whole-app background is a very light warm beige.
- Logout is only on Home, in the upper-right as a circular icon with small text beneath.
- Home summary cards stay in one row and use square/aspect-square cards.
- Properties grid is always 2 columns on phone/vertical layouts and 3 columns on desktop/horizontal layouts.
- Calendar keeps the current dense timeline geometry while displaying 100% as the default zoom.
- Calendar FIT is an explicit ON/OFF state and represents 3 months when ON.
- Each property can have multiple calendar links, property-scoped.
- Imported iCal reservations remain read-only.
- Do not redesign or replace the existing Supabase reservation/conflict architecture.

---

### Task 1: Global light appearance and shell navigation

**Files:**
- Modify: `src/lib/settings.ts`
- Modify: `src/components/AppShell.tsx`
- Modify: `src/App.tsx`
- Modify: `src/pages/HomePage.tsx`

**Interfaces:**
- `getSettings()` continues returning `AppSettings`.
- `HomePage` accepts `onLogout?: () => void`.
- `AppShell` contains only the five primary navigation items.

- [ ] **Step 1: Write failing tests**
- `src/settings.test.ts`: assert default `appearance` is `light`.
- `src/app-shell-navigation.test.tsx`: assert navigation contains Home, Calendar, Properties, New Booking, Settings and no logout button.
- `src/home-page.test.tsx`: assert the Home logout control exists.

- [ ] **Step 2: Run the focused tests and confirm the new assertions fail against the old UI.**

- [ ] **Step 3: Implement the minimal changes**
  - Change settings default from `system` to `light`.
  - Remove Logout from the bottom navigation.
  - Move sign-out action into Home.
  - Route Home receives the authentication reset callback.
  - Use `bg-[#f6f1e9]`/equivalent warm beige surface for the app shell.

- [ ] **Step 4: Run the focused tests again and confirm they pass.**

- [ ] **Step 5: Commit**
  ```bash
  git add src/lib/settings.ts src/components/AppShell.tsx src/App.tsx src/pages/HomePage.tsx src/settings.test.ts src/app-shell-navigation.test.tsx src/home-page.test.tsx
  git commit -m "feat: refine light shell and home logout"
  ```

### Task 2: Home operational overview redesign

**Files:**
- Modify: `src/pages/HomePage.tsx`
- Modify: `src/lib/i18n.ts`
- Test: `src/home-page.test.tsx`

**Interfaces:**
- `DailyOperationalSummary` and operational repository contracts remain unchanged.
- `dailyOverview` becomes the main Home heading.

- [ ] **Step 1: Write the failing test** for:
  - `Daily Overview` heading
  - `Good morning, Kate`
  - exactly three summary cards
  - `grid-cols-3`
  - `aspect-square`
  - upper-right Log out button

- [ ] **Step 2: Run the test and confirm the current Home fails the new heading/layout expectations.**

- [ ] **Step 3: Implement the minimal UI**
  ```tsx
  <h1 className="text-3xl font-light ...">Daily Overview</h1>
  <p className="mt-2 text-base font-medium ...">Good morning, Kate</p>
  ```
  Use a `grid-cols-3` summary grid and `aspect-square` cards.

- [ ] **Step 4: Run the Home test and confirm PASS.**

- [ ] **Step 5: Commit**
  ```bash
  git add src/pages/HomePage.tsx src/lib/i18n.ts src/home-page.test.tsx
  git commit -m "feat: redesign daily overview"
  ```

### Task 3: Calendar density, zoom semantics, and booking text

**Files:**
- Modify: `src/pages/CalendarPage.tsx`
- Modify: `src/lib/calendar-style.ts`
- Modify: `src/calendar-page.test.tsx`
- Modify: `src/calendar-style.test.ts`

**Interfaces:**
- Keep `layoutReservations()` unchanged.
- Keep resize persistence behavior unchanged.
- `getReservationSourceBadge(source)` returns `{ label: string; name: string }`.

- [ ] **Step 1: Write failing tests** for:
  - default displayed zoom is `100%`
  - default physical timeline width stays equivalent to the current dense geometry
  - FIT exposes `aria-pressed` and toggles ON/OFF
  - booking bar shows guest name
  - booking bar uses compact source badge
  - date stays visible on the bar

- [ ] **Step 2: Run the focused Calendar tests and confirm failures are from the requested behavior.**

- [ ] **Step 3: Implement**
  - Use `DAY_WIDTH_BASE = 51` so 100% retains the existing dense geometry.
  - Keep `ROW_LABEL_WIDTH` compact (`96px`).
  - Default `zoom = 1`.
  - Use a broader manual zoom list such as `[0.5, 0.75, 1, 1.25, 1.5]`.
  - FIT toggles between ON/OFF and switches the visible range between 90 and 45 days.
  - Normalize `airbnb_ical` and `booking_ical` to their provider colors.
  - Render source badge, guest name, and date range; remove the property thumbnail/name from the bar.

- [ ] **Step 4: Run focused Calendar tests and the existing resize tests.**

- [ ] **Step 5: Commit**
  ```bash
  git add src/pages/CalendarPage.tsx src/lib/calendar-style.ts src/calendar-page.test.tsx src/calendar-style.test.ts
  git commit -m "feat: refine calendar zoom and booking bars"
  ```

### Task 4: Properties grid and per-property calendar link editor

**Files:**
- Modify: `src/pages/PropertiesPage.tsx`
- Modify: `src/lib/ical-repository.ts`
- Modify: `src/properties-page.test.tsx`
- Modify: `src/lib/ical-repository.test.ts`

**Interfaces:**
- Existing `ExternalCalendarRecord` remains source of truth.
- Add:
  - `updateExternalCalendar(id, changes)`
  - `deleteExternalCalendar(id)`

- [ ] **Step 1: Write failing tests** for:
  - property grid `grid-cols-2 md:grid-cols-3`
  - each property card using `aspect-square`
  - LINK button exists
  - clicking LINK opens `Calendar links`
  - multiple existing links render
  - repository can update and delete a link

- [ ] **Step 2: Run focused tests and verify they fail before production implementation.**

- [ ] **Step 3: Implement**
  - Use `grid-cols-2 md:grid-cols-3`.
  - Use `aspect-square` property cards.
  - Add a `LINK` control to each card.
  - Open a property-scoped editor.
  - Support source choices Airbnb, Booking.com, Other.
  - Allow adding, editing, saving, and deleting multiple feed URLs.
  - Reuse `external_calendars`; do not store duplicated links in local settings.

- [ ] **Step 4: Run focused Properties/iCal tests and existing property tests.**

- [ ] **Step 5: Commit**
  ```bash
  git add src/pages/PropertiesPage.tsx src/lib/ical-repository.ts src/properties-page.test.tsx src/lib/ical-repository.test.ts
  git commit -m "feat: add property calendar links"
  ```

### Task 5: Regression, build, and deployment handoff

**Files:**
- Modify only if verification reveals a direct regression.

- [ ] **Step 1:** Run the full Vitest suite.
- [ ] **Step 2:** Run `npm run build`.
- [ ] **Step 3:** Confirm there are no new runtime errors from the updated flows.
- [ ] **Step 4:** Package the source tree without `node_modules`, `.git`, `.env.local`, and stale `dist`.
- [ ] **Step 5:** Deploy from `C:\BOOKWEB` with the user’s existing Vercel project:
  ```powershell
  npm.cmd exec vercel -- --prod
  ```
