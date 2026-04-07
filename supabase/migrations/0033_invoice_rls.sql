alter table public.invoices enable row level security;
alter table public.invoice_line_items enable row level security;

create or replace function public.is_assigned_technician_invoice(target_invoice_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.invoices invoice
    join public.jobs job
      on job.id = invoice.job_id
    where invoice.id = target_invoice_id
      and job.assigned_technician_user_id = auth.uid()
      and job.is_active = true
      and public.has_company_role(
        invoice.company_id,
        array['owner', 'admin', 'technician']::public.app_role[]
      )
  );
$$;

create policy "invoices_select_office"
on public.invoices
for select
to authenticated
using (
  public.has_company_role(
    company_id,
    array['owner', 'admin', 'dispatcher']::public.app_role[]
  )
);

create policy "invoices_select_assigned_technician"
on public.invoices
for select
to authenticated
using (public.is_assigned_technician_invoice(id));

create policy "invoices_insert_office"
on public.invoices
for insert
to authenticated
with check (
  created_by_user_id = auth.uid()
  and public.has_company_role(
    company_id,
    array['owner', 'admin', 'dispatcher']::public.app_role[]
  )
);

create policy "invoices_update_office"
on public.invoices
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

create policy "invoices_delete_office"
on public.invoices
for delete
to authenticated
using (
  public.has_company_role(
    company_id,
    array['owner', 'admin', 'dispatcher']::public.app_role[]
  )
);

create policy "invoice_line_items_select_office"
on public.invoice_line_items
for select
to authenticated
using (
  public.has_company_role(
    company_id,
    array['owner', 'admin', 'dispatcher']::public.app_role[]
  )
);

create policy "invoice_line_items_select_assigned_technician"
on public.invoice_line_items
for select
to authenticated
using (public.is_assigned_technician_invoice(invoice_id));

create policy "invoice_line_items_insert_office"
on public.invoice_line_items
for insert
to authenticated
with check (
  public.has_company_role(
    company_id,
    array['owner', 'admin', 'dispatcher']::public.app_role[]
  )
);

create policy "invoice_line_items_update_office"
on public.invoice_line_items
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

create policy "invoice_line_items_delete_office"
on public.invoice_line_items
for delete
to authenticated
using (
  public.has_company_role(
    company_id,
    array['owner', 'admin', 'dispatcher']::public.app_role[]
  )
);
