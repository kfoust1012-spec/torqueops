alter table public.customers
  add constraint customers_first_name_not_blank check (btrim(first_name) <> ''),
  add constraint customers_last_name_not_blank check (btrim(last_name) <> '');

alter table public.customer_addresses
  add constraint customer_addresses_line1_not_blank check (btrim(line1) <> ''),
  add constraint customer_addresses_city_not_blank check (btrim(city) <> ''),
  add constraint customer_addresses_postal_code_not_blank check (btrim(postal_code) <> '');

alter table public.vehicles
  add constraint vehicles_make_not_blank check (btrim(make) <> ''),
  add constraint vehicles_model_not_blank check (btrim(model) <> '');
