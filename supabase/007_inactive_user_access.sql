-- Enforce deactivation without deleting users, assignments or historical data.
-- Restrictive policies are ANDed with every existing permissive policy, including
-- the legacy property policies present on the hosted database.
begin;

create or replace function public.has_property_access(p_property_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    public.current_user_role() is not null
    and (
      public.current_user_role() = 'admin'
      or exists (
        select 1 from public.property_access pa
        where pa.user_id = auth.uid() and pa.property_id = p_property_id
      )
    ), false
  );
$$;

do $migration$
declare target_table text;
begin
  foreach target_table in array array[
    'profiles','properties','property_access','reservations','cleaning_tasks',
    'external_calendars','booking_conflicts'
  ] loop
    execute format('alter table public.%I enable row level security', target_table);
    execute format('drop policy if exists "Active account required" on public.%I', target_table);
    execute format(
      'create policy "Active account required" on public.%I as restrictive for all to authenticated '
      'using ((select public.current_user_role()) is not null) '
      'with check ((select public.current_user_role()) is not null)', target_table
    );
  end loop;
end;
$migration$;

commit;
