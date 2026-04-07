create unique index if not exists inventory_items_id_company_unique_idx
on public.inventory_items (id, company_id);

create unique index if not exists stock_locations_id_company_unique_idx
on public.stock_locations (id, company_id);

create unique index if not exists jobs_id_company_unique_idx
on public.jobs (id, company_id);

create unique index if not exists part_request_lines_id_company_unique_idx
on public.part_request_lines (id, company_id);

create unique index if not exists purchase_order_lines_id_company_unique_idx
on public.purchase_order_lines (id, company_id);

create unique index if not exists purchase_receipt_lines_id_company_unique_idx
on public.purchase_receipt_lines (id, company_id);

create unique index if not exists part_return_lines_id_company_unique_idx
on public.part_return_lines (id, company_id);

alter table public.inventory_item_aliases
  add constraint inventory_item_aliases_inventory_item_company_fkey
  foreign key (inventory_item_id, company_id)
  references public.inventory_items (id, company_id)
  on delete cascade;

alter table public.inventory_stock_settings
  add constraint inventory_stock_settings_inventory_item_company_fkey
  foreign key (inventory_item_id, company_id)
  references public.inventory_items (id, company_id)
  on delete cascade,
  add constraint inventory_stock_settings_stock_location_company_fkey
  foreign key (stock_location_id, company_id)
  references public.stock_locations (id, company_id)
  on delete cascade;

alter table public.inventory_transactions
  add constraint inventory_transactions_inventory_item_company_fkey
  foreign key (inventory_item_id, company_id)
  references public.inventory_items (id, company_id)
  on delete cascade,
  add constraint inventory_transactions_stock_location_company_fkey
  foreign key (stock_location_id, company_id)
  references public.stock_locations (id, company_id)
  on delete cascade,
  add constraint inventory_transactions_job_company_fkey
  foreign key (job_id, company_id)
  references public.jobs (id, company_id)
  on delete set null,
  add constraint inventory_transactions_part_request_line_company_fkey
  foreign key (part_request_line_id, company_id)
  references public.part_request_lines (id, company_id)
  on delete set null,
  add constraint inventory_transactions_purchase_order_line_company_fkey
  foreign key (purchase_order_line_id, company_id)
  references public.purchase_order_lines (id, company_id)
  on delete set null,
  add constraint inventory_transactions_purchase_receipt_line_company_fkey
  foreign key (purchase_receipt_line_id, company_id)
  references public.purchase_receipt_lines (id, company_id)
  on delete set null,
  add constraint inventory_transactions_part_return_line_company_fkey
  foreign key (part_return_line_id, company_id)
  references public.part_return_lines (id, company_id)
  on delete set null;

alter table public.inventory_reservations
  add constraint inventory_reservations_inventory_item_company_fkey
  foreign key (inventory_item_id, company_id)
  references public.inventory_items (id, company_id)
  on delete cascade,
  add constraint inventory_reservations_stock_location_company_fkey
  foreign key (stock_location_id, company_id)
  references public.stock_locations (id, company_id)
  on delete cascade,
  add constraint inventory_reservations_job_company_fkey
  foreign key (job_id, company_id)
  references public.jobs (id, company_id)
  on delete cascade,
  add constraint inventory_reservations_part_request_line_company_fkey
  foreign key (part_request_line_id, company_id)
  references public.part_request_lines (id, company_id)
  on delete set null;

alter table public.part_request_lines
  add constraint part_request_lines_inventory_item_company_fkey
  foreign key (inventory_item_id, company_id)
  references public.inventory_items (id, company_id)
  on delete set null,
  add constraint part_request_lines_stock_location_company_fkey
  foreign key (stock_location_id, company_id)
  references public.stock_locations (id, company_id)
  on delete set null;

alter table public.purchase_order_lines
  add constraint purchase_order_lines_inventory_item_company_fkey
  foreign key (inventory_item_id, company_id)
  references public.inventory_items (id, company_id)
  on delete set null,
  add constraint purchase_order_lines_stock_location_company_fkey
  foreign key (stock_location_id, company_id)
  references public.stock_locations (id, company_id)
  on delete set null;
