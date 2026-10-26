begin;
create table if not exists public.availability_blocks (
 id uuid primary key default gen_random_uuid(), property_id uuid not null references public.properties(id) on delete cascade,
 start_date date not null, end_date date not null, reason text not null, notes text not null default '',
 check(end_date > start_date), check(reason in ('Owner stay','Maintenance','Problem','Renovation','Not available','Other'))
);
create table if not exists public.guests (
 id uuid primary key default gen_random_uuid(), name text not null check(length(trim(name))>0),
 email text not null default '', phone text not null default '', language text not null default '', country text not null default '', notes text not null default '',
 created_by uuid default auth.uid()
);
alter table public.reservations
 add column if not exists guest_id uuid references public.guests(id),
 add column if not exists adults integer check(adults >= 1),
 add column if not exists children integer not null default 0 check(children >= 0),
 add column if not exists arrival_time time,
 add column if not exists special_request text,
 add column if not exists nightly_rate numeric(12,2) check(nightly_rate >= 0),
 add column if not exists total_price numeric(14,2);
create table if not exists public.property_tasks (
 id uuid primary key default gen_random_uuid(), property_id uuid not null references public.properties(id) on delete cascade,
 kind text not null check(kind in ('Cleaning','Maintenance','Inspection','Linen','Repair','Delivery','Supplies','Other')),
 title text not null check(length(trim(title))>0), start_time timestamptz not null, end_time timestamptz not null,
 status text not null default 'pending' check(status in ('pending','in_progress','done')), check(end_time>start_time)
);
alter table public.availability_blocks enable row level security;
alter table public.guests enable row level security;
alter table public.property_tasks enable row level security;
create policy blocks_read on public.availability_blocks for select to authenticated using(public.current_user_role() in ('admin','manager','viewer') and public.has_property_access(property_id));
create policy blocks_write on public.availability_blocks for all to authenticated using(public.can_operate_property(property_id)) with check(public.can_operate_property(property_id));
create policy guests_read on public.guests for select to authenticated using(public.current_user_role() in ('admin','manager','viewer') and (public.current_user_role()='admin' or created_by=auth.uid() or exists(select 1 from public.reservations r where r.guest_id=guests.id and public.has_property_access(r.property_id))));
create policy tasks_read on public.property_tasks for select to authenticated using(public.current_user_role() in ('admin','manager','viewer') and public.has_property_access(property_id));
create policy tasks_write on public.property_tasks for all to authenticated using(public.can_operate_property(property_id)) with check(public.can_operate_property(property_id));
grant select,insert,update,delete on public.availability_blocks,public.property_tasks to authenticated;
grant select on public.guests to authenticated;

create or replace function public.save_guest_contact(p_guest jsonb) returns jsonb language plpgsql security definer set search_path=public as $$
declare g public.guests; requested uuid := nullif(p_guest->>'id','')::uuid;
begin
 if public.current_user_role() not in ('admin','manager') or public.current_user_role() is null then raise exception 'Access denied' using errcode='42501'; end if;
 if requested is not null then
  select * into g from public.guests where id=requested;
  if not found or not (public.current_user_role()='admin' or g.created_by=auth.uid() or exists(select 1 from public.reservations where guest_id=requested and public.can_operate_property(property_id))) then raise exception 'Access denied' using errcode='42501'; end if;
  update public.guests set name=trim(p_guest->>'name'),email=coalesce(p_guest->>'email',''),phone=coalesce(p_guest->>'phone',''),language=coalesce(p_guest->>'language',''),country=coalesce(p_guest->>'country',''),notes=coalesce(p_guest->>'notes','') where id=requested returning * into g;
 else
  insert into public.guests(name,email,phone,language,country,notes,created_by) values(trim(p_guest->>'name'),coalesce(p_guest->>'email',''),coalesce(p_guest->>'phone',''),coalesce(p_guest->>'language',''),coalesce(p_guest->>'country',''),coalesce(p_guest->>'notes',''),auth.uid()) returning * into g;
 end if;
 return to_jsonb(g);
end $$;

