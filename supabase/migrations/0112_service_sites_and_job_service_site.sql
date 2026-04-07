alter table public.customer_addresses
  add column if not exists site_name text,
  add column if not exists service_contact_name text,
  add column if not exists service_contact_phone text,
  add column if not exists access_window_notes text,
  add column if not exists is_active boolean not null default true;

create index if not exists customer_addresses_customer_active_idx
  on public.customer_addresses (customer_id, is_active, is_primary desc, created_at asc);

alter table public.jobs
  add column if not exists service_site_id uuid null references public.customer_addresses (id) on delete set null;

create index if not exists jobs_service_site_id_idx on public.jobs (service_site_id);

update public.jobs as job
set service_site_id = (
  select address.id
  from public.customer_addresses as address
  where address.customer_id = job.customer_id
    and address.is_active = true
  order by address.is_primary desc, address.created_at asc
  limit 1
)
where job.service_site_id is null;

create or replace function public.enforce_job_company_links()
returns trigger
language plpgsql
as $$
declare
  customer_company_id uuid;
  vehicle_company_id uuid;
  vehicle_customer_id uuid;
  service_site_company_id uuid;
  service_site_customer_id uuid;
  service_site_is_active boolean;
begin
  select company_id
  into customer_company_id
  from public.customers
  where id = new.customer_id;

  if customer_company_id is null then
    raise exception 'customer_id % does not exist', new.customer_id;
  end if;

  if customer_company_id <> new.company_id then
    raise exception 'jobs.customer_id must belong to the same company';
  end if;

  select company_id, customer_id
  into vehicle_company_id, vehicle_customer_id
  from public.vehicles
  where id = new.vehicle_id;

  if vehicle_company_id is null then
    raise exception 'vehicle_id % does not exist', new.vehicle_id;
  end if;

  if vehicle_company_id <> new.company_id then
    raise exception 'jobs.vehicle_id must belong to the same company';
  end if;

  if vehicle_customer_id <> new.customer_id then
    raise exception 'jobs.vehicle_id must belong to jobs.customer_id';
  end if;

  if new.service_site_id is not null then
    select company_id, customer_id, is_active
    into service_site_company_id, service_site_customer_id, service_site_is_active
    from public.customer_addresses
    where id = new.service_site_id;

    if service_site_company_id is null then
      raise exception 'service_site_id % does not exist', new.service_site_id;
    end if;

    if service_site_company_id <> new.company_id then
      raise exception 'jobs.service_site_id must belong to the same company';
    end if;

    if service_site_customer_id <> new.customer_id then
      raise exception 'jobs.service_site_id must belong to jobs.customer_id';
    end if;

    if service_site_is_active is false then
      raise exception 'jobs.service_site_id must reference an active service site';
    end if;
  end if;

  return new;
end;
$$;
