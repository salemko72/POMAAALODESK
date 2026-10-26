create or replace function public.auto_backup_worker(p_secret text,p_action text,p_agency uuid default null,p_run uuid default null,p_info jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare s private.agency_backup_settings; r private.agency_backup_runs; result jsonb; doc jsonb; uid uuid;
begin
 if p_secret is null or not exists(select 1 from private.backup_worker_keys where key_hash=sha256(convert_to(p_secret,'UTF8'))) then
  raise exception 'Invalid worker capability' using errcode='42501';
 end if;
 if p_action in ('configure','list','download','manual') then
  uid:=(p_info->>'user_id')::uuid;
  if uid is null or not exists(select 1 from public.agency_memberships where agency_id=p_agency and user_id=uid and is_active and role in ('owner','admin')) then
   raise exception 'Owner or admin required' using errcode='42501';
  end if;
 end if;
 if p_action='configure' then
  insert into private.agency_backup_settings(agency_id,enabled,updated_by) values(p_agency,(p_info->>'enabled')::boolean,uid)
  on conflict(agency_id) do update set enabled=excluded.enabled,updated_by=uid,updated_at=now();
  return jsonb_build_object('ok',true);
 elsif p_action='due' then
  -- Retry failed or interrupted jobs. Skip completed days and bound each batch.
  select coalesce(jsonb_agg(agency_id),'[]') into result from
   (select agency_id from private.agency_backup_settings where enabled
    and (last_success_at is null or last_success_at < date_trunc('day',now() at time zone 'UTC') at time zone 'UTC')
    and (last_attempt_at is null or last_attempt_at<now()-interval '30 minutes')
    order by last_attempt_at nulls first limit 10) t;
  return result;
 elsif p_action='list' then
  select coalesce(jsonb_agg(to_jsonb(t)),'[]') into result from
   (select id,status,started_at,finished_at,file_size,sha256,error,expires_at from private.agency_backup_runs
    where agency_id=p_agency and status<>'expired' and expires_at>now() order by started_at desc limit 100) t;
  return result;
 elsif p_action='download' then
  select * into r from private.agency_backup_runs where id=p_run and agency_id=p_agency and status='success' and expires_at>now();
  if r.id is null then raise exception 'Backup not found'; end if;
  return jsonb_build_object('storage_key',r.storage_key,'sha256',r.sha256,'file_size',r.file_size);
 elsif p_action in ('manual','scheduled') then
  insert into private.agency_backup_settings(agency_id) values(p_agency) on conflict do nothing;
  select * into s from private.agency_backup_settings where agency_id=p_agency for update;
  if p_action='scheduled' and (not s.enabled or s.last_success_at >= date_trunc('day',now() at time zone 'UTC') at time zone 'UTC') then return null; end if;
  if s.last_attempt_at>now()-interval '5 minutes' or exists(select 1 from private.agency_backup_runs where agency_id=p_agency and status='running' and started_at>now()-interval '20 minutes') then
   raise exception 'Backup already running or recently attempted. Wait five minutes.';
  end if;
  update private.agency_backup_runs set status='failed',error='Backup interrupted',finished_at=now() where agency_id=p_agency and status='running';
  r.id:=gen_random_uuid();
  r.storage_key:='agencies/'||p_agency||'/'||to_char(now() at time zone 'UTC','YYYY-MM-DD')||'/'||r.id||'.json';
  insert into private.agency_backup_runs(id,agency_id,storage_key,status) values(r.id,p_agency,r.storage_key,'running');
  update private.agency_backup_settings set last_attempt_at=now(),last_error=null where agency_id=p_agency;
  return jsonb_build_object('run_id',r.id,'storage_key',r.storage_key);
 elsif p_action='snapshot' then
  select * into r from private.agency_backup_runs where id=p_run and agency_id=p_agency and status='running' and started_at>now()-interval '20 minutes';
  if r.id is null then raise exception 'Backup lease expired'; end if;
  doc:=private.agency_backup_document(p_agency);
  return doc;
 elsif p_action in ('complete','fail') then
  select * into r from private.agency_backup_runs where id=p_run and agency_id=p_agency for update;
  if r.id is null or r.status<>'running' or r.started_at<now()-interval '20 minutes' then raise exception 'Backup lease expired'; end if;
  if p_action='complete' then
   if coalesce(p_info->>'sha256','') !~ '^[0-9a-f]{64}$' or coalesce((p_info->>'file_size')::bigint,0)<=0 then raise exception 'Invalid backup metadata'; end if;
   update private.agency_backup_runs set status='success',finished_at=now(),file_size=(p_info->>'file_size')::bigint,sha256=p_info->>'sha256' where id=p_run;
   update private.agency_backup_settings set last_success_at=now(),last_error=null where agency_id=p_agency;
  else
   update private.agency_backup_runs set status='failed',finished_at=now(),error='Backup failed. Retry or contact support.' where id=p_run;
   update private.agency_backup_settings set last_error='Backup failed. Retry or contact support.' where agency_id=p_agency;
  end if;
  return jsonb_build_object('ok',true);
 elsif p_action='expired' then
  select coalesce(jsonb_agg(to_jsonb(t)),'[]') into result from (select id,storage_key from private.agency_backup_runs where expires_at<now() and status<>'expired' limit 100) t;
  return result;
 elsif p_action='expire' then
  update private.agency_backup_runs set status='expired' where id=p_run and expires_at<now();
  return jsonb_build_object('ok',true);
 end if;
 raise exception 'Unknown backup action';
end $$;
revoke all on function public.auto_backup_worker(text,text,uuid,uuid,jsonb) from public,authenticated;
grant execute on function public.auto_backup_worker(text,text,uuid,uuid,jsonb) to anon;
