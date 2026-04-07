create type public.app_role as enum ('owner', 'admin', 'dispatcher', 'technician');

create table public.company_memberships (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.app_role not null,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint company_memberships_company_user_unique unique (company_id, user_id)
);

create index company_memberships_company_id_idx on public.company_memberships (company_id);
create index company_memberships_user_id_idx on public.company_memberships (user_id);

create trigger company_memberships_set_updated_at
before update on public.company_memberships
for each row
execute function public.set_updated_at();
