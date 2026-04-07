create type public.data_import_run_status as enum (
  'queued',
  'processing',
  'paused',
  'completed',
  'failed',
  'canceled'
);

create table public.data_import_runs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  source_account_id uuid not null references public.migration_source_accounts (id) on delete cascade,
  provider public.migration_source_provider not null,
  status public.data_import_run_status not null default 'queued',
  started_by_user_id uuid not null references public.profiles (id) on delete restrict,
  options_json jsonb not null default '{}'::jsonb,
  summary_json jsonb not null default '{}'::jsonb,
  started_at timestamptz,
  finished_at timestamptz,
  last_heartbeat_at timestamptz,
  last_error_message text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index data_import_runs_company_idx
on public.data_import_runs (company_id, created_at desc);

create index data_import_runs_source_account_idx
on public.data_import_runs (source_account_id, created_at desc);

create trigger data_import_runs_set_updated_at
before update on public.data_import_runs
for each row
execute function public.set_updated_at();
