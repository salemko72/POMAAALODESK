-- Multi-agency foundation. Run only after 014_pre_multi_agency_backup.sql.
begin;

create table if not exists public.agencies (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  slug text not null unique,
  logo_url text,
  country text not null default '',
  language text not null default 'hr' check (language in ('hr', 'en')),
  currency text not null default 'EUR',
  timezone text not null default 'Europe/Sarajevo',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.agency_memberships (
  agency_id uuid not null references public.agencies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'manager', 'viewer', 'cleaning')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (agency_id, user_id)
);

create index if not exists agency_memberships_user_idx
  on public.agency_memberships(user_id, is_active);

alter table public.properties add column if not exists agency_id uuid references public.agencies(id);
alter table public.guests add column if not exists agency_id uuid references public.agencies(id);

do $legacy$
declare
  legacy_agency constant uuid := '00000000-0000-0000-0000-000000000001';
  first_admin uuid;
begin
  select id into first_admin
  from public.profiles
  where role = 'admin' and is_active = true
  order by id
  limit 1;

  insert into public.agencies(id, name, slug, language, currency, timezone, created_by)
  values (legacy_agency, 'Jolie Agency', 'jolie-agency', 'hr', 'EUR', 'Europe/Sarajevo', first_admin)
  on conflict (id) do update set name='Jolie Agency', slug='jolie-agency', updated_at=now();

  insert into public.agency_memberships(agency_id, user_id, role, is_active)
  select legacy_agency, p.id,
    case when p.id = first_admin then 'owner' else p.role end,
    p.is_active
  from public.profiles p
  on conflict (agency_id, user_id) do nothing;

  update public.properties set agency_id = legacy_agency where agency_id is null;
  update public.guests set agency_id = legacy_agency where agency_id is null;
end;
$legacy$;

alter table public.properties alter column agency_id set not null;
alter table public.guests alter column agency_id set not null;

create index if not exists properties_agency_idx on public.properties(agency_id, is_active);
create index if not exists guests_agency_idx on public.guests(agency_id);

create or replace function public.requested_agency_id()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  header_value text;
  result uuid;
begin
  header_value := nullif(
    coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb ->> 'x-agency-id',
    ''
  );
  if header_value is not null then
    begin result := header_value::uuid; exception when others then return null; end;
    return result;
  end if;

  select case
    when count(*) = 1 then (array_agg(agency_id))[1]
    else null
  end into result
  from public.agency_memberships
  where user_id = auth.uid() and is_active = true;
  return result;
end;
$$;

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.agency_memberships
  where agency_id = public.requested_agency_id()
    and user_id = auth.uid()
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
  select coalesce(
    exists (
      select 1
      from public.properties p
      where p.id = p_property_id
        and p.agency_id = public.requested_agency_id()
        and (
          public.current_user_role() in ('owner', 'admin')
          or exists (
            select 1 from public.property_access pa
            where pa.user_id = auth.uid() and pa.property_id = p.id
          )
        )
    ), false
  );
$$;

create or replace function public.can_operate_property(p_property_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role() in ('owner', 'admin', 'manager')
    and public.has_property_access(p_property_id);
$$;

alter table public.properties alter column agency_id set default public.requested_agency_id();
alter table public.guests alter column agency_id set default public.requested_agency_id();

create or replace function public.create_agency(
  p_name text,
  p_logo_url text default null,
  p_country text default '',
  p_language text default 'hr',
  p_currency text default 'EUR',
  p_timezone text default 'Europe/Sarajevo'
)
returns public.agencies
language plpgsql
security definer
set search_path = public
as $$
declare
  created public.agencies;
  base_slug text;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if length(trim(coalesce(p_name, ''))) < 2 then raise exception 'Agency name is required' using errcode = '22023'; end if;

  insert into public.profiles(id, email, full_name, role, is_active)
  select id, email, coalesce(raw_user_meta_data ->> 'full_name', split_part(email, '@', 1)), 'admin', true
  from auth.users where id = auth.uid()
  on conflict (id) do update set is_active = true;

  base_slug := trim(both '-' from regexp_replace(lower(trim(p_name)), '[^a-z0-9]+', '-', 'g'));
  if base_slug = '' then base_slug := 'agency'; end if;

  insert into public.agencies(name, slug, logo_url, country, language, currency, timezone, created_by)
  values (
    trim(p_name), base_slug || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6),
    p_logo_url, coalesce(p_country, ''),
    case when p_language in ('hr', 'en') then p_language else 'hr' end,
    coalesce(nullif(p_currency, ''), 'EUR'),
    coalesce(nullif(p_timezone, ''), 'Europe/Sarajevo'), auth.uid()
  ) returning * into created;

  insert into public.agency_memberships(agency_id, user_id, role, is_active)
  values (created.id, auth.uid(), 'owner', true);
  return created;
