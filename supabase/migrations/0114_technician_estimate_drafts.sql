create or replace function public.is_assigned_technician_job(
  target_company_id uuid,
  target_job_id uuid
)
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
      and job.company_id = target_company_id
      and job.assigned_technician_user_id = auth.uid()
      and job.is_active = true
      and public.has_company_role(
        target_company_id,
        array['owner', 'admin', 'technician']::public.app_role[]
      )
  );
$$;

create or replace function public.is_assigned_technician_draft_estimate(target_estimate_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.estimates estimate
    where estimate.id = target_estimate_id
      and estimate.status = 'draft'
      and public.is_assigned_technician_job(estimate.company_id, estimate.job_id)
  );
$$;

create policy "estimates_insert_assigned_technician_draft"
on public.estimates
for insert
to authenticated
with check (
  status = 'draft'
  and created_by_user_id = auth.uid()
  and public.is_assigned_technician_job(company_id, job_id)
);

create policy "estimates_update_assigned_technician_draft"
on public.estimates
for update
to authenticated
using (
  status = 'draft'
  and public.is_assigned_technician_job(company_id, job_id)
)
with check (
  status = 'draft'
  and public.is_assigned_technician_job(company_id, job_id)
);

create policy "estimate_line_items_insert_assigned_technician_draft"
on public.estimate_line_items
for insert
to authenticated
with check (
  estimate_section_id is null
  and public.is_assigned_technician_draft_estimate(estimate_id)
);

create policy "estimate_line_items_update_assigned_technician_draft"
on public.estimate_line_items
for update
to authenticated
using (
  estimate_section_id is null
  and public.is_assigned_technician_draft_estimate(estimate_id)
)
with check (
  estimate_section_id is null
  and public.is_assigned_technician_draft_estimate(estimate_id)
);

create policy "estimate_line_items_delete_assigned_technician_draft"
on public.estimate_line_items
for delete
to authenticated
using (
  estimate_section_id is null
  and public.is_assigned_technician_draft_estimate(estimate_id)
);
