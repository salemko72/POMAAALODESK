begin;

alter table public.booking_conflicts
  add column if not exists resolved_at timestamptz,
  add column if not exists resolved_by uuid references public.profiles(id) on delete set null;

create unique index if not exists booking_conflicts_pair_uidx
  on public.booking_conflicts (
    property_id,
    least(reservation_a_id, reservation_b_id),
    greatest(reservation_a_id, reservation_b_id)
  );

create index if not exists booking_conflicts_status_property_idx
  on public.booking_conflicts (status, property_id);

commit;
