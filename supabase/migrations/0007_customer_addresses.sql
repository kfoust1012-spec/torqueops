create table public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  label text not null default 'service',
  line1 text not null,
  line2 text,
  city text not null,
  state text not null,
  postal_code text not null,
  country text not null default 'US',
  gate_code text,
  parking_notes text,
  is_primary boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint customer_addresses_country_not_blank check (btrim(country) <> '')
);

create index customer_addresses_customer_id_idx on public.customer_addresses (customer_id);
create index customer_addresses_company_id_idx on public.customer_addresses (company_id);
create unique index customer_addresses_one_primary_per_customer_idx
  on public.customer_addresses (customer_id)
  where is_primary = true;

create trigger customer_addresses_set_updated_at
before update on public.customer_addresses
for each row
execute function public.set_updated_at();
