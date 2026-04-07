create type public.inventory_transfer_status as enum ('draft', 'in_transit', 'received', 'canceled');
create type public.job_inventory_issue_status as enum ('issued', 'partially_returned', 'returned', 'consumed');
create type public.core_inventory_status as enum ('held', 'returned');

alter table public.stock_locations
  add column if not exists technician_user_id uuid references public.profiles (id) on delete set null,
  add column if not exists vehicle_label text;

create unique index if not exists stock_locations_company_technician_van_unique_idx
on public.stock_locations (company_id, technician_user_id)
where location_type = 'van' and technician_user_id is not null;

alter table public.part_request_lines
  add column if not exists quantity_issued_from_inventory numeric(10, 2) not null default 0,
  add column if not exists quantity_returned_to_inventory numeric(10, 2) not null default 0;

alter table public.purchase_order_lines
  add column if not exists quantity_core_held numeric(10, 2) not null default 0,
  add column if not exists quantity_core_returned_from_inventory numeric(10, 2) not null default 0;

create table public.inventory_transfers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  from_stock_location_id uuid not null references public.stock_locations (id) on delete restrict,
  to_stock_location_id uuid not null references public.stock_locations (id) on delete restrict,
  status public.inventory_transfer_status not null default 'draft',
  reference_number text,
  requested_by_user_id uuid not null references public.profiles (id) on delete restrict,
  shipped_by_user_id uuid references public.profiles (id) on delete set null,
  received_by_user_id uuid references public.profiles (id) on delete set null,
  requested_at timestamptz not null default timezone('utc', now()),
  shipped_at timestamptz,
  received_at timestamptz,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint inventory_transfers_location_check check (from_stock_location_id <> to_stock_location_id)
);

create table public.inventory_transfer_lines (
  id uuid primary key default gen_random_uuid(),
  transfer_id uuid not null references public.inventory_transfers (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  inventory_item_id uuid not null references public.inventory_items (id) on delete restrict,
  quantity_requested numeric(10, 2) not null,
  quantity_shipped numeric(10, 2) not null default 0,
  quantity_received numeric(10, 2) not null default 0,
  unit_cost_cents integer,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint inventory_transfer_lines_quantity_requested_check check (quantity_requested > 0),
  constraint inventory_transfer_lines_quantity_shipped_check check (
    quantity_shipped >= 0 and quantity_shipped <= quantity_requested
  ),
  constraint inventory_transfer_lines_quantity_received_check check (
    quantity_received >= 0 and quantity_received <= quantity_shipped
  ),
  constraint inventory_transfer_lines_unit_cost_check check (
    unit_cost_cents is null or unit_cost_cents >= 0
  )
);

create table public.job_inventory_issues (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  job_id uuid not null references public.jobs (id) on delete cascade,
  part_request_line_id uuid references public.part_request_lines (id) on delete set null,
  inventory_item_id uuid not null references public.inventory_items (id) on delete restrict,
  stock_location_id uuid not null references public.stock_locations (id) on delete restrict,
  inventory_reservation_id uuid not null references public.inventory_reservations (id) on delete restrict,
  status public.job_inventory_issue_status not null default 'issued',
  quantity_issued numeric(10, 2) not null,
  quantity_consumed numeric(10, 2) not null default 0,
  quantity_returned numeric(10, 2) not null default 0,
  unit_cost_cents integer not null,
  issued_by_user_id uuid not null references public.profiles (id) on delete restrict,
  issued_at timestamptz not null default timezone('utc', now()),
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint job_inventory_issues_quantity_issued_check check (quantity_issued > 0),
  constraint job_inventory_issues_quantity_consumed_check check (quantity_consumed >= 0),
  constraint job_inventory_issues_quantity_returned_check check (quantity_returned >= 0),
  constraint job_inventory_issues_quantity_bounds_check check (
    quantity_consumed + quantity_returned <= quantity_issued
  ),
  constraint job_inventory_issues_unit_cost_check check (unit_cost_cents >= 0)
);

create table public.core_inventory_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  inventory_item_id uuid not null references public.inventory_items (id) on delete restrict,
  stock_location_id uuid not null references public.stock_locations (id) on delete restrict,
  purchase_order_line_id uuid references public.purchase_order_lines (id) on delete set null,
  job_inventory_issue_id uuid references public.job_inventory_issues (id) on delete set null,
  part_request_line_id uuid references public.part_request_lines (id) on delete set null,
  quantity numeric(10, 2) not null,
  status public.core_inventory_status not null default 'held',
  held_by_user_id uuid not null references public.profiles (id) on delete restrict,
  held_at timestamptz not null default timezone('utc', now()),
  returned_at timestamptz,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint core_inventory_events_quantity_check check (quantity > 0)
);

