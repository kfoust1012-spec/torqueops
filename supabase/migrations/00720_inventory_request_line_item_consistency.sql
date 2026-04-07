create or replace function public.reserve_inventory_for_job(
  target_company_id uuid,
  target_inventory_item_id uuid,
  target_stock_location_id uuid,
  target_job_id uuid,
  target_part_request_line_id uuid default null,
  target_quantity_reserved numeric default 0,
  target_created_by_user_id uuid default null,
  target_notes text default null
)
returns uuid
language plpgsql
as $$
declare
  item_row public.inventory_items%rowtype;
  location_row public.stock_locations%rowtype;
  job_row public.jobs%rowtype;
  request_row public.part_requests%rowtype;
  request_line_row public.part_request_lines%rowtype;
  existing_row public.inventory_reservations%rowtype;
  reservation_id uuid;
  on_hand_quantity numeric(10, 2);
  reserved_quantity numeric(10, 2);
  open_reserved_for_request_line numeric(10, 2);
  remaining_demand_quantity numeric(10, 2);
begin
  if target_quantity_reserved <= 0 then
    raise exception 'quantity reserved must be greater than zero';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      concat_ws(':', target_company_id::text, target_inventory_item_id::text, target_stock_location_id::text),
      0
    )
  );

  if target_part_request_line_id is not null then
    perform pg_advisory_xact_lock(hashtextextended(target_part_request_line_id::text, 0));
  end if;

  select *
  into item_row
  from public.inventory_items
  where id = target_inventory_item_id;

  if not found then
    raise exception 'Inventory item not found.';
  end if;

  if item_row.company_id <> target_company_id then
    raise exception 'Inventory item must belong to the current company.';
  end if;

  if not item_row.is_active then
    raise exception 'Inventory item must be active for operational inventory changes.';
  end if;

  if item_row.item_type <> 'stocked' then
    raise exception 'Inventory item must be stocked before it can participate in inventory operations.';
  end if;

  select *
  into location_row
  from public.stock_locations
  where id = target_stock_location_id;

  if not found then
    raise exception 'Stock location not found.';
  end if;

  if location_row.company_id <> target_company_id then
    raise exception 'Stock location must belong to the current company.';
  end if;

  if not location_row.is_active then
    raise exception 'Stock location must be active for operational inventory changes.';
  end if;

  if item_row.company_id <> location_row.company_id then
    raise exception 'Inventory item and stock location must belong to the same company.';
  end if;

  select *
  into job_row
  from public.jobs
  where id = target_job_id;

  if not found then
    raise exception 'Job not found.';
  end if;

  if job_row.company_id <> target_company_id then
    raise exception 'Job must belong to the current company.';
  end if;

  if target_part_request_line_id is not null then
    select *
    into request_line_row
    from public.part_request_lines
    where id = target_part_request_line_id
    for update;

    if not found then
      raise exception 'Part request line not found.';
    end if;

    if request_line_row.company_id <> target_company_id then
      raise exception 'Part request line must belong to the current company.';
    end if;

    if request_line_row.job_id <> target_job_id then
      raise exception 'Inventory reservations must target a part request line on the selected job.';
    end if;

    if request_line_row.inventory_item_id is not null
       and request_line_row.inventory_item_id <> target_inventory_item_id then
      raise exception 'Part request line is already linked to a different inventory item.';
    end if;

    select *
    into request_row
    from public.part_requests
    where id = request_line_row.part_request_id;

    if not found then
      raise exception 'Part request not found.';
    end if;

    if request_row.company_id <> target_company_id then
      raise exception 'Part request must belong to the current company.';
    end if;

    if request_row.status <> 'open' then
      raise exception 'Cannot reserve inventory for a part request that is no longer open.';
    end if;

    select
      coalesce(sum(greatest(quantity_reserved - quantity_released - quantity_consumed, 0)), 0)
    into open_reserved_for_request_line
    from public.inventory_reservations
    where part_request_line_id = target_part_request_line_id;

    remaining_demand_quantity := greatest(
      request_line_row.quantity_requested -
      request_line_row.quantity_installed -
      request_line_row.quantity_consumed_from_stock -
      open_reserved_for_request_line,
      0
    );

    if target_quantity_reserved > remaining_demand_quantity then
      raise exception 'Cannot reserve more inventory than the part request line still needs.';
    end if;
  end if;

  select coalesce(sum(quantity_delta), 0)
  into on_hand_quantity
  from public.inventory_transactions
  where company_id = target_company_id
    and inventory_item_id = target_inventory_item_id
    and stock_location_id = target_stock_location_id;

  select coalesce(sum(greatest(quantity_reserved - quantity_released - quantity_consumed, 0)), 0)
  into reserved_quantity
  from public.inventory_reservations
  where company_id = target_company_id
    and inventory_item_id = target_inventory_item_id
    and stock_location_id = target_stock_location_id;

  if target_quantity_reserved > greatest(on_hand_quantity - reserved_quantity, 0) then
    raise exception 'Cannot reserve more inventory than is currently available at this location.';
  end if;

  if target_part_request_line_id is null then
    select *
    into existing_row
    from public.inventory_reservations
    where company_id = target_company_id
      and inventory_item_id = target_inventory_item_id
      and stock_location_id = target_stock_location_id
      and job_id = target_job_id
      and part_request_line_id is null
    for update;
  else
    select *
    into existing_row
    from public.inventory_reservations
    where company_id = target_company_id
      and inventory_item_id = target_inventory_item_id
      and stock_location_id = target_stock_location_id
      and job_id = target_job_id
      and part_request_line_id = target_part_request_line_id
    for update;
  end if;

  if found then
    update public.inventory_reservations
    set
      quantity_reserved = quantity_reserved + target_quantity_reserved,
      notes = coalesce(target_notes, notes)
    where id = existing_row.id
    returning id into reservation_id;
  else
    insert into public.inventory_reservations (
      company_id,
      inventory_item_id,
      stock_location_id,
      job_id,
      part_request_line_id,
      quantity_reserved,
      quantity_released,
      quantity_consumed,
      notes,
      created_by_user_id
    )
    values (
      target_company_id,
      target_inventory_item_id,
      target_stock_location_id,
      target_job_id,
      target_part_request_line_id,
      target_quantity_reserved,
      0,
      0,
      target_notes,
      target_created_by_user_id
    )
    returning id into reservation_id;
  end if;

  if target_part_request_line_id is not null then
    update public.part_request_lines
    set inventory_item_id = target_inventory_item_id
    where id = target_part_request_line_id;
  end if;

  return reservation_id;
