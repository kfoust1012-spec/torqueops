alter table public.purchase_receipt_lines
  add column if not exists received_into_inventory_quantity numeric(10, 2) not null default 0;

alter table public.purchase_receipt_lines
  drop constraint if exists purchase_receipt_lines_received_into_inventory_quantity_check;

alter table public.purchase_receipt_lines
  add constraint purchase_receipt_lines_received_into_inventory_quantity_check
  check (received_into_inventory_quantity >= 0 and received_into_inventory_quantity <= quantity_received);
