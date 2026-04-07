alter table public.inspections enable row level security;
alter table public.inspection_items enable row level security;

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
  );
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

create policy "inspections_select_office"
on public.inspections
for select
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "inspections_select_assigned_technician"
on public.inspections
for select
to authenticated
using (
  public.has_company_role(company_id, array['owner', 'admin', 'technician']::public.app_role[])
  and public.is_assigned_technician_job(job_id)
);

create policy "inspections_insert_office"
on public.inspections
for insert
to authenticated
with check (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "inspections_insert_assigned_technician"
on public.inspections
for insert
to authenticated
with check (
  started_by_user_id = auth.uid()
  and public.has_company_role(company_id, array['owner', 'admin', 'technician']::public.app_role[])
  and public.is_assigned_technician_job(job_id)
);

create policy "inspections_update_office"
on public.inspections
for update
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]))
with check (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "inspection_items_select_office"
on public.inspection_items
for select
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "inspection_items_select_assigned_technician"
on public.inspection_items
for select
to authenticated
using (
  public.has_company_role(company_id, array['owner', 'admin', 'technician']::public.app_role[])
  and public.is_assigned_technician_inspection(inspection_id)
);

create policy "inspection_items_insert_office"
on public.inspection_items
for insert
to authenticated
with check (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

create policy "inspection_items_insert_assigned_technician"
on public.inspection_items
for insert
to authenticated
with check (
  public.has_company_role(company_id, array['owner', 'admin', 'technician']::public.app_role[])
  and public.is_assigned_technician_inspection(inspection_id)
);

create policy "inspection_items_update_office"
on public.inspection_items
for update
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]))
with check (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));