end;
$$;

create or replace function public.receive_purchased_inventory(
  target_company_id uuid,
  target_inventory_item_id uuid,
  target_stock_location_id uuid,
  target_purchase_order_line_id uuid,
  target_purchase_receipt_line_id uuid,
  target_quantity_received numeric default 0,
  target_unit_cost_cents integer default null,
  target_notes text default null,
  target_created_by_user_id uuid default null,
  target_effective_at timestamptz default timezone('utc', now())
)
returns uuid
language plpgsql
as $$
declare
  item_row public.inventory_items%rowtype;
  location_row public.stock_locations%rowtype;
  po_line_row public.purchase_order_lines%rowtype;
  receipt_line_row public.purchase_receipt_lines%rowtype;
  request_line_row public.part_request_lines%rowtype;
  transaction_id uuid;
  received_to_inventory_quantity numeric(10, 2);
  receipt_line_inventory_quantity numeric(10, 2);
  quantity_remaining numeric(10, 2);
  receipt_line_remaining numeric(10, 2);
begin
  if target_quantity_received <= 0 then
    raise exception 'quantity received must be greater than zero';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(target_purchase_order_line_id::text, 0));
  perform pg_advisory_xact_lock(hashtextextended(target_purchase_receipt_line_id::text, 0));

  select *
  into item_row
  from public.inventory_items
  where id = target_inventory_item_id;

  if not found then
    raise exception 'Inventory item not found.';
  end if;

  if item_row.company_id <> target_company_id then
    raise exception 'Inventory item must belong to the current company.';
  end if;

  if not item_row.is_active then
    raise exception 'Inventory item must be active for operational inventory changes.';
  end if;

  if item_row.item_type <> 'stocked' then
    raise exception 'Inventory item must be stocked before it can participate in inventory operations.';
  end if;

  select *
  into location_row
  from public.stock_locations
  where id = target_stock_location_id;

  if not found then
    raise exception 'Stock location not found.';
  end if;

  if location_row.company_id <> target_company_id then
    raise exception 'Stock location must belong to the current company.';
  end if;

  if not location_row.is_active then
    raise exception 'Stock location must be active for operational inventory changes.';
  end if;

  if item_row.company_id <> location_row.company_id then
    raise exception 'Inventory item and stock location must belong to the same company.';
  end if;

  select *
  into po_line_row
  from public.purchase_order_lines
  where id = target_purchase_order_line_id
  for update;

  if not found then
    raise exception 'Purchase order line not found.';
  end if;

  if po_line_row.company_id <> target_company_id then
    raise exception 'Purchase order line must belong to the current company.';
  end if;

  if po_line_row.part_request_line_id is not null then
    select *
    into request_line_row
    from public.part_request_lines
    where id = po_line_row.part_request_line_id
    for update;

    if not found then
      raise exception 'Part request line not found.';
    end if;

    if request_line_row.company_id <> target_company_id then
      raise exception 'Part request line must belong to the current company.';
    end if;

    if request_line_row.inventory_item_id is not null
       and request_line_row.inventory_item_id <> target_inventory_item_id then
      raise exception 'Part request line is already linked to a different inventory item.';
    end if;
  end if;

  select *
  into receipt_line_row
  from public.purchase_receipt_lines
  where id = target_purchase_receipt_line_id
  for update;

  if not found then
    raise exception 'Purchase receipt line not found.';
  end if;

  if receipt_line_row.company_id <> target_company_id then
    raise exception 'Purchase receipt line must belong to the current company.';
  end if;

  if receipt_line_row.purchase_order_line_id <> target_purchase_order_line_id then
    raise exception 'Inventory receipt must target a receipt line that belongs to the selected PO line.';
  end if;

  if po_line_row.inventory_item_id is not null and po_line_row.inventory_item_id <> target_inventory_item_id then
    raise exception 'Inventory receipts for a purchase order line must use the same inventory item.';
  end if;

  if po_line_row.stock_location_id is not null and po_line_row.stock_location_id <> target_stock_location_id then
    raise exception 'Inventory receipts for a purchase order line must use the same stock location.';
  end if;

  select coalesce(sum(quantity_delta), 0)
  into received_to_inventory_quantity
  from public.inventory_transactions
  where purchase_order_line_id = target_purchase_order_line_id
    and transaction_type = 'purchase_receipt';

  quantity_remaining := greatest(po_line_row.quantity_received - received_to_inventory_quantity, 0);

  if target_quantity_received > quantity_remaining then
    raise exception 'Cannot receive more inventory than the purchase order line has available.';
  end if;

  select coalesce(sum(quantity_delta), 0)
  into receipt_line_inventory_quantity
  from public.inventory_transactions
  where purchase_receipt_line_id = target_purchase_receipt_line_id
    and transaction_type = 'purchase_receipt';

  receipt_line_remaining := greatest(
    receipt_line_row.quantity_received - receipt_line_inventory_quantity,
    0
  );

  if target_quantity_received > receipt_line_remaining then
    raise exception 'Cannot receive more inventory than remains on the selected receipt line.';
  end if;

  insert into public.inventory_transactions (
    company_id,
    inventory_item_id,
    stock_location_id,
    transaction_type,
    source_type,
    source_id,
    job_id,
    part_request_line_id,
    purchase_order_line_id,
    purchase_receipt_line_id,
    part_return_line_id,
    quantity_delta,
    unit_cost_cents,
    reference_number,
    notes,
    created_by_user_id,
    effective_at
  )
  values (
    target_company_id,
    target_inventory_item_id,
    target_stock_location_id,
    'purchase_receipt',
    'purchase_receipt',
    target_purchase_receipt_line_id,
    po_line_row.job_id,
    po_line_row.part_request_line_id,
    target_purchase_order_line_id,
    target_purchase_receipt_line_id,
    null,
    target_quantity_received,
    target_unit_cost_cents,
    null,
    target_notes,
    target_created_by_user_id,
    coalesce(target_effective_at, timezone('utc', now()))
  )
  returning id into transaction_id;

  update public.purchase_receipt_lines
  set received_into_inventory_quantity = received_into_inventory_quantity + target_quantity_received
  where id = receipt_line_row.id;

  update public.purchase_order_lines
  set
    inventory_item_id = target_inventory_item_id,
    stock_location_id = target_stock_location_id
  where id = po_line_row.id;

  if po_line_row.part_request_line_id is not null then
    update public.part_request_lines
    set inventory_item_id = target_inventory_item_id
    where id = po_line_row.part_request_line_id;
  end if;

  return transaction_id;
end;
$$;
