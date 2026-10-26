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
 and not exists(select 1 from jsonb_array_elements(p_events) as snapshot(item) where snapshot.item->>'uid'=r.external_id);
 update public.external_calendars set sync_status='success',sync_error=null,last_synced_at=now(),sync_lease=null,event_count=n where id=c.id;
 return n;
end $$;
revoke all on function public.apply_ical_snapshot(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.apply_ical_snapshot(uuid,uuid,jsonb) to service_role;

revoke execute on function public.check_availability_and_price() from public,anon;
