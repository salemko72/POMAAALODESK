# PomaaaloStay — PROJECT HANDOFF FOR CODEX

## 1. Purpose

PomaaaloStay / Booking Manager is a responsive web-first property-management workspace for small property managers, agents and owners.

Primary job:
- Make availability immediately understandable across multiple properties.
- Make today's and tomorrow's operational work obvious.
- Keep administration inside Settings.
- Be fast, touch-friendly and usable on phone, tablet and desktop.

This is NOT a full PMS. Do not add accounting, payment processing, CRM or internal chat unless explicitly requested.

## 2. Current stack

Frontend:
- React
- TypeScript
- Vite
- Tailwind CSS
- date-fns
- lucide-react

Backend:
- Supabase
- PostgreSQL
- Supabase Auth
- Row Level Security
- Supabase Edge Functions

Hosting:
- Vercel

Local project:
- `C:\BOOKWEB`

Supabase project:
- Name: `Booking Manager Web 2`
- Project ID: `jawcaedeynlbyntjolrg`
- Region: `eu-west-1`

Never expose service-role secrets in browser code.
Environment configuration belongs in `.env.local` / Vercel environment variables.

## 3. Canonical product specification

See:
`docs/MASTER-SPECIFICATION.md`
and
`docs/PomaaaloStay_Web_Project_Master_Specification_v2.0_September_2026.docx`

The DOCX contains the complete product specification. This handoff summarizes the most important current decisions.

## 4. Navigation

Current destinations:
- Home
- Calendar
- Properties
- New Booking
- Settings

Mobile uses persistent bottom navigation.

New Booking is the visually prominent darker-purple action.

Logout is NOT in bottom navigation.
Logout is accessed from the Home top-right account control, with the small "Logout" label below it.

## 5. Home

Home is the daily operational overview.

Top:
- Large light-weight `Daily Overview`
- `Good morning, Kate`
- Current date

Summary cards:
- Check-ins
- Check-outs
- Cleanings

Main content:
- Today
- Tomorrow

Desktop:
- two equal vertical columns
- thin vertical divider

Mobile:
- Today first
- Tomorrow below

Tomorrow is visually quieter/lighter.

Event rows contain:
- property image
- property name
- source
- time
- guest count
- relevant status

Empty state:
`You're all clear. No check-ins, check-outs or cleanings today.`

## 6. Calendar

Calendar is a continuous horizontal multi-property timeline.

Rules:
- Date columns are continuous left-to-right.
- Properties are rows.
- Reservations render as horizontal bars.
- Today line is visible.
- Horizontal scroll through months.
- Do NOT replace this with a primary month/week selector.
- Mobile uses horizontal swipe/scroll.
- Clicking a reservation opens its detail.
- Clicking a property opens property detail/calendar.
- Manual reservations are editable.
- iCal-imported reservations are read-only.

Booking duration resizing:
- left/right resize changes check-in/check-out dates.
- every resize date change requires confirmation.
- if resulting dates conflict, reject and roll back.
- double-click reservation opens Edit Reservation.

Overlap:
- overlapping bookings are vertically stacked in lanes.

Visual density:
- Preserve the dense geometry used by the current implementation ("75% legacy dense geometry").
- This refers to geometry/density, NOT the displayed zoom percentage.
- Default zoom display starts at 100%.

Zoom:
- timeline can zoom smaller/larger.
- FIT is an ON/OFF state represented by a small switch.
- FIT means approximately 3 months / 90 days.

Reservation bar:
- small circular source icon/mark at left.
- guest name large/bold.
- date range ALWAYS visible on the right/continuation, small/light.
- example: `13.07. – 23.07. 2026.`
- property name is NOT repeated in the booking bar.
- property photo is shown in the booking bar.
- resize affordance uses three vertical dots near bar end.
- iCal bars may show the affordance visually but remain read-only.

## 7. Properties

Properties are generic entities. Never hard-code Priko, Kate, one user, one agent or one listing.

Property cards:
- rounded-square cards
- desktop/horizontal: 3 per row
- mobile/vertical: 2 per row
- normal grid with no unnecessary vertical gaps
- property imagery is important
- circular profile image can be used in detail/profile contexts
- AC is an attribute

Do NOT use a LINK button on property cards.

iCal sources belong to the property:
- New Property must support adding iCal links before saving.
- Edit Property supports iCal links.
- A property can have multiple calendar sources.

Save behaviour:
- Save Changes saves the property and automatically exits the editor / returns to Properties list.

## 8. Property fields

Current V1 fields:
- id
- name
- address
- city
- capacity
- rooms
- area_m2
- image_url
- notes
- check_in_time
- check_out_time
- parking
- wifi
- keybox
- air_conditioning
- cleaning_duration_minutes
- active

Later/optional:
- color
- latitude
- longitude

Demo Priko:
- Name: Priko
- Address: Kralja Tomislava 27
- City: Stari Grad
- Area: 61 m²
- Capacity: 6 (4+2)
- Rooms: 3
- Check-in: 14:00
- Check-out: 10:00
- Wi-Fi: true
- AC: true
- Cleaning: 120 minutes
- Notes: `Apartman 61 m², kapacitet 4+2.`

## 9. iCal / Airbnb / Booking.com model

V1 uses iCal, not direct platform APIs.

