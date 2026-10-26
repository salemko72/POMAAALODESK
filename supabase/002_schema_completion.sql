-- Booking Manager Web — schema completion
-- Adds fields already defined in the project specification.
-- Safe to run more than once.

begin;

alter table public.properties
  add column if not exists address text,
  add column if not exists city text,
  add column if not exists image_url text,
  add column if not exists notes text,
  add column if not exists parking boolean default false,
  add column if not exists keybox boolean default false;

alter table public.reservations
  add column if not exists notes text,
  add column if not exists external_id text,
  add column if not exists created_at timestamptz default timezone('utc', now()),
  add column if not exists updated_at timestamptz default timezone('utc', now());

alter table public.profiles
  add column if not exists avatar_url text;

commit;

-- Existing sample property data
update public.properties
set address = case
    when id = '11111111-1111-1111-1111-111111111111' then 'Kralja Tomislava 27'
    else address
  end,
  city = case
    when id in (
      '11111111-1111-1111-1111-111111111111',
      '22222222-2222-2222-2222-222222222222',
      '33333333-3333-3333-3333-333333333333'
    ) then 'Stari Grad'
    else city
  end
where id in (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333'
);
