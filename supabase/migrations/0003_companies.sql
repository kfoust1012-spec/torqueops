create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug extensions.citext not null unique,
  owner_user_id uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint companies_slug_format check (slug::text ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

create index companies_owner_user_id_idx on public.companies (owner_user_id);

create trigger companies_set_updated_at
before update on public.companies
for each row
execute function public.set_updated_at();

create or replace function public.prevent_company_owner_change()
returns trigger
language plpgsql
as $$
begin
  if new.owner_user_id <> old.owner_user_id then
    raise exception 'owner_user_id is immutable';
  end if;

  return new;
end;
$$;

create trigger companies_prevent_owner_change
before update on public.companies
for each row
execute function public.prevent_company_owner_change();

alter table public.profiles
  add constraint profiles_default_company_id_fkey
  foreign key (default_company_id)
  references public.companies (id)
  on delete set null;

create index profiles_default_company_id_idx on public.profiles (default_company_id);
