-- Run as postgres in the SQL Editor. Fixtures and all test writes are rolled back.
-- Run before and after 007. Every row must pass after the migration.
begin;
create temporary table access_test_results (role text, active boolean, passed boolean, observed jsonb);
do $test$
declare
  test_user uuid;
  assigned_property uuid := gen_random_uuid();
  other_property uuid := gen_random_uuid();
  test_role text;
  active_state boolean;
  allowed boolean;
  visible_assigned integer;
  visible_other integer;
  visible_profiles integer;
  visible_access integer;
  updated_rows integer;
begin
  insert into public.properties(id,name) values
    (assigned_property,'Access regression assigned'), (other_property,'Access regression unassigned');
  foreach test_role in array array['admin','manager','viewer','cleaning'] loop
    foreach active_state in array array[true,false] loop
      test_user := gen_random_uuid();
      insert into auth.users(id,email) values(test_user,test_user::text || '@example.invalid');
      insert into public.profiles(id,email,role,is_active)
        values(test_user,test_user::text || '@example.invalid',test_role,active_state)
        on conflict(id) do update set role=excluded.role,is_active=excluded.is_active;
      insert into public.property_access(user_id,property_id) values(test_user,assigned_property);
      perform set_config('request.jwt.claim.sub',test_user::text,true);
      perform set_config('request.jwt.claims',json_build_object('sub',test_user,'role','authenticated')::text,true);
      set local role authenticated;
      select public.has_property_access(assigned_property) into allowed;
      select count(*) into visible_assigned from public.properties where id=assigned_property;
      select count(*) into visible_other from public.properties where id=other_property;
      select count(*) into visible_profiles from public.profiles where id=test_user;
      select count(*) into visible_access from public.property_access where user_id=test_user;
      update public.properties set name=name where id=assigned_property;
      get diagnostics updated_rows = row_count;
      reset role;
      insert into access_test_results values(test_role,active_state,
        allowed is not distinct from active_state
        and visible_assigned=active_state::integer
        and visible_other=(active_state and test_role='admin')::integer
        and visible_profiles=active_state::integer
        and visible_access=active_state::integer
        and updated_rows=(active_state and test_role in ('admin','manager'))::integer,
        jsonb_build_object('helper',allowed,'assigned',visible_assigned,'unassigned',visible_other,
          'own_profile',visible_profiles,'assignments',visible_access,'updated',updated_rows));
    end loop;
  end loop;
end;
$test$;
select * from access_test_results order by role,active desc;
rollback;
