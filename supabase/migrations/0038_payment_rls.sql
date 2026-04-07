create trigger payments_enforce_parent_match
before insert or update on public.payments
for each row
execute function public.enforce_payment_company_match();

alter table public.payments enable row level security;

create or replace function public.is_assigned_technician_payment(target_payment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.payments payment
    join public.jobs job
      on job.id = payment.job_id
    where payment.id = target_payment_id
      and job.assigned_technician_user_id = auth.uid()
      and job.is_active = true
      and public.has_company_role(
        payment.company_id,
        array['owner', 'admin', 'technician']::public.app_role[]
      )
  );
$$;

create policy "payments_select_office"
on public.payments
for select
to authenticated
using (
  public.has_company_role(
    company_id,
    array['owner', 'admin', 'dispatcher']::public.app_role[]
  )
);

create policy "payments_select_assigned_technician"
on public.payments
for select
to authenticated
using (public.is_assigned_technician_payment(id));

create policy "payments_insert_office"
on public.payments
for insert
to authenticated
with check (
  public.has_company_role(
    company_id,
    array['owner', 'admin', 'dispatcher']::public.app_role[]
  )
);

create policy "payments_update_office"
on public.payments
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

create policy "payments_delete_office"
on public.payments
for delete
to authenticated
using (
  public.has_company_role(
    company_id,
    array['owner', 'admin', 'dispatcher']::public.app_role[]
  )
);