create table public.inventory_cycle_counts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  stock_location_id uuid not null references public.stock_locations (id) on delete restrict,
  counted_by_user_id uuid not null references public.profiles (id) on delete restrict,
  counted_at timestamptz not null default timezone('utc', now()),
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.inventory_cycle_count_lines (
  id uuid primary key default gen_random_uuid(),
  cycle_count_id uuid not null references public.inventory_cycle_counts (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  inventory_item_id uuid not null references public.inventory_items (id) on delete restrict,
  expected_quantity numeric(10, 2) not null,
  counted_quantity numeric(10, 2) not null,
  variance_quantity numeric(10, 2) not null,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index inventory_transfers_id_company_unique_idx
on public.inventory_transfers (id, company_id);

create unique index inventory_transfer_lines_id_company_unique_idx
on public.inventory_transfer_lines (id, company_id);

create unique index job_inventory_issues_id_company_unique_idx
on public.job_inventory_issues (id, company_id);

create unique index core_inventory_events_id_company_unique_idx
on public.core_inventory_events (id, company_id);

create unique index inventory_cycle_counts_id_company_unique_idx
on public.inventory_cycle_counts (id, company_id);

create unique index inventory_cycle_count_lines_id_company_unique_idx
on public.inventory_cycle_count_lines (id, company_id);

create unique index if not exists inventory_reservations_id_company_unique_idx
on public.inventory_reservations (id, company_id);

alter table public.inventory_transfers
  add constraint inventory_transfers_from_location_company_fkey
  foreign key (from_stock_location_id, company_id)
  references public.stock_locations (id, company_id)
  on delete restrict,
  add constraint inventory_transfers_to_location_company_fkey
  foreign key (to_stock_location_id, company_id)
  references public.stock_locations (id, company_id)
  on delete restrict;

alter table public.inventory_transfer_lines
  add constraint inventory_transfer_lines_transfer_company_fkey
  foreign key (transfer_id, company_id)
  references public.inventory_transfers (id, company_id)
  on delete cascade,
  add constraint inventory_transfer_lines_item_company_fkey
  foreign key (inventory_item_id, company_id)
  references public.inventory_items (id, company_id)
  on delete restrict;

alter table public.job_inventory_issues
  add constraint job_inventory_issues_job_company_fkey
  foreign key (job_id, company_id)
  references public.jobs (id, company_id)
  on delete cascade,
  add constraint job_inventory_issues_part_request_line_company_fkey
  foreign key (part_request_line_id, company_id)
  references public.part_request_lines (id, company_id)
  on delete set null,
  add constraint job_inventory_issues_inventory_item_company_fkey
  foreign key (inventory_item_id, company_id)
  references public.inventory_items (id, company_id)
  on delete restrict,
  add constraint job_inventory_issues_stock_location_company_fkey
  foreign key (stock_location_id, company_id)
  references public.stock_locations (id, company_id)
  on delete restrict,
  add constraint job_inventory_issues_reservation_company_fkey
  foreign key (inventory_reservation_id, company_id)
  references public.inventory_reservations (id, company_id)
  on delete restrict;

alter table public.core_inventory_events
  add constraint core_inventory_events_inventory_item_company_fkey
  foreign key (inventory_item_id, company_id)
  references public.inventory_items (id, company_id)
  on delete restrict,
  add constraint core_inventory_events_stock_location_company_fkey
  foreign key (stock_location_id, company_id)
  references public.stock_locations (id, company_id)
  on delete restrict,
  add constraint core_inventory_events_purchase_order_line_company_fkey
  foreign key (purchase_order_line_id, company_id)
  references public.purchase_order_lines (id, company_id)
  on delete set null,
  add constraint core_inventory_events_job_inventory_issue_company_fkey
  foreign key (job_inventory_issue_id, company_id)
  references public.job_inventory_issues (id, company_id)
  on delete set null,
  add constraint core_inventory_events_part_request_line_company_fkey
  foreign key (part_request_line_id, company_id)
  references public.part_request_lines (id, company_id)
  on delete set null;

alter table public.inventory_cycle_counts
  add constraint inventory_cycle_counts_stock_location_company_fkey
  foreign key (stock_location_id, company_id)
  references public.stock_locations (id, company_id)
  on delete restrict;

alter table public.inventory_cycle_count_lines
  add constraint inventory_cycle_count_lines_cycle_count_company_fkey
  foreign key (cycle_count_id, company_id)
  references public.inventory_cycle_counts (id, company_id)
  on delete cascade,
  add constraint inventory_cycle_count_lines_item_company_fkey
  foreign key (inventory_item_id, company_id)
  references public.inventory_items (id, company_id)
  on delete restrict;

create index inventory_transfers_company_status_idx
on public.inventory_transfers (company_id, status, requested_at desc);

create index inventory_transfers_from_location_idx
on public.inventory_transfers (company_id, from_stock_location_id, status, requested_at desc);

create index inventory_transfers_to_location_idx
on public.inventory_transfers (company_id, to_stock_location_id, status, requested_at desc);

create index inventory_transfer_lines_transfer_idx
on public.inventory_transfer_lines (transfer_id, inventory_item_id);

create index job_inventory_issues_company_job_idx
on public.job_inventory_issues (company_id, job_id, issued_at desc);

create index job_inventory_issues_reservation_idx
on public.job_inventory_issues (inventory_reservation_id);

create index job_inventory_issues_request_line_idx
on public.job_inventory_issues (part_request_line_id);

create index core_inventory_events_company_status_idx
on public.core_inventory_events (company_id, status, held_at desc);

create index core_inventory_events_purchase_order_line_idx
on public.core_inventory_events (purchase_order_line_id);

create index inventory_cycle_counts_company_location_idx
on public.inventory_cycle_counts (company_id, stock_location_id, counted_at desc);

create index inventory_cycle_count_lines_cycle_count_idx
on public.inventory_cycle_count_lines (cycle_count_id, inventory_item_id);

create trigger inventory_transfers_set_updated_at
before update on public.inventory_transfers
for each row
execute function public.set_updated_at();

create trigger inventory_transfer_lines_set_updated_at
before update on public.inventory_transfer_lines
for each row
execute function public.set_updated_at();

create trigger job_inventory_issues_set_updated_at
before update on public.job_inventory_issues
for each row
execute function public.set_updated_at();

create trigger core_inventory_events_set_updated_at
before update on public.core_inventory_events
for each row
execute function public.set_updated_at();

create trigger inventory_cycle_counts_set_updated_at
before update on public.inventory_cycle_counts
for each row
execute function public.set_updated_at();

create trigger inventory_cycle_count_lines_set_updated_at
before update on public.inventory_cycle_count_lines
for each row
execute function public.set_updated_at();

create or replace function public.inventory_on_hand_quantity(
  target_company_id uuid,
  target_inventory_item_id uuid,
  target_stock_location_id uuid
)
returns numeric
language sql
stable
as $$
  select coalesce(sum(quantity_delta), 0)
  from public.inventory_transactions
  where company_id = target_company_id
    and inventory_item_id = target_inventory_item_id
    and stock_location_id = target_stock_location_id;
$$;

create or replace function public.inventory_reserved_quantity(
  target_company_id uuid,
  target_inventory_item_id uuid,
  target_stock_location_id uuid
)
returns numeric
language sql
stable
as $$
  select coalesce(sum(greatest(quantity_reserved - quantity_released - quantity_consumed, 0)), 0)
  from public.inventory_reservations
  where company_id = target_company_id
    and inventory_item_id = target_inventory_item_id
    and stock_location_id = target_stock_location_id;
$$;

create or replace function public.inventory_available_quantity(
  target_company_id uuid,
  target_inventory_item_id uuid,
  target_stock_location_id uuid
)
returns numeric
language sql
stable
as $$
  select greatest(
    public.inventory_on_hand_quantity(
      target_company_id,
      target_inventory_item_id,
      target_stock_location_id
    ) -
    public.inventory_reserved_quantity(
      target_company_id,
      target_inventory_item_id,
      target_stock_location_id
    ),
    0
  );
$$;

create or replace function public.sync_part_request_line_inventory_issue_totals(
  target_part_request_line_id uuid
)
returns void
language plpgsql
as $$
declare
  issued_total numeric(10, 2);
  returned_total numeric(10, 2);
begin
  if target_part_request_line_id is null then
    return;
  end if;

  select
    coalesce(sum(quantity_issued), 0),
    coalesce(sum(quantity_returned), 0)
  into issued_total, returned_total
  from public.job_inventory_issues
  where part_request_line_id = target_part_request_line_id;

  update public.part_request_lines
  set
    quantity_issued_from_inventory = issued_total,
    quantity_returned_to_inventory = returned_total
  where id = target_part_request_line_id;
end;
$$;

create or replace function public.handle_job_inventory_issue_totals_sync()
returns trigger
language plpgsql
as $$
begin
  if tg_op <> 'INSERT' and old.part_request_line_id is not null then
    perform public.sync_part_request_line_inventory_issue_totals(old.part_request_line_id);
  end if;

  if tg_op <> 'DELETE' and new.part_request_line_id is not null then
    perform public.sync_part_request_line_inventory_issue_totals(new.part_request_line_id);
  end if;

  return null;
end;
$$;

create trigger job_inventory_issues_sync_part_request_line_totals
after insert or update or delete on public.job_inventory_issues
for each row
execute function public.handle_job_inventory_issue_totals_sync();

create or replace function public.sync_purchase_order_line_core_inventory_totals(
  target_purchase_order_line_id uuid
)
returns void
language plpgsql
as $$
declare
  held_total numeric(10, 2);
  returned_total numeric(10, 2);
begin
  if target_purchase_order_line_id is null then
    return;
  end if;

  select
    coalesce(sum(case when status = 'held' then quantity else 0 end), 0),
    coalesce(sum(case when status = 'returned' then quantity else 0 end), 0)
  into held_total, returned_total
  from public.core_inventory_events
  where purchase_order_line_id = target_purchase_order_line_id;

  update public.purchase_order_lines
  set
    quantity_core_held = held_total,
    quantity_core_returned_from_inventory = returned_total
  where id = target_purchase_order_line_id;
end;
$$;

create or replace function public.handle_core_inventory_totals_sync()
returns trigger
language plpgsql
as $$
begin
  if tg_op <> 'INSERT' and old.purchase_order_line_id is not null then
    perform public.sync_purchase_order_line_core_inventory_totals(old.purchase_order_line_id);
  end if;

  if tg_op <> 'DELETE' and new.purchase_order_line_id is not null then
    perform public.sync_purchase_order_line_core_inventory_totals(new.purchase_order_line_id);
  end if;

  return null;
end;
$$;

create trigger core_inventory_events_sync_purchase_order_line_totals
after insert or update or delete on public.core_inventory_events
for each row
execute function public.handle_core_inventory_totals_sync();

create or replace function public.create_inventory_transfer(
  target_company_id uuid,
  target_from_stock_location_id uuid,
  target_to_stock_location_id uuid,
  target_requested_by_user_id uuid,
  target_reference_number text default null,
  target_notes text default null,
  target_lines jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
as $$
declare
  from_location_row public.stock_locations%rowtype;
  to_location_row public.stock_locations%rowtype;
  line_record jsonb;
  item_row public.inventory_items%rowtype;
  transfer_id uuid;
begin
  if target_from_stock_location_id = target_to_stock_location_id then
    raise exception 'Transfer source and destination must differ.';
  end if;

  select * into from_location_row
  from public.stock_locations
  where id = target_from_stock_location_id;

  if not found then
    raise exception 'From stock location not found.';
  end if;

  select * into to_location_row
  from public.stock_locations
  where id = target_to_stock_location_id;

  if not found then
    raise exception 'To stock location not found.';
  end if;

  if from_location_row.company_id <> target_company_id
     or to_location_row.company_id <> target_company_id then
    raise exception 'Transfer locations must belong to the current company.';
  end if;

  insert into public.inventory_transfers (
    company_id,
    from_stock_location_id,
    to_stock_location_id,
    reference_number,
    requested_by_user_id,
    notes
  )
  values (
    target_company_id,
    target_from_stock_location_id,
    target_to_stock_location_id,
    target_reference_number,
    target_requested_by_user_id,
    target_notes
  )
  returning id into transfer_id;

  for line_record in select * from jsonb_array_elements(target_lines)
  loop
    select * into item_row
    from public.inventory_items
    where id = (line_record ->> 'inventory_item_id')::uuid;

    if not found then
      raise exception 'Transfer inventory item not found.';
    end if;

    if item_row.company_id <> target_company_id then
      raise exception 'Transfer inventory item must belong to the current company.';
    end if;

    if not item_row.is_active or item_row.item_type <> 'stocked' then
      raise exception 'Transfer inventory item must be active and stocked.';
    end if;

    if coalesce((line_record ->> 'quantity_requested')::numeric, 0) <= 0 then
      raise exception 'Transfer quantity requested must be greater than zero.';
    end if;

    insert into public.inventory_transfer_lines (
      transfer_id,
      company_id,
      inventory_item_id,
      quantity_requested,
      unit_cost_cents,
      notes
    )
    values (
      transfer_id,
      target_company_id,
      item_row.id,
      (line_record ->> 'quantity_requested')::numeric,
      nullif(line_record ->> 'unit_cost_cents', '')::integer,
      nullif(line_record ->> 'notes', '')
    );
  end loop;

  return transfer_id;
end;
$$;

create or replace function public.ship_inventory_transfer(
  target_transfer_id uuid,
  target_shipped_by_user_id uuid default null,
  target_shipped_at timestamptz default timezone('utc', now()),
  target_notes text default null,
  target_lines jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
as $$
declare
  transfer_row public.inventory_transfers%rowtype;
  line_record jsonb;
  line_row public.inventory_transfer_lines%rowtype;
  item_row public.inventory_items%rowtype;
  quantity_to_ship numeric(10, 2);
  unit_cost integer;
begin
  select * into transfer_row
  from public.inventory_transfers
  where id = target_transfer_id
  for update;

  if not found then
    raise exception 'Inventory transfer not found.';
  end if;

  if transfer_row.status <> 'draft' then
    raise exception 'Only draft transfers can be shipped.';
  end if;

  for line_record in select * from jsonb_array_elements(target_lines)
  loop
    select * into line_row
    from public.inventory_transfer_lines
    where id = (line_record ->> 'transfer_line_id')::uuid
      and transfer_id = target_transfer_id
    for update;

    if not found then
      raise exception 'Transfer line not found.';
    end if;

    quantity_to_ship := coalesce((line_record ->> 'quantity_shipped')::numeric, 0);

    if quantity_to_ship <= 0 then
      raise exception 'Transfer shipped quantity must be greater than zero.';
    end if;

    if quantity_to_ship > greatest(line_row.quantity_requested - line_row.quantity_shipped, 0) then
      raise exception 'Cannot ship more than the transfer line still requires.';
    end if;

    select * into item_row
    from public.inventory_items
    where id = line_row.inventory_item_id;

    perform pg_advisory_xact_lock(
      hashtextextended(
        concat_ws(':', transfer_row.company_id::text, line_row.inventory_item_id::text, transfer_row.from_stock_location_id::text),
        0
      )
    );

    if quantity_to_ship > public.inventory_available_quantity(
      transfer_row.company_id,
      line_row.inventory_item_id,
      transfer_row.from_stock_location_id
    ) then
      raise exception 'Cannot ship more than is currently available at the source location.';
    end if;

    unit_cost := coalesce(
      nullif(line_record ->> 'unit_cost_cents', '')::integer,
      line_row.unit_cost_cents,
      item_row.default_unit_cost_cents,
      0
    );

    insert into public.inventory_transactions (
      company_id,
      inventory_item_id,
      stock_location_id,
      transaction_type,
      source_type,
      source_id,
      quantity_delta,
      unit_cost_cents,
      notes,
      created_by_user_id,
      effective_at
    )
    values (
      transfer_row.company_id,
      line_row.inventory_item_id,
      transfer_row.from_stock_location_id,
      'transfer_out',
      'transfer',
      transfer_row.id,
      quantity_to_ship * -1,
      unit_cost,
      coalesce(nullif(line_record ->> 'notes', ''), target_notes),
      coalesce(target_shipped_by_user_id, transfer_row.requested_by_user_id),
      target_shipped_at
    );

    update public.inventory_transfer_lines
    set
      quantity_shipped = quantity_shipped + quantity_to_ship,
      unit_cost_cents = unit_cost,
      notes = coalesce(nullif(line_record ->> 'notes', ''), notes)
    where id = line_row.id;
  end loop;

  update public.inventory_transfers
  set
    status = 'in_transit',
    shipped_by_user_id = coalesce(target_shipped_by_user_id, shipped_by_user_id),
    shipped_at = coalesce(target_shipped_at, shipped_at),
    notes = coalesce(target_notes, notes)
  where id = transfer_row.id;

  return transfer_row.id;
end;
$$;

create or replace function public.receive_inventory_transfer(
  target_transfer_id uuid,
  target_received_by_user_id uuid default null,
  target_received_at timestamptz default timezone('utc', now()),
  target_notes text default null,
  target_lines jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
as $$
declare
  transfer_row public.inventory_transfers%rowtype;
  line_record jsonb;
  line_row public.inventory_transfer_lines%rowtype;
  quantity_to_receive numeric(10, 2);
  all_received boolean;
begin
  select * into transfer_row
  from public.inventory_transfers
  where id = target_transfer_id
  for update;

  if not found then
    raise exception 'Inventory transfer not found.';
  end if;

  if transfer_row.status <> 'in_transit' then
    raise exception 'Only in-transit transfers can be received.';
  end if;

  for line_record in select * from jsonb_array_elements(target_lines)
  loop
    select * into line_row
    from public.inventory_transfer_lines
    where id = (line_record ->> 'transfer_line_id')::uuid
      and transfer_id = target_transfer_id
    for update;

    if not found then
      raise exception 'Transfer line not found.';
    end if;

    quantity_to_receive := coalesce((line_record ->> 'quantity_received')::numeric, 0);

    if quantity_to_receive <= 0 then
      raise exception 'Transfer received quantity must be greater than zero.';
    end if;

    if quantity_to_receive > greatest(line_row.quantity_shipped - line_row.quantity_received, 0) then
      raise exception 'Cannot receive more than has been shipped and not already received.';
    end if;

    perform pg_advisory_xact_lock(
      hashtextextended(
        concat_ws(':', transfer_row.company_id::text, line_row.inventory_item_id::text, transfer_row.to_stock_location_id::text),
        0
      )
    );

    insert into public.inventory_transactions (
      company_id,
      inventory_item_id,
      stock_location_id,
      transaction_type,
      source_type,
      source_id,
      quantity_delta,
      unit_cost_cents,
      notes,
      created_by_user_id,
      effective_at
    )
    values (
      transfer_row.company_id,
      line_row.inventory_item_id,
      transfer_row.to_stock_location_id,
      'transfer_in',
      'transfer',
      transfer_row.id,
      quantity_to_receive,
      line_row.unit_cost_cents,
      coalesce(nullif(line_record ->> 'notes', ''), target_notes),
      coalesce(target_received_by_user_id, transfer_row.requested_by_user_id),
      target_received_at
    );

    update public.inventory_transfer_lines
    set
      quantity_received = quantity_received + quantity_to_receive,
      notes = coalesce(nullif(line_record ->> 'notes', ''), notes)
    where id = line_row.id;
  end loop;

  select bool_and(quantity_received >= quantity_shipped and quantity_shipped > 0)
  into all_received
  from public.inventory_transfer_lines
  where transfer_id = transfer_row.id;

  update public.inventory_transfers
  set
    status = case when coalesce(all_received, false) then 'received' else status end,
    received_by_user_id = coalesce(target_received_by_user_id, received_by_user_id),
    received_at = case when coalesce(all_received, false) then coalesce(target_received_at, received_at) else received_at end,
    notes = coalesce(target_notes, notes)
  where id = transfer_row.id;

  return transfer_row.id;
end;
$$;

create or replace function public.create_job_inventory_issue(
  target_company_id uuid,
  target_inventory_reservation_id uuid,
  target_quantity_issued numeric,
  target_issued_by_user_id uuid default null,
  target_notes text default null,
  target_issued_at timestamptz default timezone('utc', now())
)
returns uuid
language plpgsql
as $$
declare
  reservation_row public.inventory_reservations%rowtype;
  request_line_row public.part_request_lines%rowtype;
  issue_id uuid;
  open_reserved_quantity numeric(10, 2);
  unit_cost integer;
begin
  if target_quantity_issued <= 0 then
    raise exception 'Issued quantity must be greater than zero.';
  end if;

  select * into reservation_row
  from public.inventory_reservations
  where id = target_inventory_reservation_id
  for update;

  if not found then
    raise exception 'Inventory reservation not found.';
  end if;

  if reservation_row.company_id <> target_company_id then
    raise exception 'Inventory reservation must belong to the current company.';
  end if;

  open_reserved_quantity := greatest(
    reservation_row.quantity_reserved - reservation_row.quantity_released - reservation_row.quantity_consumed,
    0
  );

  if target_quantity_issued > open_reserved_quantity then
    raise exception 'Cannot issue more than the reservation still holds.';
  end if;

  if reservation_row.part_request_line_id is not null then
    select * into request_line_row
    from public.part_request_lines
    where id = reservation_row.part_request_line_id
    for update;
  end if;

  select coalesce(default_unit_cost_cents, 0)
  into unit_cost
  from public.inventory_items
  where id = reservation_row.inventory_item_id;

  insert into public.job_inventory_issues (
    company_id,
    job_id,
    part_request_line_id,
    inventory_item_id,
    stock_location_id,
    inventory_reservation_id,
    quantity_issued,
    unit_cost_cents,
    issued_by_user_id,
    issued_at,
    notes
  )
  values (
    reservation_row.company_id,
    reservation_row.job_id,
    reservation_row.part_request_line_id,
    reservation_row.inventory_item_id,
    reservation_row.stock_location_id,
    reservation_row.id,
    target_quantity_issued,
    unit_cost,
    coalesce(target_issued_by_user_id, reservation_row.created_by_user_id),
    target_issued_at,
    target_notes
  )
  returning id into issue_id;

  update public.inventory_reservations
  set quantity_consumed = quantity_consumed + target_quantity_issued
  where id = reservation_row.id;

  insert into public.inventory_transactions (
    company_id,
    inventory_item_id,
    stock_location_id,
    transaction_type,
    source_type,
    source_id,
    job_id,
    part_request_line_id,
    quantity_delta,
    unit_cost_cents,
    notes,
    created_by_user_id,
    effective_at
  )
  values (
    reservation_row.company_id,
    reservation_row.inventory_item_id,
    reservation_row.stock_location_id,
    'job_issue',
    'job_issue',
    issue_id,
    reservation_row.job_id,
    reservation_row.part_request_line_id,
    target_quantity_issued * -1,
    unit_cost,
    target_notes,
    coalesce(target_issued_by_user_id, reservation_row.created_by_user_id),
    target_issued_at
  );

  if request_line_row.id is not null and request_line_row.inventory_item_id is null then
    update public.part_request_lines
    set inventory_item_id = reservation_row.inventory_item_id
    where id = request_line_row.id;
  end if;

  return issue_id;
end;
$$;

create or replace function public.consume_job_inventory_issue(
  target_issue_id uuid,
  target_quantity_consumed numeric,
  target_notes text default null
)
returns uuid
language plpgsql
as $$
declare
  issue_row public.job_inventory_issues%rowtype;
begin
  if target_quantity_consumed <= 0 then
    raise exception 'Consumed quantity must be greater than zero.';
  end if;

  select * into issue_row
  from public.job_inventory_issues
  where id = target_issue_id
  for update;

  if not found then
    raise exception 'Job inventory issue not found.';
  end if;

  if target_quantity_consumed > greatest(issue_row.quantity_issued - issue_row.quantity_consumed - issue_row.quantity_returned, 0) then
    raise exception 'Cannot consume more than remains on the job issue.';
  end if;

  update public.job_inventory_issues
  set
    quantity_consumed = quantity_consumed + target_quantity_consumed,
    status = case
      when quantity_consumed + target_quantity_consumed >= quantity_issued - quantity_returned then 'consumed'
      when quantity_returned > 0 then 'partially_returned'
      else status
    end,
    notes = coalesce(target_notes, notes)
  where id = issue_row.id;

  return issue_row.id;
end;
$$;

create or replace function public.return_job_inventory_issue(
  target_issue_id uuid,
  target_quantity_returned numeric,
  target_returned_by_user_id uuid default null,
  target_notes text default null,
  target_effective_at timestamptz default timezone('utc', now())
)
returns uuid
language plpgsql
as $$
declare
  issue_row public.job_inventory_issues%rowtype;
begin
  if target_quantity_returned <= 0 then
    raise exception 'Returned quantity must be greater than zero.';
  end if;

  select * into issue_row
  from public.job_inventory_issues
  where id = target_issue_id
  for update;

  if not found then
    raise exception 'Job inventory issue not found.';
  end if;

  if target_quantity_returned > greatest(issue_row.quantity_issued - issue_row.quantity_consumed - issue_row.quantity_returned, 0) then
    raise exception 'Cannot return more than remains open on the job issue.';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      concat_ws(':', issue_row.company_id::text, issue_row.inventory_item_id::text, issue_row.stock_location_id::text),
      0
    )
  );

  insert into public.inventory_transactions (
    company_id,
    inventory_item_id,
    stock_location_id,
    transaction_type,
    source_type,
    source_id,
    job_id,
    part_request_line_id,
    quantity_delta,
    unit_cost_cents,
    notes,
    created_by_user_id,
    effective_at
  )
  values (
    issue_row.company_id,
    issue_row.inventory_item_id,
    issue_row.stock_location_id,
    'job_return',
    'job_return',
    issue_row.id,
    issue_row.job_id,
    issue_row.part_request_line_id,
    target_quantity_returned,
    issue_row.unit_cost_cents,
    target_notes,
    coalesce(target_returned_by_user_id, issue_row.issued_by_user_id),
    target_effective_at
  );

  update public.job_inventory_issues
  set
    quantity_returned = quantity_returned + target_quantity_returned,
    status = case
      when quantity_returned + target_quantity_returned >= quantity_issued - quantity_consumed then 'returned'
      else 'partially_returned'
    end,
    notes = coalesce(target_notes, notes)
  where id = issue_row.id;

  return issue_row.id;
end;
$$;

create or replace function public.create_inventory_cycle_count(
  target_company_id uuid,
  target_stock_location_id uuid,
  target_counted_by_user_id uuid,
  target_counted_at timestamptz default timezone('utc', now()),
  target_notes text default null,
  target_lines jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
as $$
declare
  location_row public.stock_locations%rowtype;
  line_record jsonb;
  item_row public.inventory_items%rowtype;
  cycle_count_id uuid;
  expected_quantity numeric(10, 2);
  counted_quantity numeric(10, 2);
  variance_quantity numeric(10, 2);
begin
  select * into location_row
  from public.stock_locations
  where id = target_stock_location_id;

  if not found then
    raise exception 'Stock location not found.';
  end if;

  if location_row.company_id <> target_company_id then
    raise exception 'Stock location must belong to the current company.';
  end if;

  insert into public.inventory_cycle_counts (
    company_id,
    stock_location_id,
    counted_by_user_id,
    counted_at,
    notes
  )
  values (
    target_company_id,
    target_stock_location_id,
    target_counted_by_user_id,
    target_counted_at,
    target_notes
  )
  returning id into cycle_count_id;

  for line_record in select * from jsonb_array_elements(target_lines)
  loop
    select * into item_row
    from public.inventory_items
    where id = (line_record ->> 'inventory_item_id')::uuid;

    if not found then
      raise exception 'Cycle count inventory item not found.';
    end if;

    if item_row.company_id <> target_company_id then
      raise exception 'Cycle count inventory item must belong to the current company.';
    end if;

    expected_quantity := public.inventory_on_hand_quantity(
      target_company_id,
      item_row.id,
      target_stock_location_id
    );
    counted_quantity := coalesce((line_record ->> 'counted_quantity')::numeric, 0);
    variance_quantity := counted_quantity - expected_quantity;

    insert into public.inventory_cycle_count_lines (
      cycle_count_id,
      company_id,
      inventory_item_id,
      expected_quantity,
      counted_quantity,
      variance_quantity,
      notes
    )
    values (
      cycle_count_id,
      target_company_id,
      item_row.id,
      expected_quantity,
      counted_quantity,
      variance_quantity,
      nullif(line_record ->> 'notes', '')
    );

    if variance_quantity <> 0 then
      insert into public.inventory_transactions (
        company_id,
        inventory_item_id,
        stock_location_id,
        transaction_type,
        source_type,
        source_id,
        quantity_delta,
        unit_cost_cents,
        notes,
        created_by_user_id,
        effective_at
      )
      values (
        target_company_id,
        item_row.id,
        target_stock_location_id,
        case when variance_quantity > 0 then 'cycle_count_gain' else 'cycle_count_loss' end,
        'cycle_count',
        cycle_count_id,
        variance_quantity,
        item_row.default_unit_cost_cents,
        coalesce(nullif(line_record ->> 'notes', ''), target_notes),
        target_counted_by_user_id,
        target_counted_at
      );
    end if;
  end loop;

  return cycle_count_id;
end;
$$;

create or replace function public.record_core_inventory_hold(
  target_company_id uuid,
  target_inventory_item_id uuid,
  target_stock_location_id uuid,
  target_quantity numeric,
  target_held_by_user_id uuid,
  target_purchase_order_line_id uuid default null,
  target_job_inventory_issue_id uuid default null,
  target_part_request_line_id uuid default null,
  target_notes text default null,
  target_effective_at timestamptz default timezone('utc', now())
)
returns uuid
language plpgsql
as $$
declare
  item_row public.inventory_items%rowtype;
  location_row public.stock_locations%rowtype;
  event_id uuid;
begin
  if target_quantity <= 0 then
    raise exception 'Core hold quantity must be greater than zero.';
  end if;

  select * into item_row
  from public.inventory_items
  where id = target_inventory_item_id;

  if not found or item_row.company_id <> target_company_id then
    raise exception 'Core hold inventory item must belong to the current company.';
  end if;

  select * into location_row
  from public.stock_locations
  where id = target_stock_location_id;

  if not found or location_row.company_id <> target_company_id then
    raise exception 'Core hold stock location must belong to the current company.';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      concat_ws(':', target_company_id::text, target_inventory_item_id::text, target_stock_location_id::text),
      0
    )
  );

  insert into public.core_inventory_events (
    company_id,
    inventory_item_id,
    stock_location_id,
    purchase_order_line_id,
    job_inventory_issue_id,
    part_request_line_id,
    quantity,
    status,
    held_by_user_id,
    held_at,
    notes
  )
  values (
    target_company_id,
    target_inventory_item_id,
    target_stock_location_id,
    target_purchase_order_line_id,
    target_job_inventory_issue_id,
    target_part_request_line_id,
    target_quantity,
    'held',
    target_held_by_user_id,
    target_effective_at,
    target_notes
  )
  returning id into event_id;

  insert into public.inventory_transactions (
    company_id,
    inventory_item_id,
    stock_location_id,
    transaction_type,
    source_type,
    source_id,
    part_request_line_id,
    purchase_order_line_id,
    quantity_delta,
    unit_cost_cents,
    notes,
    created_by_user_id,
    effective_at
  )
  values (
    target_company_id,
    target_inventory_item_id,
    target_stock_location_id,
    'core_hold_in',
    'core_event',
    event_id,
    target_part_request_line_id,
    target_purchase_order_line_id,
    target_quantity,
    item_row.default_unit_cost_cents,
    target_notes,
    target_held_by_user_id,
    target_effective_at
  );

  return event_id;
end;
$$;

create or replace function public.record_core_inventory_return(
  target_core_event_id uuid,
  target_returned_by_user_id uuid,
  target_notes text default null,
  target_effective_at timestamptz default timezone('utc', now())
)
returns uuid
language plpgsql
as $$
declare
  event_row public.core_inventory_events%rowtype;
  item_row public.inventory_items%rowtype;
begin
  select * into event_row
  from public.core_inventory_events
  where id = target_core_event_id
  for update;

  if not found then
    raise exception 'Core inventory event not found.';
  end if;

  if event_row.status <> 'held' then
    raise exception 'Only held cores can be returned.';
  end if;

  select * into item_row
  from public.inventory_items
  where id = event_row.inventory_item_id;

  perform pg_advisory_xact_lock(
    hashtextextended(
      concat_ws(':', event_row.company_id::text, event_row.inventory_item_id::text, event_row.stock_location_id::text),
      0
    )
  );

  if event_row.quantity > public.inventory_available_quantity(
    event_row.company_id,
    event_row.inventory_item_id,
    event_row.stock_location_id
  ) then
    raise exception 'Cannot return more core inventory than is currently available at this location.';
  end if;

  insert into public.inventory_transactions (
    company_id,
    inventory_item_id,
    stock_location_id,
    transaction_type,
    source_type,
    source_id,
    part_request_line_id,
    purchase_order_line_id,
    quantity_delta,
    unit_cost_cents,
    notes,
    created_by_user_id,
    effective_at
  )
  values (
    event_row.company_id,
    event_row.inventory_item_id,
    event_row.stock_location_id,
    'core_return_out',
    'core_event',
    event_row.id,
    event_row.part_request_line_id,
    event_row.purchase_order_line_id,
    event_row.quantity * -1,
    item_row.default_unit_cost_cents,
    target_notes,
    target_returned_by_user_id,
    target_effective_at
  );

  update public.core_inventory_events
  set
    status = 'returned',
    returned_at = target_effective_at,
    notes = coalesce(target_notes, notes)
  where id = event_row.id;

  return event_row.id;
end;
$$;
