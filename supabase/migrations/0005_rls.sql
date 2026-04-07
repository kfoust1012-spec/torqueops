alter table public.profiles enable row level security;
alter table public.companies enable row level security;
alter table public.company_memberships enable row level security;

create or replace function public.is_company_member(target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.company_memberships membership
    where membership.company_id = target_company_id
      and membership.user_id = auth.uid()
      and membership.is_active = true
  );
$$;

create or replace function public.is_company_owner(target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.companies company
    where company.id = target_company_id
      and company.owner_user_id = auth.uid()
  );
$$;

create or replace function public.has_company_role(
  target_company_id uuid,
  allowed_roles public.app_role[]
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.company_memberships membership
    where membership.company_id = target_company_id
      and membership.user_id = auth.uid()
      and membership.is_active = true
      and membership.role = any (allowed_roles)
  );
$$;

create policy "profiles_select_own_or_shared_company"
on public.profiles
for select
to authenticated
using (
  auth.uid() = id
  or exists (
    select 1
    from public.company_memberships viewer
    join public.company_memberships target
      on target.company_id = viewer.company_id
    where viewer.user_id = auth.uid()
      and viewer.is_active = true
      and viewer.role in ('owner', 'admin')
      and target.user_id = profiles.id
      and target.is_active = true
  )
);

create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (
  auth.uid() = id
  and (
    default_company_id is null
    or public.is_company_member(default_company_id)
  )
);

create policy "companies_select_members"
on public.companies
for select
to authenticated
using (public.is_company_member(id) or owner_user_id = auth.uid());

create policy "companies_insert_owner"
on public.companies
for insert
to authenticated
with check (owner_user_id = auth.uid());

create policy "companies_update_admin_roles"
on public.companies
for update
to authenticated
using (public.has_company_role(id, array['owner', 'admin']::public.app_role[]))
with check (public.has_company_role(id, array['owner', 'admin']::public.app_role[]));

create policy "company_memberships_select_members"
on public.company_memberships
for select
to authenticated
using (public.is_company_member(company_id));

create policy "company_memberships_insert_managers"
on public.company_memberships
for insert
to authenticated
with check (
  (
    public.has_company_role(company_id, array['owner', 'admin']::public.app_role[])
    and (role <> 'owner' or public.is_company_owner(company_id))
  )
  or (
    role = 'owner'
    and user_id = auth.uid()
    and public.is_company_owner(company_id)
  )
);

create policy "company_memberships_update_managers"
on public.company_memberships
for update
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin']::public.app_role[]))
with check (
  public.has_company_role(company_id, array['owner', 'admin']::public.app_role[])
  and (role <> 'owner' or public.is_company_owner(company_id))
);

create policy "company_memberships_delete_managers"
on public.company_memberships
for delete
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin']::public.app_role[]));
