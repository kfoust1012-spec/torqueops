alter table public.estimates enable row level security;
alter table public.estimate_line_items enable row level security;

create or replace function public.is_assigned_technician_estimate(target_estimate_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.estimates estimate
    join public.jobs job
      on job.id = estimate.job_id
    where estimate.id = target_estimate_id
      and job.assigned_technician_user_id = auth.uid()
      and job.is_active = true
      and public.has_company_role(
        estimate.company_id,
        array['owner', 'admin', 'technician']::public.app_role[]
      )
  );
$$;

create policy "estimates_select_office"
on public.estimates
for select
to authenticated
using (
  public.has_company_role(
    company_id,
    array['owner', 'admin', 'dispatcher']::public.app_role[]
  )
);

create policy "estimates_select_assigned_technician"
on public.estimates
for select
to authenticated
using (public.is_assigned_technician_estimate(id));

create policy "estimates_insert_office"
on public.estimates
for insert
to authenticated
with check (
  created_by_user_id = auth.uid()
  and public.has_company_role(
    company_id,
    array['owner', 'admin', 'dispatcher']::public.app_role[]
  )
);

create policy "estimates_update_office"
on public.estimates
for update
to authenticated
using (
  public.has_company_role(
    company_id,
    array['owner', 'admin', 'dispatcher']::public.app_role[]
  )
)
with check (
  public.has_company_role(
    company_id,
    array['owner', 'admin', 'dispatcher']::public.app_role[]
  )
);

create policy "estimates_delete_office"
on public.estimates
for delete
to authenticated
using (
  public.has_company_role(
    company_id,
    array['owner', 'admin', 'dispatcher']::public.app_role[]
  )
);

create policy "estimate_line_items_select_office"
on public.estimate_line_items
for select
to authenticated
using (
  public.has_company_role(
    company_id,
    array['owner', 'admin', 'dispatcher']::public.app_role[]
  )
);

create policy "estimate_line_items_select_assigned_technician"
on public.estimate_line_items
for select
to authenticated
using (public.is_assigned_technician_estimate(estimate_id));

create policy "estimate_line_items_insert_office"
on public.estimate_line_items
for insert
to authenticated
with check (
  public.has_company_role(
    company_id,
    array['owner', 'admin', 'dispatcher']::public.app_role[]
  )
);

create policy "estimate_line_items_update_office"
on public.estimate_line_items
for update
to authenticated
using (
  public.has_company_role(
    company_id,
    array['owner', 'admin', 'dispatcher']::public.app_role[]
  )
)
with check (
  public.has_company_role(
    company_id,
    array['owner', 'admin', 'dispatcher']::public.app_role[]
  )
);

create policy "estimate_line_items_delete_office"
on public.estimate_line_items
for delete
to authenticated
using (
  public.has_company_role(
    company_id,
    array['owner', 'admin', 'dispatcher']::public.app_role[]
  )
);
