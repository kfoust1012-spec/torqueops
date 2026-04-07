create type public.data_import_entity_type as enum (
  'customer',
  'customer_address',
  'vehicle',
  'order'
);

create type public.data_import_checkpoint_status as enum (
  'pending',
  'processing',
  'completed',
  'failed'
);

create table public.external_record_mappings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  provider public.migration_source_provider not null,
  entity_type public.data_import_entity_type not null,
  external_id text not null,
  internal_table text not null,
  internal_id uuid not null,
  payload_hash text not null,
  source_updated_at timestamptz,
  last_import_run_id uuid references public.data_import_runs (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint external_record_mappings_company_provider_entity_external_unique unique (
    company_id,
    provider,
    entity_type,
    external_id
  ),
  constraint external_record_mappings_external_id_not_blank check (btrim(external_id) <> ''),
  constraint external_record_mappings_internal_table_not_blank check (btrim(internal_table) <> ''),
  constraint external_record_mappings_payload_hash_not_blank check (btrim(payload_hash) <> '')
);

create index external_record_mappings_internal_lookup_idx
on public.external_record_mappings (company_id, internal_table, internal_id);

create trigger external_record_mappings_set_updated_at
before update on public.external_record_mappings
for each row
execute function public.set_updated_at();

create table public.data_import_checkpoints (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.data_import_runs (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  entity_type public.data_import_entity_type not null,
  status public.data_import_checkpoint_status not null default 'pending',
  cursor_json jsonb not null default '{}'::jsonb,
  processed_count integer not null default 0,
  failed_count integer not null default 0,
  last_error_message text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint data_import_checkpoints_run_entity_unique unique (run_id, entity_type)
);

create index data_import_checkpoints_company_idx
on public.data_import_checkpoints (company_id, run_id, entity_type);

create trigger data_import_checkpoints_set_updated_at
before update on public.data_import_checkpoints
for each row
execute function public.set_updated_at();
