create type public.dispatch_calendar_scope as enum ('all_workers', 'single_tech', 'subset');
create type public.dispatch_calendar_view as enum ('day', 'week');

create table public.dispatch_calendar_settings (
  company_id uuid primary key references public.companies(id) on delete cascade,
  week_starts_on smallint not null default 1 check (week_starts_on between 0 and 6),
  day_start_hour smallint not null default 7 check (day_start_hour between 0 and 23),
  day_end_hour smallint not null default 19 check (day_end_hour between 1 and 24 and day_end_hour > day_start_hour),
  slot_minutes smallint not null default 30 check (slot_minutes in (15, 30, 60)),
  show_saturday boolean not null default true,
  show_sunday boolean not null default false,
  default_view public.dispatch_calendar_view not null default 'day',
  updated_by_user_id uuid not null references public.profiles(id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger set_dispatch_calendar_settings_updated_at
before update on public.dispatch_calendar_settings
for each row
execute function public.set_updated_at();
