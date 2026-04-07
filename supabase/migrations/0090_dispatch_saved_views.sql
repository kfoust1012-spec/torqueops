create table public.dispatch_saved_views (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  created_by_user_id uuid not null references public.profiles(id),
  name text not null check (char_length(trim(name)) between 1 and 80),
  scope public.dispatch_calendar_scope not null default 'all_workers',
  include_unassigned boolean not null default true,
  view public.dispatch_calendar_view not null default 'day',
  is_default boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (id, company_id)
);

create index dispatch_saved_views_company_id_idx
on public.dispatch_saved_views (company_id, created_by_user_id, created_at desc);

create unique index dispatch_saved_views_default_idx
on public.dispatch_saved_views (company_id, created_by_user_id)
where is_default;

create table public.dispatch_saved_view_members (
  id uuid primary key default gen_random_uuid(),
  saved_view_id uuid not null,
  company_id uuid not null references public.companies(id) on delete cascade,
  technician_user_id uuid not null references public.profiles(id),
  display_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (saved_view_id, technician_user_id),
  foreign key (saved_view_id, company_id)
    references public.dispatch_saved_views (id, company_id)
    on delete cascade
);

create index dispatch_saved_view_members_saved_view_idx
on public.dispatch_saved_view_members (saved_view_id, display_order, created_at);

create trigger set_dispatch_saved_views_updated_at
before update on public.dispatch_saved_views
for each row
execute function public.set_updated_at();

create trigger set_dispatch_saved_view_members_updated_at
before update on public.dispatch_saved_view_members
for each row
execute function public.set_updated_at();
