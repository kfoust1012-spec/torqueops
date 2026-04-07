create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete restrict,
  year integer,
  make text not null,
  model text not null,
  trim text,
  engine text,
  license_plate text,
  license_state text,
  vin text,
  color text,
  odometer integer,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint vehicles_year_range check (year is null or year between 1900 and 2100),
  constraint vehicles_odometer_nonnegative check (odometer is null or odometer >= 0),
  constraint vehicles_vin_length check (vin is null or char_length(vin) = 17)
);

create index vehicles_company_id_idx on public.vehicles (company_id);
create index vehicles_customer_id_idx on public.vehicles (customer_id);
create index vehicles_company_make_model_idx on public.vehicles (company_id, make, model);
create unique index vehicles_company_vin_unique_idx
  on public.vehicles (company_id, vin)
  where vin is not null;
create unique index vehicles_company_plate_unique_idx
  on public.vehicles (company_id, license_plate, license_state)
  where license_plate is not null and license_state is not null;

create trigger vehicles_set_updated_at
before update on public.vehicles
for each row
execute function public.set_updated_at();
