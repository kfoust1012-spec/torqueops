alter table public.external_record_mappings enable row level security;
alter table public.data_import_checkpoints enable row level security;

create policy "Owners and admins can read external import mappings"
on public.external_record_mappings
for select
using (public.has_company_role(company_id, array['owner', 'admin']::public.app_role[]));

create policy "Owners and admins can create external import mappings"
on public.external_record_mappings
for insert
with check (public.has_company_role(company_id, array['owner', 'admin']::public.app_role[]));

create policy "Owners and admins can update external import mappings"
on public.external_record_mappings
for update
using (public.has_company_role(company_id, array['owner', 'admin']::public.app_role[]))
with check (public.has_company_role(company_id, array['owner', 'admin']::public.app_role[]));

create policy "Owners and admins can delete external import mappings"
on public.external_record_mappings
for delete
using (public.has_company_role(company_id, array['owner', 'admin']::public.app_role[]));

create policy "Owners and admins can read import checkpoints"
on public.data_import_checkpoints
for select
using (public.has_company_role(company_id, array['owner', 'admin']::public.app_role[]));

create policy "Owners and admins can create import checkpoints"
on public.data_import_checkpoints
for insert
with check (public.has_company_role(company_id, array['owner', 'admin']::public.app_role[]));

create policy "Owners and admins can update import checkpoints"
on public.data_import_checkpoints
for update
using (public.has_company_role(company_id, array['owner', 'admin']::public.app_role[]))
with check (public.has_company_role(company_id, array['owner', 'admin']::public.app_role[]));

create policy "Owners and admins can delete import checkpoints"
on public.data_import_checkpoints
for delete
using (public.has_company_role(company_id, array['owner', 'admin']::public.app_role[]));
