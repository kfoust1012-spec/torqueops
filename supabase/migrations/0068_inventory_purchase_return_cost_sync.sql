create or replace function public.return_purchase_order_line_with_inventory(
  target_company_id uuid,
  target_supplier_account_id uuid,
  target_purchase_order_id uuid,
  target_purchase_order_line_id uuid,
  target_returned_by_user_id uuid,
  target_quantity_returned numeric default 0,
  target_inventory_quantity_returned numeric default 0,
  target_is_core_return boolean default false,
  target_credit_amount_cents integer default null,
  target_returned_at timestamptz default timezone('utc', now()),
  target_return_number text default null,
  target_reason text default null,
  target_notes text default null
)
returns uuid
language plpgsql
as $$
declare
  purchase_order_row public.purchase_orders%rowtype;
  purchase_order_line_row public.purchase_order_lines%rowtype;
  request_line_row public.part_request_lines%rowtype;
  part_return_id uuid;
  part_return_line_id uuid;
  next_quantity_returned numeric(10, 2);
  next_quantity_core_returned numeric(10, 2);
  next_status public.part_lifecycle_status;
  received_to_inventory_quantity numeric(10, 2);
  returned_from_inventory_quantity numeric(10, 2);
  on_hand_quantity numeric(10, 2);
  reserved_quantity numeric(10, 2);
  total_ordered numeric(10, 2);
  total_received numeric(10, 2);
  next_purchase_order_status public.purchase_order_status;
