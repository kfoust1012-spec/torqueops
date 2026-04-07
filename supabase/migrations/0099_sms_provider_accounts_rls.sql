alter table public.sms_provider_accounts enable row level security;

create policy "sms_provider_accounts_select_office"
on public.sms_provider_accounts
for select
to authenticated
using (
  public.has_company_role(
    company_id,
    array['owner', 'admin', 'dispatcher']::public.app_role[]
  )
);

create policy "sms_provider_accounts_insert_office"
on public.sms_provider_accounts
for insert
to authenticated
with check (
  public.has_company_role(
    company_id,
    array['owner', 'admin', 'dispatcher']::public.app_role[]
  )
);

create policy "sms_provider_accounts_update_office"
on public.sms_provider_accounts
for update
to authenticated
using (
  public.has_company_role(
    company_id,
    array['owner', 'admin', 'dispatcher']::public.app_role[]
  )
)
with check (
  public.has_company_role(
    company_id,
    array['owner', 'admin', 'dispatcher']::public.app_role[]
  )
);

create policy "sms_provider_accounts_delete_office"
on public.sms_provider_accounts
for delete
to authenticated
using (
  public.has_company_role(
    company_id,
    array['owner', 'admin', 'dispatcher']::public.app_role[]
  )
);
