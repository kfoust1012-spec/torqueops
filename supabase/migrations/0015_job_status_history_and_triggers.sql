create table public.job_status_history (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  from_status public.job_status,
  to_status public.job_status not null,
  changed_by_user_id uuid not null references auth.users (id) on delete restrict,
  reason text,
  created_at timestamptz not null default timezone('utc', now())
);

create index job_status_history_job_id_idx on public.job_status_history (job_id, created_at desc);
create index job_status_history_company_id_idx on public.job_status_history (company_id);

create or replace function public.enforce_job_company_links()
returns trigger
language plpgsql
as $$
declare
  customer_company_id uuid;
  vehicle_company_id uuid;
  vehicle_customer_id uuid;
begin
  select company_id
  into customer_company_id
  from public.customers
  where id = new.customer_id;

  if customer_company_id is null then
    raise exception 'customer_id % does not exist', new.customer_id;
  end if;

  if customer_company_id <> new.company_id then
    raise exception 'jobs.customer_id must belong to the same company';
  end if;

  select company_id, customer_id
  into vehicle_company_id, vehicle_customer_id
  from public.vehicles
  where id = new.vehicle_id;

  if vehicle_company_id is null then
    raise exception 'vehicle_id % does not exist', new.vehicle_id;
  end if;

  if vehicle_company_id <> new.company_id then
    raise exception 'jobs.vehicle_id must belong to the same company';
  end if;

  if vehicle_customer_id <> new.customer_id then
    raise exception 'jobs.vehicle_id must belong to jobs.customer_id';
  end if;

  return new;
end;
$$;

create or replace function public.enforce_job_assigned_technician()
returns trigger
language plpgsql
as $$
begin
  if new.assigned_technician_user_id is null then
    return new;
  end if;

  if not exists (
    select 1
    from public.company_memberships membership
    where membership.company_id = new.company_id
      and membership.user_id = new.assigned_technician_user_id
      and membership.is_active = true
      and membership.role in ('owner', 'admin', 'technician')
  ) then
    raise exception 'assigned technician must be an active technician/admin/owner in the same company';
  end if;

  return new;
end;
$$;

create or replace function public.enforce_job_note_company_match()
returns trigger
language plpgsql
as $$
declare
  parent_company_id uuid;
begin
  select company_id
  into parent_company_id
  from public.jobs
  where id = new.job_id;

  if parent_company_id is null then
    raise exception 'job_id % does not exist', new.job_id;
  end if;

  if new.company_id <> parent_company_id then
    raise exception 'job_notes.company_id must match jobs.company_id';
  end if;

  return new;
end;
$$;

create or replace function public.enforce_job_status_history_company_match()
returns trigger
language plpgsql
as $$
declare
  parent_company_id uuid;
begin
  select company_id
  into parent_company_id
  from public.jobs
  where id = new.job_id;

  if parent_company_id is null then
    raise exception 'job_id % does not exist', new.job_id;
  end if;

  if new.company_id <> parent_company_id then
    raise exception 'job_status_history.company_id must match jobs.company_id';
  end if;

  return new;
end;
$$;

create or replace function public.is_valid_job_status_transition(
  current_status public.job_status,
  next_status public.job_status
)
returns boolean
language sql
immutable
as $$
  select case
    when current_status = next_status then true
    when current_status = 'new' and next_status in ('scheduled', 'dispatched', 'canceled') then true
    when current_status = 'scheduled' and next_status in ('dispatched', 'in_progress', 'canceled') then true
    when current_status = 'dispatched' and next_status in ('scheduled', 'in_progress', 'canceled') then true
    when current_status = 'in_progress' and next_status in ('completed', 'canceled') then true
    else false
  end;
$$;

create or replace function public.set_job_status_timestamps()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from old.status then
    if new.status = 'in_progress' and new.started_at is null then
      new.started_at = timezone('utc', now());
    end if;

    if new.status = 'completed' then
      if new.started_at is null then
        new.started_at = timezone('utc', now());
      end if;

      if new.completed_at is null then
        new.completed_at = timezone('utc', now());
      end if;
    end if;

    if new.status = 'canceled' and new.canceled_at is null then
      new.canceled_at = timezone('utc', now());
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.log_job_created()
returns trigger
language plpgsql
as $$
begin
  insert into public.job_status_history (
    job_id,
    company_id,
    from_status,
    to_status,
    changed_by_user_id,
    reason
  )
  values (
    new.id,
    new.company_id,
    null,
    new.status,
    new.created_by_user_id,
    'Job created'
  );

  return new;
end;
$$;

create or replace function public.change_job_status(
  target_job_id uuid,
  next_status public.job_status,
  change_reason text default null
)
returns void
language plpgsql
as $$
declare
  current_job public.jobs%rowtype;
  previous_status public.job_status;
begin
  select *
  into current_job
  from public.jobs
  where id = target_job_id;

  if current_job.id is null then
    raise exception 'job % not found', target_job_id;
  end if;

  if not public.has_company_role(
    current_job.company_id,
    array['owner', 'admin', 'dispatcher']::public.app_role[]
  ) then
    raise exception 'insufficient permissions to change job status';
  end if;

  previous_status = current_job.status;

  if not public.is_valid_job_status_transition(previous_status, next_status) then
    raise exception 'invalid job status transition from % to %', previous_status, next_status;
  end if;

  update public.jobs
  set status = next_status
  where id = target_job_id
  returning *
  into current_job;

  insert into public.job_status_history (
    job_id,
    company_id,
    from_status,
    to_status,
    changed_by_user_id,
    reason
  )
  values (
    current_job.id,
    current_job.company_id,
    previous_status,
    next_status,
    coalesce(auth.uid(), current_job.created_by_user_id),
    nullif(btrim(change_reason), '')
  );
end;
$$;

create trigger jobs_enforce_company_links
before insert or update on public.jobs
for each row
execute function public.enforce_job_company_links();

create trigger jobs_enforce_assigned_technician
before insert or update on public.jobs
for each row
execute function public.enforce_job_assigned_technician();

create trigger jobs_set_status_timestamps
before update on public.jobs
for each row
execute function public.set_job_status_timestamps();

create trigger jobs_log_created
after insert on public.jobs
for each row
execute function public.log_job_created();

create trigger job_notes_company_match
before insert or update on public.job_notes
for each row
execute function public.enforce_job_note_company_match();

create trigger job_status_history_company_match
before insert or update on public.job_status_history
for each row
execute function public.enforce_job_status_history_company_match();
