# PomaaaloStay Rev2.8 — iCal & Overbooking Design

## Goal
Uvesti centralni booking/calendar model u kojem svaki iCal feed pripada konkretnoj nekretnini, rezervacije iz različitih izvora mogu koegzistirati, a preklapanja se evidentiraju kao rješivi OVERBOOK/CONFLICT događaji umjesto da se rezervacije automatski blokiraju ili brišu.

## Architecture
`properties` → `external_calendars` → periodic iCal sync → central `reservations` → deterministic conflict detection → `booking_conflicts` → Calendar + Home Action Center.

A reservation zadržava vlastiti source (`airbnb_ical`, `booking_ical`, `direct`, `agency`, budući izvori). Conflict je zaseban entitet sa statusom `open/resolved`, tako da rezervacija može ostati `confirmed` čak i dok sudjeluje u otvorenom konfliktu.

## Core rules
1. `external_calendars.property_id` je obavezan.
2. Jedna nekretnina može imati više external calendars.
3. iCal sync je idempotentan preko `external_id` u kombinaciji s konkretnim external calendar izvorom.
4. Manual/Agency reservation je nezavisna od iCal feedova.
5. Svako novo ili promijenjeno razdoblje provjerava preklapanje svih rezervacija iste nekretnine, osim cancelled.
6. Konflikt ne blokira upis i ne briše rezervaciju.
7. Svaki aktivni konflikt je jasno označen na Calendar timelineu crvenim conflict treatmentom.
8. Home Action Center prikazuje otvorene konflikte i direktno vodi na relevantni booking/property timeline.
9. Conflict ostaje otvoren dok ga korisnik eksplicitno ne riješi.
10. Model je generičan po property/user accountu i ne smije sadržavati hard-code za Priko/Nelly/Pjaca ili pojedinu platformu.
