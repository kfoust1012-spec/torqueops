alter table public.companies
  add column timezone text not null default 'UTC',
  add constraint companies_timezone_not_blank check (btrim(timezone) <> '');

create table public.technician_availability_blocks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  technician_user_id uuid not null references auth.users (id) on delete cascade,
  block_type text not null,
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  is_all_day boolean not null default false,
  notes text,
  created_by_user_id uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint technician_availability_blocks_type_check check (
    block_type in ('unavailable', 'time_off', 'break', 'training')
  ),
  constraint technician_availability_blocks_title_not_blank check (btrim(title) <> ''),
  constraint technician_availability_blocks_range_check check (ends_at > starts_at)
);

create index technician_availability_blocks_company_idx
on public.technician_availability_blocks (company_id, starts_at asc);

create index technician_availability_blocks_technician_idx
on public.technician_availability_blocks (company_id, technician_user_id, starts_at asc);

create index jobs_dispatch_active_schedule_idx
on public.jobs (company_id, assigned_technician_user_id, scheduled_start_at asc)
where is_active = true
  and status in ('new', 'scheduled', 'dispatched', 'in_progress');

create index jobs_dispatch_unassigned_idx
on public.jobs (company_id, scheduled_start_at asc)
where is_active = true
  and assigned_technician_user_id is null
  and status in ('new', 'scheduled', 'dispatched', 'in_progress');

create or replace function public.enforce_technician_availability_block_membership()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1
    from public.company_memberships membership
    where membership.company_id = new.company_id
      and membership.user_id = new.technician_user_id
      and membership.is_active = true
      and membership.role in ('owner', 'admin', 'technician')
  ) then
    raise exception 'availability block technician must be an active technician/admin/owner in the same company';
  end if;

  if not exists (
    select 1
    from public.company_memberships membership
    where membership.company_id = new.company_id
      and membership.user_id = new.created_by_user_id
      and membership.is_active = true
      and membership.role in ('owner', 'admin', 'dispatcher')
  ) then
    raise exception 'availability block creator must be an active office user in the same company';
  end if;

  return new;
end;
$$;

create trigger technician_availability_blocks_set_updated_at
before update on public.technician_availability_blocks
for each row
execute function public.set_updated_at();

create trigger technician_availability_blocks_enforce_membership
before insert or update on public.technician_availability_blocks
for each row
execute function public.enforce_technician_availability_block_membership();