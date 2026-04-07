alter table public.supplier_accounts enable row level security;
alter table public.supplier_routing_rules enable row level security;
alter table public.part_requests enable row level security;
alter table public.part_request_lines enable row level security;
alter table public.supplier_carts enable row level security;
alter table public.supplier_cart_lines enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.purchase_order_lines enable row level security;
alter table public.purchase_receipts enable row level security;
alter table public.purchase_receipt_lines enable row level security;
alter table public.part_returns enable row level security;
alter table public.part_return_lines enable row level security;

create policy "supplier_accounts_select_office"
on public.supplier_accounts
for select
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "supplier_accounts_insert_office"
on public.supplier_accounts
for insert
to authenticated
with check (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "supplier_accounts_update_office"
on public.supplier_accounts
for update
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]))
with check (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "supplier_accounts_delete_office"
on public.supplier_accounts
for delete
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "supplier_routing_rules_select_office"
on public.supplier_routing_rules
for select
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "supplier_routing_rules_insert_office"
on public.supplier_routing_rules
for insert
to authenticated
with check (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "supplier_routing_rules_update_office"
on public.supplier_routing_rules
for update
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]))
with check (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "supplier_routing_rules_delete_office"
on public.supplier_routing_rules
for delete
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "part_requests_select_office"
on public.part_requests
for select
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "part_requests_insert_office"
on public.part_requests
for insert
to authenticated
with check (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "part_requests_update_office"
on public.part_requests
for update
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]))
with check (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "part_requests_delete_office"
on public.part_requests
for delete
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "part_request_lines_select_office"
on public.part_request_lines
for select
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "part_request_lines_insert_office"
on public.part_request_lines
for insert
to authenticated
with check (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "part_request_lines_update_office"
on public.part_request_lines
for update
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]))
with check (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "part_request_lines_delete_office"
on public.part_request_lines
for delete
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "supplier_carts_select_office"
on public.supplier_carts
for select
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "supplier_carts_insert_office"
on public.supplier_carts
for insert
to authenticated
with check (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "supplier_carts_update_office"
on public.supplier_carts
for update
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]))
with check (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "supplier_carts_delete_office"
on public.supplier_carts
for delete
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "supplier_cart_lines_select_office"
on public.supplier_cart_lines
for select
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "supplier_cart_lines_insert_office"
on public.supplier_cart_lines
for insert
to authenticated
with check (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "supplier_cart_lines_update_office"
on public.supplier_cart_lines
for update
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]))
with check (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "supplier_cart_lines_delete_office"
on public.supplier_cart_lines
for delete
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "purchase_orders_select_office"
on public.purchase_orders
for select
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "purchase_orders_insert_office"
on public.purchase_orders
for insert
to authenticated
with check (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "purchase_orders_update_office"
on public.purchase_orders
for update
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]))
with check (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "purchase_orders_delete_office"
on public.purchase_orders
for delete
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "purchase_order_lines_select_office"
on public.purchase_order_lines
for select
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "purchase_order_lines_insert_office"
on public.purchase_order_lines
for insert
to authenticated
with check (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "purchase_order_lines_update_office"
on public.purchase_order_lines
for update
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]))
with check (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "purchase_order_lines_delete_office"
on public.purchase_order_lines
for delete
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "purchase_receipts_select_office"
on public.purchase_receipts
for select
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "purchase_receipts_insert_office"
on public.purchase_receipts
for insert
to authenticated
with check (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "purchase_receipts_update_office"
on public.purchase_receipts
for update
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]))
with check (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "purchase_receipts_delete_office"
on public.purchase_receipts
for delete
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "purchase_receipt_lines_select_office"
on public.purchase_receipt_lines
for select
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "purchase_receipt_lines_insert_office"
on public.purchase_receipt_lines
for insert
to authenticated
with check (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "purchase_receipt_lines_update_office"
on public.purchase_receipt_lines
for update
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]))
with check (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "purchase_receipt_lines_delete_office"
on public.purchase_receipt_lines
for delete
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "part_returns_select_office"
on public.part_returns
for select
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "part_returns_insert_office"
on public.part_returns
for insert
to authenticated
with check (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "part_returns_update_office"
on public.part_returns
for update
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]))
with check (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "part_returns_delete_office"
on public.part_returns
for delete
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "part_return_lines_select_office"
on public.part_return_lines
for select
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "part_return_lines_insert_office"
on public.part_return_lines
for insert
to authenticated
with check (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "part_return_lines_update_office"
on public.part_return_lines
for update
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]))
with check (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "part_return_lines_delete_office"
on public.part_return_lines
for delete
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));
