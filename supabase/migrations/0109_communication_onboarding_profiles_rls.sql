alter table public.communication_onboarding_profiles enable row level security;

create policy "communication_onboarding_profiles_select_office"
on public.communication_onboarding_profiles
for select
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "communication_onboarding_profiles_insert_admin"
on public.communication_onboarding_profiles
for insert
to authenticated
with check (
  updated_by_user_id = auth.uid()
  and public.has_company_role(company_id, array['owner', 'admin']::public.app_role[])
);

create policy "communication_onboarding_profiles_update_admin"
on public.communication_onboarding_profiles
for update
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin']::public.app_role[]))
with check (
  updated_by_user_id = auth.uid()
  and public.has_company_role(company_id, array['owner', 'admin']::public.app_role[])
);
