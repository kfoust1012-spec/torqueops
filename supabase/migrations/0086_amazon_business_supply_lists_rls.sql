alter table public.procurement_supply_lists enable row level security;
alter table public.procurement_supply_list_lines enable row level security;

create policy "procurement_supply_lists_select_office"
on public.procurement_supply_lists
for select
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "procurement_supply_lists_insert_office"
on public.procurement_supply_lists
for insert
to authenticated
with check (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "procurement_supply_lists_update_office"
on public.procurement_supply_lists
for update
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]))
with check (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "procurement_supply_lists_delete_office"
on public.procurement_supply_lists
for delete
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "procurement_supply_list_lines_select_office"
on public.procurement_supply_list_lines
for select
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "procurement_supply_list_lines_insert_office"
on public.procurement_supply_list_lines
for insert
to authenticated
with check (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "procurement_supply_list_lines_update_office"
on public.procurement_supply_list_lines
for update
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]))
with check (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "procurement_supply_list_lines_delete_office"
on public.procurement_supply_list_lines
for delete
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));
