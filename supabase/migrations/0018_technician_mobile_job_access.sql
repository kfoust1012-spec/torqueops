drop policy if exists "jobs_select_members" on public.jobs;
drop policy if exists "job_notes_select_members" on public.job_notes;
drop policy if exists "job_status_history_select_members" on public.job_status_history;
drop policy if exists "jobs_update_assigned_technician" on public.jobs;

create or replace function public.is_assigned_technician_job(target_job_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.jobs job
    where job.id = target_job_id
      and job.assigned_technician_user_id = auth.uid()
      and job.is_active = true
  );
$$;

create or replace function public.is_valid_assigned_technician_job_transition(
  current_status public.job_status,
  next_status public.job_status
)
returns boolean
language sql
immutable
as $$
  select case
    when current_status = 'scheduled' and next_status = 'in_progress' then true
    when current_status = 'dispatched' and next_status = 'in_progress' then true
    when current_status = 'in_progress' and next_status = 'completed' then true
    else false
  end;
$$;

create or replace function public.enforce_assigned_technician_job_update()
returns trigger
language plpgsql
as $$
begin
  if public.has_company_role(
    old.company_id,
    array['owner', 'admin', 'dispatcher']::public.app_role[]
  ) then
    return new;
  end if;

  if old.assigned_technician_user_id is distinct from auth.uid() then
    return new;
  end if;

  if new.company_id is distinct from old.company_id
    or new.customer_id is distinct from old.customer_id
    or new.vehicle_id is distinct from old.vehicle_id
    or new.title is distinct from old.title
    or new.description is distinct from old.description
    or new.customer_concern is distinct from old.customer_concern
    or new.internal_summary is distinct from old.internal_summary
    or new.scheduled_start_at is distinct from old.scheduled_start_at
    or new.scheduled_end_at is distinct from old.scheduled_end_at
    or new.arrival_window_start_at is distinct from old.arrival_window_start_at
    or new.arrival_window_end_at is distinct from old.arrival_window_end_at
    or new.assigned_technician_user_id is distinct from old.assigned_technician_user_id
    or new.priority is distinct from old.priority
    or new.source is distinct from old.source
    or new.is_active is distinct from old.is_active
    or new.created_by_user_id is distinct from old.created_by_user_id
    or new.created_at is distinct from old.created_at
  then
    raise exception 'assigned technicians may only update job status';
  end if;

  if new.status is distinct from old.status
    and not public.is_valid_assigned_technician_job_transition(old.status, new.status)
  then
    raise exception 'assigned technicians cannot move job status from % to %', old.status, new.status;
  end if;

  return new;
end;
$$;

create or replace function public.change_assigned_job_status(
  target_job_id uuid,
  next_status public.job_status,
  change_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_job public.jobs%rowtype;
begin
  select *
  into current_job
  from public.jobs
  where id = target_job_id;

  if current_job.id is null then
    raise exception 'job % not found', target_job_id;
  end if;

  if current_job.is_active = false then
    raise exception 'archived jobs cannot be modified';
  end if;

  if current_job.assigned_technician_user_id is distinct from auth.uid() then
    raise exception 'job % is not assigned to the current technician', target_job_id;
  end if;

  if not public.has_company_role(
    current_job.company_id,
    array['owner', 'admin', 'technician']::public.app_role[]
  ) then
    raise exception 'current user no longer has technician access to this company';
  end if;

  if not public.is_valid_assigned_technician_job_transition(current_job.status, next_status) then
    raise exception 'invalid assigned technician status transition from % to %', current_job.status, next_status;
  end if;

  perform set_config(
    'app.job_status_change_reason',
    coalesce(nullif(btrim(change_reason), ''), ''),
    true
  );

  update public.jobs
  set status = next_status
  where id = target_job_id;
end;
$$;

create policy "jobs_select_office"
on public.jobs
for select
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "jobs_select_assigned_technician"
on public.jobs
for select
to authenticated
using (
  assigned_technician_user_id = auth.uid()
  and public.has_company_role(company_id, array['owner', 'admin', 'technician']::public.app_role[])
);

create policy "job_notes_select_office"
on public.job_notes
for select
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "job_notes_select_assigned_technician"
on public.job_notes
for select
to authenticated
using (
  public.has_company_role(company_id, array['owner', 'admin', 'technician']::public.app_role[])
  and public.is_assigned_technician_job(job_id)
);

create policy "job_notes_insert_assigned_technician"
on public.job_notes
for insert
to authenticated
with check (
  author_user_id = auth.uid()
  and is_internal = true
  and public.has_company_role(company_id, array['owner', 'admin', 'technician']::public.app_role[])
  and public.is_assigned_technician_job(job_id)
);

create policy "job_status_history_select_office"
on public.job_status_history
for select
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "job_status_history_select_assigned_technician"
on public.job_status_history
for select
to authenticated
using (
  public.has_company_role(company_id, array['owner', 'admin', 'technician']::public.app_role[])
  and public.is_assigned_technician_job(job_id)
);

drop trigger if exists jobs_enforce_assigned_technician_update on public.jobs;

create trigger jobs_enforce_assigned_technician_update
before update on public.jobs
for each row
execute function public.enforce_assigned_technician_job_update();
