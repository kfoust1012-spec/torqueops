create type public.sms_provider as enum (
  'twilio',
  'telnyx'
);

create type public.sms_provider_account_status as enum (
  'connected',
  'action_required',
  'error',
  'disconnected'
);

create table public.sms_provider_accounts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  provider public.sms_provider not null,
  status public.sms_provider_account_status not null default 'disconnected',
  display_name text not null,
  username text,
  from_number text not null,
  is_default boolean not null default false,
  credential_ciphertext text,
  credential_hint text,
  settings_json jsonb not null default '{}'::jsonb,
  capabilities_json jsonb not null default '{}'::jsonb,
  last_verified_at timestamptz,
  last_error_message text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint sms_provider_accounts_company_provider_unique unique (company_id, provider),
  constraint sms_provider_accounts_display_name_not_blank check (btrim(display_name) <> ''),
  constraint sms_provider_accounts_from_number_not_blank check (btrim(from_number) <> ''),
  constraint sms_provider_accounts_from_number_e164 check (
    from_number ~ '^\+[1-9][0-9]{1,14}$'
  ),
  constraint sms_provider_accounts_username_not_blank check (
    username is null or btrim(username) <> ''
  )
);

create unique index sms_provider_accounts_company_default_unique_idx
on public.sms_provider_accounts (company_id)
where is_default;

create index sms_provider_accounts_company_idx
on public.sms_provider_accounts (company_id, provider, status);

create trigger sms_provider_accounts_set_updated_at
before update on public.sms_provider_accounts
for each row
execute function public.set_updated_at();
