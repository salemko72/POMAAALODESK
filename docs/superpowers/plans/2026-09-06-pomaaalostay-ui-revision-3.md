# PomaaaloStay UI Revision 3 — concentrated UX update

## Scope
Consolidated from the UI review PDF and the follow-up Home dashboard direction.

### Home
- Light/beige application surface.
- Daily Overview heading with light typography and greeting beneath.
- Logout only in Home header as circular icon with small label.
- Three square summary cards remain in one row on phone and desktop; each has a pictogram inside a rounded square.
- Today and Tomorrow are two operational panels on desktop, separated by a subtle vertical divider.
- On mobile, Tomorrow stacks below Today.
- Tomorrow is visually quieter/smaller than Today.
- Event rows include property image, property name, guest/event details, time, status and chevron.
- Tomorrow loads operational data as well as Today.
- First-login/session readiness failure gets a friendly retry state instead of a raw error-only screen.

### Calendar
- Keep dense timeline geometry at 100% (do not inflate day width).
- Keep zoom adjustable below/above 100%.
- FIT is a compact ON/OFF switch and remains a 90-day view.
- Reduce property label column width.
- Booking bars show property image + source badge + guest name + compact date range.
- Date range is always visible on the bar.
- Preserve resize/overlap semantics.

### Properties
- Two-column mobile / three-column desktop square property cards.
- Remove the LINK button from property cards.
- Calendar links live inside the property editor.
- New properties can add multiple iCal links before saving; links are persisted after the property is created.
- Saving an existing property returns to the property list.
- Address autocomplete selection explicitly commits address/city/coordinates on pointer interaction.

### People
- Keep existing role/access UI.
- Ensure the `admin-user` Edge Function is deployed to the Supabase project so direct user creation/invitation/deletion can operate in production.

## Verification
- Production build and full test suite must be run on the user's Windows project after replacing the package.
- Do not claim tests are green from the packaging environment because dependencies are intentionally excluded from the package and were not available for a full local run here.
