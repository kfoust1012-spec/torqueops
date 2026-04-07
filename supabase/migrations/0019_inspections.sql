create type public.inspection_status as enum ('draft', 'in_progress', 'completed');
create type public.inspection_item_status as enum ('pass', 'attention', 'fail', 'not_checked');
create type public.finding_severity as enum ('low', 'medium', 'high', 'critical');

create table public.inspections (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  job_id uuid not null references public.jobs (id) on delete cascade,
  status public.inspection_status not null default 'draft',
  template_version text not null,
  started_by_user_id uuid not null references auth.users (id) on delete restrict,
  completed_by_user_id uuid references auth.users (id) on delete set null,
  started_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint inspections_job_id_unique unique (job_id),
  constraint inspections_template_version_not_blank check (btrim(template_version) <> '')
);

create index inspections_company_id_idx on public.inspections (company_id);
create index inspections_job_id_idx on public.inspections (job_id);
create index inspections_status_idx on public.inspections (company_id, status);

create table public.inspection_items (
  id uuid primary key default gen_random_uuid(),
  inspection_id uuid not null references public.inspections (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  job_id uuid not null references public.jobs (id) on delete cascade,
  section_key text not null,
  item_key text not null,
  label text not null,
  position integer not null,
  status public.inspection_item_status not null default 'not_checked',
  finding_severity public.finding_severity,
  technician_notes text,
  recommendation text,
  is_required boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint inspection_items_inspection_item_unique unique (inspection_id, item_key),
  constraint inspection_items_section_key_not_blank check (btrim(section_key) <> ''),
  constraint inspection_items_item_key_not_blank check (btrim(item_key) <> ''),
  constraint inspection_items_label_not_blank check (btrim(label) <> ''),
  constraint inspection_items_position_nonnegative check (position >= 0),
  constraint inspection_items_status_severity_check check (
    (status in ('attention', 'fail') and finding_severity is not null)
    or (status in ('pass', 'not_checked') and finding_severity is null)
  )
);

create index inspection_items_inspection_id_idx
  on public.inspection_items (inspection_id, section_key, position);
create index inspection_items_job_id_idx on public.inspection_items (job_id);
create index inspection_items_company_id_idx on public.inspection_items (company_id);

create or replace function public.enforce_inspection_company_match()
returns trigger
language plpgsql
as $$
declare
  parent_company_id uuid;
begin
  select company_id
  into parent_company_id
  from public.jobs
  where id = new.job_id;

  if parent_company_id is null then
    raise exception 'job_id % does not exist', new.job_id;
  end if;

  if new.company_id <> parent_company_id then
    raise exception 'inspections.company_id must match jobs.company_id';
  end if;

  return new;
end;
$$;

create or replace function public.enforce_inspection_item_parent_match()
returns trigger
language plpgsql
as $$
declare
  parent_company_id uuid;
  parent_job_id uuid;
begin
  select company_id, job_id
  into parent_company_id, parent_job_id
  from public.inspections
  where id = new.inspection_id;

  if parent_company_id is null then
    raise exception 'inspection_id % does not exist', new.inspection_id;
  end if;

  if new.company_id <> parent_company_id then
    raise exception 'inspection_items.company_id must match inspections.company_id';
  end if;

  if new.job_id <> parent_job_id then
    raise exception 'inspection_items.job_id must match inspections.job_id';
  end if;

  return new;
end;
$$;

create or replace function public.set_inspection_completed_at()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'completed' and old.status is distinct from new.status and new.completed_at is null then
    new.completed_at = timezone('utc', now());
  end if;

  return new;
end;
$$;

create or replace function public.prevent_completed_inspection_mutation()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'completed' then
    raise exception 'completed inspections cannot be modified';
  end if;

  return new;
end;
$$;

create or replace function public.prevent_completed_inspection_item_mutation()
returns trigger
language plpgsql
as $$
declare
  target_inspection_id uuid;
  inspection_status public.inspection_status;
begin
  target_inspection_id := coalesce(new.inspection_id, old.inspection_id);

  select status
  into inspection_status
  from public.inspections
  where id = target_inspection_id;

  if inspection_status is null then
    raise exception 'inspection % not found', target_inspection_id;
  end if;

  if inspection_status = 'completed' then
    raise exception 'completed inspections cannot be modified';
  end if;

  return coalesce(new, old);
end;
$$;

create trigger inspections_set_updated_at
before update on public.inspections
for each row
execute function public.set_updated_at();

create trigger inspection_items_set_updated_at
before update on public.inspection_items
for each row
execute function public.set_updated_at();

create trigger inspections_company_match
before insert or update on public.inspections
for each row
execute function public.enforce_inspection_company_match();

create trigger inspection_items_parent_match
before insert or update on public.inspection_items
for each row
execute function public.enforce_inspection_item_parent_match();

create trigger inspections_set_completed_at
before update on public.inspections
for each row
execute function public.set_inspection_completed_at();

create trigger inspections_prevent_completed_mutation
before update on public.inspections
for each row
when (old.status = 'completed')
execute function public.prevent_completed_inspection_mutation();

create trigger inspection_items_prevent_completed_mutation
before insert or update or delete on public.inspection_items
for each row
execute function public.prevent_completed_inspection_item_mutation();
