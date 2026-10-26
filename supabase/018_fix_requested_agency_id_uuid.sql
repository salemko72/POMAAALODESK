begin;

create or replace function public.requested_agency_id()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  header_value text;
  result uuid;
begin
  begin
    header_value := current_setting('request.headers', true)::jsonb ->> 'x-agency-id';
  exception when others then
    header_value := null;
  end;

  if header_value is not null and header_value <> '' then
    begin
      result := header_value::uuid;
    exception when others then
      return null;
    end;
    return result;
  end if;

  select case
    when count(*) = 1 then (array_agg(agency_id))[1]
    else null
  end into result
  from public.agency_memberships
  where user_id = auth.uid() and is_active = true;

  return result;
end;
$$;

commit;
