create table public.booking_override_audit(
 id uuid primary key default gen_random_uuid(),property_id uuid not null references public.properties(id),reservation_id uuid not null,
 actor uuid not null references auth.users(id),reason text not null,check_in timestamptz not null,check_out timestamptz not null,created_at timestamptz not null default now()
);
alter table public.booking_override_audit enable row level security;
grant select on public.booking_override_audit to authenticated;
create policy override_audit_read on public.booking_override_audit for select to authenticated using(public.has_property_access(property_id) and public.current_user_role() in ('owner','admin'));

create or replace function public.save_reservation_override(p_data jsonb,p_reason text,p_id uuid default null) returns public.reservations language plpgsql security definer set search_path='' as $$
declare v public.reservations; saved public.reservations; original_id uuid;
begin
 if auth.uid() is null or public.current_user_role() not in ('owner','admin') or length(trim(p_reason))<10 then raise exception 'Owner/admin and a reason are required';end if;
 if p_id is not null then
  select * into v from public.reservations where id=p_id;
  if v.id is null or not public.can_operate_property(v.property_id) or v.external_calendar_id is not null or v.ical_kind is not null then raise exception 'Reservation unavailable';end if;
 else v.id:=gen_random_uuid();v.status:='confirmed';v.adults:=1;v.children:=0;v.guests:=1;end if;
 original_id:=v.id;
 if exists(select 1 from jsonb_object_keys(p_data) k where k not in ('property_id','guest_id','source','guest_name','check_in','check_out','guests','adults','children','arrival_time','special_request','nightly_rate','status','notes')) then raise exception 'Unsupported change';end if;
 v:=jsonb_populate_record(v,p_data);
 if not public.can_operate_property(v.property_id) or v.source not in ('direct','agency') or v.check_out<=v.check_in then raise exception 'Invalid reservation';end if;
 perform set_config('pomaaalo.override_id',original_id::text,true);
 if p_id is null then
  insert into public.reservations(id,property_id,guest_id,source,guest_name,check_in,check_out,guests,adults,children,arrival_time,special_request,nightly_rate,status,notes)
  values(v.id,v.property_id,v.guest_id,v.source,v.guest_name,v.check_in,v.check_out,v.guests,v.adults,v.children,v.arrival_time,v.special_request,v.nightly_rate,v.status,v.notes) returning * into saved;
 else
  update public.reservations set property_id=v.property_id,guest_id=v.guest_id,source=v.source,guest_name=v.guest_name,check_in=v.check_in,check_out=v.check_out,guests=v.guests,adults=v.adults,children=v.children,arrival_time=v.arrival_time,special_request=v.special_request,nightly_rate=v.nightly_rate,status=v.status,notes=v.notes where id=p_id returning * into saved;
 end if;
 perform set_config('pomaaalo.override_id','',true);
 insert into public.booking_override_audit(property_id,reservation_id,actor,reason,check_in,check_out) values(saved.property_id,saved.id,auth.uid(),trim(p_reason),saved.check_in,saved.check_out);
 return saved;
end $$;
revoke all on function public.save_reservation_override(jsonb,text,uuid) from public,anon;
grant execute on function public.save_reservation_override(jsonb,text,uuid) to authenticated;

create or replace function public.check_availability_and_price() returns trigger language plpgsql security definer set search_path=public as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(new.property_id::text,0));
 if not exists(select 1 from public.properties p where p.id=new.property_id and p.agency_id=public.requested_agency_id()) then raise exception 'Property unavailable' using errcode='42501'; end if;
 if tg_table_name='availability_blocks' then
  if exists(select 1 from public.reservations r where r.property_id=new.property_id and r.status<>'cancelled' and (r.check_in at time zone 'Europe/Zagreb')::date<new.end_date and (r.check_out at time zone 'Europe/Zagreb')::date>new.start_date)
   or exists(select 1 from public.availability_blocks b where b.property_id=new.property_id and b.id<>new.id and b.start_date<new.end_date and b.end_date>new.start_date) then raise exception 'OVERBOOK: Dates overlap an existing booking or block'; end if;
 else
  if new.status<>'cancelled' and new.source in ('direct','agency') and not (coalesce(current_setting('pomaaalo.override_id',true),'')=new.id::text and auth.uid() is not null and public.current_user_role() in ('owner','admin')) then
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
