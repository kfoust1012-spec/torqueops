create type public.job_status as enum (
  'new',
  'scheduled',
  'dispatched',
  'in_progress',
  'completed',
  'canceled'
);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete restrict,
  vehicle_id uuid not null references public.vehicles (id) on delete restrict,
  status public.job_status not null default 'new',
  title text not null,
  description text,
  customer_concern text,
  internal_summary text,
  scheduled_start_at timestamptz,
  scheduled_end_at timestamptz,
  arrival_window_start_at timestamptz,
  arrival_window_end_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  canceled_at timestamptz,
  assigned_technician_user_id uuid references auth.users (id) on delete set null,
  priority text not null default 'normal',
  source text not null default 'office',
  is_active boolean not null default true,
  created_by_user_id uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint jobs_title_not_blank check (btrim(title) <> ''),
  constraint jobs_priority_check check (priority in ('low', 'normal', 'high', 'urgent')),
  constraint jobs_source_check check (source in ('office', 'phone', 'web')),
  constraint jobs_scheduled_range_check check (
    scheduled_end_at is null
    or scheduled_start_at is null
    or scheduled_end_at >= scheduled_start_at
  ),
  constraint jobs_arrival_window_range_check check (
    arrival_window_end_at is null
    or arrival_window_start_at is null
    or arrival_window_end_at >= arrival_window_start_at
  )
);

create index jobs_company_id_idx on public.jobs (company_id);
create index jobs_customer_id_idx on public.jobs (customer_id);
create index jobs_vehicle_id_idx on public.jobs (vehicle_id);
create index jobs_status_idx on public.jobs (company_id, status);
create index jobs_assigned_technician_idx on public.jobs (company_id, assigned_technician_user_id);
create index jobs_scheduled_start_idx on public.jobs (company_id, scheduled_start_at desc);
create index jobs_created_at_idx on public.jobs (company_id, created_at desc);

create trigger jobs_set_updated_at
before update on public.jobs
for each row
execute function public.set_updated_at();
