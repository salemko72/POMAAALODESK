-- Feed snapshots are applied atomically. Raw URLs remain in the existing protected table.
alter table public.external_calendars add column if not exists sync_error text;
alter table public.external_calendars add column if not exists sync_started_at timestamptz;
alter table public.external_calendars add column if not exists sync_lease uuid;
alter table public.external_calendars add column if not exists event_count integer not null default 0;
alter table public.reservations add column if not exists ical_kind text check (ical_kind in ('reservation','block','unknown'));
alter table public.reservations drop constraint if exists reservations_source_check;
alter table public.reservations add constraint reservations_source_check check(source in ('direct','agency','airbnb','booking','airbnb_ical','booking_ical','other_ical'));
create unique index if not exists reservations_external_identity on public.reservations(external_calendar_id,external_id);

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table private.ical_jobs(token uuid primary key default gen_random_uuid(), calendar_id uuid not null references public.external_calendars(id) on delete cascade, expires_at timestamptz not null default now()+interval '2 minutes');
alter table private.ical_jobs enable row level security;
create or replace function public.consume_ical_job(p_token uuid) returns uuid language sql security definer set search_path='' as $$
 delete from private.ical_jobs where token=p_token and expires_at>now() returning calendar_id;
$$;
revoke all on function public.consume_ical_job(uuid) from public,anon,authenticated;
grant execute on function public.consume_ical_job(uuid) to service_role;

create or replace function public.claim_ical_sync(p_calendar uuid,p_force boolean default false) returns jsonb language plpgsql security invoker set search_path='' as $$
declare c public.external_calendars; v uuid := gen_random_uuid();
begin
 update public.external_calendars set sync_status='syncing',sync_started_at=now(),sync_lease=v,sync_error=null
 where id=p_calendar and is_active and (sync_started_at is null or sync_started_at<now()-interval '1 minute')
 and (sync_status<>'syncing' or sync_started_at<now()-interval '3 minutes')
 and (p_force or last_synced_at is null or last_synced_at<now()-interval '5 minutes') returning * into c;
 if not found then return null; end if;
 return jsonb_build_object('feed_url',c.feed_url,'lease',v);
end $$;
revoke all on function public.claim_ical_sync(uuid,boolean) from public,anon,authenticated;
grant execute on function public.claim_ical_sync(uuid,boolean) to service_role;

create or replace function public.fail_ical_sync(p_calendar uuid,p_lease uuid,p_error text) returns void language sql security invoker set search_path='' as $$
 update public.external_calendars set sync_status='error',sync_error=left(p_error,300),sync_lease=null where id=p_calendar and sync_lease=p_lease;
