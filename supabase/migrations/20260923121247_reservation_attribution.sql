-- Historical rows remain unknown. Identity is recorded by the DB, never the form.
-- UUIDs are historical identifiers (no FK): deleting a login must not rewrite history.
alter table public.reservations
 add column created_by uuid,
 add column created_by_name text,
 add column created_actor_kind text check(created_actor_kind in ('user','ical','system')),
 add column last_modified_by uuid,
 add column last_modified_by_name text,
 add column last_modified_actor_kind text check(last_modified_actor_kind in ('user','ical','system')),
 add column last_modified_at timestamptz;

create function private.stamp_reservation_attribution() returns trigger
language plpgsql security definer set search_path='' as $$
declare
 actor uuid:=auth.uid(); actor_name text; actor_kind text; agency uuid;
 ignored text[]:=array['created_at','updated_at','created_by','created_by_name','created_actor_kind',
 'last_modified_by','last_modified_by_name','last_modified_actor_kind','last_modified_at'];
begin
 if tg_op='UPDATE' then
  -- Creator is immutable; clients cannot forge any attribution column.
  new.created_by:=old.created_by;
  new.created_by_name:=old.created_by_name;
  new.created_actor_kind:=old.created_actor_kind;
  if (to_jsonb(new)-ignored) is not distinct from (to_jsonb(old)-ignored) then
   new.last_modified_by:=old.last_modified_by;
   new.last_modified_by_name:=old.last_modified_by_name;
   new.last_modified_actor_kind:=old.last_modified_actor_kind;
   new.last_modified_at:=old.last_modified_at;
   return new;
  end if;
 end if;
 if actor is not null then
  select agency_id into agency from public.properties where id=new.property_id;
  if not exists(select 1 from public.agency_memberships where agency_id=agency and user_id=actor and is_active) then
   raise exception 'Reservation actor must belong to the agency' using errcode='42501';
  end if;
  select coalesce(nullif(trim(full_name),''),nullif(trim(email),'')) into actor_name from public.profiles where id=actor;
  actor_kind:='user';
 else
  actor_kind:=case when new.external_calendar_id is not null or new.source in ('airbnb_ical','booking_ical','other_ical') then 'ical' else 'system' end;
 end if;
 if tg_op='INSERT' then
  new.created_by:=actor;
  new.created_by_name:=actor_name;
  new.created_actor_kind:=actor_kind;
  new.last_modified_by:=null;
  new.last_modified_by_name:=null;
  new.last_modified_actor_kind:=null;
  new.last_modified_at:=null;
 else
  new.last_modified_by:=actor;
  new.last_modified_by_name:=actor_name;
  new.last_modified_actor_kind:=actor_kind;
  new.last_modified_at:=clock_timestamp();
 end if;
 return new;
end $$;
revoke all on function private.stamp_reservation_attribution() from public,anon,authenticated;
-- Run after existing validation/price/timestamp BEFORE triggers.
create trigger zz_reservation_attribution before insert or update on public.reservations
for each row execute function private.stamp_reservation_attribution();
