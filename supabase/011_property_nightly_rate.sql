begin;
alter table public.properties add column if not exists nightly_rate numeric(12,2) check (nightly_rate >= 0);

create or replace function public.check_availability_and_price()
returns trigger language plpgsql as $$
declare nights integer;
begin
  if new.check_out <= new.check_in then raise exception 'Check-out must be after check-in'; end if;
  if exists (select 1 from public.reservations r where r.property_id = new.property_id and r.id <> coalesce(new.id, gen_random_uuid()) and r.status <> 'cancelled' and tstzrange(r.check_in,r.check_out,'[)') && tstzrange(new.check_in,new.check_out,'[)')) then raise exception 'Property is not available for selected dates'; end if;
  nights := greatest(1, ceil(extract(epoch from (new.check_out-new.check_in))/86400)::integer);
  if new.nightly_rate is null then select p.nightly_rate into new.nightly_rate from public.properties p where p.id = new.property_id; end if;
  new.total_price := coalesce(new.nightly_rate,0) * nights;
  return new;
end; $$;
commit;
