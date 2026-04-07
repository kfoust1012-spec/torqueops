create type public.estimate_section_source as enum (
  'manual',
  'labor_suggestion',
  'service_package'
);

create table public.estimate_sections (
  id uuid primary key default gen_random_uuid(),
  estimate_id uuid not null references public.estimates (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  job_id uuid not null references public.jobs (id) on delete cascade,
  position integer not null,
  title text not null,
  description text,
  notes text,
  source public.estimate_section_source not null default 'manual',
  source_ref text,
  created_by_user_id uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint estimate_sections_position_nonnegative check (position >= 0),
  constraint estimate_sections_title_not_blank check (btrim(title) <> ''),
  constraint estimate_sections_estimate_position_unique unique (estimate_id, position)
);

alter table public.estimate_line_items
  add column estimate_section_id uuid references public.estimate_sections (id) on delete set null;

create table public.estimate_service_packages (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null,
  description text,
  notes text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_by_user_id uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint estimate_service_packages_name_not_blank check (btrim(name) <> ''),
  constraint estimate_service_packages_sort_order_nonnegative check (sort_order >= 0)
);

create table public.estimate_service_package_lines (
  id uuid primary key default gen_random_uuid(),
  service_package_id uuid not null references public.estimate_service_packages (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  position integer not null,
  item_type text not null,
  name text not null,
  description text,
  quantity numeric(12, 2) not null default 1,
  unit_price_cents integer not null default 0,
  taxable boolean not null default true,
  manufacturer text,
  part_number text,
  supplier_sku text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint estimate_service_package_lines_position_nonnegative check (position >= 0),
  constraint estimate_service_package_lines_item_type_valid check (item_type in ('labor', 'part', 'fee')),
  constraint estimate_service_package_lines_name_not_blank check (btrim(name) <> ''),
  constraint estimate_service_package_lines_quantity_positive check (quantity > 0),
  constraint estimate_service_package_lines_unit_price_nonnegative check (unit_price_cents >= 0),
  constraint estimate_service_package_lines_unique_position unique (service_package_id, position)
);

create index estimate_sections_estimate_id_idx
on public.estimate_sections (estimate_id, position);

create index estimate_sections_company_id_idx
on public.estimate_sections (company_id);

create index estimate_sections_job_id_idx
on public.estimate_sections (job_id);

create index estimate_line_items_estimate_section_id_idx
on public.estimate_line_items (estimate_section_id, position);

create index estimate_service_packages_company_id_idx
on public.estimate_service_packages (company_id, is_active, sort_order, name);

create index estimate_service_package_lines_package_id_idx
on public.estimate_service_package_lines (service_package_id, position);

create or replace function public.enforce_estimate_section_parent_match()
returns trigger
language plpgsql
as $$
declare
  target_estimate public.estimates%rowtype;
begin
  select *
  into target_estimate
  from public.estimates
  where id = new.estimate_id;

  if target_estimate.id is null then
    raise exception 'estimate % not found', new.estimate_id;
  end if;

  if new.company_id <> target_estimate.company_id then
    raise exception 'estimate_sections.company_id must match estimates.company_id';
  end if;

  if new.job_id <> target_estimate.job_id then
    raise exception 'estimate_sections.job_id must match estimates.job_id';
  end if;

  return new;
end;
$$;

create or replace function public.enforce_estimate_service_package_line_parent_match()
returns trigger
language plpgsql
as $$
declare
  target_package public.estimate_service_packages%rowtype;
begin
  select *
  into target_package
  from public.estimate_service_packages
  where id = new.service_package_id;

  if target_package.id is null then
    raise exception 'estimate service package % not found', new.service_package_id;
  end if;

  if new.company_id <> target_package.company_id then
    raise exception 'estimate_service_package_lines.company_id must match estimate_service_packages.company_id';
  end if;

  return new;
end;
$$;

create or replace function public.enforce_estimate_line_item_parent_match()
returns trigger
language plpgsql
as $$
declare
  target_estimate public.estimates%rowtype;
  target_section public.estimate_sections%rowtype;
begin
  select *
  into target_estimate
  from public.estimates
  where id = new.estimate_id;

  if target_estimate.id is null then
    raise exception 'estimate % not found', new.estimate_id;
  end if;

  if new.company_id <> target_estimate.company_id then
    raise exception 'estimate_line_items.company_id must match estimates.company_id';
  end if;

  if new.job_id <> target_estimate.job_id then
    raise exception 'estimate_line_items.job_id must match estimates.job_id';
  end if;

  if new.estimate_section_id is not null then
    select *
    into target_section
    from public.estimate_sections
    where id = new.estimate_section_id;

    if target_section.id is null then
      raise exception 'estimate section % not found', new.estimate_section_id;
    end if;

    if target_section.estimate_id <> new.estimate_id then
      raise exception 'estimate_line_items.estimate_section_id must belong to the same estimate';
    end if;

    if target_section.company_id <> new.company_id then
      raise exception 'estimate_line_items.estimate_section_id must belong to the same company';
    end if;

    if target_section.job_id <> new.job_id then
      raise exception 'estimate_line_items.estimate_section_id must belong to the same job';
    end if;
  end if;

  return new;
end;
$$;

create trigger estimate_sections_set_updated_at
before update on public.estimate_sections
for each row
execute function public.set_updated_at();

create trigger estimate_service_packages_set_updated_at
before update on public.estimate_service_packages
for each row
execute function public.set_updated_at();

create trigger estimate_service_package_lines_set_updated_at
before update on public.estimate_service_package_lines
for each row
execute function public.set_updated_at();

create trigger estimate_sections_enforce_parent_match
before insert or update on public.estimate_sections
for each row
execute function public.enforce_estimate_section_parent_match();

create trigger estimate_sections_prevent_terminal_mutation
before insert or update or delete on public.estimate_sections
for each row
execute function public.prevent_terminal_estimate_line_item_mutation();

create trigger estimate_service_package_lines_enforce_parent_match
before insert or update on public.estimate_service_package_lines
for each row
execute function public.enforce_estimate_service_package_line_parent_match();

alter table public.estimate_sections enable row level security;
alter table public.estimate_service_packages enable row level security;
alter table public.estimate_service_package_lines enable row level security;

create policy "estimate_sections_select_office"
on public.estimate_sections
for select
to authenticated
using (
  public.has_company_role(
    company_id,
    array['owner', 'admin', 'dispatcher']::public.app_role[]
  )
);

create policy "estimate_sections_select_assigned_technician"
on public.estimate_sections
for select
to authenticated
using (public.is_assigned_technician_estimate(estimate_id));

create policy "estimate_sections_insert_office"
on public.estimate_sections
for insert
to authenticated
with check (
  created_by_user_id = auth.uid()
  and public.has_company_role(
    company_id,
    array['owner', 'admin', 'dispatcher']::public.app_role[]
  )
);

create policy "estimate_sections_update_office"
on public.estimate_sections
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

create policy "estimate_sections_delete_office"
on public.estimate_sections
for delete
to authenticated
using (
  public.has_company_role(
    company_id,
    array['owner', 'admin', 'dispatcher']::public.app_role[]
  )
);

create policy "estimate_service_packages_select_office"
on public.estimate_service_packages
for select
to authenticated
using (
  public.has_company_role(
    company_id,
    array['owner', 'admin', 'dispatcher']::public.app_role[]
  )
);

create policy "estimate_service_packages_insert_office"
on public.estimate_service_packages
for insert
to authenticated
with check (
  created_by_user_id = auth.uid()
  and public.has_company_role(
    company_id,
    array['owner', 'admin', 'dispatcher']::public.app_role[]
  )
);

create policy "estimate_service_packages_update_office"
on public.estimate_service_packages
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

create policy "estimate_service_packages_delete_office"
on public.estimate_service_packages
for delete
to authenticated
using (
  public.has_company_role(
    company_id,
    array['owner', 'admin', 'dispatcher']::public.app_role[]
  )
);

create policy "estimate_service_package_lines_select_office"
on public.estimate_service_package_lines
for select
to authenticated
using (
  public.has_company_role(
    company_id,
    array['owner', 'admin', 'dispatcher']::public.app_role[]
  )
);

create policy "estimate_service_package_lines_insert_office"
on public.estimate_service_package_lines
for insert
to authenticated
with check (
  public.has_company_role(
    company_id,
    array['owner', 'admin', 'dispatcher']::public.app_role[]
  )
);

create policy "estimate_service_package_lines_update_office"
on public.estimate_service_package_lines
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

create policy "estimate_service_package_lines_delete_office"
on public.estimate_service_package_lines
for delete
to authenticated
using (
  public.has_company_role(
    company_id,
    array['owner', 'admin', 'dispatcher']::public.app_role[]
  )
);
