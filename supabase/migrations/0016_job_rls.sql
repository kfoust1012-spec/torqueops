alter table public.jobs enable row level security;
alter table public.job_notes enable row level security;
alter table public.job_status_history enable row level security;

create policy "jobs_select_members"
on public.jobs
for select
to authenticated
using (public.is_company_member(company_id));

create policy "jobs_insert_office"
on public.jobs
for insert
to authenticated
with check (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "jobs_update_office"
on public.jobs
for update
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]))
with check (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "jobs_delete_office"
on public.jobs
for delete
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "job_notes_select_members"
on public.job_notes
for select
to authenticated
using (public.is_company_member(company_id));

create policy "job_notes_insert_office"
on public.job_notes
for insert
to authenticated
with check (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "job_notes_update_office"
on public.job_notes
for update
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]))
with check (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "job_notes_delete_office"
on public.job_notes
for delete
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "job_status_history_select_members"
on public.job_status_history
for select
to authenticated
using (public.is_company_member(company_id));

create policy "job_status_history_insert_office"
on public.job_status_history
for insert
to authenticated
with check (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));
