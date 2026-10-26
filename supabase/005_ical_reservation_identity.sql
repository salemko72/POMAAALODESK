begin;

alter table public.reservations
  add column if not exists external_calendar_id uuid
    references public.external_calendars(id) on delete set null;

create unique index if not exists reservations_external_identity_uidx
  on public.reservations (external_calendar_id, external_id)
  where external_calendar_id is not null and external_id is not null;

create index if not exists reservations_external_calendar_idx
  on public.reservations (external_calendar_id);

commit;
