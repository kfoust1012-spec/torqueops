do $$
begin
  create type public.customer_relationship_type as enum ('retail_customer', 'fleet_account');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.vehicle_ownership_type as enum ('customer_owned', 'fleet_account_asset');
exception
  when duplicate_object then null;
end $$;

alter table public.customers
  add column if not exists relationship_type public.customer_relationship_type not null default 'retail_customer',
  add column if not exists company_name text;

alter table public.customers
  drop constraint if exists customers_company_name_not_blank,
  drop constraint if exists customers_company_name_required_for_fleet;

alter table public.customers
  add constraint customers_company_name_not_blank
    check (company_name is null or btrim(company_name) <> ''),
  add constraint customers_company_name_required_for_fleet
    check (
      relationship_type <> 'fleet_account'
      or (company_name is not null and btrim(company_name) <> '')
    );

create index if not exists customers_company_relationship_idx
on public.customers (company_id, relationship_type, is_active);

alter table public.vehicles
  add column if not exists ownership_type public.vehicle_ownership_type not null default 'customer_owned';

create index if not exists vehicles_company_ownership_idx
on public.vehicles (company_id, ownership_type, is_active, created_at desc);

create table if not exists public.service_units (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  stock_location_id uuid not null,
  assigned_technician_user_id uuid references public.profiles (id) on delete set null,
  unit_code text not null,
  display_name text not null,
  year integer,
  make text,
  model text,
  license_plate text,
  license_state text,
  vin text,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint service_units_company_stock_location_fk
    foreign key (stock_location_id, company_id)
    references public.stock_locations (id, company_id)
    on delete restrict,
  constraint service_units_company_stock_location_unique unique (company_id, stock_location_id),
  constraint service_units_company_unit_code_unique unique (company_id, unit_code),
  constraint service_units_unit_code_not_blank check (btrim(unit_code) <> ''),
  constraint service_units_display_name_not_blank check (btrim(display_name) <> ''),
  constraint service_units_year_range check (year is null or year between 1900 and 2100),
  constraint service_units_vin_length check (vin is null or char_length(vin) = 17),
  constraint service_units_plate_pair_check check (
    (license_plate is null and license_state is null)
    or (license_plate is not null and license_state is not null)
  )
);

create unique index if not exists service_units_company_vin_unique_idx
on public.service_units (company_id, vin)
where vin is not null;

create unique index if not exists service_units_company_plate_unique_idx
on public.service_units (company_id, license_plate, license_state)
where license_plate is not null and license_state is not null;

create index if not exists service_units_company_assigned_technician_idx
on public.service_units (company_id, assigned_technician_user_id, is_active);

create or replace function public.enforce_service_unit_company_match()
returns trigger
language plpgsql
as $$
declare
  location_company_id uuid;
  location_type public.inventory_location_type;
begin
  select company_id, location_type
  into location_company_id, location_type
  from public.stock_locations
  where id = new.stock_location_id;

  if location_company_id is null then
    raise exception 'stock_location_id % does not exist', new.stock_location_id;
  end if;

  if new.company_id <> location_company_id then
    raise exception 'service_units.company_id must match stock_locations.company_id';
  end if;

  if location_type <> 'van' then
    raise exception 'service_units must reference a van stock location.';
  end if;

  return new;
end;
$$;

drop trigger if exists service_units_company_match on public.service_units;
create trigger service_units_company_match
before insert or update on public.service_units
for each row
execute function public.enforce_service_unit_company_match();

drop trigger if exists service_units_set_updated_at on public.service_units;
create trigger service_units_set_updated_at
before update on public.service_units
for each row
execute function public.set_updated_at();

insert into public.service_units (
  company_id,
  stock_location_id,
  assigned_technician_user_id,
  unit_code,
  display_name,
  is_active,
  notes
)
select
  stock.company_id,
  stock.id,
  stock.technician_user_id,
  upper(stock.slug),
  coalesce(nullif(stock.vehicle_label, ''), stock.name, upper(stock.slug)),
  stock.is_active,
  stock.notes
from public.stock_locations stock
where stock.location_type = 'van'
on conflict (company_id, stock_location_id) do nothing;