CRITICAL:
- iCal is NOT global to a landlord/agent.
- Every external calendar belongs to exactly one property.
- One property may have multiple calendar sources.
- Initial sources: Airbnb iCal, Booking.com iCal, generic/other iCal.
- Store feed URL, active state, last sync, sync status and errors.
- Background sync target is approximately every 15 minutes.
- Sync is server-side.
- Imported reservations are read-only.
- Use external calendar identity + external_id as idempotency key.
- Sync must be idempotent and must not create duplicates.
- Manual reservations are NEVER deleted or overwritten by iCal sync.
- Source identity remains visible.
- Conflicts are recomputed after relevant sync changes.

Current tables/models include:
- `external_calendars`
- `booking_conflicts`
- `reservations.external_calendar_id`
- `reservations.external_id`

Current external calendar model is property-scoped.

## 10. Overbooking / conflicts

Important product rule:
- Overbooking is NOT blocked.
- A conflicting booking may be saved.
- The booking is then marked/represented as a conflict.

Conflict rules:
- never reject a reservation only because a conflict exists.
- never delete a manual reservation because of iCal sync.
- cancelled reservations do not create active conflicts.
- conflict status: `open` / `resolved`.
- conflicts remain open until explicitly resolved.
- duplicate conflict pairs must not create duplicate conflict rows.

`booking_conflicts` includes:
- id
- property_id
- reservation_a_id
- reservation_b_id
- conflict_type
- status
- detected_at
- resolved_at
- resolved_by

## 11. Reservations

Core fields:
- id
- property_id
- source
- guest_name
- check_in
- check_out
- guests
- notes
- status
- external_id
- external_calendar_id
- created_at
- updated_at

Sources include:
- `airbnb`
- `booking`
- `direct`
- `agency`
and current iCal model variants such as:
- `airbnb_ical`
- `booking_ical`
- `other_ical`

Statuses:
- tentative
- confirmed
- cancelled

New Booking is for:
- manual/direct
- agency

## 12. Cleaning

Cleaning task is linked to reservation and property.

Defaults:
- start = reservation check-out
- duration = property's `cleaning_duration_minutes`
- end = start + duration

Manual override/lock is supported.

Reservation timing changes update automatic cleaning timing unless manually overridden/locked.

Statuses:
- pending
- in_progress
- done

Cleaning users see operational data only.
No internal chat.

## 13. Users / roles / access

Roles:
- Admin: full system access
- Manager: operational access to assigned properties; no global user administration
- Viewer: read-only assigned properties/reservations
- Cleaning: cleaning-relevant assigned-property data; can update cleaning status

Property access uses User–Property assignments.

RLS must enforce the access model.

Deactivated users lose access without historical data being deleted.

Cleaning users must not receive unnecessary guest-sensitive information.

## 14. People / admin-user Edge Function

The Supabase Edge Function:
- `admin-user`

Current deployment state:
- active
- JWT verification enabled
- uses server-side privileges for administrative user operations

Do not put service-role credentials in browser code.

Important:
- backend function has been deployed.
- People UI still requires real-world functional verification before declaring it complete.

## 15. Authentication

Supabase Auth email/password.

Requirements:
- persistent browser session
- forgot password from Login
- recovery email browser reset-password page
- useful state for invalid/expired recovery links
- no blank page on auth errors
- no iOS custom URL scheme required for web V1

## 16. Settings

Settings areas:
- Properties
- People
- Calendar / Sources
- Notifications
- Account
- Appearance
- Formatting
- Language

Preferences:
- Appearance: Light / Dark / System
- EU date format: DD.MM.YYYY
- Imperial measurement units option
- Language: English / Hrvatski
- Language and formatting preferences are independent

## 17. Visual direction

- Montserrat or close geometric sans-serif
- light neutral base
- restrained lavender/purple accent family
- rounded surfaces
- subtle or no shadows
- functional colors mainly for status/conflict meaning
- large typography and strong hierarchy
- thin subtle icon outlines
- simple pictograms
- property imagery as visual anchor
- no hover-only functionality

## 18. Demo mode

Suggested demo properties:
- Priko
- Nelly
- Pjaca

Demo must look alive immediately but must not contain real guest PII.

Demo should exercise:
- Home
- Calendar
- Properties
- New Booking
- cleaning
- permissions

## 19. Current implementation checkpoint

At the latest Revision 3 checkpoint:
- Authentication connected to Supabase Auth.
- Operational data connected to Supabase.
- Home connected to operational data and Revision 3 UI applied.
- Calendar continuous timeline, reservation editing and resize persistence implemented.
- Conflict rules implemented and tested.
- Persistent booking conflicts implemented.
- Property-scoped iCal database/repository model implemented.
- Properties UI current grid/card direction and fixes applied.
- `admin-user` Edge Function deployed.
- People UI still needs real-world verification.
- Latest regression checkpoint: 46/46 test files and 123/123 tests passing.
- Production build passes.
- Vite reports a non-blocking >500 kB JS chunk warning.

## 20. Engineering rules for Codex

1. Inspect the existing repository before changing architecture.
2. Read this handoff and the canonical Master Specification first.
3. Treat current source code + these docs as the source of truth.
4. Use TDD for production behaviour changes.
5. Run focused tests for the change.
6. Run full regression after major changes.
7. Run the real production build before claiming completion.
8. Verify responsive UI at representative phone/tablet/desktop sizes.
9. Do not call a feature complete from tests alone when user flow still needs visual/functional verification.
10. Never expose service-role secrets.
11. Never hard-code one property, user, agent or source.
12. Preserve existing product decisions unless an explicitly approved new requirement changes them.
13. Before large architectural changes, explain the change and its impact.
14. Keep modules coherent and architecture simple.
15. Prefer fixing the existing implementation over replacing working systems wholesale.