-- Serialize writes per property so simultaneous blocks and manual bookings cannot race.
create or replace function public.check_availability_and_price() returns trigger language plpgsql security definer set search_path=public as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(new.property_id::text,0));
 if tg_table_name='availability_blocks' then
  if exists(select 1 from public.reservations r where r.property_id=new.property_id and r.status<>'cancelled' and (r.check_in at time zone 'Europe/Zagreb')::date<new.end_date and (r.check_out at time zone 'Europe/Zagreb')::date>new.start_date)
   or exists(select 1 from public.availability_blocks b where b.property_id=new.property_id and b.id<>new.id and b.start_date<new.end_date and b.end_date>new.start_date) then raise exception 'Dates overlap an existing booking or block'; end if;
 else
  if new.status<>'cancelled' and new.source in ('direct','agency') and exists(select 1 from public.availability_blocks b where b.property_id=new.property_id and (new.check_in at time zone 'Europe/Zagreb')::date<b.end_date and (new.check_out at time zone 'Europe/Zagreb')::date>b.start_date) then raise exception 'These dates are blocked'; end if;
  if new.guest_id is not null and auth.uid() is not null and not exists(select 1 from public.guests g where g.id=new.guest_id and (public.current_user_role()='admin' or g.created_by=auth.uid() or exists(select 1 from public.reservations r where r.guest_id=g.id and public.has_property_access(r.property_id)))) then raise exception 'Guest unavailable' using errcode='42501'; end if;
  new.total_price := new.nightly_rate * greatest(0,(new.check_out at time zone 'Europe/Zagreb')::date-(new.check_in at time zone 'Europe/Zagreb')::date);
 end if;
 return new;
end $$;
create trigger availability_block_guard before insert or update on public.availability_blocks for each row execute function public.check_availability_and_price();
create trigger reservation_block_guard before insert or update on public.reservations for each row execute function public.check_availability_and_price();

create or replace function public.move_checkout_cleaning() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.check_out is distinct from old.check_out or new.property_id is distinct from old.property_id then
  update public.cleaning_tasks c set property_id=new.property_id,start_time=new.check_out,end_time=new.check_out+make_interval(mins=>p.cleaning_duration_minutes)
   from public.properties p where c.reservation_id=new.id and p.id=new.property_id and not coalesce(c.is_manually_overridden,false) and c.status<>'done';
 end if;
 return new;
end $$;
create trigger reservation_cleaning_move after update on public.reservations for each row execute function public.move_checkout_cleaning();

create or replace function public.get_property_tasks() returns table(id uuid,property_id uuid,kind text,title text,start_time timestamptz,end_time timestamptz,status text) language sql stable security definer set search_path=public as $$
 select t.id,t.property_id,t.kind,t.title,t.start_time,t.end_time,t.status from public.property_tasks t where public.current_user_role() is not null and public.has_property_access(t.property_id)
 union all select c.id,c.property_id,'Cleaning','Checkout cleaning',c.start_time,c.end_time,c.status from public.cleaning_tasks c join public.reservations r on r.id=c.reservation_id where r.status<>'cancelled' and public.current_user_role() is not null and public.has_property_access(c.property_id);
$$;
create or replace function public.set_property_task_status(p_id uuid,p_status text) returns void language plpgsql security definer set search_path=public as $$
begin
 if public.current_user_role() is null or public.current_user_role() not in ('admin','manager','cleaning') then raise exception 'Access denied' using errcode='42501'; end if;
 if p_status is null or p_status not in ('pending','in_progress','done') then raise exception 'Invalid status'; end if;
 update public.property_tasks set status=p_status where id=p_id and public.has_property_access(property_id);
 if found then return; end if;
 update public.cleaning_tasks set status=p_status where id=p_id and public.has_property_access(property_id) and exists(select 1 from public.reservations r where r.id=reservation_id and r.status<>'cancelled');
 if not found then raise exception 'Task unavailable' using errcode='42501'; end if;
end $$;
revoke all on function public.save_guest_contact(jsonb), public.get_property_tasks(),public.set_property_task_status(uuid,text) from public,anon;
grant execute on function public.save_guest_contact(jsonb), public.get_property_tasks(),public.set_property_task_status(uuid,text) to authenticated;
commit;
