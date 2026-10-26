begin;

create table public.property_images (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  storage_provider text not null default 'r2' check (storage_provider in ('r2')),
  storage_key text not null unique,
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  file_size integer not null check (file_size > 0 and file_size <= 245760),
  format text not null check (format in ('webp', 'jpeg')),
  original_width integer check (original_width > 0),
  original_height integer check (original_height > 0),
  original_file_size integer check (original_file_size > 0),
  sort_order integer not null default 0,
  is_cover boolean not null default true,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (property_id)
);

create index property_images_agency_property_idx
  on public.property_images (agency_id, property_id);

alter table public.property_images enable row level security;

create policy property_images_select
on public.property_images
for select
to authenticated
using (
  agency_id = public.requested_agency_id()
  and public.has_property_access(property_id)
);

create policy property_images_insert
on public.property_images
for insert
to authenticated
with check (
  agency_id = public.requested_agency_id()
  and public.current_user_role() in ('owner', 'admin', 'manager')
  and public.has_property_access(property_id)
  and exists (
    select 1 from public.properties property
    where property.id = property_id
      and property.agency_id = agency_id
  )
);

create policy property_images_update
on public.property_images
for update
to authenticated
using (
  agency_id = public.requested_agency_id()
  and public.current_user_role() in ('owner', 'admin', 'manager')
  and public.has_property_access(property_id)
)
with check (
  agency_id = public.requested_agency_id()
  and public.current_user_role() in ('owner', 'admin', 'manager')
  and public.has_property_access(property_id)
  and exists (
    select 1 from public.properties property
    where property.id = property_id
      and property.agency_id = agency_id
  )
);

create policy property_images_delete
on public.property_images
for delete
to authenticated
using (
  agency_id = public.requested_agency_id()
  and public.current_user_role() in ('owner', 'admin', 'manager')
  and public.has_property_access(property_id)
);

grant select, insert, update, delete on public.property_images to authenticated;

commit;
