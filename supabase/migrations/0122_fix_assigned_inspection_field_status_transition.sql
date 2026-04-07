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

  if target_job.status = 'scheduled' then
    update public.jobs
    set status = 'en_route'
    where id = target_item.job_id;

    update public.jobs
    set status = 'arrived'
    where id = target_item.job_id;

    update public.jobs
    set status = 'diagnosing'
    where id = target_item.job_id;
  elsif target_job.status = 'dispatched' then
    update public.jobs
    set status = 'en_route'
    where id = target_item.job_id;

    update public.jobs
    set status = 'arrived'
    where id = target_item.job_id;

    update public.jobs
    set status = 'diagnosing'
    where id = target_item.job_id;
  elsif target_job.status = 'en_route' then
    update public.jobs
    set status = 'arrived'
    where id = target_item.job_id;

    update public.jobs
    set status = 'diagnosing'
    where id = target_item.job_id;
  elsif target_job.status = 'arrived' then
    update public.jobs
    set status = 'diagnosing'
    where id = target_item.job_id;
  elsif target_job.status = 'in_progress' then
    update public.jobs
    set status = 'diagnosing'
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
