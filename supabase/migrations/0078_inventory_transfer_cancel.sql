create or replace function public.cancel_inventory_transfer(
  target_transfer_id uuid,
  target_notes text default null
)
returns uuid
language plpgsql
as $$
declare
  transfer_row public.inventory_transfers%rowtype;
begin
  select * into transfer_row
  from public.inventory_transfers
  where id = target_transfer_id
  for update;

  if not found then
    raise exception 'Inventory transfer not found.';
  end if;

  if transfer_row.status <> 'draft' then
    raise exception 'Only draft transfers can be canceled.';
  end if;

  update public.inventory_transfers
  set
    status = 'canceled',
    notes = coalesce(target_notes, notes)
  where id = transfer_row.id;

  return transfer_row.id;
end;
$$;
