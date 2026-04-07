create or replace function public.is_assigned_technician_inspection(target_inspection_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.inspections inspection
    join public.jobs job
      on job.id = inspection.job_id
    where inspection.id = target_inspection_id
      and job.assigned_technician_user_id = auth.uid()
      and job.is_active = true
      and public.has_company_role(
        inspection.company_id,
        array['owner', 'admin', 'technician']::public.app_role[]
      )
  );
$$;

create or replace function public.create_inspection_for_job(
  target_company_id uuid,
  target_job_id uuid,
  target_template_version text,
  target_started_by_user_id uuid,
  target_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_job public.jobs%rowtype;
  existing_inspection_id uuid;
  new_inspection_id uuid;
begin
  select *
  into target_job
  from public.jobs
  where id = target_job_id;

  if target_job.id is null then
    raise exception 'job % not found', target_job_id;
  end if;

  if target_job.company_id <> target_company_id then
    raise exception 'inspection company must match job company';
  end if;

  select inspection.id
  into existing_inspection_id
  from public.inspections inspection
  where inspection.job_id = target_job_id;

  if existing_inspection_id is not null then
    return existing_inspection_id;
  end if;

  if not (
    public.has_company_role(
      target_company_id,
      array['owner', 'admin', 'dispatcher']::public.app_role[]
    )
    or (
      auth.uid() = target_started_by_user_id
      and public.is_assigned_technician_job(target_job_id)
      and public.has_company_role(
        target_company_id,
        array['owner', 'admin', 'technician']::public.app_role[]
      )
    )
  ) then
    raise exception 'insufficient permissions to create inspection for job %', target_job_id;
  end if;

  if jsonb_typeof(target_items) <> 'array' or jsonb_array_length(target_items) = 0 then
    raise exception 'inspection items payload must contain at least one item';
  end if;

  insert into public.inspections (
    company_id,
    job_id,
    status,
    template_version,
    started_by_user_id
  )
  values (
    target_company_id,
    target_job_id,
    'in_progress',
    target_template_version,
    target_started_by_user_id
  )
  returning id into new_inspection_id;

  insert into public.inspection_items (
    inspection_id,
    company_id,
    job_id,
    section_key,
    item_key,
    label,
    position,
    status,
    finding_severity,
    technician_notes,
    recommendation,
    is_required
  )
  select
    new_inspection_id,
    record.company_id,
    record.job_id,
    record.section_key,
    record.item_key,
    record.label,
    record.position,
    record.status,
    record.finding_severity,
    record.technician_notes,
    record.recommendation,
    record.is_required
  from jsonb_to_recordset(target_items) as record(
    company_id uuid,
    job_id uuid,
    section_key text,
    item_key text,
    label text,
    position integer,
    status public.inspection_item_status,
    finding_severity public.finding_severity,
    technician_notes text,
    recommendation text,
    is_required boolean
  );

  return new_inspection_id;
end;
$$;

create or replace function public.update_assigned_inspection_item(
  target_inspection_item_id uuid,
  next_status public.inspection_item_status,
  next_finding_severity public.finding_severity default null,
  next_technician_notes text default null,
  next_recommendation text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_item public.inspection_items%rowtype;
  target_job public.jobs%rowtype;
begin
  select item.*
  into target_item
  from public.inspection_items item
  where item.id = target_inspection_item_id;

  if target_item.id is null then
    raise exception 'inspection item % not found', target_inspection_item_id;
  end if;

  if not public.is_assigned_technician_inspection(target_item.inspection_id) then
    raise exception 'inspection item % is not available to the current technician', target_inspection_item_id;
  end if;

  select *
  into target_job
  from public.jobs
  where id = target_item.job_id;

  if target_job.status in ('scheduled', 'dispatched') then
    update public.jobs
    set status = 'in_progress'
    where id = target_item.job_id;
  end if;

  update public.inspection_items
  set status = next_status,
      finding_severity = next_finding_severity,
      technician_notes = nullif(btrim(next_technician_notes), ''),
      recommendation = nullif(btrim(next_recommendation), '')
  where id = target_inspection_item_id;
end;
$$;

create or replace function public.complete_assigned_inspection(target_inspection_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_inspection public.inspections%rowtype;
begin
  select inspection.*
  into target_inspection
  from public.inspections inspection
  where inspection.id = target_inspection_id;

  if target_inspection.id is null then
    raise exception 'inspection % not found', target_inspection_id;
  end if;

  if target_inspection.status = 'completed' then
    return;
  end if;

  if not public.is_assigned_technician_inspection(target_inspection_id) then
    raise exception 'inspection % is not assigned to the current technician', target_inspection_id;
  end if;

  if not exists (
    select 1
    from public.inspection_items item
    where item.inspection_id = target_inspection_id
  ) then
    raise exception 'inspection % has no items to complete', target_inspection_id;
  end if;

  if exists (
    select 1
    from public.inspection_items item
    where item.inspection_id = target_inspection_id
      and item.is_required = true
      and item.status = 'not_checked'
  ) then
    raise exception 'all required inspection items must be completed before completion';
  end if;

  update public.inspections
  set status = 'completed',
      completed_by_user_id = auth.uid()
  where id = target_inspection_id;
end;
$$;
