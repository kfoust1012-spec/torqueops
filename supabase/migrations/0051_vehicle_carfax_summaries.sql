create table public.vehicle_carfax_summaries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  vehicle_id uuid not null references public.vehicles (id) on delete cascade,
  vin_snapshot text not null,
  status text not null,
  summary jsonb,
  fetched_at timestamptz,
  last_attempted_at timestamptz not null default timezone('utc', now()),
  next_eligible_refresh_at timestamptz not null default timezone('utc', now()),
  last_error_message text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint vehicle_carfax_summaries_vehicle_unique unique (vehicle_id),
  constraint vehicle_carfax_summaries_vin_format_check
    check (vin_snapshot ~ '^[A-HJ-NPR-Z0-9]{17}$'),
  constraint vehicle_carfax_summaries_status_check
    check (status in ('ready', 'not_available', 'provider_error')),
  constraint vehicle_carfax_summaries_summary_object_check
    check (summary is null or jsonb_typeof(summary) = 'object')
);

create index vehicle_carfax_summaries_company_id_idx
  on public.vehicle_carfax_summaries (company_id);

create index vehicle_carfax_summaries_vehicle_status_idx
  on public.vehicle_carfax_summaries (vehicle_id, status);

create or replace function public.enforce_vehicle_carfax_summary_company_match()
returns trigger
language plpgsql
as $$
declare
  parent_company_id uuid;
begin
  select company_id
  into parent_company_id
  from public.vehicles
  where id = new.vehicle_id;

  if parent_company_id is null then
    raise exception 'vehicle_id % does not exist', new.vehicle_id;
  end if;

  if new.company_id <> parent_company_id then
    raise exception 'vehicle_carfax_summaries.company_id must match vehicles.company_id';
  end if;

  return new;
end;
$$;

create trigger vehicle_carfax_summaries_company_match
before insert or update on public.vehicle_carfax_summaries
for each row
execute function public.enforce_vehicle_carfax_summary_company_match();

create trigger vehicle_carfax_summaries_set_updated_at
before update on public.vehicle_carfax_summaries
for each row
execute function public.set_updated_at();

alter table public.vehicle_carfax_summaries enable row level security;

create policy "vehicle_carfax_summaries_select_members"
on public.vehicle_carfax_summaries
for select
to authenticated
using (public.is_company_member(company_id));

create policy "vehicle_carfax_summaries_insert_office"
on public.vehicle_carfax_summaries
for insert
to authenticated
with check (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "vehicle_carfax_summaries_update_office"
on public.vehicle_carfax_summaries
for update
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]))
with check (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "vehicle_carfax_summaries_delete_office"
on public.vehicle_carfax_summaries
for delete
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));
