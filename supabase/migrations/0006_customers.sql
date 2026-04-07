create table public.customers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  first_name text not null,
  last_name text not null,
  email extensions.citext,
  phone text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index customers_company_id_idx on public.customers (company_id);
create index customers_company_last_name_idx on public.customers (company_id, last_name, first_name);
create unique index customers_company_email_unique_idx
  on public.customers (company_id, email)
  where email is not null;

create trigger customers_set_updated_at
before update on public.customers
for each row
execute function public.set_updated_at();
