begin;

alter table public.properties
  add column if not exists color text default '#7C5CFC',
  add column if not exists latitude double precision,
  add column if not exists longitude double precision;

update public.properties
set color = case
  when id = '11111111-1111-1111-1111-111111111111' then '#7C5CFC'
  when id = '22222222-2222-2222-2222-222222222222' then '#2A8CFF'
  when id = '33333333-3333-3333-3333-333333333333' then '#18A67A'
  else coalesce(color, '#7C5CFC')
end
where color is null;

commit;
