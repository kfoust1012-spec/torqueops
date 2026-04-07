create type public.attachment_category as enum (
  'general',
  'before',
  'after',
  'issue',
  'inspection'
);

create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  job_id uuid not null references public.jobs (id) on delete cascade,
  inspection_id uuid references public.inspections (id) on delete cascade,
  inspection_item_id uuid references public.inspection_items (id) on delete set null,
  uploaded_by_user_id uuid not null references auth.users (id) on delete restrict,
  storage_bucket text not null,
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  file_size_bytes integer not null,
  category public.attachment_category not null default 'general',
  caption text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint attachments_file_size_positive check (file_size_bytes > 0),
  constraint attachments_storage_bucket_not_blank check (btrim(storage_bucket) <> ''),
  constraint attachments_storage_path_not_blank check (btrim(storage_path) <> ''),
  constraint attachments_file_name_not_blank check (btrim(file_name) <> ''),
  constraint attachments_mime_type_not_blank check (btrim(mime_type) <> ''),
  constraint attachments_inspection_category_parent_check check (
    category <> 'inspection'
    or inspection_id is not null
    or inspection_item_id is not null
  )
);

create unique index attachments_bucket_path_unique_idx
  on public.attachments (storage_bucket, storage_path);
create index attachments_company_id_idx on public.attachments (company_id);
create index attachments_job_id_idx on public.attachments (job_id, created_at desc);
create index attachments_inspection_id_idx on public.attachments (inspection_id, created_at desc);
create index attachments_inspection_item_id_idx on public.attachments (inspection_item_id, created_at desc);

create trigger attachments_set_updated_at
before update on public.attachments
for each row
execute function public.set_updated_at();

create or replace function public.enforce_attachment_parent_match()
returns trigger
language plpgsql
as $$
declare
  target_job public.jobs%rowtype;
  target_inspection public.inspections%rowtype;
  target_item public.inspection_items%rowtype;
begin
  select *
  into target_job
  from public.jobs
  where id = new.job_id;

  if target_job.id is null then
    raise exception 'job % not found', new.job_id;
  end if;

  if new.company_id <> target_job.company_id then
    raise exception 'attachments.company_id must match jobs.company_id';
  end if;

  if new.inspection_id is not null then
    select *
    into target_inspection
    from public.inspections
    where id = new.inspection_id;

    if target_inspection.id is null then
      raise exception 'inspection % not found', new.inspection_id;
    end if;

    if target_inspection.company_id <> new.company_id or target_inspection.job_id <> new.job_id then
      raise exception 'attachments inspection linkage must match company and job';
    end if;
  end if;

  if new.inspection_item_id is not null then
    select *
    into target_item
    from public.inspection_items
    where id = new.inspection_item_id;

    if target_item.id is null then
      raise exception 'inspection item % not found', new.inspection_item_id;
    end if;

    if target_item.company_id <> new.company_id or target_item.job_id <> new.job_id then
      raise exception 'attachments inspection item linkage must match company and job';
    end if;

    if new.inspection_id is not null and target_item.inspection_id <> new.inspection_id then
      raise exception 'attachments inspection_item_id must belong to inspection_id';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.prevent_archived_job_attachment_mutation()
returns trigger
language plpgsql
as $$
declare
  target_job_id uuid;
  target_is_active boolean;
begin
  target_job_id := coalesce(new.job_id, old.job_id);

  select is_active
  into target_is_active
  from public.jobs
  where id = target_job_id;

  if target_is_active is null then
    raise exception 'job % not found', target_job_id;
  end if;

  if target_is_active = false then
    raise exception 'archived jobs cannot be modified';
  end if;

  return coalesce(new, old);
end;
$$;

create trigger attachments_enforce_parent_match
before insert or update on public.attachments
for each row
execute function public.enforce_attachment_parent_match();

create trigger attachments_prevent_archived_job_mutation
before insert or update or delete on public.attachments
for each row
execute function public.prevent_archived_job_attachment_mutation();
