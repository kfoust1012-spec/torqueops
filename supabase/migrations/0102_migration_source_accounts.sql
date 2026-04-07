create type public.migration_source_provider as enum (
  'shopmonkey'
);

create type public.migration_source_account_status as enum (
  'connected',
  'action_required',
  'error',
  'disconnected'
);

create table public.migration_source_accounts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  provider public.migration_source_provider not null,
  status public.migration_source_account_status not null default 'disconnected',
  display_name text not null,
  credential_ciphertext text,
  credential_hint text,
  webhook_secret text,
  settings_json jsonb not null default '{}'::jsonb,
  capabilities_json jsonb not null default '{}'::jsonb,
  last_verified_at timestamptz,
  last_error_message text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint migration_source_accounts_company_provider_unique unique (company_id, provider),
  constraint migration_source_accounts_display_name_not_blank check (btrim(display_name) <> ''),
  constraint migration_source_accounts_credential_hint_not_blank check (
    credential_hint is null or btrim(credential_hint) <> ''
  ),
  constraint migration_source_accounts_webhook_secret_not_blank check (
    webhook_secret is null or btrim(webhook_secret) <> ''
  )
);

create index migration_source_accounts_company_idx
on public.migration_source_accounts (company_id, provider, status);

create trigger migration_source_accounts_set_updated_at
before update on public.migration_source_accounts
for each row
execute function public.set_updated_at();
