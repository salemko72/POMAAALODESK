begin;

-- Normal guest editing continues through save_guest_contact(). Direct writes
-- are reserved for Owner/Admin so the backup restore can preserve guest IDs
-- and reservation relationships with an authenticated bulk upsert.
create policy guests_insert
on public.guests
for insert
to authenticated
with check (
  agency_id = public.requested_agency_id()
  and public.current_user_role() in ('owner', 'admin')
);

create policy guests_update
on public.guests
for update
to authenticated
using (
  agency_id = public.requested_agency_id()
  and public.current_user_role() in ('owner', 'admin')
)
with check (
  agency_id = public.requested_agency_id()
  and public.current_user_role() in ('owner', 'admin')
);

grant insert, update on public.guests to authenticated;

commit;
