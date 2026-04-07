create type public.supplier_account_mode as enum ('manual', 'link_out');
create type public.part_request_origin as enum ('job_detail', 'estimate_editor');
create type public.part_request_status as enum ('open', 'fulfilled', 'canceled');
create type public.part_lifecycle_status as enum (
  'quoted',
  'ordered',
  'received',
  'installed',
  'returned',
  'core_due',
  'core_returned'
);
create type public.supplier_cart_status as enum ('open', 'submitted', 'converted', 'abandoned');
create type public.purchase_order_status as enum (
  'draft',
  'ordered',
  'partially_received',
  'received',
  'canceled',
  'closed'
);
create type public.part_return_status as enum ('draft', 'submitted', 'completed', 'canceled');

create table public.supplier_accounts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null,
  slug text not null,
  mode public.supplier_account_mode not null default 'manual',
  external_url text,
  contact_name text,
  contact_email text,
  contact_phone text,
  notes text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint supplier_accounts_company_slug_unique unique (company_id, slug)
);

create table public.supplier_routing_rules (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  supplier_account_id uuid not null references public.supplier_accounts (id) on delete cascade,
  name text not null,
  priority integer not null default 0,
  is_active boolean not null default true,
  match_job_priority text,
  match_vehicle_make text,
  match_has_core boolean,
  match_part_term text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.part_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  job_id uuid not null references public.jobs (id) on delete cascade,
  estimate_id uuid references public.estimates (id) on delete set null,
  origin public.part_request_origin not null,
  status public.part_request_status not null default 'open',
  requested_by_user_id uuid not null,
  assigned_buyer_user_id uuid,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.part_request_lines (
  id uuid primary key default gen_random_uuid(),
  part_request_id uuid not null references public.part_requests (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  job_id uuid not null references public.jobs (id) on delete cascade,
  estimate_id uuid references public.estimates (id) on delete set null,
  estimate_line_item_id uuid references public.estimate_line_items (id) on delete set null,
  status public.part_lifecycle_status not null default 'quoted',
  description text not null,
  manufacturer text,
  part_number text,
  supplier_sku text,
  quantity_requested numeric(10, 2) not null default 1,
  quantity_ordered numeric(10, 2) not null default 0,
  quantity_received numeric(10, 2) not null default 0,
  quantity_installed numeric(10, 2) not null default 0,
  quantity_returned numeric(10, 2) not null default 0,
  quantity_core_due numeric(10, 2) not null default 0,
  quantity_core_returned numeric(10, 2) not null default 0,
  quoted_unit_cost_cents integer,
  estimated_unit_cost_cents integer,
  actual_unit_cost_cents integer,
  needs_core boolean not null default false,
  core_charge_cents integer not null default 0,
  last_supplier_account_id uuid references public.supplier_accounts (id) on delete set null,
  notes text,
  created_by_user_id uuid not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint part_request_lines_quantity_requested_check check (quantity_requested > 0),
  constraint part_request_lines_quantity_ordered_check check (quantity_ordered >= 0),
  constraint part_request_lines_quantity_received_check check (quantity_received >= 0),
  constraint part_request_lines_quantity_installed_check check (quantity_installed >= 0),
  constraint part_request_lines_quantity_returned_check check (quantity_returned >= 0),
  constraint part_request_lines_quantity_core_due_check check (quantity_core_due >= 0),
  constraint part_request_lines_quantity_core_returned_check check (quantity_core_returned >= 0),
  constraint part_request_lines_quoted_unit_cost_check check (
    quoted_unit_cost_cents is null or quoted_unit_cost_cents >= 0
  ),
  constraint part_request_lines_estimated_unit_cost_check check (
    estimated_unit_cost_cents is null or estimated_unit_cost_cents >= 0
  ),
  constraint part_request_lines_actual_unit_cost_check check (
    actual_unit_cost_cents is null or actual_unit_cost_cents >= 0
  ),
  constraint part_request_lines_core_charge_check check (core_charge_cents >= 0)
);

create table public.supplier_carts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  supplier_account_id uuid not null references public.supplier_accounts (id) on delete cascade,
  status public.supplier_cart_status not null default 'open',
  source_bucket_key text not null,
  created_by_user_id uuid not null,
  submitted_by_user_id uuid,
  submitted_at timestamptz,
  converted_purchase_order_id uuid,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index supplier_carts_open_company_supplier_bucket_unique
on public.supplier_carts (company_id, supplier_account_id, source_bucket_key)
where status = 'open';

create table public.supplier_cart_lines (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.supplier_carts (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  supplier_account_id uuid not null references public.supplier_accounts (id) on delete cascade,
  part_request_line_id uuid not null references public.part_request_lines (id) on delete cascade,
  job_id uuid not null references public.jobs (id) on delete cascade,
  quoted_unit_cost_cents integer,
  quoted_core_charge_cents integer not null default 0,
  quantity numeric(10, 2) not null default 1,
  supplier_part_number text,
  supplier_url text,
  availability_text text,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint supplier_cart_lines_quantity_check check (quantity > 0),
  constraint supplier_cart_lines_quoted_unit_cost_check check (
    quoted_unit_cost_cents is null or quoted_unit_cost_cents >= 0
  ),
  constraint supplier_cart_lines_quoted_core_charge_check check (quoted_core_charge_cents >= 0),
  constraint supplier_cart_lines_cart_line_unique unique (cart_id, part_request_line_id)
);

create table public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  supplier_account_id uuid not null references public.supplier_accounts (id) on delete cascade,
  supplier_cart_id uuid references public.supplier_carts (id) on delete set null,
  status public.purchase_order_status not null default 'draft',
  po_number text not null,
  ordered_by_user_id uuid not null,
  ordered_at timestamptz,
  expected_at timestamptz,
  external_reference text,
  manual_order_url text,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint purchase_orders_company_po_number_unique unique (company_id, po_number)
);

create table public.purchase_order_lines (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references public.purchase_orders (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  supplier_account_id uuid not null references public.supplier_accounts (id) on delete cascade,
  part_request_line_id uuid not null references public.part_request_lines (id) on delete cascade,
  job_id uuid not null references public.jobs (id) on delete cascade,
  supplier_cart_line_id uuid references public.supplier_cart_lines (id) on delete set null,
  status public.part_lifecycle_status not null default 'quoted',
  description text not null,
  manufacturer text,
  part_number text,
  supplier_part_number text,
  quantity_ordered numeric(10, 2) not null default 0,
  quantity_received numeric(10, 2) not null default 0,
  quantity_installed numeric(10, 2) not null default 0,
  quantity_returned numeric(10, 2) not null default 0,
  quantity_core_due numeric(10, 2) not null default 0,
  quantity_core_returned numeric(10, 2) not null default 0,
  unit_ordered_cost_cents integer not null default 0,
  unit_actual_cost_cents integer,
  core_charge_cents integer not null default 0,
  is_core_returnable boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint purchase_order_lines_quantity_ordered_check check (quantity_ordered >= 0),
  constraint purchase_order_lines_quantity_received_check check (quantity_received >= 0),
  constraint purchase_order_lines_quantity_installed_check check (quantity_installed >= 0),
  constraint purchase_order_lines_quantity_returned_check check (quantity_returned >= 0),
  constraint purchase_order_lines_quantity_core_due_check check (quantity_core_due >= 0),
  constraint purchase_order_lines_quantity_core_returned_check check (quantity_core_returned >= 0),
  constraint purchase_order_lines_unit_ordered_cost_check check (unit_ordered_cost_cents >= 0),
  constraint purchase_order_lines_unit_actual_cost_check check (
    unit_actual_cost_cents is null or unit_actual_cost_cents >= 0
  ),
  constraint purchase_order_lines_core_charge_check check (core_charge_cents >= 0)
);

create table public.purchase_receipts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  supplier_account_id uuid not null references public.supplier_accounts (id) on delete cascade,
  purchase_order_id uuid not null references public.purchase_orders (id) on delete cascade,
  receipt_number text,
  received_by_user_id uuid not null,
  received_at timestamptz not null,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.purchase_receipt_lines (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references public.purchase_receipts (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  purchase_order_line_id uuid not null references public.purchase_order_lines (id) on delete cascade,
  quantity_received numeric(10, 2) not null default 0,
  unit_received_cost_cents integer,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint purchase_receipt_lines_quantity_received_check check (quantity_received > 0),
  constraint purchase_receipt_lines_unit_received_cost_check check (
    unit_received_cost_cents is null or unit_received_cost_cents >= 0
  )
);

create table public.part_returns (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  supplier_account_id uuid not null references public.supplier_accounts (id) on delete cascade,
  purchase_order_id uuid references public.purchase_orders (id) on delete set null,
  status public.part_return_status not null default 'draft',
  return_number text,
  reason text,
  returned_by_user_id uuid not null,
  returned_at timestamptz,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.part_return_lines (
  id uuid primary key default gen_random_uuid(),
  part_return_id uuid not null references public.part_returns (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  purchase_order_line_id uuid not null references public.purchase_order_lines (id) on delete cascade,
  quantity_returned numeric(10, 2) not null default 0,
  is_core_return boolean not null default false,
  credit_amount_cents integer,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint part_return_lines_quantity_returned_check check (quantity_returned > 0),
  constraint part_return_lines_credit_amount_check check (
    credit_amount_cents is null or credit_amount_cents >= 0
  )
);

alter table public.supplier_carts
  add constraint supplier_carts_converted_purchase_order_id_fkey
  foreign key (converted_purchase_order_id) references public.purchase_orders (id) on delete set null;

alter table public.estimate_line_items
  add column part_request_line_id uuid references public.part_request_lines (id) on delete set null,
  add column estimated_cost_cents integer,
  add column actual_cost_cents integer;

alter table public.invoice_line_items
  add column part_request_line_id uuid references public.part_request_lines (id) on delete set null,
  add column estimated_cost_cents integer,
  add column actual_cost_cents integer;

alter table public.estimate_line_items
  add constraint estimate_line_items_estimated_cost_cents_check check (
    estimated_cost_cents is null or estimated_cost_cents >= 0
  ),
  add constraint estimate_line_items_actual_cost_cents_check check (
    actual_cost_cents is null or actual_cost_cents >= 0
  );

alter table public.invoice_line_items
  add constraint invoice_line_items_estimated_cost_cents_check check (
    estimated_cost_cents is null or estimated_cost_cents >= 0
  ),
  add constraint invoice_line_items_actual_cost_cents_check check (
    actual_cost_cents is null or actual_cost_cents >= 0
  );

create index supplier_accounts_company_id_idx on public.supplier_accounts (company_id);
create index supplier_accounts_company_active_idx on public.supplier_accounts (company_id, is_active, sort_order, name);
create index supplier_routing_rules_company_id_idx on public.supplier_routing_rules (company_id);
create index supplier_routing_rules_supplier_id_idx on public.supplier_routing_rules (supplier_account_id);
create index part_requests_company_id_idx on public.part_requests (company_id);
create index part_requests_job_id_idx on public.part_requests (job_id);
create index part_requests_estimate_id_idx on public.part_requests (estimate_id);
create index part_requests_status_idx on public.part_requests (company_id, status, created_at desc);
create index part_request_lines_request_id_idx on public.part_request_lines (part_request_id);
create index part_request_lines_job_id_idx on public.part_request_lines (job_id);
create index part_request_lines_estimate_id_idx on public.part_request_lines (estimate_id);
create index part_request_lines_estimate_line_item_id_idx on public.part_request_lines (estimate_line_item_id);
create index part_request_lines_status_idx on public.part_request_lines (company_id, status, updated_at desc);
create index part_request_lines_supplier_idx on public.part_request_lines (last_supplier_account_id);
create index supplier_carts_company_id_idx on public.supplier_carts (company_id);
create index supplier_carts_supplier_status_idx on public.supplier_carts (supplier_account_id, status, created_at desc);
create index supplier_cart_lines_cart_id_idx on public.supplier_cart_lines (cart_id);
create index supplier_cart_lines_part_request_line_id_idx on public.supplier_cart_lines (part_request_line_id);
create index purchase_orders_company_id_idx on public.purchase_orders (company_id);
create index purchase_orders_supplier_status_idx on public.purchase_orders (supplier_account_id, status, created_at desc);
create index purchase_order_lines_purchase_order_id_idx on public.purchase_order_lines (purchase_order_id);
create index purchase_order_lines_part_request_line_id_idx on public.purchase_order_lines (part_request_line_id);
create index purchase_order_lines_job_id_idx on public.purchase_order_lines (job_id);
create index purchase_receipts_purchase_order_id_idx on public.purchase_receipts (purchase_order_id);
create index purchase_receipt_lines_receipt_id_idx on public.purchase_receipt_lines (receipt_id);
create index purchase_receipt_lines_purchase_order_line_id_idx on public.purchase_receipt_lines (purchase_order_line_id);
create index part_returns_company_id_idx on public.part_returns (company_id);
create index part_returns_purchase_order_id_idx on public.part_returns (purchase_order_id);
create index part_return_lines_part_return_id_idx on public.part_return_lines (part_return_id);
create index part_return_lines_purchase_order_line_id_idx on public.part_return_lines (purchase_order_line_id);
create index estimate_line_items_part_request_line_id_idx on public.estimate_line_items (part_request_line_id);
create index invoice_line_items_part_request_line_id_idx on public.invoice_line_items (part_request_line_id);

create trigger supplier_accounts_set_updated_at
before update on public.supplier_accounts
for each row
execute function public.set_updated_at();

create trigger supplier_routing_rules_set_updated_at
before update on public.supplier_routing_rules
for each row
execute function public.set_updated_at();

create trigger part_requests_set_updated_at
before update on public.part_requests
for each row
execute function public.set_updated_at();

create trigger part_request_lines_set_updated_at
before update on public.part_request_lines
for each row
execute function public.set_updated_at();

create trigger supplier_carts_set_updated_at
before update on public.supplier_carts
for each row
execute function public.set_updated_at();

create trigger supplier_cart_lines_set_updated_at
before update on public.supplier_cart_lines
for each row
execute function public.set_updated_at();

create trigger purchase_orders_set_updated_at
before update on public.purchase_orders
for each row
execute function public.set_updated_at();

create trigger purchase_order_lines_set_updated_at
before update on public.purchase_order_lines
for each row
execute function public.set_updated_at();

create trigger purchase_receipts_set_updated_at
before update on public.purchase_receipts
for each row
execute function public.set_updated_at();

create trigger purchase_receipt_lines_set_updated_at
before update on public.purchase_receipt_lines
for each row
execute function public.set_updated_at();

create trigger part_returns_set_updated_at
before update on public.part_returns
for each row
execute function public.set_updated_at();

create trigger part_return_lines_set_updated_at
before update on public.part_return_lines
for each row
execute function public.set_updated_at();
