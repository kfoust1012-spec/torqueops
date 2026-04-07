alter table public.part_request_lines
  add column quantity_reserved_from_stock numeric(10, 2) not null default 0,
  add column quantity_consumed_from_stock numeric(10, 2) not null default 0;

alter table public.part_request_lines
  add constraint part_request_lines_quantity_reserved_from_stock_check check (
    quantity_reserved_from_stock >= 0
  ),
  add constraint part_request_lines_quantity_consumed_from_stock_check check (
    quantity_consumed_from_stock >= 0
  );
