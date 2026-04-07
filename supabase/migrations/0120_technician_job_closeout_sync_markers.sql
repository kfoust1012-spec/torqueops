create table if not exists public.technician_job_closeout_sync_markers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  job_id uuid not null references public.jobs (id) on delete cascade,
  technician_user_id uuid not null,
  has_pending_inspection_sync boolean not null default false,
  has_pending_attachment_sync boolean not null default false,
  has_pending_closeout_sync boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (company_id, job_id, technician_user_id)
);

create index if not exists technician_job_closeout_sync_markers_job_idx
  on public.technician_job_closeout_sync_markers (job_id);

create index if not exists technician_job_closeout_sync_markers_pending_idx
  on public.technician_job_closeout_sync_markers (has_pending_closeout_sync, updated_at desc);

alter table public.technician_job_closeout_sync_markers enable row level security;
