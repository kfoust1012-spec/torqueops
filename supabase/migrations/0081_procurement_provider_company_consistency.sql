create unique index if not exists supplier_accounts_id_company_unique_idx
on public.supplier_accounts (id, company_id);

create unique index if not exists estimates_id_company_unique_idx
on public.estimates (id, company_id);

create unique index if not exists part_requests_id_company_unique_idx
on public.part_requests (id, company_id);

create unique index if not exists purchase_orders_id_company_unique_idx
on public.purchase_orders (id, company_id);

create unique index if not exists supplier_cart_lines_id_company_unique_idx
on public.supplier_cart_lines (id, company_id);

create unique index if not exists procurement_provider_accounts_id_company_unique_idx
on public.procurement_provider_accounts (id, company_id);

create unique index if not exists procurement_provider_supplier_mappings_id_company_unique_idx
on public.procurement_provider_supplier_mappings (id, company_id);

create unique index if not exists procurement_provider_quotes_id_company_unique_idx
on public.procurement_provider_quotes (id, company_id);

create unique index if not exists procurement_provider_quote_lines_id_company_unique_idx
on public.procurement_provider_quote_lines (id, company_id);

create unique index if not exists procurement_provider_orders_id_company_unique_idx
on public.procurement_provider_orders (id, company_id);

alter table public.procurement_provider_supplier_mappings
  add constraint procurement_provider_supplier_mappings_provider_account_company_fkey
  foreign key (provider_account_id, company_id)
  references public.procurement_provider_accounts (id, company_id)
  on delete cascade,
  add constraint procurement_provider_supplier_mappings_supplier_account_company_fkey
  foreign key (supplier_account_id, company_id)
  references public.supplier_accounts (id, company_id)
  on delete cascade;

alter table public.procurement_provider_quotes
  add constraint procurement_provider_quotes_provider_account_company_fkey
  foreign key (provider_account_id, company_id)
  references public.procurement_provider_accounts (id, company_id)
  on delete cascade,
  add constraint procurement_provider_quotes_job_company_fkey
  foreign key (job_id, company_id)
  references public.jobs (id, company_id)
  on delete cascade,
  add constraint procurement_provider_quotes_estimate_company_fkey
  foreign key (estimate_id, company_id)
  references public.estimates (id, company_id)
  on delete set null,
  add constraint procurement_provider_quotes_part_request_company_fkey
  foreign key (part_request_id, company_id)
  references public.part_requests (id, company_id)
  on delete cascade;

alter table public.procurement_provider_quote_lines
  add constraint procurement_provider_quote_lines_quote_company_fkey
  foreign key (provider_quote_id, company_id)
  references public.procurement_provider_quotes (id, company_id)
  on delete cascade,
  add constraint procurement_provider_quote_lines_request_line_company_fkey
  foreign key (part_request_line_id, company_id)
  references public.part_request_lines (id, company_id)
  on delete cascade,
  add constraint procurement_provider_quote_lines_supplier_mapping_company_fkey
  foreign key (provider_supplier_mapping_id, company_id)
  references public.procurement_provider_supplier_mappings (id, company_id)
  on delete set null;

alter table public.procurement_provider_orders
  add constraint procurement_provider_orders_provider_account_company_fkey
  foreign key (provider_account_id, company_id)
  references public.procurement_provider_accounts (id, company_id)
  on delete cascade,
  add constraint procurement_provider_orders_purchase_order_company_fkey
  foreign key (purchase_order_id, company_id)
  references public.purchase_orders (id, company_id)
  on delete cascade,
  add constraint procurement_provider_orders_quote_company_fkey
  foreign key (provider_quote_id, company_id)
  references public.procurement_provider_quotes (id, company_id)
  on delete set null;

alter table public.procurement_provider_order_lines
  add constraint procurement_provider_order_lines_order_company_fkey
  foreign key (provider_order_id, company_id)
  references public.procurement_provider_orders (id, company_id)
  on delete cascade,
  add constraint procurement_provider_order_lines_purchase_order_line_company_fkey
  foreign key (purchase_order_line_id, company_id)
  references public.purchase_order_lines (id, company_id)
  on delete cascade,
  add constraint procurement_provider_order_lines_quote_line_company_fkey
  foreign key (provider_quote_line_id, company_id)
  references public.procurement_provider_quote_lines (id, company_id)
  on delete set null;

alter table public.supplier_cart_lines
  add constraint supplier_cart_lines_provider_quote_line_company_fkey
  foreign key (provider_quote_line_id, company_id)
  references public.procurement_provider_quote_lines (id, company_id)
  on delete set null;
