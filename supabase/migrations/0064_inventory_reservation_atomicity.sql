create or replace function public.sync_part_request_line_inventory_stock_coverage(
  target_part_request_line_id uuid
)
returns void
language plpgsql
as $$
declare
  total_reserved numeric(10, 2);
  total_consumed numeric(10, 2);
begin
  if target_part_request_line_id is null then
    return;
  end if;

  select
    coalesce(sum(greatest(quantity_reserved - quantity_released - quantity_consumed, 0)), 0),
    coalesce(sum(quantity_consumed), 0)
  into total_reserved, total_consumed
  from public.inventory_reservations
  where part_request_line_id = target_part_request_line_id;

  update public.part_request_lines
  set
    quantity_reserved_from_stock = total_reserved,
    quantity_consumed_from_stock = total_consumed
  where id = target_part_request_line_id;
end;
$$;

create or replace function public.handle_inventory_reservation_stock_coverage()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    perform public.sync_part_request_line_inventory_stock_coverage(old.part_request_line_id);
    return old;
  end if;

  perform public.sync_part_request_line_inventory_stock_coverage(new.part_request_line_id);

  if tg_op = 'UPDATE' and old.part_request_line_id is distinct from new.part_request_line_id then
    perform public.sync_part_request_line_inventory_stock_coverage(old.part_request_line_id);
  end if;

  return new;
end;
$$;

drop trigger if exists inventory_reservations_sync_stock_coverage on public.inventory_reservations;
create trigger inventory_reservations_sync_stock_coverage
after insert or update or delete on public.inventory_reservations
for each row
execute function public.handle_inventory_reservation_stock_coverage();

create or replace function public.consume_inventory_reservation(
  target_reservation_id uuid,
  target_quantity_consumed numeric,
  target_created_by_user_id uuid,
  target_effective_at timestamptz default timezone('utc', now()),
  target_notes text default null
)
returns uuid
language plpgsql
as $$
declare
  reservation_row public.inventory_reservations%rowtype;
  open_quantity numeric(10, 2);
  transaction_id uuid;
begin
  select *
  into reservation_row
  from public.inventory_reservations
  where id = target_reservation_id
  for update;

  if not found then
    raise exception 'inventory reservation not found';
  end if;

  open_quantity := greatest(
    reservation_row.quantity_reserved - reservation_row.quantity_released - reservation_row.quantity_consumed,
    0
  );

  if target_quantity_consumed <= 0 then
    raise exception 'quantity consumed must be greater than zero';
  end if;

  if target_quantity_consumed > open_quantity then
    raise exception 'Cannot consume more inventory than is still reserved.';
  end if;

  update public.inventory_reservations
  set quantity_consumed = quantity_consumed + target_quantity_consumed
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
    reservation_row.company_id,
    reservation_row.inventory_item_id,
    reservation_row.stock_location_id,
    'consumption',
    'job',
    reservation_row.job_id,
    reservation_row.job_id,
    reservation_row.part_request_line_id,
    null,
    null,
    null,
    -abs(target_quantity_consumed),
    null,
    null,
    target_notes,
    target_created_by_user_id,
    coalesce(target_effective_at, timezone('utc', now()))
  )
  returning id into transaction_id;

  return transaction_id;
end;
$$;

with reservation_summary as (
  select
    part_request_line_id,
    coalesce(sum(greatest(quantity_reserved - quantity_released - quantity_consumed, 0)), 0) as total_reserved,
    coalesce(sum(quantity_consumed), 0) as total_consumed
  from public.inventory_reservations
  where part_request_line_id is not null
  group by part_request_line_id
)
update public.part_request_lines as prl
set
  quantity_reserved_from_stock = coalesce(reservation_summary.total_reserved, 0),
  quantity_consumed_from_stock = coalesce(reservation_summary.total_consumed, 0)
from reservation_summary
where prl.id = reservation_summary.part_request_line_id;

update public.part_request_lines
set
  quantity_reserved_from_stock = 0,
  quantity_consumed_from_stock = 0
where id not in (
  select distinct part_request_line_id
  from public.inventory_reservations
  where part_request_line_id is not null
);