end;
$$;

create or replace function public.get_my_agencies()
returns table(id uuid, name text, slug text, logo_url text, country text, language text, currency text, timezone text, role text, is_active boolean)
language sql
stable
security definer
set search_path = public
as $$
  select a.id, a.name, a.slug, a.logo_url, a.country, a.language, a.currency, a.timezone, m.role, m.is_active
  from public.agency_memberships m
  join public.agencies a on a.id = m.agency_id
  where m.user_id = auth.uid() and m.is_active = true
  order by a.name;
$$;

create or replace function public.get_agency_members()
returns table(id uuid, email text, full_name text, role text, is_active boolean)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.email, p.full_name, m.role, m.is_active
  from public.agency_memberships m
  join public.profiles p on p.id = m.user_id
  where m.agency_id = public.requested_agency_id()
    and public.current_user_role() in ('owner', 'admin')
  order by p.full_name nulls last, p.email;
$$;

create or replace function public.update_agency_member(
  p_user_id uuid,
  p_role text,
  p_is_active boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role text := public.current_user_role();
  old_role text;
  owner_count integer;
begin
  if caller_role not in ('owner', 'admin') or caller_role is null then
    raise exception 'Administration access required' using errcode = '42501';
  end if;
  if p_role not in ('owner', 'admin', 'manager', 'viewer', 'cleaning') then
    raise exception 'Invalid role' using errcode = '22023';
  end if;
  if p_role = 'owner' and caller_role <> 'owner' then
    raise exception 'Only an owner can appoint another owner' using errcode = '42501';
  end if;

  select role into old_role
  from public.agency_memberships
  where agency_id = public.requested_agency_id() and user_id = p_user_id
  for update;
  if not found then raise exception 'Agency member unavailable' using errcode = '42501'; end if;
  if old_role = 'owner' and caller_role <> 'owner' then
    raise exception 'Only an owner can change another owner' using errcode = '42501';
  end if;

  if old_role = 'owner' and (p_role <> 'owner' or not p_is_active) then
    select count(*) into owner_count
    from public.agency_memberships
    where agency_id = public.requested_agency_id()
      and role = 'owner' and is_active = true;
    if owner_count <= 1 then raise exception 'Keep at least one active owner' using errcode = '22023'; end if;
  end if;

  update public.agency_memberships
  set role = p_role, is_active = p_is_active
  where agency_id = public.requested_agency_id() and user_id = p_user_id;
end;
$$;

revoke all on function public.create_agency(text,text,text,text,text,text) from public, anon;
revoke all on function public.get_my_agencies() from public, anon;
revoke all on function public.get_agency_members() from public, anon;
revoke all on function public.update_agency_member(uuid,text,boolean) from public, anon;
grant execute on function public.create_agency(text,text,text,text,text,text) to authenticated;
grant execute on function public.get_my_agencies() to authenticated;
grant execute on function public.get_agency_members() to authenticated;
grant execute on function public.update_agency_member(uuid,text,boolean) to authenticated;

-- Replace legacy policies with agency-aware rules.
do $policies$
declare
  v_table_name text;
  v_policy_name text;
begin
  foreach v_table_name in array array[
    'agencies', 'agency_memberships', 'profiles', 'property_access', 'properties',
    'reservations', 'cleaning_tasks', 'external_calendars', 'booking_conflicts',
    'availability_blocks', 'guests', 'property_tasks'
  ] loop
    if to_regclass('public.' || v_table_name) is not null then
      execute format('alter table public.%I enable row level security', v_table_name);
      for v_policy_name in select policyname from pg_policies where schemaname = 'public' and tablename = v_table_name loop
        execute format('drop policy if exists %I on public.%I', v_policy_name, v_table_name);
      end loop;
    end if;
  end loop;
end;
$policies$;

create policy agencies_select on public.agencies for select to authenticated
using (exists(select 1 from public.agency_memberships m where m.agency_id=id and m.user_id=auth.uid() and m.is_active));
create policy agencies_update on public.agencies for update to authenticated
using (id=public.requested_agency_id() and public.current_user_role() in ('owner','admin'))
with check (id=public.requested_agency_id() and public.current_user_role() in ('owner','admin'));

create policy memberships_select on public.agency_memberships for select to authenticated
using (user_id=auth.uid() or (agency_id=public.requested_agency_id() and public.current_user_role() in ('owner','admin')));
create policy memberships_manage on public.agency_memberships for all to authenticated
using (agency_id=public.requested_agency_id() and public.current_user_role() in ('owner','admin'))
with check (agency_id=public.requested_agency_id() and public.current_user_role() in ('owner','admin'));

create policy profiles_select on public.profiles for select to authenticated
using (id=auth.uid() or exists(select 1 from public.agency_memberships m where m.user_id=profiles.id and m.agency_id=public.requested_agency_id() and public.current_user_role() in ('owner','admin')));
create policy profiles_update on public.profiles for update to authenticated
using (id=auth.uid())
with check (id=auth.uid());

create policy property_access_select on public.property_access for select to authenticated
using ((user_id=auth.uid() or public.current_user_role() in ('owner','admin'))
  and exists (select 1 from public.properties p where p.id=property_id and p.agency_id=public.requested_agency_id()));
create policy property_access_manage on public.property_access for all to authenticated
using (public.current_user_role() in ('owner','admin') and public.has_property_access(property_id))
with check (public.current_user_role() in ('owner','admin') and public.has_property_access(property_id));

create policy properties_select on public.properties for select to authenticated
using (
  agency_id = public.requested_agency_id()
  and (
    public.current_user_role() in ('owner','admin')
    or (
      public.current_user_role() in ('manager','viewer')
      and public.has_property_access(id)
    )
  )
);
create policy properties_insert on public.properties for insert to authenticated
with check (
  (select auth.uid()) is not null
  and exists (
    select 1
    from public.agency_memberships membership
    where membership.agency_id = properties.agency_id
      and membership.user_id = (select auth.uid())
      and membership.is_active = true
      and membership.role in ('owner','admin')
  )
);
create policy properties_update on public.properties for update to authenticated
using (public.can_operate_property(id)) with check (agency_id=public.requested_agency_id() and public.can_operate_property(id));
create policy properties_delete on public.properties for delete to authenticated
using (public.current_user_role() in ('owner','admin') and public.has_property_access(id));

create policy reservations_select on public.reservations for select to authenticated
using (public.current_user_role() in ('owner','admin','manager','viewer') and public.has_property_access(property_id));
create policy reservations_write on public.reservations for all to authenticated
using (public.can_operate_property(property_id)) with check (public.can_operate_property(property_id));

create policy cleaning_tasks_manage on public.cleaning_tasks for all to authenticated
using (public.current_user_role() in ('owner','admin','manager') and public.has_property_access(property_id))
with check (public.current_user_role() in ('owner','admin','manager') and public.has_property_access(property_id));
create policy external_calendars_manage on public.external_calendars for all to authenticated
using (public.current_user_role() in ('owner','admin') and public.has_property_access(property_id))
with check (public.current_user_role() in ('owner','admin') and public.has_property_access(property_id));
create policy booking_conflicts_manage on public.booking_conflicts for all to authenticated
using (public.current_user_role() in ('owner','admin','manager','viewer') and public.has_property_access(property_id))
with check (public.current_user_role() in ('owner','admin','manager') and public.has_property_access(property_id));
create policy availability_blocks_select on public.availability_blocks for select to authenticated
using (public.current_user_role() in ('owner','admin','manager','viewer') and public.has_property_access(property_id));
create policy availability_blocks_write on public.availability_blocks for all to authenticated
using (public.can_operate_property(property_id)) with check (public.can_operate_property(property_id));
create policy guests_select on public.guests for select to authenticated
using (agency_id=public.requested_agency_id() and public.current_user_role() in ('owner','admin','manager','viewer')
  and (public.current_user_role() in ('owner','admin') or created_by=auth.uid()
    or exists (select 1 from public.reservations r where r.guest_id=guests.id and public.has_property_access(r.property_id))));
create policy guests_insert on public.guests for insert to authenticated
with check (agency_id=public.requested_agency_id() and public.current_user_role() in ('owner','admin'));
create policy guests_update on public.guests for update to authenticated
using (agency_id=public.requested_agency_id() and public.current_user_role() in ('owner','admin'))
with check (agency_id=public.requested_agency_id() and public.current_user_role() in ('owner','admin'));
create policy property_tasks_select on public.property_tasks for select to authenticated
using (public.current_user_role() in ('owner','admin','manager','viewer') and public.has_property_access(property_id));
create policy property_tasks_write on public.property_tasks for all to authenticated
using (public.can_operate_property(property_id)) with check (public.can_operate_property(property_id));

-- Agency-aware versions of operational functions that previously knew only
-- the legacy global administrator role.
create or replace function public.save_guest_contact(p_guest jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare g public.guests; requested uuid := nullif(p_guest->>'id','')::uuid;
begin
 if public.current_user_role() not in ('owner','admin','manager') or public.current_user_role() is null then raise exception 'Access denied' using errcode='42501'; end if;
 if requested is not null then
  select * into g from public.guests where id=requested and agency_id=public.requested_agency_id();
  if not found then raise exception 'Guest unavailable' using errcode='42501'; end if;
  update public.guests set name=trim(p_guest->>'name'),email=coalesce(p_guest->>'email',''),phone=coalesce(p_guest->>'phone',''),language=coalesce(p_guest->>'language',''),country=coalesce(p_guest->>'country',''),notes=coalesce(p_guest->>'notes','')
  where id=requested and agency_id=public.requested_agency_id() returning * into g;
 else
  insert into public.guests(agency_id,name,email,phone,language,country,notes,created_by)
  values(public.requested_agency_id(),trim(p_guest->>'name'),coalesce(p_guest->>'email',''),coalesce(p_guest->>'phone',''),coalesce(p_guest->>'language',''),coalesce(p_guest->>'country',''),coalesce(p_guest->>'notes',''),auth.uid()) returning * into g;
 end if;
 return to_jsonb(g);
end $$;

create or replace function public.check_availability_and_price()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(new.property_id::text,0));
 if not exists(select 1 from public.properties p where p.id=new.property_id and p.agency_id=public.requested_agency_id()) then raise exception 'Property unavailable' using errcode='42501'; end if;
 if tg_table_name='availability_blocks' then
  if exists(select 1 from public.reservations r where r.property_id=new.property_id and r.status<>'cancelled' and (r.check_in at time zone 'Europe/Zagreb')::date<new.end_date and (r.check_out at time zone 'Europe/Zagreb')::date>new.start_date)
   or exists(select 1 from public.availability_blocks b where b.property_id=new.property_id and b.id<>new.id and b.start_date<new.end_date and b.end_date>new.start_date) then raise exception 'Dates overlap an existing booking or block'; end if;
 else
  if new.status<>'cancelled' and new.source in ('direct','agency') and exists(select 1 from public.availability_blocks b where b.property_id=new.property_id and (new.check_in at time zone 'Europe/Zagreb')::date<b.end_date and (new.check_out at time zone 'Europe/Zagreb')::date>b.start_date) then raise exception 'These dates are blocked'; end if;
  if new.status<>'cancelled' and new.source in ('direct','agency') and exists(select 1 from public.reservations r where r.property_id=new.property_id and r.id<>new.id and r.status<>'cancelled' and r.source in ('direct','agency') and r.check_in<new.check_out and r.check_out>new.check_in) then raise exception 'Property is not available for selected dates'; end if;
  if new.guest_id is not null and not exists(select 1 from public.guests g where g.id=new.guest_id and g.agency_id=public.requested_agency_id()) then raise exception 'Guest unavailable' using errcode='42501'; end if;
  if new.nightly_rate is null then select p.nightly_rate into new.nightly_rate from public.properties p where p.id=new.property_id; end if;
  new.total_price := coalesce(new.nightly_rate,0) * greatest(0,(new.check_out at time zone 'Europe/Zagreb')::date-(new.check_in at time zone 'Europe/Zagreb')::date);
 end if;
 return new;
end $$;

create or replace function public.set_property_task_status(p_id uuid,p_status text)
returns void language plpgsql security definer set search_path=public as $$
begin
 if public.current_user_role() is null or public.current_user_role() not in ('owner','admin','manager','cleaning') then raise exception 'Access denied' using errcode='42501'; end if;
 if p_status is null or p_status not in ('pending','in_progress','done') then raise exception 'Invalid status'; end if;
 update public.property_tasks set status=p_status where id=p_id and public.has_property_access(property_id);
 if found then return; end if;
 update public.cleaning_tasks set status=p_status where id=p_id and public.has_property_access(property_id) and exists(select 1 from public.reservations r where r.id=reservation_id and r.status<>'cancelled');
 if not found then raise exception 'Task unavailable' using errcode='42501'; end if;
end $$;

revoke insert, update, delete on public.agency_memberships from authenticated;

grant select on public.agencies, public.agency_memberships to authenticated;
grant update on public.agencies to authenticated;
grant insert, update on public.guests to authenticated;
commit;
