create type public.invoice_status as enum (
  'draft',
  'issued',
  'paid',
  'void'
);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  job_id uuid not null references public.jobs (id) on delete cascade,
  estimate_id uuid references public.estimates (id) on delete set null,
  status public.invoice_status not null default 'draft',
  invoice_number text not null,
  title text not null,
  notes text,
  terms text,
  currency_code text not null default 'USD',
  tax_rate_basis_points integer not null default 0,
  subtotal_cents integer not null default 0,
  discount_cents integer not null default 0,
  tax_cents integer not null default 0,
  total_cents integer not null default 0,
  amount_paid_cents integer not null default 0,
  balance_due_cents integer not null default 0,
  issued_at timestamptz,
  paid_at timestamptz,
  voided_at timestamptz,
  created_by_user_id uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint invoices_invoice_number_not_blank check (btrim(invoice_number) <> ''),
  constraint invoices_title_not_blank check (btrim(title) <> ''),
  constraint invoices_currency_code_usd check (currency_code = 'USD'),
  constraint invoices_tax_rate_nonnegative check (tax_rate_basis_points >= 0),
  constraint invoices_subtotal_nonnegative check (subtotal_cents >= 0),
  constraint invoices_discount_nonnegative check (discount_cents >= 0),
  constraint invoices_tax_nonnegative check (tax_cents >= 0),
  constraint invoices_total_nonnegative check (total_cents >= 0),
  constraint invoices_amount_paid_nonnegative check (amount_paid_cents >= 0),
  constraint invoices_balance_due_nonnegative check (balance_due_cents >= 0),
  constraint invoices_company_invoice_number_unique unique (company_id, invoice_number),
  constraint invoices_job_id_unique unique (job_id)
);

create table public.invoice_line_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  job_id uuid not null references public.jobs (id) on delete cascade,
  position integer not null,
  item_type text not null,
  name text not null,
  description text,
  quantity numeric(12,2) not null,
  unit_price_cents integer not null,
  line_subtotal_cents integer not null,
  taxable boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint invoice_line_items_position_nonnegative check (position >= 0),
  constraint invoice_line_items_item_type_valid check (item_type in ('labor', 'part', 'fee')),
  constraint invoice_line_items_name_not_blank check (btrim(name) <> ''),
  constraint invoice_line_items_quantity_positive check (quantity > 0),
  constraint invoice_line_items_unit_price_nonnegative check (unit_price_cents >= 0),
  constraint invoice_line_items_line_subtotal_nonnegative check (line_subtotal_cents >= 0),
  constraint invoice_line_items_invoice_position_unique unique (invoice_id, position)
);

create index invoices_company_id_idx on public.invoices (company_id);
create index invoices_job_id_idx on public.invoices (job_id);
create index invoices_estimate_id_idx on public.invoices (estimate_id);
create index invoices_status_idx on public.invoices (company_id, status);
create index invoices_created_at_idx on public.invoices (company_id, created_at desc);

create index invoice_line_items_invoice_id_idx on public.invoice_line_items (invoice_id, position);
create index invoice_line_items_company_id_idx on public.invoice_line_items (company_id);
create index invoice_line_items_job_id_idx on public.invoice_line_items (job_id);

create trigger invoices_set_updated_at
before update on public.invoices
for each row
execute function public.set_updated_at();

create trigger invoice_line_items_set_updated_at
before update on public.invoice_line_items
for each row
execute function public.set_updated_at();

create or replace function public.enforce_invoice_company_match()
returns trigger
language plpgsql
as $$
declare
  target_job public.jobs%rowtype;
  target_estimate public.estimates%rowtype;
begin
  select *
  into target_job
  from public.jobs
  where id = new.job_id;

  if target_job.id is null then
    raise exception 'job % not found', new.job_id;
  end if;

  if new.company_id <> target_job.company_id then
    raise exception 'invoices.company_id must match jobs.company_id';
  end if;

  if new.estimate_id is not null then
    select *
    into target_estimate
    from public.estimates
    where id = new.estimate_id;

    if target_estimate.id is null then
      raise exception 'estimate % not found', new.estimate_id;
    end if;

    if target_estimate.company_id <> new.company_id then
      raise exception 'invoices.estimate_id must belong to the same company';
    end if;

    if target_estimate.job_id <> new.job_id then
      raise exception 'invoices.estimate_id must belong to the same job';
    end if;

    if target_estimate.status <> 'accepted' then
      raise exception 'only accepted estimates can be linked to invoices';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.enforce_invoice_line_item_parent_match()
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
    raise exception 'invoice_line_items.company_id must match invoices.company_id';
  end if;

  if new.job_id <> target_invoice.job_id then
    raise exception 'invoice_line_items.job_id must match invoices.job_id';
  end if;

  return new;
end;
$$;

create or replace function public.sync_invoice_line_item_subtotal()
returns trigger
language plpgsql
as $$
begin
  new.line_subtotal_cents := round((new.quantity * new.unit_price_cents)::numeric)::integer;
  return new;
