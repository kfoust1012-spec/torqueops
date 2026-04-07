alter table public.customers enable row level security;
alter table public.customer_addresses enable row level security;
alter table public.vehicles enable row level security;

create or replace function public.enforce_customer_address_company_match()
returns trigger
language plpgsql
as $$
declare
  parent_company_id uuid;
begin
  select company_id
  into parent_company_id
  from public.customers
  where id = new.customer_id;

  if parent_company_id is null then
    raise exception 'customer_id % does not exist', new.customer_id;
  end if;

  if new.company_id <> parent_company_id then
    raise exception 'customer_addresses.company_id must match customers.company_id';
  end if;

  return new;
end;
$$;

create or replace function public.enforce_vehicle_company_match()
returns trigger
language plpgsql
as $$
declare
  parent_company_id uuid;
begin
  select company_id
  into parent_company_id
  from public.customers
  where id = new.customer_id;

  if parent_company_id is null then
    raise exception 'customer_id % does not exist', new.customer_id;
  end if;

  if new.company_id <> parent_company_id then
    raise exception 'vehicles.company_id must match customers.company_id';
  end if;

  return new;
end;
$$;

create trigger customer_addresses_company_match
before insert or update on public.customer_addresses
for each row
execute function public.enforce_customer_address_company_match();

create trigger vehicles_company_match
before insert or update on public.vehicles
for each row
execute function public.enforce_vehicle_company_match();

create policy "customers_select_members"
on public.customers
for select
to authenticated
using (public.is_company_member(company_id));

create policy "customers_insert_office"
on public.customers
for insert
to authenticated
with check (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "customers_update_office"
on public.customers
for update
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]))
with check (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "customers_delete_office"
on public.customers
for delete
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "customer_addresses_select_members"
on public.customer_addresses
for select
to authenticated
using (public.is_company_member(company_id));

create policy "customer_addresses_insert_office"
on public.customer_addresses
for insert
to authenticated
with check (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "customer_addresses_update_office"
on public.customer_addresses
for update
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]))
with check (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "customer_addresses_delete_office"
on public.customer_addresses
for delete
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "vehicles_select_members"
on public.vehicles
for select
to authenticated
using (public.is_company_member(company_id));

create policy "vehicles_insert_office"
on public.vehicles
for insert
to authenticated
with check (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "vehicles_update_office"
on public.vehicles
for update
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]))
with check (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "vehicles_delete_office"
on public.vehicles
for delete
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));
