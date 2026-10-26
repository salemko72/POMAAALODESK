-- Synthetic fixtures are rolled back inside the DO block, including auth users.
-- Any failed assertion stops execution; no temporary result table is required.
do $test$
declare p uuid:=gen_random_uuid(); p2 uuid:=gen_random_uuid(); u uuid:=gen_random_uuid(); r uuid:=gen_random_uuid(); t uuid:=gen_random_uuid(); g jsonb; n integer; amount numeric; denied boolean;
begin
 insert into public.properties(id,name) values(p,'Operations regression'),(p2,'Unassigned regression');
 insert into auth.users(id,email) values(u,u::text||'@example.invalid');
 insert into public.profiles(id,email,role,is_active) values(u,u::text||'@example.invalid','manager',true) on conflict(id) do update set role='manager',is_active=true;
 insert into public.property_access(user_id,property_id) values(u,p);
 perform set_config('request.jwt.claim.sub',u::text,true);
 perform set_config('request.jwt.claims',json_build_object('sub',u,'role','authenticated')::text,true);
 set local role authenticated;
 g:=public.save_guest_contact('{"name":"Test contact","email":"fixture@example.invalid"}'::jsonb);
 insert into public.availability_blocks(property_id,start_date,end_date,reason) values(p,'2035-01-10','2035-01-15','Maintenance');
 denied:=false;
 begin insert into public.reservations(property_id,source,guest_name,check_in,check_out) values(p,'direct','Blocked','2035-01-11T14:00Z','2035-01-13T10:00Z'); exception when raise_exception then denied:=true; end;
 if not denied then raise exception 'FAIL: manual booking bypassed block'; end if;
 insert into public.reservations(id,property_id,source,guest_name,guest_id,check_in,check_out,nightly_rate) values(r,p,'direct','Test contact',(g->>'id')::uuid,'2035-01-15T14:00Z','2035-01-18T10:00Z',99.99);
 select total_price into amount from public.reservations where id=r;
 if amount is distinct from 299.97 then raise exception 'FAIL: nightly total %',amount; end if;
 insert into public.cleaning_tasks(reservation_id,property_id,start_time,end_time,status,is_manually_overridden) values(r,p,'2035-01-18T10:00Z','2035-01-18T12:00Z','pending',false);
 update public.reservations set check_out='2035-01-19T10:00Z' where id=r;
 select total_price into amount from public.reservations where id=r;
 if amount is distinct from 399.96 then raise exception 'FAIL: resized total'; end if;
 select count(*) into n from public.cleaning_tasks where reservation_id=r and start_time='2035-01-19T10:00Z';
 if n<>1 then raise exception 'FAIL: cleaning did not move'; end if;
 insert into public.reservations(property_id,source,guest_name,check_in,check_out) values(p,'airbnb','Imported conflict','2035-01-11T14:00Z','2035-01-13T10:00Z');
 insert into public.property_tasks(id,property_id,kind,title,start_time,end_time) values(t,p,'Repair','Repair fixture','2035-01-11T10:00Z','2035-01-11T12:00Z');
 denied:=false;
 begin insert into public.property_tasks(property_id,kind,title,start_time,end_time) values(p2,'Repair','Denied','2035-01-11T10:00Z','2035-01-11T12:00Z'); exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'FAIL: unassigned property writable'; end if;
 reset role;
 update public.profiles set role='cleaning' where id=u;
 set local role authenticated;
 select count(*) into n from public.guests where id=(g->>'id')::uuid;
 if n<>0 then raise exception 'FAIL: cleaning sees guest'; end if;
 perform public.set_property_task_status(t,'done');
 select count(*) into n from public.get_property_tasks() where id=t and status='done';
 if n<>1 then raise exception 'FAIL: cleaning task status'; end if;
 reset role;
 update public.profiles set is_active=false where id=u;
 set local role authenticated;
 select count(*) into n from public.get_property_tasks();
 if n<>0 then raise exception 'FAIL: inactive task access'; end if;
 reset role;
 raise exception 'Rollback successful fixtures' using errcode='ZX001';
exception when sqlstate 'ZX001' then null;
end $test$;
select 'PASS: blocks, imported conflicts, rates, cleaning reschedule, contacts, property access, task status and deactivation' as result;
