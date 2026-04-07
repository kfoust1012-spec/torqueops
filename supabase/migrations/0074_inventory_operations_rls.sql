alter table public.inventory_transfers enable row level security;
alter table public.inventory_transfer_lines enable row level security;
alter table public.job_inventory_issues enable row level security;
alter table public.core_inventory_events enable row level security;
alter table public.inventory_cycle_counts enable row level security;
alter table public.inventory_cycle_count_lines enable row level security;

create policy "inventory_transfers_select_office"
on public.inventory_transfers
for select
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "inventory_transfers_insert_office"
on public.inventory_transfers
for insert
to authenticated
with check (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "inventory_transfers_update_office"
on public.inventory_transfers
for update
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]))
with check (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "inventory_transfers_delete_office"
on public.inventory_transfers
for delete
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "inventory_transfer_lines_select_office"
on public.inventory_transfer_lines
for select
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "inventory_transfer_lines_insert_office"
on public.inventory_transfer_lines
for insert
to authenticated
with check (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "inventory_transfer_lines_update_office"
on public.inventory_transfer_lines
for update
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]))
with check (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "inventory_transfer_lines_delete_office"
on public.inventory_transfer_lines
for delete
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "job_inventory_issues_select_office"
on public.job_inventory_issues
for select
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "job_inventory_issues_insert_office"
on public.job_inventory_issues
for insert
to authenticated
with check (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "job_inventory_issues_update_office"
on public.job_inventory_issues
for update
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]))
with check (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "job_inventory_issues_delete_office"
on public.job_inventory_issues
for delete
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "core_inventory_events_select_office"
on public.core_inventory_events
for select
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "core_inventory_events_insert_office"
on public.core_inventory_events
for insert
to authenticated
with check (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "core_inventory_events_update_office"
on public.core_inventory_events
for update
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]))
with check (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "core_inventory_events_delete_office"
on public.core_inventory_events
for delete
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "inventory_cycle_counts_select_office"
on public.inventory_cycle_counts
for select
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "inventory_cycle_counts_insert_office"
on public.inventory_cycle_counts
for insert
to authenticated
with check (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "inventory_cycle_counts_update_office"
on public.inventory_cycle_counts
for update
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]))
with check (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "inventory_cycle_counts_delete_office"
on public.inventory_cycle_counts
for delete
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "inventory_cycle_count_lines_select_office"
on public.inventory_cycle_count_lines
for select
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "inventory_cycle_count_lines_insert_office"
on public.inventory_cycle_count_lines
for insert
to authenticated
with check (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "inventory_cycle_count_lines_update_office"
on public.inventory_cycle_count_lines
for update
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]))
with check (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "inventory_cycle_count_lines_delete_office"
on public.inventory_cycle_count_lines
for delete
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));
