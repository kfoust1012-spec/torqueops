alter table public.migration_source_accounts enable row level security;

create policy "migration_source_accounts_select_admin"
on public.migration_source_accounts
for select
to authenticated
using (
  public.has_company_role(
    company_id,
    array['owner', 'admin']::public.app_role[]
  )
);

create policy "migration_source_accounts_insert_admin"
on public.migration_source_accounts
for insert
to authenticated
with check (
  public.has_company_role(
    company_id,
    array['owner', 'admin']::public.app_role[]
  )
);

create policy "migration_source_accounts_update_admin"
on public.migration_source_accounts
for update
to authenticated
using (
  public.has_company_role(
    company_id,
    array['owner', 'admin']::public.app_role[]
  )
)
with check (
  public.has_company_role(
    company_id,
    array['owner', 'admin']::public.app_role[]
  )
);

create policy "migration_source_accounts_delete_admin"
on public.migration_source_accounts
for delete
to authenticated
using (
  public.has_company_role(
    company_id,
    array['owner', 'admin']::public.app_role[]
  )
);
