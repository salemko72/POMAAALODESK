create or replace function public.get_ical_sync_status() returns table(id uuid,property_name text,source text,sync_status text,last_synced_at timestamptz,sync_error text,event_count integer)
language sql stable security definer set search_path='' as $$
 select c.id,p.name,c.source,c.sync_status,c.last_synced_at,c.sync_error,c.event_count from public.external_calendars c join public.properties p on p.id=c.property_id
 where auth.uid() is not null and c.is_active and public.has_property_access(p.id) and public.current_user_role() in ('owner','admin','manager','viewer') order by p.name,c.id;
$$;
revoke all on function public.get_ical_sync_status() from public,anon;
grant execute on function public.get_ical_sync_status() to authenticated;

create or replace function private.reset_ical_link() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if (new.feed_url,new.source,new.is_active) is distinct from (old.feed_url,old.source,old.is_active) then
  new.sync_status:='idle';new.sync_error:=null;new.sync_started_at:=null;new.sync_lease:=null;
 end if;
 return new;
end $$;
create trigger reset_ical_link before update on public.external_calendars for each row execute function private.reset_ical_link();

create or replace function private.protect_ical_reservation() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if coalesce(current_setting('request.jwt.claims',true),'{}')::jsonb->>'role' = 'service_role' then return coalesce(new,old);end if;
 if tg_op='INSERT' then
  if new.ical_kind is not null or new.external_calendar_id is not null then raise exception 'iCal entries are managed by synchronization';end if;
 elsif old.external_calendar_id is not null then
  -- Removing a feed uses ON DELETE SET NULL and should preserve history.
  if tg_op='DELETE' then raise exception 'iCal entries are managed by synchronization';end if;
  if new.external_calendar_id is not null or (new.property_id,new.external_id,new.source,new.check_in,new.check_out,new.status,new.ical_kind) is distinct from (old.property_id,old.external_id,old.source,old.check_in,old.check_out,old.status,old.ical_kind) then raise exception 'iCal dates are managed by their source';end if;
 elsif new.ical_kind is not null or new.external_calendar_id is not null then raise exception 'iCal entries are managed by synchronization';
 end if;
 return coalesce(new,old);
end $$;
create trigger protect_ical_reservation before insert or update or delete on public.reservations for each row execute function private.protect_ical_reservation();
