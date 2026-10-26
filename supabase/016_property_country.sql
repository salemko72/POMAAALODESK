begin;

alter table public.properties
  add column if not exists country text not null default '';

commit;
