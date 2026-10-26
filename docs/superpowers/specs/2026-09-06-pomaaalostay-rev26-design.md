# PomaaaloStay Revision 2.6 Design

## Goal
Refine the calendar interaction model and complete the first operational administration flow without changing the existing Supabase/RLS architecture.

## Scope
- Calendar: default zoom 75%; FIT presents 90 days (three months); reservation bars use property-first typography and Smoobu-inspired resize affordances.
- Resize: pointer preview is not persisted until explicit confirmation. Conflicts still roll back immediately.
- Reservation editing: double-clicking a manual/operational reservation opens `/edit-reservation/:id`; imported Airbnb/Booking reservations remain read-only for source/date/guest fields.
- Date selection: reusable month/week date-picker popup with Monday-first weeks and DD.MM.YYYY presentation.
- Users: People administration can invite and delete users. Invitations and deletion go through a Supabase Edge Function using the service-role key server-side; the browser never receives that secret. Roles remain admin/manager/viewer/cleaning and property access remains user-to-property.
- Properties: selecting a property shows a compact three-month availability reminder timeline beneath its details.

## Files
UI: CalendarPage, EditReservationPage, NewBookingPage, PropertiesPage, PeoplePage, DatePicker, PropertyTimeline, App.
Data: reservations-repository, admin-users.
Server: `supabase/functions/admin-user/index.ts`.
Tests: calendar, resize confirmation, date picker, edit reservation, people/admin users, property timeline.

## Acceptance criteria
- Default calendar visibly reports 75% zoom and shows 45 days.
- FIT switches to 90 days.
- Date picker opens and emits ISO dates while displaying European numeric dates.
- Resize does not call persistence until Confirm; Cancel restores the original dates.
- Double-click reaches the edit route.
- Manual reservations can be updated; imported reservations keep source/date/guest fields read-only.
- Admin can open Add User, send an invitation with role/property access, and delete a user other than self.
- Property details show a three-month availability timeline.
