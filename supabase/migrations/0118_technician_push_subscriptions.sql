create table public.technician_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  technician_user_id uuid not null,
  installation_id text not null,
  expo_push_token text not null,
  platform text not null check (platform in ('ios', 'android')),
  is_active boolean not null default true,
  last_seen_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index technician_push_subscriptions_installation_key
on public.technician_push_subscriptions (company_id, technician_user_id, installation_id);

create unique index technician_push_subscriptions_token_key
on public.technician_push_subscriptions (expo_push_token);

create index technician_push_subscriptions_user_idx
on public.technician_push_subscriptions (company_id, technician_user_id)
where is_active = true;

alter table public.technician_push_subscriptions enable row level security;

create trigger technician_push_subscriptions_set_updated_at
before update on public.technician_push_subscriptions
for each row
execute function public.set_updated_at();
