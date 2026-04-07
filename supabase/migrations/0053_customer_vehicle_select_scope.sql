drop policy if exists "customers_select_members" on public.customers;
drop policy if exists "customers_select_office" on public.customers;
drop policy if exists "customers_select_assigned_technician" on public.customers;
drop policy if exists "customer_addresses_select_members" on public.customer_addresses;
drop policy if exists "customer_addresses_select_office" on public.customer_addresses;
drop policy if exists "customer_addresses_select_assigned_technician" on public.customer_addresses;
drop policy if exists "vehicles_select_members" on public.vehicles;
drop policy if exists "vehicles_select_office" on public.vehicles;
drop policy if exists "vehicles_select_assigned_technician" on public.vehicles;

create or replace function public.is_assigned_technician_customer(target_customer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.jobs job
    where job.customer_id = target_customer_id
      and job.assigned_technician_user_id = auth.uid()
      and job.is_active = true
      and public.has_company_role(job.company_id, array['owner', 'admin', 'technician']::public.app_role[])
  );
$$;

create or replace function public.is_assigned_technician_vehicle(target_vehicle_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.jobs job
    where job.vehicle_id = target_vehicle_id
      and job.assigned_technician_user_id = auth.uid()
      and job.is_active = true
      and public.has_company_role(job.company_id, array['owner', 'admin', 'technician']::public.app_role[])
  );
$$;

create policy "customers_select_office"
on public.customers
for select
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "customers_select_assigned_technician"
on public.customers
for select
to authenticated
using (public.is_assigned_technician_customer(id));

create policy "customer_addresses_select_office"
on public.customer_addresses
for select
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "customer_addresses_select_assigned_technician"
on public.customer_addresses
for select
to authenticated
using (public.is_assigned_technician_customer(customer_id));

create policy "vehicles_select_office"
on public.vehicles
for select
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "vehicles_select_assigned_technician"
on public.vehicles
for select
to authenticated
using (public.is_assigned_technician_vehicle(id));
