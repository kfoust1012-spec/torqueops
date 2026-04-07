create or replace function public.release_inventory_reservation(
  target_reservation_id uuid,
  target_quantity_released numeric
)
returns uuid
language plpgsql
as $$
declare
  reservation_row public.inventory_reservations%rowtype;
  open_quantity numeric(10, 2);
begin
  select *
  into reservation_row
  from public.inventory_reservations
  where id = target_reservation_id
  for update;

  if not found then
    raise exception 'inventory reservation not found';
  end if;

  if target_quantity_released <= 0 then
    raise exception 'quantity released must be greater than zero';
  end if;

  open_quantity := greatest(
    reservation_row.quantity_reserved - reservation_row.quantity_released - reservation_row.quantity_consumed,
    0
  );

  if target_quantity_released > open_quantity then
    raise exception 'Cannot release more inventory than is still reserved.';
  end if;

  update public.inventory_reservations
  set quantity_released = quantity_released + target_quantity_released
  where id = reservation_row.id;

  return reservation_row.id;
end;
$$;
