alter table public.technician_availability_blocks enable row level security;

create policy "technician_availability_blocks_select_office"
on public.technician_availability_blocks
for select
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "technician_availability_blocks_insert_office"
on public.technician_availability_blocks
for insert
to authenticated
with check (
  created_by_user_id = auth.uid()
  and public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[])
);

create policy "technician_availability_blocks_update_office"
on public.technician_availability_blocks
for update
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]))
with check (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "technician_availability_blocks_delete_office"
on public.technician_availability_blocks
for delete
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));