alter table public.service_units enable row level security;

create policy "service_units_select_office"
on public.service_units
for select
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "service_units_select_assigned_technician"
on public.service_units
for select
to authenticated
using (assigned_technician_user_id = auth.uid());

create policy "service_units_insert_office"
on public.service_units
for insert
to authenticated
with check (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "service_units_update_office"
on public.service_units
for update
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]))
with check (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "service_units_delete_office"
on public.service_units
for delete
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));
