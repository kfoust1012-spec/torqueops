create type public.procurement_provider as enum ('partstech');
create type public.procurement_provider_account_status as enum (
  'connected',
  'action_required',
  'error',
  'disconnected'
);
create type public.procurement_provider_supplier_mapping_status as enum (
  'active',
  'pending_approval',
  'unmapped',
  'disabled'
);
create type public.procurement_provider_quote_status as enum (
  'draft',
  'priced',
  'selected',
  'converted',
  'manual_required',
  'expired',
  'failed'
);
create type public.procurement_provider_order_status as enum (
  'draft',
  'submitted',
  'accepted',
  'manual_required',
  'failed',
  'canceled'
);

create table public.procurement_provider_accounts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  provider public.procurement_provider not null,
  status public.procurement_provider_account_status not null default 'disconnected',
  display_name text not null,
  username text,
  credential_ciphertext text,
  credential_hint text,
  settings_json jsonb not null default '{}'::jsonb,
  capabilities_json jsonb not null default '{}'::jsonb,
  last_verified_at timestamptz,
  last_error_message text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint procurement_provider_accounts_company_provider_unique unique (company_id, provider)
);

create table public.procurement_provider_supplier_mappings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  provider_account_id uuid not null references public.procurement_provider_accounts (id) on delete cascade,
  supplier_account_id uuid not null references public.supplier_accounts (id) on delete cascade,
  provider_supplier_key text not null,
  provider_supplier_name text not null,
  provider_location_key text,
  status public.procurement_provider_supplier_mapping_status not null default 'unmapped',
  supports_quote boolean not null default false,
  supports_order boolean not null default false,
  last_verified_at timestamptz,
  last_error_message text,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index procurement_provider_supplier_mappings_provider_supplier_unique
on public.procurement_provider_supplier_mappings (
  provider_account_id,
  provider_supplier_key,
  coalesce(provider_location_key, '')
);

create table public.procurement_provider_quotes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  provider_account_id uuid not null references public.procurement_provider_accounts (id) on delete cascade,
  job_id uuid not null references public.jobs (id) on delete cascade,
  estimate_id uuid references public.estimates (id) on delete set null,
  part_request_id uuid not null references public.part_requests (id) on delete cascade,
  status public.procurement_provider_quote_status not null default 'draft',
  vehicle_context_json jsonb not null default '{}'::jsonb,
  search_context_json jsonb not null default '{}'::jsonb,
  requested_by_user_id uuid not null,
  requested_at timestamptz not null default timezone('utc', now()),
  expires_at timestamptz,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.procurement_provider_quote_lines (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  provider_quote_id uuid not null references public.procurement_provider_quotes (id) on delete cascade,
  part_request_line_id uuid not null references public.part_request_lines (id) on delete cascade,
  provider_supplier_mapping_id uuid references public.procurement_provider_supplier_mappings (id) on delete set null,
  provider_offer_key text not null,
  provider_supplier_key text not null,
  provider_supplier_name text not null,
  description text not null,
  manufacturer text,
  part_number text,
  quantity numeric(10, 2) not null default 1,
  unit_price_cents integer,
  core_charge_cents integer,
  availability_text text,
  eta_text text,
  selected_for_cart boolean not null default false,
  raw_response_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint procurement_provider_quote_lines_quantity_check check (quantity > 0),
  constraint procurement_provider_quote_lines_unit_price_check check (
    unit_price_cents is null or unit_price_cents >= 0
  ),
  constraint procurement_provider_quote_lines_core_charge_check check (
    core_charge_cents is null or core_charge_cents >= 0
  ),
  constraint procurement_provider_quote_lines_offer_unique unique (provider_quote_id, provider_offer_key)
);

create table public.procurement_provider_orders (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  provider_account_id uuid not null references public.procurement_provider_accounts (id) on delete cascade,
  purchase_order_id uuid not null references public.purchase_orders (id) on delete cascade,
  provider_quote_id uuid references public.procurement_provider_quotes (id) on delete set null,
  status public.procurement_provider_order_status not null default 'draft',
  provider_order_reference text,
  submitted_at timestamptz,
  response_received_at timestamptz,
  manual_fallback_reason text,
  raw_request_json jsonb not null default '{}'::jsonb,
  raw_response_json jsonb not null default '{}'::jsonb,
  last_error_message text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint procurement_provider_orders_purchase_order_unique unique (purchase_order_id, provider_account_id)
);

create table public.procurement_provider_order_lines (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  provider_order_id uuid not null references public.procurement_provider_orders (id) on delete cascade,
  purchase_order_line_id uuid not null references public.purchase_order_lines (id) on delete cascade,
  provider_quote_line_id uuid references public.procurement_provider_quote_lines (id) on delete set null,
  provider_line_reference text,
  quantity numeric(10, 2) not null default 1,
  unit_price_cents integer,
  raw_response_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint procurement_provider_order_lines_quantity_check check (quantity > 0),
  constraint procurement_provider_order_lines_unit_price_check check (
    unit_price_cents is null or unit_price_cents >= 0
  ),
  constraint procurement_provider_order_lines_order_line_unique unique (provider_order_id, purchase_order_line_id)
);

alter table public.supplier_cart_lines
  add column provider_quote_line_id uuid references public.procurement_provider_quote_lines (id) on delete set null;

create unique index supplier_cart_lines_provider_quote_line_unique
on public.supplier_cart_lines (provider_quote_line_id)
where provider_quote_line_id is not null;

create index procurement_provider_accounts_company_id_idx
on public.procurement_provider_accounts (company_id);

create index procurement_provider_accounts_status_idx
on public.procurement_provider_accounts (company_id, provider, status);

create index procurement_provider_supplier_mappings_company_id_idx
on public.procurement_provider_supplier_mappings (company_id);

create index procurement_provider_supplier_mappings_supplier_account_id_idx
on public.procurement_provider_supplier_mappings (supplier_account_id);

create index procurement_provider_quotes_company_id_idx
on public.procurement_provider_quotes (company_id);

create index procurement_provider_quotes_request_idx
on public.procurement_provider_quotes (part_request_id, requested_at desc);

create index procurement_provider_quote_lines_quote_id_idx
on public.procurement_provider_quote_lines (provider_quote_id);

create index procurement_provider_quote_lines_request_line_id_idx
on public.procurement_provider_quote_lines (part_request_line_id);

create index procurement_provider_orders_company_id_idx
on public.procurement_provider_orders (company_id);

create index procurement_provider_orders_purchase_order_id_idx
on public.procurement_provider_orders (purchase_order_id);

create index procurement_provider_order_lines_order_id_idx
on public.procurement_provider_order_lines (provider_order_id);

create trigger procurement_provider_accounts_set_updated_at
before update on public.procurement_provider_accounts
for each row
execute function public.set_updated_at();

create trigger procurement_provider_supplier_mappings_set_updated_at
before update on public.procurement_provider_supplier_mappings
for each row
execute function public.set_updated_at();

create trigger procurement_provider_quotes_set_updated_at
before update on public.procurement_provider_quotes
for each row
execute function public.set_updated_at();

create trigger procurement_provider_quote_lines_set_updated_at
before update on public.procurement_provider_quote_lines
for each row
execute function public.set_updated_at();

create trigger procurement_provider_orders_set_updated_at
before update on public.procurement_provider_orders
for each row
execute function public.set_updated_at();

create trigger procurement_provider_order_lines_set_updated_at
before update on public.procurement_provider_order_lines
for each row
execute function public.set_updated_at();
