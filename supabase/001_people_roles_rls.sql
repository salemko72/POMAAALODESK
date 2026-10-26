-- Booking Manager Web — People / Roles / RLS
-- Run this in Supabase SQL Editor after the People code has been copied.
-- IMPORTANT: before enabling access, bootstrap the first admin using the
-- commented INSERT/UPDATE example at the bottom.

begin;

-- Roles are intentionally constrained to the application model.
alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('admin', 'manager', 'viewer', 'cleaning'));

-- Prevent duplicate property assignments.
create unique index if not exists property_access_user_property_uidx
  on public.property_access(user_id, property_id);

-- Helper functions use SECURITY DEFINER to avoid recursive RLS checks.
create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.profiles
  where id = auth.uid()
    and is_active = true
  limit 1;
$$;

create or replace function public.has_property_access(p_property_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.current_user_role() = 'admin'
    or exists (
      select 1
      from public.property_access pa
      where pa.user_id = auth.uid()
        and pa.property_id = p_property_id
    );
$$;

create or replace function public.can_operate_property(p_property_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.current_user_role() in ('admin', 'manager')
    and public.has_property_access(p_property_id);
$$;

-- Lock down all application tables.
alter table public.profiles enable row level security;
alter table public.property_access enable row level security;
alter table public.properties enable row level security;
alter table public.reservations enable row level security;
alter table public.cleaning_tasks enable row level security;

-- Recreate policies so this script is safe to re-run.
drop policy if exists "Profiles: own or admin select" on public.profiles;
drop policy if exists "Profiles: admin update" on public.profiles;

create policy "Profiles: own or admin select"
on public.profiles
for select
to authenticated
using (
  id = auth.uid()
  or public.current_user_role() = 'admin'
);

create policy "Profiles: admin update"
on public.profiles
for update
to authenticated
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

drop policy if exists "Property access: admin manage" on public.property_access;
drop policy if exists "Property access: own select" on public.property_access;

create policy "Property access: admin manage"
on public.property_access
for all
to authenticated
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

create policy "Property access: own select"
on public.property_access
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Properties: accessible select" on public.properties;
drop policy if exists "Properties: admin insert" on public.properties;
drop policy if exists "Properties: admin or manager update" on public.properties;
drop policy if exists "Properties: admin delete" on public.properties;

create policy "Properties: accessible select"
on public.properties
for select
to authenticated
using (public.has_property_access(id));

create policy "Properties: admin insert"
on public.properties
for insert
to authenticated
with check (public.current_user_role() = 'admin');

create policy "Properties: admin or manager update"
on public.properties
for update
to authenticated
using (
  public.current_user_role() = 'admin'
  or public.can_operate_property(id)
)
with check (
  public.current_user_role() = 'admin'
  or public.can_operate_property(id)
);

create policy "Properties: admin delete"
on public.properties
for delete
to authenticated
using (public.current_user_role() = 'admin');

drop policy if exists "Reservations: accessible select" on public.reservations;
drop policy if exists "Reservations: admin or manager insert" on public.reservations;
drop policy if exists "Reservations: admin or manager update" on public.reservations;
drop policy if exists "Reservations: admin or manager delete" on public.reservations;

create policy "Reservations: accessible select"
on public.reservations
for select
to authenticated
using (public.has_property_access(property_id));

create policy "Reservations: admin or manager insert"
on public.reservations
for insert
to authenticated
with check (
  public.current_user_role() in ('admin', 'manager')
  and public.has_property_access(property_id)
);

create policy "Reservations: admin or manager update"
on public.reservations
for update
to authenticated
using (
  public.current_user_role() in ('admin', 'manager')
  and public.has_property_access(property_id)
)
with check (
  public.current_user_role() in ('admin', 'manager')
  and public.has_property_access(property_id)
);

create policy "Reservations: admin or manager delete"
on public.reservations
for delete
to authenticated
using (
  public.current_user_role() in ('admin', 'manager')
  and public.has_property_access(property_id)
);

drop policy if exists "Cleaning: operational select" on public.cleaning_tasks;
drop policy if exists "Cleaning: admin or manager insert" on public.cleaning_tasks;
drop policy if exists "Cleaning: operational update" on public.cleaning_tasks;
drop policy if exists "Cleaning: admin or manager delete" on public.cleaning_tasks;

create policy "Cleaning: operational select"
on public.cleaning_tasks
for select
to authenticated
using (
  public.has_property_access(property_id)
);

create policy "Cleaning: admin or manager insert"
on public.cleaning_tasks
for insert
to authenticated
with check (
  public.current_user_role() in ('admin', 'manager')
  and public.has_property_access(property_id)
);

create policy "Cleaning: operational update"
on public.cleaning_tasks
for update
to authenticated
using (
  public.current_user_role() in ('admin', 'manager', 'cleaning')
  and public.has_property_access(property_id)
)
with check (
  public.current_user_role() in ('admin', 'manager', 'cleaning')
  and public.has_property_access(property_id)
);

create policy "Cleaning: admin or manager delete"
on public.cleaning_tasks
for delete
to authenticated
using (
  public.current_user_role() in ('admin', 'manager')
  and public.has_property_access(property_id)
);

commit;

-- Bootstrap the first admin AFTER the transaction above succeeds.
-- Replace the email with the email used for your Supabase Auth account.
--
-- insert into public.profiles (id, email, full_name, role, is_active)
-- select id, email, coalesce(raw_user_meta_data->>'full_name', split_part(email, '@', 1)),
--        'admin', true
-- from auth.users
-- where email = 'YOUR-ADMIN-EMAIL@example.com'
-- on conflict (id) do update
-- set role = 'admin', is_active = true;
