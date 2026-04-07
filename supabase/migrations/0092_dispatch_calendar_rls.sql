alter table public.dispatch_calendar_settings enable row level security;
alter table public.dispatch_saved_views enable row level security;
alter table public.dispatch_saved_view_members enable row level security;
alter table public.dispatch_resource_preferences enable row level security;

create policy "dispatch_calendar_settings_select_office"
on public.dispatch_calendar_settings
for select
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "dispatch_calendar_settings_insert_office"
on public.dispatch_calendar_settings
for insert
to authenticated
with check (
  updated_by_user_id = auth.uid()
  and public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[])
);

create policy "dispatch_calendar_settings_update_office"
on public.dispatch_calendar_settings
for update
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]))
with check (
  updated_by_user_id = auth.uid()
  and public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[])
);

create policy "dispatch_saved_views_select_office"
on public.dispatch_saved_views
for select
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "dispatch_saved_views_insert_office"
on public.dispatch_saved_views
for insert
to authenticated
with check (
  created_by_user_id = auth.uid()
  and public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[])
);

create policy "dispatch_saved_views_update_office"
on public.dispatch_saved_views
for update
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]))
with check (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "dispatch_saved_views_delete_office"
on public.dispatch_saved_views
for delete
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "dispatch_saved_view_members_select_office"
on public.dispatch_saved_view_members
for select
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "dispatch_saved_view_members_insert_office"
on public.dispatch_saved_view_members
for insert
to authenticated
with check (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "dispatch_saved_view_members_update_office"
on public.dispatch_saved_view_members
for update
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]))
with check (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "dispatch_saved_view_members_delete_office"
on public.dispatch_saved_view_members
for delete
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "dispatch_resource_preferences_select_office"
on public.dispatch_resource_preferences
for select
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "dispatch_resource_preferences_insert_office"
on public.dispatch_resource_preferences
for insert
to authenticated
with check (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "dispatch_resource_preferences_update_office"
on public.dispatch_resource_preferences
for update
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]))
with check (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "dispatch_resource_preferences_delete_office"
on public.dispatch_resource_preferences
for delete
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));
