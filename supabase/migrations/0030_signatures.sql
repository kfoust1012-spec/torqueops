create table public.signatures (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  job_id uuid not null references public.jobs (id) on delete cascade,
  estimate_id uuid not null references public.estimates (id) on delete cascade,
  signed_by_name text not null,
  statement text not null,
  storage_bucket text not null,
  storage_path text not null,
  mime_type text not null,
  file_size_bytes integer not null,
  captured_by_user_id uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint signatures_signed_by_name_not_blank check (btrim(signed_by_name) <> ''),
  constraint signatures_statement_not_blank check (btrim(statement) <> ''),
  constraint signatures_storage_bucket_not_blank check (btrim(storage_bucket) <> ''),
  constraint signatures_storage_path_not_blank check (btrim(storage_path) <> ''),
  constraint signatures_mime_type_png check (mime_type = 'image/png'),
  constraint signatures_file_size_positive check (file_size_bytes > 0),
  constraint signatures_estimate_id_unique unique (estimate_id),
  constraint signatures_bucket_path_unique unique (storage_bucket, storage_path)
);

alter table public.estimates
  add column approval_statement text,
  add column approved_signature_id uuid,
  add column approved_by_name text,
  add constraint estimates_approved_signature_id_fkey
    foreign key (approved_signature_id)
    references public.signatures (id)
    on delete restrict,
  add constraint estimates_approval_state_check check (
    (
      status = 'accepted'
      and approved_signature_id is not null
      and approved_by_name is not null
      and btrim(approved_by_name) <> ''
      and approval_statement is not null
      and btrim(approval_statement) <> ''
      and accepted_at is not null
    )
    or (
      status <> 'accepted'
      and approved_signature_id is null
      and approved_by_name is null
      and approval_statement is null
    )
  );

create index signatures_company_id_idx on public.signatures (company_id);
create index signatures_job_id_idx on public.signatures (job_id);
create index signatures_estimate_id_idx on public.signatures (estimate_id);

create trigger signatures_set_updated_at
before update on public.signatures
for each row
execute function public.set_updated_at();

create or replace function public.enforce_signature_parent_match()
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
    raise exception 'signatures.company_id must match estimates.company_id';
  end if;

  if new.job_id <> target_estimate.job_id then
    raise exception 'signatures.job_id must match estimates.job_id';
  end if;

  return new;
end;
$$;

create or replace function public.enforce_estimate_signature_match()
returns trigger
language plpgsql
as $$
declare
  target_signature public.signatures%rowtype;
begin
  if new.approved_signature_id is null then
    return new;
  end if;

  select *
  into target_signature
  from public.signatures
  where id = new.approved_signature_id;

  if target_signature.id is null then
    raise exception 'signature % not found', new.approved_signature_id;
  end if;

  if target_signature.estimate_id <> new.id then
    raise exception 'approved signature must belong to the same estimate';
  end if;

  if target_signature.company_id <> new.company_id or target_signature.job_id <> new.job_id then
    raise exception 'approved signature must match estimate company and job';
  end if;

  return new;
end;
$$;

create trigger signatures_enforce_parent_match
before insert or update on public.signatures
for each row
execute function public.enforce_signature_parent_match();

create trigger estimates_enforce_signature_match
before update on public.estimates
for each row
execute function public.enforce_estimate_signature_match();
