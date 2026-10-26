begin;
create or replace function public.check_availability_and_price() returns trigger language plpgsql security definer set search_path=public as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(new.property_id::text,0));
 if tg_table_name='availability_blocks' then
  if exists(select 1 from public.reservations r where r.property_id=new.property_id and r.status<>'cancelled' and (r.check_in at time zone 'Europe/Zagreb')::date<new.end_date and (r.check_out at time zone 'Europe/Zagreb')::date>new.start_date)
   or exists(select 1 from public.availability_blocks b where b.property_id=new.property_id and b.id<>new.id and b.start_date<new.end_date and b.end_date>new.start_date) then raise exception 'Dates overlap an existing booking or block'; end if;
 else
  if new.status<>'cancelled' and new.source in ('direct','agency') and exists(select 1 from public.availability_blocks b where b.property_id=new.property_id and (new.check_in at time zone 'Europe/Zagreb')::date<b.end_date and (new.check_out at time zone 'Europe/Zagreb')::date>b.start_date) then raise exception 'These dates are blocked'; end if;
  if new.guest_id is not null and auth.uid() is not null and not exists(select 1 from public.guests g where g.id=new.guest_id and (public.current_user_role()='admin' or g.created_by=auth.uid() or exists(select 1 from public.reservations r where r.guest_id=g.id and public.has_property_access(r.property_id)))) then raise exception 'Guest unavailable' using errcode='42501'; end if;
  if new.nightly_rate is null then select p.nightly_rate into new.nightly_rate from public.properties p where p.id=new.property_id; end if;
  new.total_price := new.nightly_rate * greatest(0,(new.check_out at time zone 'Europe/Zagreb')::date-(new.check_in at time zone 'Europe/Zagreb')::date);
 end if;
 return new;
end $$;

commit;
