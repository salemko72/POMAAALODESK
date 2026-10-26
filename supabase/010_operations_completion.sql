begin;
create or replace function public.get_task_properties() returns table(id uuid,name text) language sql stable security definer set search_path=public as $$
 select p.id,p.name from public.properties p where p.is_active and public.current_user_role() is not null and public.has_property_access(p.id) order by p.name;
$$;
revoke all on function public.get_task_properties() from public,anon;
grant execute on function public.get_task_properties() to authenticated;
-- Preserve separate identities when the old data only contains a name.
-- Existing contacts can be explicitly selected when editing a stay.
do $$ declare r record; g uuid; begin
 for r in select id,guest_name from public.reservations where guest_id is null and length(trim(guest_name))>0 loop
  insert into public.guests(name) values(r.guest_name) returning id into g;
  update public.reservations set guest_id=g where id=r.id;
 end loop;
end $$;
create index if not exists reservation_guest_idx on public.reservations(guest_id);
create index if not exists availability_property_dates_idx on public.availability_blocks(property_id,start_date,end_date);
create index if not exists property_tasks_property_time_idx on public.property_tasks(property_id,start_time);
commit;
