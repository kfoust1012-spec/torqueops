create or replace function public.create_inventory_adjustment(
  target_company_id uuid,
  target_inventory_item_id uuid,
  target_stock_location_id uuid,
  target_transaction_type public.inventory_transaction_type,
  target_quantity numeric default 0,
  target_created_by_user_id uuid default null,
  target_unit_cost_cents integer default null,
  target_notes text default null,
  target_effective_at timestamptz default timezone('utc', now())
)
returns uuid
language plpgsql
as $$
declare
  item_row public.inventory_items%rowtype;
  location_row public.stock_locations%rowtype;
  on_hand_quantity numeric(10, 2);
  reserved_quantity numeric(10, 2);
  quantity_delta numeric(10, 2);
  transaction_id uuid;
begin
  if target_quantity <= 0 then
    raise exception 'quantity must be greater than zero';
  end if;

  if target_transaction_type not in ('adjustment_in', 'adjustment_out') then
    raise exception 'inventory adjustments only support adjustment_in or adjustment_out';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      concat_ws(':', target_company_id::text, target_inventory_item_id::text, target_stock_location_id::text),
      0
    )
  );

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

  if target_transaction_type = 'adjustment_out' then
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

    if target_quantity > greatest(on_hand_quantity - reserved_quantity, 0) then
      raise exception 'Cannot adjust out more inventory than is currently available at this location.';
    end if;

    quantity_delta := -abs(target_quantity);
  else
    quantity_delta := abs(target_quantity);
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
    target_transaction_type,
    'manual',
    null,
    null,
    null,
    null,
    null,
    null,
    quantity_delta,
    target_unit_cost_cents,
    null,
    target_notes,
    target_created_by_user_id,
    coalesce(target_effective_at, timezone('utc', now()))
  )
  returning id into transaction_id;

  return transaction_id;
end;
$$;
