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
  counted_item_ids uuid[] := '{}'::uuid[];
  target_inventory_item_id uuid;
begin
  if jsonb_typeof(target_lines) <> 'array' or jsonb_array_length(target_lines) = 0 then
    raise exception 'Cycle count must include at least one inventory item.';
  end if;

  select * into location_row
  from public.stock_locations
  where id = target_stock_location_id;

  if not found then
    raise exception 'Stock location not found.';
  end if;

  if location_row.company_id <> target_company_id then
    raise exception 'Stock location must belong to the current company.';
  end if;

  if not location_row.is_active then
    raise exception 'Cycle count stock location must be active.';
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
    target_inventory_item_id := (line_record ->> 'inventory_item_id')::uuid;

    if target_inventory_item_id is null then
      raise exception 'Cycle count inventory item is required.';
    end if;

    if target_inventory_item_id = any(counted_item_ids) then
      raise exception 'Cycle count inventory item cannot appear more than once in the same count.';
    end if;

    counted_item_ids := array_append(counted_item_ids, target_inventory_item_id);

    select * into item_row
    from public.inventory_items
    where id = target_inventory_item_id;

    if not found then
      raise exception 'Cycle count inventory item not found.';
    end if;

    if item_row.company_id <> target_company_id then
      raise exception 'Cycle count inventory item must belong to the current company.';
    end if;

    if not item_row.is_active then
      raise exception 'Cycle count inventory item must be active.';
    end if;

    if item_row.item_type <> 'stocked' then
      raise exception 'Only stocked inventory items can be included in a cycle count.';
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
