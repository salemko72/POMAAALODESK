# BOOKWEB: početak na drugom računaru
Paket pripremljen 12.10.2026. Ovo je pregled lokalnih fajlova, bez novog pregleda produkcije ili pokretanja testova.

Projekat se u dokumentaciji naziva PomaaaloStay / PomaaaloDesk / Booking Manager. Web aplikacija za upravljanje smještajem, rezervacijama, gostima, kalendarima i operativnim zadacima. Kod: React, TypeScript i Vite, Supabase backend te Cloudflare worker-i.

## Prvo pročitati
1. docs/PROJECT-HANDOFF.md i docs/MASTER-SPECIFICATION.md
2. docs/DISASTER-RECOVERY.md i docs/AUTOMATIC-BACKUP.md
3. docs/DECISIONS.md te trenutni kod i testove.

CURRENT-STATUS i PROJECT-HANDOFF sadrže septembarske kontrolne tačke i starije navode o Vercelu. Noviji DISASTER-RECOVERY navodi Cloudflare Pages: https://bookweb.pages.dev. Ne pretpostavljati da su stari statusi/testovi dokaz današnjeg stanja. Aktivne servise treba zasebno provjeriti kada nastavljate rad.

## Sačuvano stanje
HEAD: 04b69b1720cf37ac70ced49365a12d3b16082eb1
Sačuvani su i nekomitovani fajlovi u priloženom BOOKWEB folderu. Git bundle je pored foldera. Nemoj zamijeniti trenutni kod starim commitom.
Kod uključuje novije fajlove za automatski backup, iCal, overbooking i praćenje izvora rezervacije, uključujući migracije od 14, 16. i 23. septembra. Samo prisustvo fajlova ne dokazuje da je sve primijenjeno na serveru.

## Lokalno pokretanje
Instalirati Node.js i u folderu BOOKWEB pokrenuti npm ci. Prema .env.example napraviti .env.local s odgovarajućim vrijednostima iz vlastitog projekta, zatim npm run dev. Postoje naredbe npm test i npm run build. Alati i instalirane biblioteke nisu dio ZIP-a.
Ne objavljivati niti primjenjivati migracije automatski tokom samog prijenosa. Servisi i pristupni računi ostaju postojeći. Postupak obnove baze/slika objašnjen je u docs/DISASTER-RECOVERY.md. Uključeni backupi su stari lokalni fajlovi, bez novog izvoza baze ili R2 slika.
Istorijski razgovori BOOKWEB-a nisu izvezeni u ovaj paket. Postojeća dokumentacija je sačuvana za nastavak.

## Radno stanje u trenutku pakovanja
```text
 M src/App.tsx
 M src/components/AppShell.tsx
 M src/components/PropertyTimeline.tsx
 M src/edit-reservation-page.test.tsx
 M src/lib/booking-conflicts.ts
 M src/lib/ical-repository.ts
 M src/lib/operational-repository.ts
 M src/lib/reservation-rules.ts
 M src/lib/reservations-repository.ts
 M src/pages/BackupPage.tsx
 M src/pages/CalendarPage.tsx
 M src/pages/EditReservationPage.tsx
 M src/pages/HomePage.tsx
 M src/pages/NewBookingPage.tsx
 M src/pages/OperationsPage.tsx
 M src/pages/PropertiesPage.tsx
?? .sheet-work/
?? .supabase-changelog-check.md
?? docs/AUTOMATIC-BACKUP.md
?? outputs/
?? public/airbnb-logo.svg
?? public/booking-logo.svg
?? src/auto-backup-worker.test.ts
?? src/components/AutoBackup.tsx
?? src/components/BookingAvailability.tsx
?? src/components/OverbookAlerts.tsx
?? src/components/ReservationAttribution.tsx
?? src/components/ReservationSourceMark.tsx
?? src/lib/auto-backup.ts
?? src/lib/ical-parser.test.ts
?? src/lib/ical-sync-context.tsx
?? src/lib/overbook-override.ts
?? src/reservation-attribution.test.tsx
?? supabase/.temp/
?? supabase/functions/ical-sync/
?? supabase/migrations/20260914070452_ical_sync_and_overbooking.sql
?? supabase/migrations/20260914071224_ical_status_and_source_guards.sql
?? supabase/migrations/20260914071634_ical_snapshot_reconciliation.sql
?? supabase/migrations/20260914071858_audited_overbook_override.sql
?? supabase/migrations/20260916142642_automatic_agency_backups.sql
?? supabase/migrations/20260923120246_harden_backup_rpc_grants.sql
?? supabase/migrations/20260923121247_reservation_attribution.sql
?? supabase/tests/reservation_attribution.sql
?? worker/agency-backups.ts
?? wrangler.backups.jsonc
```