$$;
revoke all on function public.fail_ical_sync(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.fail_ical_sync(uuid,uuid,text) to service_role;

create or replace function public.apply_ical_snapshot(p_calendar uuid,p_lease uuid,p_events jsonb) returns integer language plpgsql security invoker set search_path='' as $$
declare c public.external_calendars; a uuid; e jsonb; n integer := 0;
begin
 select * into c from public.external_calendars where id=p_calendar for update;
 if c.sync_lease is distinct from p_lease or not c.is_active then raise exception 'Sync superseded'; end if;
 select agency_id into a from public.properties where id=c.property_id;
 perform set_config('request.headers',jsonb_build_object('x-agency-id',a)::text,true);
 perform pg_advisory_xact_lock(hashtextextended(c.property_id::text,0));
 if jsonb_typeof(p_events)<>'array' or jsonb_array_length(p_events)>5000 then raise exception 'Invalid snapshot'; end if;
 for e in select value from jsonb_array_elements(p_events) loop
  if e->>'uid' is null or (e->>'end')::date<=(e->>'start')::date then raise exception 'Invalid event'; end if;
  insert into public.reservations(property_id,external_calendar_id,external_id,source,guest_name,check_in,check_out,guests,status,ical_kind,notes)
  values(c.property_id,c.id,e->>'uid',case c.source when 'airbnb_ical' then 'airbnb' when 'booking_ical' then 'booking' else 'other_ical' end,
   e->>'title',((e->>'start')::date+time '12:00') at time zone 'Europe/Zagreb',((e->>'end')::date+time '12:00') at time zone 'Europe/Zagreb',1,
   case when (e->>'cancelled')::boolean then 'cancelled' else 'confirmed' end,e->>'kind','Imported iCal availability. Guest count and price are not supplied by the feed.')
  on conflict(external_calendar_id,external_id) do update set guest_name=excluded.guest_name,check_in=excluded.check_in,check_out=excluded.check_out,status=excluded.status,ical_kind=excluded.ical_kind,source=excluded.source,updated_at=now();
  n:=n+1;
 end loop;
 -- Retain history; absent future items are cancelled only after a complete valid snapshot.
 update public.reservations r set status='cancelled',updated_at=now() where external_calendar_id=c.id and status<>'cancelled' and check_out>now()
 and not exists(select 1 from jsonb_array_elements(p_events) e where e->>'uid'=r.external_id);
 update public.external_calendars set sync_status='success',sync_error=null,last_synced_at=now(),sync_lease=null,event_count=n where id=c.id;
 return n;
end $$;
revoke all on function public.apply_ical_snapshot(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.apply_ical_snapshot(uuid,uuid,jsonb) to service_role;

-- Acknowledgements apply to an exact pair AND its dates; a changed stay alerts again.
create table public.booking_same_stay(
 reservation_a uuid not null references public.reservations(id) on delete cascade,
 reservation_b uuid not null references public.reservations(id) on delete cascade,
 property_id uuid not null references public.properties(id) on delete cascade,
 a_start timestamptz not null,a_end timestamptz not null,b_start timestamptz not null,b_end timestamptz not null,
 confirmed_by uuid not null default auth.uid() references auth.users(id), confirmed_at timestamptz not null default now(),
 primary key(reservation_a,reservation_b),check(reservation_a<reservation_b)
);
alter table public.booking_same_stay enable row level security;
grant select,insert,update,delete on public.booking_same_stay to authenticated;
create policy same_stay_read on public.booking_same_stay for select to authenticated using(public.has_property_access(property_id));
-- Mutations use a validated RPC, so clients cannot acknowledge unrelated reservations.
create or replace function public.confirm_same_stay(p_a uuid,p_b uuid,p_reopen boolean default false) returns void language plpgsql security definer set search_path='' as $$
declare a public.reservations;b public.reservations;
begin
 if auth.uid() is null then raise exception 'Sign in required';end if;
 select * into a from public.reservations where id=least(p_a,p_b);
 select * into b from public.reservations where id=greatest(p_a,p_b);
 if a.id is null or b.id is null or a.property_id<>b.property_id or not public.can_operate_property(a.property_id) or (a.external_calendar_id is null and b.external_calendar_id is null) then raise exception 'Unavailable';end if;
 if p_reopen then delete from public.booking_same_stay where reservation_a=a.id and reservation_b=b.id;return;end if;
 insert into public.booking_same_stay(reservation_a,reservation_b,property_id,a_start,a_end,b_start,b_end,confirmed_by)
 values(a.id,b.id,a.property_id,a.check_in,a.check_out,b.check_in,b.check_out,auth.uid())
 on conflict(reservation_a,reservation_b) do update set a_start=excluded.a_start,a_end=excluded.a_end,b_start=excluded.b_start,b_end=excluded.b_end,confirmed_by=auth.uid(),confirmed_at=now();
end $$;
revoke all on function public.confirm_same_stay(uuid,uuid,boolean) from public,anon;
grant execute on function public.confirm_same_stay(uuid,uuid,boolean) to authenticated;

create or replace function public.get_booking_overlaps() returns table(
 property_id uuid,property_name text,a_id uuid,b_id uuid,a_name text,b_name text,a_source text,b_source text,
 overlap_start date,overlap_end date,possible boolean,can_link boolean,acknowledged boolean
) language sql stable security invoker set search_path='' as $$
 with entries as (
 select id,property_id,guest_name title,source,(check_in at time zone 'Europe/Zagreb')::date s,(check_out at time zone 'Europe/Zagreb')::date e,check_in,check_out,ical_kind,external_calendar_id,false is_block
 from public.reservations where status<>'cancelled'
 union all select id,property_id,reason,'block',start_date,end_date,start_date::timestamptz,end_date::timestamptz,'block',null,true from public.availability_blocks
 ) select a.property_id,p.name,a.id,b.id,a.title,b.title,a.source,b.source,greatest(a.s,b.s),least(a.e,b.e),
 coalesce(a.ical_kind in ('block','unknown') or b.ical_kind in ('block','unknown'),false),
 not a.is_block and not b.is_block and (a.external_calendar_id is not null or b.external_calendar_id is not null),
 exists(select 1 from public.booking_same_stay k where k.reservation_a=a.id and k.reservation_b=b.id and k.a_start=a.check_in and k.a_end=a.check_out and k.b_start=b.check_in and k.b_end=b.check_out)
 from entries a join entries b on a.property_id=b.property_id and a.id<b.id and a.s<b.e and a.e>b.s
 join public.properties p on p.id=a.property_id;
$$;
revoke all on function public.get_booking_overlaps() from public,anon;
grant execute on function public.get_booking_overlaps() to authenticated;

create or replace function public.check_availability_and_price() returns trigger language plpgsql security definer set search_path=public as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(new.property_id::text,0));
 if not exists(select 1 from public.properties p where p.id=new.property_id and p.agency_id=public.requested_agency_id()) then raise exception 'Property unavailable' using errcode='42501'; end if;
 if tg_table_name='availability_blocks' then
  if exists(select 1 from public.reservations r where r.property_id=new.property_id and r.status<>'cancelled' and (r.check_in at time zone 'Europe/Zagreb')::date<new.end_date and (r.check_out at time zone 'Europe/Zagreb')::date>new.start_date)
   or exists(select 1 from public.availability_blocks b where b.property_id=new.property_id and b.id<>new.id and b.start_date<new.end_date and b.end_date>new.start_date) then raise exception 'OVERBOOK: Dates overlap an existing booking or block'; end if;
 else
  if new.status<>'cancelled' and new.source in ('direct','agency') then
   if exists(select 1 from public.availability_blocks b where b.property_id=new.property_id and (new.check_in at time zone 'Europe/Zagreb')::date<b.end_date and (new.check_out at time zone 'Europe/Zagreb')::date>b.start_date)
    or exists(select 1 from public.reservations r where r.property_id=new.property_id and r.id<>new.id and r.status<>'cancelled'
      and (r.check_in at time zone 'Europe/Zagreb')::date<(new.check_out at time zone 'Europe/Zagreb')::date and (r.check_out at time zone 'Europe/Zagreb')::date>(new.check_in at time zone 'Europe/Zagreb')::date
      and not exists(select 1 from public.booking_same_stay k where k.reservation_a=least(new.id,r.id) and k.reservation_b=greatest(new.id,r.id)
        and k.a_start=case when new.id<r.id then new.check_in else r.check_in end and k.a_end=case when new.id<r.id then new.check_out else r.check_out end
        and k.b_start=case when new.id<r.id then r.check_in else new.check_in end and k.b_end=case when new.id<r.id then r.check_out else new.check_out end))
    then raise exception 'OVERBOOK: Property is not available for selected nights';end if;
  end if;
  if new.guest_id is not null and not exists(select 1 from public.guests g where g.id=new.guest_id and g.agency_id=public.requested_agency_id()) then raise exception 'Guest unavailable' using errcode='42501'; end if;
  if new.ical_kind is not null then new.nightly_rate:=null;new.total_price:=null;
  else
   if new.nightly_rate is null then select p.nightly_rate into new.nightly_rate from public.properties p where p.id=new.property_id; end if;
   new.total_price:=coalesce(new.nightly_rate,0)*greatest(0,(new.check_out at time zone 'Europe/Zagreb')::date-(new.check_in at time zone 'Europe/Zagreb')::date);
  end if;
 end if;
 return new;
end $$;

-- No permanent shared secret: pg_cron creates one-use capabilities per calendar.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
create or replace function private.enqueue_ical_sync(p_calendar uuid default null) returns integer language plpgsql security invoker set search_path='' as $$
declare c record;v uuid;n integer:=0;
begin
 delete from private.ical_jobs where expires_at<now();
 for c in select id from public.external_calendars where is_active and (p_calendar is null or id=p_calendar) loop
  insert into private.ical_jobs(calendar_id) values(c.id) returning token into v;
  perform net.http_post(url:='https://jawcaedeynlbyntjolrg.supabase.co/functions/v1/ical-sync',headers:='{"Content-Type":"application/json"}'::jsonb,body:=jsonb_build_object('job_token',v),timeout_milliseconds:=60000);
  n:=n+1;
 end loop;
 return n;
end $$;
revoke all on function private.enqueue_ical_sync(uuid) from public,anon,authenticated;
select cron.schedule('pomaaalodesk-ical-15min','*/15 * * * *','select private.enqueue_ical_sync()');
