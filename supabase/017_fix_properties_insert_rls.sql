begin;

-- Validate the agency on the row being inserted. This avoids depending on the
-- optional x-agency-id request header while preserving Owner/Admin-only access.
alter policy properties_insert
on public.properties
to authenticated
with check (
  (select auth.uid()) is not null
  and exists (
    select 1
    from public.agency_memberships membership
    where membership.agency_id = properties.agency_id
      and membership.user_id = (select auth.uid())
      and membership.is_active = true
      and membership.role in ('owner', 'admin')
  )
);

commit;
