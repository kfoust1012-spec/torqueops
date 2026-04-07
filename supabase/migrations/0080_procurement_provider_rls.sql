alter table public.procurement_provider_accounts enable row level security;
alter table public.procurement_provider_supplier_mappings enable row level security;
alter table public.procurement_provider_quotes enable row level security;
alter table public.procurement_provider_quote_lines enable row level security;
alter table public.procurement_provider_orders enable row level security;
alter table public.procurement_provider_order_lines enable row level security;

create policy "procurement_provider_accounts_select_office"
on public.procurement_provider_accounts
for select
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "procurement_provider_accounts_insert_office"
on public.procurement_provider_accounts
for insert
to authenticated
with check (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "procurement_provider_accounts_update_office"
on public.procurement_provider_accounts
for update
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]))
with check (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "procurement_provider_accounts_delete_office"
on public.procurement_provider_accounts
for delete
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "procurement_provider_supplier_mappings_select_office"
on public.procurement_provider_supplier_mappings
for select
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "procurement_provider_supplier_mappings_insert_office"
on public.procurement_provider_supplier_mappings
for insert
to authenticated
with check (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "procurement_provider_supplier_mappings_update_office"
on public.procurement_provider_supplier_mappings
for update
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]))
with check (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "procurement_provider_supplier_mappings_delete_office"
on public.procurement_provider_supplier_mappings
for delete
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "procurement_provider_quotes_select_office"
on public.procurement_provider_quotes
for select
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "procurement_provider_quotes_insert_office"
on public.procurement_provider_quotes
for insert
to authenticated
with check (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "procurement_provider_quotes_update_office"
on public.procurement_provider_quotes
for update
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]))
with check (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "procurement_provider_quotes_delete_office"
on public.procurement_provider_quotes
for delete
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "procurement_provider_quote_lines_select_office"
on public.procurement_provider_quote_lines
for select
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "procurement_provider_quote_lines_insert_office"
on public.procurement_provider_quote_lines
for insert
to authenticated
with check (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "procurement_provider_quote_lines_update_office"
on public.procurement_provider_quote_lines
for update
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]))
with check (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "procurement_provider_quote_lines_delete_office"
on public.procurement_provider_quote_lines
for delete
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "procurement_provider_orders_select_office"
on public.procurement_provider_orders
for select
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "procurement_provider_orders_insert_office"
on public.procurement_provider_orders
for insert
to authenticated
with check (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "procurement_provider_orders_update_office"
on public.procurement_provider_orders
for update
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]))
with check (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "procurement_provider_orders_delete_office"
on public.procurement_provider_orders
for delete
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "procurement_provider_order_lines_select_office"
on public.procurement_provider_order_lines
for select
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "procurement_provider_order_lines_insert_office"
on public.procurement_provider_order_lines
for insert
to authenticated
with check (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "procurement_provider_order_lines_update_office"
on public.procurement_provider_order_lines
for update
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]))
with check (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "procurement_provider_order_lines_delete_office"
on public.procurement_provider_order_lines
for delete
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));
