create table public.technician_location_pings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  technician_user_id uuid not null references auth.users (id) on delete cascade,
  latitude double precision not null,
  longitude double precision not null,
  accuracy_meters double precision,
  altitude_meters double precision,
  heading_degrees double precision,
  speed_meters_per_second double precision,
  source text not null default 'mobile_app',
  captured_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  constraint technician_location_pings_latitude_check check (latitude >= -90 and latitude <= 90),
  constraint technician_location_pings_longitude_check check (longitude >= -180 and longitude <= 180),
  constraint technician_location_pings_accuracy_check check (
    accuracy_meters is null or accuracy_meters >= 0
  ),
  constraint technician_location_pings_heading_check check (
    heading_degrees is null or (heading_degrees >= 0 and heading_degrees <= 360)
  ),
  constraint technician_location_pings_source_check check (
    source in ('mobile_app', 'system')
  )
);

create index technician_location_pings_company_captured_idx
on public.technician_location_pings (company_id, captured_at desc);

create index technician_location_pings_technician_captured_idx
on public.technician_location_pings (technician_user_id, captured_at desc);

alter table public.technician_location_pings enable row level security;

create or replace function public.enforce_technician_location_ping_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.technician_user_id is distinct from auth.uid() then
    raise exception 'technician location pings may only be recorded for the signed-in user';
  end if;

  if not public.has_company_role(
    new.company_id,
    array['owner', 'admin', 'technician']::public.app_role[]
  ) then
    raise exception 'current user does not have technician location access for this company';
  end if;

  return new;
end;
$$;

create trigger technician_location_pings_enforce_membership
before insert on public.technician_location_pings
for each row
execute function public.enforce_technician_location_ping_membership();

create policy "technician_location_pings_select_company_members"
on public.technician_location_pings
for select
to authenticated
using (public.is_company_member(company_id));

create policy "technician_location_pings_insert_self"
on public.technician_location_pings
for insert
to authenticated
with check (
  technician_user_id = auth.uid()
  and public.has_company_role(
    company_id,
    array['owner', 'admin', 'technician']::public.app_role[]
  )
);