end;
$$;

create or replace function public.is_valid_invoice_status_transition(
  current_status public.invoice_status,
  next_status public.invoice_status
)
returns boolean
language sql
immutable
as $$
  select case
    when current_status = next_status then true
    when current_status = 'draft' and next_status in ('issued', 'void') then true
    when current_status = 'issued' and next_status in ('paid', 'void') then true
    else false
  end;
$$;

create or replace function public.validate_invoice_status_change()
returns trigger
language plpgsql
as $$
begin
  if not public.is_valid_invoice_status_transition(old.status, new.status) then
    raise exception 'invalid invoice status transition from % to %', old.status, new.status;
  end if;

  return new;
end;
$$;

create or replace function public.set_invoice_status_timestamps()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from old.status then
    if new.status = 'issued' and new.issued_at is null then
      new.issued_at = timezone('utc', now());
    end if;

    if new.status = 'paid' then
      if new.paid_at is null then
        new.paid_at = timezone('utc', now());
      end if;

      new.amount_paid_cents = new.total_cents;
      new.balance_due_cents = 0;
    end if;

    if new.status = 'void' then
      if new.voided_at is null then
        new.voided_at = timezone('utc', now());
      end if;

      new.balance_due_cents = 0;
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.prevent_sending_empty_invoice()
returns trigger
language plpgsql
as $$
declare
  line_item_count bigint;
begin
  if new.status = 'issued' and new.status is distinct from old.status then
    select count(*)
    into line_item_count
    from public.invoice_line_items
    where invoice_id = new.id;

    if line_item_count = 0 then
      raise exception 'invoice must contain at least one line item before it can be issued';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.prevent_locked_invoice_mutation()
returns trigger
language plpgsql
as $$
begin
  if old.status in ('paid', 'void') then
    raise exception 'locked invoices cannot be modified';
  end if;

  if old.status = 'issued' then
    if new.status = old.status then
      raise exception 'issued invoices cannot be modified';
    end if;

    if new.status not in ('paid', 'void') then
      raise exception 'invalid invoice status transition from issued to %', new.status;
    end if;

    if new.invoice_number is distinct from old.invoice_number
      or new.title is distinct from old.title
      or new.notes is distinct from old.notes
      or new.terms is distinct from old.terms
      or new.currency_code is distinct from old.currency_code
      or new.tax_rate_basis_points is distinct from old.tax_rate_basis_points
      or new.subtotal_cents is distinct from old.subtotal_cents
      or new.discount_cents is distinct from old.discount_cents
      or new.tax_cents is distinct from old.tax_cents
      or new.total_cents is distinct from old.total_cents
      or new.amount_paid_cents is distinct from old.amount_paid_cents
      or new.balance_due_cents is distinct from old.balance_due_cents
      or new.company_id is distinct from old.company_id
      or new.job_id is distinct from old.job_id
      or new.estimate_id is distinct from old.estimate_id
      or new.created_by_user_id is distinct from old.created_by_user_id
    then
      raise exception 'issued invoices cannot be modified except for final status change';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.prevent_locked_invoice_line_item_mutation()
returns trigger
language plpgsql
as $$
declare
  target_invoice_id uuid;
  target_status public.invoice_status;
begin
  target_invoice_id := coalesce(new.invoice_id, old.invoice_id);

  select status
  into target_status
  from public.invoices
  where id = target_invoice_id;

  if target_status is null then
    raise exception 'invoice % not found', target_invoice_id;
  end if;

  if target_status in ('issued', 'paid', 'void') then
    raise exception 'locked invoices cannot be modified';
  end if;

  return coalesce(new, old);
end;
$$;

create trigger invoices_enforce_company_match
before insert or update on public.invoices
for each row
execute function public.enforce_invoice_company_match();

create trigger invoices_validate_status_change
before update on public.invoices
for each row
when (new.status is distinct from old.status)
execute function public.validate_invoice_status_change();

create trigger invoices_set_status_timestamps
before update on public.invoices
for each row
execute function public.set_invoice_status_timestamps();

create trigger invoices_prevent_sending_empty
before update on public.invoices
for each row
when (new.status is distinct from old.status)
execute function public.prevent_sending_empty_invoice();

create trigger invoices_prevent_locked_mutation
before update on public.invoices
for each row
when (old.status in ('issued', 'paid', 'void'))
execute function public.prevent_locked_invoice_mutation();

create trigger invoice_line_items_enforce_parent_match
before insert or update on public.invoice_line_items
for each row
execute function public.enforce_invoice_line_item_parent_match();

create trigger invoice_line_items_sync_subtotal
before insert or update on public.invoice_line_items
for each row
execute function public.sync_invoice_line_item_subtotal();

create trigger invoice_line_items_prevent_locked_mutation
before insert or update or delete on public.invoice_line_items
for each row
execute function public.prevent_locked_invoice_line_item_mutation();
