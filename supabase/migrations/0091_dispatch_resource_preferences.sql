create table public.dispatch_resource_preferences (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  technician_user_id uuid not null references public.profiles(id),
  lane_order integer not null default 0,
  lane_color text null check (lane_color is null or lane_color ~ '^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$'),
  is_visible_by_default boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (company_id, technician_user_id)
);

create index dispatch_resource_preferences_company_lane_idx
on public.dispatch_resource_preferences (company_id, lane_order, created_at);

create trigger set_dispatch_resource_preferences_updated_at
before update on public.dispatch_resource_preferences
for each row
execute function public.set_updated_at();
