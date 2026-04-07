alter table public.jobs
  add constraint jobs_scheduled_pair_check
    check (scheduled_end_at is null or scheduled_start_at is not null),
  add constraint jobs_arrival_window_pair_check
    check (arrival_window_end_at is null or arrival_window_start_at is not null);

create or replace function public.enforce_job_mutability()
returns trigger
language plpgsql
as $$
begin
  if old.is_active = false then
    raise exception 'archived jobs cannot be modified';
  end if;

  return new;
end;
$$;

create or replace function public.enforce_job_note_job_is_active()
returns trigger
language plpgsql
as $$
declare
  target_job_id uuid;
  target_is_active boolean;
begin
  target_job_id := coalesce(new.job_id, old.job_id);

  select is_active
  into target_is_active
  from public.jobs
  where id = target_job_id;

  if target_is_active is null then
    raise exception 'job % not found', target_job_id;
  end if;

  if target_is_active = false then
    raise exception 'archived jobs cannot be modified';
  end if;

  return coalesce(new, old);
end;
$$;

create or replace function public.validate_job_status_change()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from old.status then
    if not public.is_valid_job_status_transition(old.status, new.status) then
      raise exception 'invalid job status transition from % to %', old.status, new.status;
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.log_job_status_change()
returns trigger
language plpgsql
as $$
declare
  change_reason text;
begin
  if new.status is distinct from old.status then
    change_reason := nullif(current_setting('app.job_status_change_reason', true), '');

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
      old.status,
      new.status,
      coalesce(auth.uid(), new.created_by_user_id),
      change_reason
    );
  end if;

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

create trigger jobs_enforce_mutability
before update on public.jobs
for each row
when (old.is_active = false)
execute function public.enforce_job_mutability();

create trigger jobs_validate_status_change
before update on public.jobs
for each row
when (new.status is distinct from old.status)
execute function public.validate_job_status_change();

create trigger jobs_log_status_change
after update on public.jobs
for each row
when (new.status is distinct from old.status)
execute function public.log_job_status_change();

create trigger job_notes_require_active_job
before insert or update or delete on public.job_notes
for each row
execute function public.enforce_job_note_job_is_active();
