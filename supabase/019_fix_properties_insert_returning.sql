begin;

-- INSERT ... RETURNING also evaluates the SELECT policy. Owner/Admin access
-- must therefore be decided from the new row's agency_id instead of looking
-- the not-yet-visible row up again through has_property_access(id).
alter policy properties_select
on public.properties
to authenticated
using (
  agency_id = public.requested_agency_id()
  and (
    public.current_user_role() in ('owner', 'admin')
    or (
      public.current_user_role() in ('manager', 'viewer')
      and public.has_property_access(id)
    )
  )
);

commit;
