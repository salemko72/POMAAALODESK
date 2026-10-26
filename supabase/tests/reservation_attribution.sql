begin;

create temporary table attribution_test (like public.reservations including defaults) on commit drop;
create trigger attribution_test before insert or update on attribution_test for each row execute function private.stamp_reservation_attribution();
do $check$
declare a uuid:='00000000-0000-0000-0000-000000000001'; p uuid; u uuid; other_user uuid; r public.reservations; old_time timestamptz;
begin
 select id into p from public.properties where agency_id=a limit 1;
 select user_id into u from public.agency_memberships where agency_id=a and is_active order by role='owner' desc limit 1;
 select user_id into other_user from public.agency_memberships where agency_id=a and is_active and user_id<>u limit 1;
 other_user:=coalesce(other_user,u);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
 insert into attribution_test(property_id,source,guest_name,check_in,check_out,guests,status,created_by,created_by_name,last_modified_by)
 values(p,'direct','Attribution verification','2099-01-01','2099-01-03',1,'confirmed',gen_random_uuid(),'FORGED',gen_random_uuid()) returning * into r;
 if r.created_by<>u or r.created_by_name='FORGED' or r.last_modified_by is not null then raise exception 'Insert stamping failed';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',other_user,'role','authenticated')::text,true);
 update attribution_test set check_out='2099-01-04',created_by=other_user,created_by_name='FORGED' where id=r.id returning * into r;
 if r.created_by<>u or r.created_by_name='FORGED' or r.last_modified_by<>other_user or r.last_modified_at is null then raise exception 'Edit stamping failed';end if;
 old_time:=r.last_modified_at;
 update attribution_test set last_modified_by=u,last_modified_by_name='FORGED',last_modified_at=now()+interval '1 day',updated_at=now() where id=r.id returning * into r;
 if r.last_modified_at<>old_time or r.last_modified_by_name='FORGED' then raise exception 'No-op or tampering not ignored';end if;
 perform set_config('request.jwt.claims','{}',true);
 insert into attribution_test(property_id,source,guest_name,check_in,check_out,guests,status)
 values(p,'airbnb_ical','iCal verification','2099-01-01','2099-01-03',1,'confirmed') returning * into r;
 if r.created_actor_kind<>'ical' or r.created_by is not null then raise exception 'iCal actor incorrect';end if;
 update attribution_test set check_out='2099-01-04' where id=r.id returning * into r;
 if r.last_modified_actor_kind<>'ical' then raise exception 'iCal editor incorrect';end if;
end $check$;
select 'Creator/editor, immutable creator, forged field rejection, no-op handling and iCal attribution passed' as result;

rollback;

