-- Cleaning users access a deliberately small operational projection and a
-- status-only command. Raw rows may contain guest names, notes or feed URLs.
begin;
do $migration$
declare target_table text;
begin
  foreach target_table in array array['properties','reservations','cleaning_tasks','external_calendars','booking_conflicts'] loop
    execute format('drop policy if exists "Cleaning uses operational API" on public.%I',target_table);
    execute format(
      'create policy "Cleaning uses operational API" on public.%I as restrictive for all to authenticated '
      'using ((select public.current_user_role()) <> ''cleaning'') '
      'with check ((select public.current_user_role()) <> ''cleaning'')', target_table);
  end loop;
end;
$migration$;

create or replace function public.get_my_cleaning_work(p_start timestamptz,p_end timestamptz)
returns table(task_id uuid,property_name text,address text,city text,start_time timestamptz,end_time timestamptz,status text)
language sql stable security definer set search_path = public
as $$
  select c.id,p.name,p.address,p.city,c.start_time,c.end_time,c.status
  from public.cleaning_tasks c
  join public.properties p on p.id=c.property_id
  join public.reservations r on r.id=c.reservation_id and r.property_id=c.property_id
  where public.current_user_role()='cleaning'
    and public.has_property_access(c.property_id)
    and p.is_active=true and r.status <> 'cancelled'
    and p_end > p_start and p_end <= p_start + interval '31 days'
    and c.start_time >= p_start and c.start_time < p_end
  order by c.start_time,c.id;
$$;

create or replace function public.update_my_cleaning_status(p_task_id uuid,p_status text)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if public.current_user_role() is distinct from 'cleaning' then
    raise exception 'Cleaning access required' using errcode='42501';
  end if;
  if p_status is null or p_status not in ('pending','in_progress','done') then
    raise exception 'Invalid cleaning status' using errcode='22023';
  end if;
  update public.cleaning_tasks c set status=p_status
  where c.id=p_task_id and public.has_property_access(c.property_id)
    and exists(select 1 from public.properties p where p.id=c.property_id and p.is_active=true)
    and exists(select 1 from public.reservations r where r.id=c.reservation_id and r.property_id=c.property_id and r.status <> 'cancelled');
  if not found then raise exception 'Task unavailable' using errcode='42501'; end if;
end;
$$;

revoke all on function public.get_my_cleaning_work(timestamptz,timestamptz) from public,anon;
revoke all on function public.update_my_cleaning_status(uuid,text) from public,anon;
grant execute on function public.get_my_cleaning_work(timestamptz,timestamptz) to authenticated;
grant execute on function public.update_my_cleaning_status(uuid,text) to authenticated;
commit;
