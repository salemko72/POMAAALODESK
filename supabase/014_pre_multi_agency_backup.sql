-- Immutable safety copy made before the multi-agency migration.
-- Run this file and verify the final manifest query before running 015.
begin;

create schema if not exists backup_pre_multi_agency_20260909;
revoke all on schema backup_pre_multi_agency_20260909 from public, anon, authenticated;

do $backup$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles', 'properties', 'property_access', 'reservations',
    'cleaning_tasks', 'guests', 'availability_blocks', 'property_tasks',
    'external_calendars', 'booking_conflicts'
  ] loop
    if to_regclass('public.' || table_name) is not null
       and to_regclass('backup_pre_multi_agency_20260909.' || table_name) is null then
      execute format(
        'create table backup_pre_multi_agency_20260909.%I as table public.%I',
        table_name,
        table_name
      );
    end if;
  end loop;
end;
$backup$;

create table if not exists backup_pre_multi_agency_20260909.manifest (
  created_at timestamptz not null default now(),
  source text not null default 'pre multi-agency migration'
);

insert into backup_pre_multi_agency_20260909.manifest default values;
commit;

select schemaname, tablename
from pg_tables
where schemaname = 'backup_pre_multi_agency_20260909'
order by tablename;
