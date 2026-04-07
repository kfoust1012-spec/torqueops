create type public.inventory_item_type as enum ('stocked', 'non_stocked');
create type public.inventory_alias_type as enum (
  'manufacturer_part_number',
  'supplier_sku',
  'alternate_sku'
);
create type public.inventory_location_type as enum ('warehouse', 'shop');
create type public.inventory_transaction_type as enum (
  'adjustment_in',
  'adjustment_out',
  'purchase_receipt',
  'purchase_return',
  'reservation_in',
  'reservation_out',
  'consumption',
  'release',
  'transfer_in',
  'transfer_out'
);
create type public.inventory_transaction_source_type as enum (
  'manual',
  'purchase_receipt',
  'purchase_return',
  'part_request',
  'job',
  'inventory_count'
);
create type public.inventory_reorder_status as enum ('ok', 'low_stock', 'reorder_due');

create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  sku text not null,
  name text not null,
  description text,
  manufacturer text,
  part_number text,
  supplier_account_id uuid references public.supplier_accounts (id) on delete set null,
  default_unit_cost_cents integer,
  item_type public.inventory_item_type not null default 'stocked',
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint inventory_items_company_sku_unique unique (company_id, sku),
  constraint inventory_items_default_unit_cost_check check (
    default_unit_cost_cents is null or default_unit_cost_cents >= 0
  )
);

create table public.inventory_item_aliases (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  inventory_item_id uuid not null references public.inventory_items (id) on delete cascade,
  alias_type public.inventory_alias_type not null,
  value text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint inventory_item_aliases_company_alias_unique unique (company_id, alias_type, value)
);

create table public.stock_locations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null,
  slug text not null,
  location_type public.inventory_location_type not null default 'warehouse',
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint stock_locations_company_slug_unique unique (company_id, slug)
);

create table public.inventory_stock_settings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  inventory_item_id uuid not null references public.inventory_items (id) on delete cascade,
  stock_location_id uuid not null references public.stock_locations (id) on delete cascade,
  reorder_point_quantity numeric(10, 2) not null default 0,
  low_stock_threshold_quantity numeric(10, 2) not null default 0,
  preferred_reorder_quantity numeric(10, 2),
  is_stocked_here boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint inventory_stock_settings_item_location_unique unique (
    company_id,
    inventory_item_id,
    stock_location_id
  ),
  constraint inventory_stock_settings_reorder_point_check check (reorder_point_quantity >= 0),
  constraint inventory_stock_settings_low_stock_threshold_check check (low_stock_threshold_quantity >= 0),
  constraint inventory_stock_settings_preferred_reorder_check check (
    preferred_reorder_quantity is null or preferred_reorder_quantity > 0
  )
);

create table public.inventory_transactions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  inventory_item_id uuid not null references public.inventory_items (id) on delete cascade,
  stock_location_id uuid not null references public.stock_locations (id) on delete cascade,
  transaction_type public.inventory_transaction_type not null,
  source_type public.inventory_transaction_source_type not null,
  source_id uuid,
  job_id uuid references public.jobs (id) on delete set null,
  part_request_line_id uuid references public.part_request_lines (id) on delete set null,
  purchase_order_line_id uuid references public.purchase_order_lines (id) on delete set null,
  purchase_receipt_line_id uuid references public.purchase_receipt_lines (id) on delete set null,
  part_return_line_id uuid references public.part_return_lines (id) on delete set null,
  quantity_delta numeric(10, 2) not null,
  unit_cost_cents integer,
  reference_number text,
  notes text,
  created_by_user_id uuid not null,
  effective_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint inventory_transactions_quantity_delta_check check (quantity_delta <> 0),
  constraint inventory_transactions_unit_cost_check check (
    unit_cost_cents is null or unit_cost_cents >= 0
  )
);

create table public.inventory_reservations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  inventory_item_id uuid not null references public.inventory_items (id) on delete cascade,
  stock_location_id uuid not null references public.stock_locations (id) on delete cascade,
  job_id uuid not null references public.jobs (id) on delete cascade,
  part_request_line_id uuid references public.part_request_lines (id) on delete set null,
  quantity_reserved numeric(10, 2) not null default 0,
  quantity_released numeric(10, 2) not null default 0,
  quantity_consumed numeric(10, 2) not null default 0,
  notes text,
  created_by_user_id uuid not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint inventory_reservations_quantity_reserved_check check (quantity_reserved > 0),
  constraint inventory_reservations_quantity_released_check check (quantity_released >= 0),
  constraint inventory_reservations_quantity_consumed_check check (quantity_consumed >= 0),
  constraint inventory_reservations_release_bounds_check check (
    quantity_released + quantity_consumed <= quantity_reserved
  )
);

alter table public.part_request_lines
  add column inventory_item_id uuid references public.inventory_items (id) on delete set null,
  add column stock_location_id uuid references public.stock_locations (id) on delete set null;

alter table public.purchase_order_lines
  add column inventory_item_id uuid references public.inventory_items (id) on delete set null,
  add column stock_location_id uuid references public.stock_locations (id) on delete set null;

create index inventory_items_company_id_idx on public.inventory_items (company_id);
create index inventory_items_company_active_idx on public.inventory_items (company_id, is_active, sku);
create index inventory_items_part_number_idx on public.inventory_items (company_id, part_number);
create index inventory_item_aliases_company_id_idx on public.inventory_item_aliases (company_id);
create index inventory_item_aliases_item_id_idx on public.inventory_item_aliases (inventory_item_id);
create index stock_locations_company_id_idx on public.stock_locations (company_id);
create index stock_locations_company_active_idx on public.stock_locations (company_id, is_active, slug);
create index inventory_stock_settings_company_item_location_idx
on public.inventory_stock_settings (company_id, inventory_item_id, stock_location_id);
create index inventory_transactions_company_item_location_effective_idx
on public.inventory_transactions (company_id, inventory_item_id, stock_location_id, effective_at desc);
create index inventory_transactions_company_job_idx
on public.inventory_transactions (company_id, job_id, effective_at desc);
create index inventory_transactions_company_source_idx
on public.inventory_transactions (company_id, source_type, effective_at desc);
create index inventory_reservations_company_item_location_idx
on public.inventory_reservations (company_id, inventory_item_id, stock_location_id);
create index inventory_reservations_company_job_idx
on public.inventory_reservations (company_id, job_id, updated_at desc);
create index inventory_reservations_open_idx
on public.inventory_reservations (company_id, inventory_item_id, stock_location_id, updated_at desc)
where quantity_reserved > quantity_released + quantity_consumed;

create index part_request_lines_inventory_item_id_idx on public.part_request_lines (inventory_item_id);
create index part_request_lines_stock_location_id_idx on public.part_request_lines (stock_location_id);
create index purchase_order_lines_inventory_item_id_idx on public.purchase_order_lines (inventory_item_id);
create index purchase_order_lines_stock_location_id_idx on public.purchase_order_lines (stock_location_id);
