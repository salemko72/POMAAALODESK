begin;

create table if not exists public.external_calendars (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  source text not null check (source in ('airbnb_ical', 'booking_ical', 'other_ical')),
  feed_url text not null,
  is_active boolean not null default true,
  last_synced_at timestamptz,
  sync_status text not null default 'idle'
    check (sync_status in ('idle', 'syncing', 'success', 'error')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists external_calendars_property_active_idx
  on public.external_calendars (property_id, is_active);

create table if not exists public.booking_conflicts (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  reservation_a_id uuid not null references public.reservations(id) on delete cascade,
  reservation_b_id uuid not null references public.reservations(id) on delete cascade,
  conflict_type text not null default 'overlap'
    check (conflict_type in ('overlap')),
  status text not null default 'open'
    check (status in ('open', 'resolved')),
  detected_at timestamptz not null default timezone('utc', now()),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (reservation_a_id <> reservation_b_id)
);

create unique index if not exists booking_conflicts_pair_uidx
  on public.booking_conflicts (
    property_id,
    least(reservation_a_id, reservation_b_id),
    greatest(reservation_a_id, reservation_b_id),
    conflict_type
  );

create index if not exists booking_conflicts_status_property_idx
  on public.booking_conflicts (status, property_id);

create index if not exists booking_conflicts_reservation_a_idx
  on public.booking_conflicts (reservation_a_id);

create index if not exists booking_conflicts_reservation_b_idx
  on public.booking_conflicts (reservation_b_id);

commit;