begin
  if target_quantity_returned <= 0 then
    raise exception 'quantity returned must be greater than zero';
  end if;

  if target_inventory_quantity_returned < 0 then
    raise exception 'inventory quantity returned cannot be negative';
  end if;

  if target_inventory_quantity_returned > target_quantity_returned then
    raise exception 'Inventory return quantity cannot exceed the supplier return quantity.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(target_purchase_order_line_id::text, 0));

  select *
  into purchase_order_line_row
  from public.purchase_order_lines
  where id = target_purchase_order_line_id
  for update;

  if not found then
    raise exception 'Purchase order line not found.';
  end if;

  if purchase_order_line_row.company_id <> target_company_id then
    raise exception 'Purchase order line must belong to the current company.';
  end if;

  if purchase_order_line_row.purchase_order_id <> target_purchase_order_id then
    raise exception 'Purchase order line must belong to the selected purchase order.';
  end if;

  if purchase_order_line_row.supplier_account_id <> target_supplier_account_id then
    raise exception 'Purchase order line must belong to the selected supplier account.';
  end if;

  select *
  into purchase_order_row
  from public.purchase_orders
  where id = target_purchase_order_id
  for update;

  if not found then
    raise exception 'Purchase order not found.';
  end if;

  if purchase_order_row.company_id <> target_company_id then
    raise exception 'Purchase order must belong to the current company.';
  end if;

  if purchase_order_row.status not in ('ordered', 'partially_received', 'received') then
    raise exception 'Purchase order returns are only allowed for ordered or received purchase orders.';
  end if;

  next_quantity_returned := purchase_order_line_row.quantity_returned + target_quantity_returned;
  next_quantity_core_returned := purchase_order_line_row.quantity_core_returned +
    case when target_is_core_return then target_quantity_returned else 0 end;

  if next_quantity_returned > purchase_order_line_row.quantity_received then
    raise exception 'Cannot return more quantity than has been received.';
  end if;

  if purchase_order_line_row.quantity_installed + next_quantity_returned > purchase_order_line_row.quantity_received then
    raise exception 'Installed and returned quantity cannot exceed received quantity.';
  end if;

  if next_quantity_core_returned > purchase_order_line_row.quantity_core_due then
    raise exception 'Core returned quantity cannot exceed the outstanding core due quantity.';
  end if;

  if target_inventory_quantity_returned > 0 then
    if purchase_order_line_row.inventory_item_id is null or purchase_order_line_row.stock_location_id is null then
      raise exception 'Only inventory-linked purchase order lines can return stock from inventory.';
    end if;

    perform pg_advisory_xact_lock(
      hashtextextended(
        concat_ws(
          ':',
          target_company_id::text,
          purchase_order_line_row.inventory_item_id::text,
          purchase_order_line_row.stock_location_id::text
        ),
        0
      )
    );

    select coalesce(sum(quantity_delta), 0)
    into on_hand_quantity
    from public.inventory_transactions
    where company_id = target_company_id
      and inventory_item_id = purchase_order_line_row.inventory_item_id
      and stock_location_id = purchase_order_line_row.stock_location_id;

    select coalesce(sum(greatest(quantity_reserved - quantity_released - quantity_consumed, 0)), 0)
    into reserved_quantity
    from public.inventory_reservations
    where company_id = target_company_id
      and inventory_item_id = purchase_order_line_row.inventory_item_id
      and stock_location_id = purchase_order_line_row.stock_location_id;

    if target_inventory_quantity_returned > greatest(on_hand_quantity - reserved_quantity, 0) then
      raise exception 'Cannot return more inventory than is currently available at this location.';
    end if;

    select coalesce(sum(quantity_delta), 0)
    into received_to_inventory_quantity
    from public.inventory_transactions
    where purchase_order_line_id = target_purchase_order_line_id
      and transaction_type = 'purchase_receipt';

    select coalesce(sum(abs(quantity_delta)), 0)
    into returned_from_inventory_quantity
    from public.inventory_transactions
    where purchase_order_line_id = target_purchase_order_line_id
      and transaction_type = 'purchase_return';

    if target_inventory_quantity_returned > greatest(received_to_inventory_quantity - returned_from_inventory_quantity, 0) then
      raise exception 'Cannot return more inventory than this purchase order line previously received into stock.';
    end if;
  end if;

  insert into public.part_returns (
    company_id,
    supplier_account_id,
    purchase_order_id,
    status,
    return_number,
    reason,
    returned_by_user_id,
    returned_at,
    notes
  )
  values (
    target_company_id,
    target_supplier_account_id,
    target_purchase_order_id,
    case when target_returned_at is null then 'submitted' else 'completed' end,
    target_return_number,
    target_reason,
    target_returned_by_user_id,
    target_returned_at,
    target_notes
  )
  returning id into part_return_id;

  insert into public.part_return_lines (
    part_return_id,
    company_id,
    purchase_order_line_id,
    quantity_returned,
    is_core_return,
    credit_amount_cents,
    notes
  )
  values (
    part_return_id,
    target_company_id,
    target_purchase_order_line_id,
    target_quantity_returned,
    target_is_core_return,
    target_credit_amount_cents,
    target_notes
  )
  returning id into part_return_line_id;

  next_status := case
    when purchase_order_line_row.quantity_core_due > next_quantity_core_returned then 'core_due'::public.part_lifecycle_status
    when purchase_order_line_row.quantity_core_due > 0 and next_quantity_core_returned >= purchase_order_line_row.quantity_core_due then 'core_returned'::public.part_lifecycle_status
    when next_quantity_returned > 0 then 'returned'::public.part_lifecycle_status
    when purchase_order_line_row.quantity_installed > 0 then 'installed'::public.part_lifecycle_status
    when purchase_order_line_row.quantity_received > 0 then 'received'::public.part_lifecycle_status
    when purchase_order_line_row.quantity_ordered > 0 then 'ordered'::public.part_lifecycle_status
    else 'quoted'::public.part_lifecycle_status
  end;

  update public.purchase_order_lines
  set
    quantity_returned = next_quantity_returned,
    quantity_core_returned = next_quantity_core_returned,
    status = next_status
  where id = target_purchase_order_line_id;

  if target_inventory_quantity_returned > 0 then
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
      purchase_order_line_row.inventory_item_id,
      purchase_order_line_row.stock_location_id,
      'purchase_return',
      'purchase_return',
      part_return_line_id,
      purchase_order_line_row.job_id,
      purchase_order_line_row.part_request_line_id,
      target_purchase_order_line_id,
      null,
      part_return_line_id,
      -abs(target_inventory_quantity_returned),
      coalesce(purchase_order_line_row.unit_actual_cost_cents, purchase_order_line_row.unit_ordered_cost_cents),
      null,
      target_notes,
      target_returned_by_user_id,
      coalesce(target_returned_at, timezone('utc', now()))
    );
  end if;

  if purchase_order_line_row.part_request_line_id is not null then
    select *
    into request_line_row
    from public.part_request_lines
    where id = purchase_order_line_row.part_request_line_id
    for update;

    if found then
      update public.part_request_lines
      set
        actual_unit_cost_cents = (
          with po_lines as (
            select
              pol.id,
              pol.quantity_received,
              pol.quantity_returned,
              coalesce(pol.unit_actual_cost_cents, pol.unit_ordered_cost_cents, 0) as fallback_unit_cost_cents
            from public.purchase_order_lines pol
            where pol.part_request_line_id = request_line_row.id
          ),
          receipt_totals as (
            select
              po_lines.id as purchase_order_line_id,
              coalesce(
                sum(
                  prl.quantity_received * coalesce(prl.unit_received_cost_cents, po_lines.fallback_unit_cost_cents)
                ),
                0
              ) as receipt_cost_cents
            from po_lines
            left join public.purchase_receipt_lines prl on prl.purchase_order_line_id = po_lines.id
            group by po_lines.id
          ),
          return_totals as (
            select
              po_lines.id as purchase_order_line_id,
              coalesce(
                sum(
                  case
                    when prl.credit_amount_cents is not null then prl.credit_amount_cents
                    when prl.is_core_return then 0
                    else prl.quantity_returned * po_lines.fallback_unit_cost_cents
                  end
                ),
                0
              ) as return_credit_cents
            from po_lines
            left join public.part_return_lines prl on prl.purchase_order_line_id = po_lines.id
            group by po_lines.id
          ),
          snapshot as (
            select
              sum(greatest(coalesce(receipt_totals.receipt_cost_cents, 0) - coalesce(return_totals.return_credit_cents, 0), 0)) as actual_cost_cents,
              sum(greatest(po_lines.quantity_received - po_lines.quantity_returned, 0)) as net_quantity_received
            from po_lines
            left join receipt_totals on receipt_totals.purchase_order_line_id = po_lines.id
            left join return_totals on return_totals.purchase_order_line_id = po_lines.id
          )
          select
            case
              when snapshot.net_quantity_received > 0 then round(snapshot.actual_cost_cents / snapshot.net_quantity_received)::integer
              else null
            end
          from snapshot
        ),
        quantity_core_due = (
          select coalesce(sum(quantity_core_due), 0)
          from public.purchase_order_lines
          where part_request_line_id = request_line_row.id
        ),
        quantity_core_returned = (
          select coalesce(sum(quantity_core_returned), 0)
          from public.purchase_order_lines
          where part_request_line_id = request_line_row.id
        ),
        quantity_installed = (
          select coalesce(sum(quantity_installed), 0)
          from public.purchase_order_lines
          where part_request_line_id = request_line_row.id
        ),
        quantity_ordered = (
          select coalesce(sum(quantity_ordered), 0)
          from public.purchase_order_lines
          where part_request_line_id = request_line_row.id
        ),
        quantity_received = (
          select coalesce(sum(quantity_received), 0)
          from public.purchase_order_lines
          where part_request_line_id = request_line_row.id
        ),
        quantity_returned = (
          select coalesce(sum(quantity_returned), 0)
          from public.purchase_order_lines
          where part_request_line_id = request_line_row.id
        ),
        status = (
          with line_totals as (
            select
              coalesce(sum(quantity_ordered), 0) as quantity_ordered,
              coalesce(sum(quantity_received), 0) as quantity_received,
              coalesce(sum(quantity_installed), 0) as quantity_installed,
              coalesce(sum(quantity_returned), 0) as quantity_returned,
              coalesce(sum(quantity_core_due), 0) as quantity_core_due,
              coalesce(sum(quantity_core_returned), 0) as quantity_core_returned
            from public.purchase_order_lines
            where part_request_line_id = request_line_row.id
          )
          select case
            when line_totals.quantity_core_due > line_totals.quantity_core_returned then 'core_due'::public.part_lifecycle_status
            when line_totals.quantity_core_due > 0 and line_totals.quantity_core_returned >= line_totals.quantity_core_due then 'core_returned'::public.part_lifecycle_status
            when line_totals.quantity_returned > 0 then 'returned'::public.part_lifecycle_status
            when line_totals.quantity_installed > 0 then 'installed'::public.part_lifecycle_status
            when line_totals.quantity_received > 0 then 'received'::public.part_lifecycle_status
            when line_totals.quantity_ordered > 0 then 'ordered'::public.part_lifecycle_status
            else 'quoted'::public.part_lifecycle_status
          end
          from line_totals
        )
      where id = request_line_row.id;

      update public.part_requests
      set status = case
        when status = 'canceled' then status
        when not exists (
          select 1
          from public.part_request_lines
          where part_request_id = request_line_row.part_request_id
            and quantity_installed < quantity_requested
        ) then 'fulfilled'::public.part_request_status
        else 'open'::public.part_request_status
      end
      where id = request_line_row.part_request_id;
    end if;
  end if;

  if purchase_order_row.status <> 'canceled' and purchase_order_row.status <> 'closed' then
    select
      coalesce(sum(quantity_ordered), 0),
      coalesce(sum(quantity_received), 0)
    into total_ordered, total_received
    from public.purchase_order_lines
    where purchase_order_id = target_purchase_order_id;

    next_purchase_order_status := 'draft';
    if total_ordered > 0 then
      next_purchase_order_status := 'ordered';
    end if;
    if total_received > 0 then
      next_purchase_order_status := case
        when total_received >= total_ordered then 'received'::public.purchase_order_status
        else 'partially_received'::public.purchase_order_status
      end;
    end if;

    update public.purchase_orders
    set status = next_purchase_order_status
    where id = target_purchase_order_id;
  end if;

  return part_return_id;
end;
$$;
