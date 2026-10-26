begin;
alter table public.properties
  add column if not exists currency text not null default 'EUR'
  check (currency in ('EUR','USD','GBP','CHF','BAM'));
commit;
