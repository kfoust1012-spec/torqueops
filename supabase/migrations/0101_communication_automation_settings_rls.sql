alter table public.communication_automation_settings enable row level security;

create policy "communication_automation_settings_select_office"
on public.communication_automation_settings
for select
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "communication_automation_settings_insert_admin"
on public.communication_automation_settings
for insert
to authenticated
with check (
  updated_by_user_id = auth.uid()
  and public.has_company_role(company_id, array['owner', 'admin']::public.app_role[])
);

create policy "communication_automation_settings_update_admin"
on public.communication_automation_settings
for update
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin']::public.app_role[]))
with check (
  updated_by_user_id = auth.uid()
  and public.has_company_role(company_id, array['owner', 'admin']::public.app_role[])
);
