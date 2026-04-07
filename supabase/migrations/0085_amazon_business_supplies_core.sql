alter type public.procurement_provider add value if not exists 'amazon_business';

alter table public.procurement_provider_quote_lines
  add column if not exists provider_product_key text;

create index if not exists procurement_provider_quote_lines_product_key_idx
on public.procurement_provider_quote_lines (provider_product_key)
where provider_product_key is not null;

create table public.procurement_supply_lists (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_by_user_id uuid not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.procurement_supply_list_lines (
  id uuid primary key default gen_random_uuid(),
  supply_list_id uuid not null references public.procurement_supply_lists (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  inventory_item_id uuid references public.inventory_items (id) on delete set null,
  description text not null,
  default_quantity numeric(10, 2) not null default 1,
  search_query text,
  provider public.procurement_provider not null,
  provider_product_key text,
  provider_offer_key text,
  expected_unit_cost_cents integer,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint procurement_supply_list_lines_default_quantity_check check (default_quantity > 0),
  constraint procurement_supply_list_lines_expected_unit_cost_check check (
    expected_unit_cost_cents is null or expected_unit_cost_cents >= 0
  )
);

create index procurement_supply_lists_company_id_idx
on public.procurement_supply_lists (company_id);

create index procurement_supply_list_lines_supply_list_id_idx
on public.procurement_supply_list_lines (supply_list_id);

create index procurement_supply_list_lines_company_id_idx
on public.procurement_supply_list_lines (company_id);

create index procurement_supply_list_lines_provider_idx
on public.procurement_supply_list_lines (company_id, provider);

create trigger procurement_supply_lists_set_updated_at
before update on public.procurement_supply_lists
for each row
execute function public.set_updated_at();

create trigger procurement_supply_list_lines_set_updated_at
before update on public.procurement_supply_list_lines
for each row
execute function public.set_updated_at();
