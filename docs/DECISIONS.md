# PomaaaloStay — DECISIONS

## Product

- Product is a responsive WEB application, not a native V1 mobile app.
- Mobile targets include iPhone Safari, iPad Safari and Android browsers.
- Desktop browsers are supported.
- Supabase is the authoritative backend.
- V1 is intentionally not a full PMS.

## UX

- Home is an operational daily overview.
- Today and Tomorrow are the main Home content.
- Calendar is a continuous horizontal timeline, not a month-grid-first calendar.
- Properties are shown as a clean responsive card grid.
- New Booking is the prominent navigation action.
- Logout is not in bottom navigation.
- Property cards do not contain LINK buttons.
- Property editing exits automatically after Save Changes.
- iCal configuration is property-scoped.
- Calendar bars show source + guest + always-visible date range.
- Imported iCal reservations are read-only.
- Manual reservations remain editable.
- Overbooking is allowed and produces a conflict state.
- FIT is a small switch and means about 90 days / 3 months.
- Dense timeline geometry is intentionally preserved; 75% refers to geometry density, not zoom display.

## iCal

- Never model iCal as a global feed for an agent.
- One property can have multiple sources.
- Every external calendar belongs to exactly one property.
- Sync is idempotent.
- Manual bookings are never deleted or overwritten by sync.
- Cancelled reservations do not generate active conflicts.

## Conflicts

- Conflicts do not block saving a booking.
- Conflicts are persistent records.
- Status is open/resolved.
- Conflict pairs must be unique.
- Every date resize that changes a reservation requires confirmation.
- A resize that would create a forbidden conflict is rejected and rolled back according to the current Calendar rules; normal new-booking overbooking remains allowed.

## Permissions

- Access is based on User–Property assignments.
- RLS enforces access.
- Roles are Admin, Manager, Viewer and Cleaning.
- Cleaning role receives operationally relevant data only.

## Security

- Supabase service-role credentials never enter browser code.
- Administrative user actions use the server-side `admin-user` Edge Function.
