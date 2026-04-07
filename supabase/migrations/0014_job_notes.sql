create table public.job_notes (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  author_user_id uuid not null references auth.users (id) on delete restrict,
  body text not null,
  is_internal boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint job_notes_body_not_blank check (btrim(body) <> '')
);

create index job_notes_job_id_idx on public.job_notes (job_id, created_at desc);
create index job_notes_company_id_idx on public.job_notes (company_id);

create trigger job_notes_set_updated_at
before update on public.job_notes
for each row
execute function public.set_updated_at();
