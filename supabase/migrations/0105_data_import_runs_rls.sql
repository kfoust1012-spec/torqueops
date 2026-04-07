alter table public.data_import_runs enable row level security;

create policy "Owners and admins can read company data import runs"
on public.data_import_runs
for select
using (public.has_company_role(company_id, array['owner', 'admin']::public.app_role[]));

create policy "Owners and admins can create company data import runs"
on public.data_import_runs
for insert
with check (public.has_company_role(company_id, array['owner', 'admin']::public.app_role[]));

create policy "Owners and admins can update company data import runs"
on public.data_import_runs
for update
using (public.has_company_role(company_id, array['owner', 'admin']::public.app_role[]))
with check (public.has_company_role(company_id, array['owner', 'admin']::public.app_role[]));

create policy "Owners and admins can delete company data import runs"
on public.data_import_runs
for delete
using (public.has_company_role(company_id, array['owner', 'admin']::public.app_role[]));
