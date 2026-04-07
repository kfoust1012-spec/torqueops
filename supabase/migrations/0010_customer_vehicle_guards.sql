alter table public.customer_addresses
  add constraint customer_addresses_label_check
    check (label in ('service', 'billing', 'home', 'work', 'other')),
  add constraint customer_addresses_state_format_check
    check (state ~ '^[A-Z]{2}$'),
  add constraint customer_addresses_country_format_check
    check (country ~ '^[A-Z]{2}$');

alter table public.vehicles
  add constraint vehicles_license_state_format_check
    check (license_state is null or license_state ~ '^[A-Z]{2}$'),
  add constraint vehicles_vin_format_check
    check (vin is null or vin ~ '^[A-HJ-NPR-Z0-9]{17}$');

create or replace function public.sync_primary_customer_address()
returns trigger
language plpgsql
as $$
begin
  if new.is_primary then
    update public.customer_addresses
    set is_primary = false
    where customer_id = new.customer_id
      and id <> new.id;
  end if;

  return new;
end;
$$;

create trigger customer_addresses_sync_primary
before insert or update on public.customer_addresses
for each row
execute function public.sync_primary_customer_address();
