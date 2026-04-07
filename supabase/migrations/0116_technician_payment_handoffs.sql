create type public.technician_payment_handoff_kind as enum (
  'follow_up_required',
  'resend_link',
  'promised_to_pay_later',
  'manual_tender',
  'other'
);

create type public.technician_payment_handoff_status as enum (
  'open',
  'resolved'
);

create type public.technician_payment_tender_type as enum (
  'cash',
  'check',
  'other'
);

create table public.technician_payment_handoffs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  job_id uuid not null references public.jobs (id) on delete cascade,
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  technician_user_id uuid not null references auth.users (id) on delete restrict,
  status public.technician_payment_handoff_status not null default 'open',
  kind public.technician_payment_handoff_kind not null,
  tender_type public.technician_payment_tender_type,
  amount_cents integer,
  customer_promise_at timestamptz,
  note text,
  resolved_at timestamptz,
  resolved_by_user_id uuid references auth.users (id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint technician_payment_handoffs_amount_positive check (
    amount_cents is null or amount_cents > 0
  ),
  constraint technician_payment_handoffs_note_not_blank check (
    note is null or btrim(note) <> ''
  ),
  constraint technician_payment_handoffs_manual_tender_check check (
    (
      kind = 'manual_tender'
      and tender_type is not null
      and amount_cents is not null
    )
    or (
      kind <> 'manual_tender'
      and tender_type is null
    )
  ),
  constraint technician_payment_handoffs_resolution_check check (
    (
      status = 'open'
      and resolved_at is null
      and resolved_by_user_id is null
    )
    or (
      status = 'resolved'
      and resolved_by_user_id is not null
    )
  )
);

create index technician_payment_handoffs_job_id_idx
  on public.technician_payment_handoffs (job_id, created_at desc);

create index technician_payment_handoffs_invoice_id_idx
  on public.technician_payment_handoffs (invoice_id, created_at desc);

create index technician_payment_handoffs_company_id_idx
  on public.technician_payment_handoffs (company_id, created_at desc);

create trigger technician_payment_handoffs_set_updated_at
before update on public.technician_payment_handoffs
for each row
execute function public.set_updated_at();

create or replace function public.enforce_technician_payment_handoff_parent_match()
returns trigger
language plpgsql
as $$
declare
  target_invoice public.invoices%rowtype;
begin
  select *
  into target_invoice
  from public.invoices
  where id = new.invoice_id;

  if target_invoice.id is null then
    raise exception 'invoice % not found', new.invoice_id;
  end if;

  if new.company_id <> target_invoice.company_id then
    raise exception 'technician_payment_handoffs.company_id must match invoices.company_id';
  end if;

  if new.job_id <> target_invoice.job_id then
    raise exception 'technician_payment_handoffs.job_id must match invoices.job_id';
  end if;

  return new;
end;
$$;

create trigger technician_payment_handoffs_enforce_parent_match
before insert or update on public.technician_payment_handoffs
for each row
execute function public.enforce_technician_payment_handoff_parent_match();

create or replace function public.set_technician_payment_handoff_resolution()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'resolved' then
    if new.resolved_at is null then
      new.resolved_at = timezone('utc', now());
    end if;
  else
    new.resolved_at = null;
    new.resolved_by_user_id = null;
  end if;

  return new;
end;
$$;

create trigger technician_payment_handoffs_resolution_state
before insert or update on public.technician_payment_handoffs
for each row
execute function public.set_technician_payment_handoff_resolution();

alter table public.technician_payment_handoffs enable row level security;

create or replace function public.is_assigned_technician_payment_handoff(
  target_handoff_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.technician_payment_handoffs handoff
    join public.jobs job
      on job.id = handoff.job_id
    where handoff.id = target_handoff_id
      and job.assigned_technician_user_id = auth.uid()
      and job.is_active = true
      and public.has_company_role(
        handoff.company_id,
        array['owner', 'admin', 'technician']::public.app_role[]
      )
  );
$$;

create policy "technician_payment_handoffs_select_office"
on public.technician_payment_handoffs
for select
to authenticated
using (
  public.has_company_role(
    company_id,
    array['owner', 'admin', 'dispatcher']::public.app_role[]
  )
);

create policy "technician_payment_handoffs_select_assigned_technician"
on public.technician_payment_handoffs
for select
to authenticated
using (public.is_assigned_technician_payment_handoff(id));

create policy "technician_payment_handoffs_insert_office"
on public.technician_payment_handoffs
for insert
to authenticated
with check (
  public.has_company_role(
    company_id,
    array['owner', 'admin', 'dispatcher']::public.app_role[]
  )
);

create policy "technician_payment_handoffs_insert_assigned_technician"
on public.technician_payment_handoffs
for insert
to authenticated
with check (
  technician_user_id = auth.uid()
  and public.is_assigned_technician_invoice(invoice_id)
  and public.has_company_role(
    company_id,
    array['owner', 'admin', 'technician']::public.app_role[]
  )
);

create policy "technician_payment_handoffs_update_office"
on public.technician_payment_handoffs
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
