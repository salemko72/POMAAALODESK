-- Select this entire script before Run selected. Everything is rolled back.
-- Run after 007 and 008; every result must be true.
begin;
create temporary table cleaning_test_results(test text,passed boolean);
do $test$
declare
  p1 uuid := gen_random_uuid(); p2 uuid := gen_random_uuid();
  r1 uuid := gen_random_uuid(); r2 uuid := gen_random_uuid();
  t1 uuid := gen_random_uuid(); t2 uuid := gen_random_uuid();
  u uuid; cleaner uuid; test_role text; active_state boolean;
  raw_count integer; task_count integer; changed integer; denied boolean; payload jsonb;
begin
  insert into public.properties(id,name) values(p1,'Privacy test assigned'),(p2,'Privacy test unassigned');
  insert into public.reservations(id,property_id,source,guest_name,notes,check_in,check_out)
    values(r1,p1,'direct','PRIVATE GUEST','PRIVATE NOTES','2026-09-10T10:00Z','2026-09-11T10:00Z'),
          (r2,p2,'direct','OTHER PRIVATE GUEST','OTHER NOTES','2026-09-10T10:00Z','2026-09-11T10:00Z');
  insert into public.cleaning_tasks(id,reservation_id,property_id,start_time,end_time)
    values(t1,r1,p1,'2026-09-11T10:00Z','2026-09-11T12:00Z'),(t2,r2,p2,'2026-09-11T10:00Z','2026-09-11T12:00Z');
  foreach test_role in array array['admin','manager','viewer','cleaning'] loop
    foreach active_state in array array[true,false] loop
      u := gen_random_uuid();
      insert into auth.users(id,email) values(u,u::text || '@example.invalid');
      insert into public.profiles(id,email,role,is_active) values(u,u::text || '@example.invalid',test_role,active_state)
        on conflict(id) do update set role=excluded.role,is_active=excluded.is_active;
      insert into public.property_access(user_id,property_id) values(u,p1);
      if test_role='cleaning' and active_state then cleaner:=u; end if;
      perform set_config('request.jwt.claim.sub',u::text,true);
      perform set_config('request.jwt.claims',json_build_object('sub',u,'role','authenticated')::text,true);
      set local role authenticated;
      select count(*) into raw_count from public.reservations where id=r1;
      select count(*) into task_count from public.get_my_cleaning_work('2026-09-11T00:00Z','2026-09-12T00:00Z');
      update public.cleaning_tasks set start_time=start_time where id=t1;
      get diagnostics changed = row_count;
      denied:=false;
      begin perform public.update_my_cleaning_status(t1,'done'); exception when insufficient_privilege then denied:=true; end;
      reset role;
      insert into cleaning_test_results values(test_role || ' active=' || active_state,
        raw_count=(active_state and test_role<>'cleaning')::integer
        and task_count=(active_state and test_role='cleaning')::integer
        and changed=(active_state and test_role in ('admin','manager'))::integer
        and denied=not(active_state and test_role='cleaning'));
    end loop;
  end loop;
  perform set_config('request.jwt.claim.sub',cleaner::text,true);
  perform set_config('request.jwt.claims',json_build_object('sub',cleaner,'role','authenticated')::text,true);
  set local role authenticated;
  select to_jsonb(w) into payload from public.get_my_cleaning_work('2026-09-11T00:00Z','2026-09-12T00:00Z') w;
  denied:=false;
  begin perform public.update_my_cleaning_status(t2,'done'); exception when insufficient_privilege then denied:=true; end;
  reset role;
  insert into cleaning_test_results values('unassigned task rejected',denied);
  insert into cleaning_test_results values('only operational fields returned',
    payload is not null and (payload - array['task_id','property_name','address','city','start_time','end_time','status'])='{}'::jsonb
    and payload->>'status'='done' and payload->>'start_time'='2026-09-11T10:00:00+00:00');
  set local role authenticated;
  denied:=false;
  begin perform public.update_my_cleaning_status(t1,'invalid'); exception when invalid_parameter_value then denied:=true; end;
  reset role;
  insert into cleaning_test_results values('invalid status rejected',denied);
  update public.reservations set status='cancelled' where id=r1;
  set local role authenticated;
  select count(*) into task_count from public.get_my_cleaning_work('2026-09-11T00:00Z','2026-09-12T00:00Z');
  reset role;
  insert into cleaning_test_results values('cancelled stay hidden',task_count=0);
  update public.reservations set status='confirmed' where id=r1;
  update public.profiles set is_active=false where id=cleaner;
  set local role authenticated;
  select count(*) into task_count from public.get_my_cleaning_work('2026-09-11T00:00Z','2026-09-12T00:00Z');
  denied:=false;
  begin perform public.update_my_cleaning_status(t1,'pending'); exception when insufficient_privilege then denied:=true; end;
  reset role;
  insert into cleaning_test_results values('same session loses access after deactivation',task_count=0 and denied);
end;
$test$;
insert into cleaning_test_results values('anonymous cannot execute operational API',
  not has_function_privilege('anon','public.get_my_cleaning_work(timestamptz,timestamptz)','execute')
  and not has_function_privilege('anon','public.update_my_cleaning_status(uuid,text)','execute'));
select * from cleaning_test_results;
rollback;
