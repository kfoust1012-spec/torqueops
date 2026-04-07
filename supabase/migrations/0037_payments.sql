create type public.payment_status as enum (
  'succeeded',
  'failed'
);

alter table public.invoices
  add column payment_url text,
  add column payment_url_expires_at timestamptz,
  add column stripe_checkout_session_id text,
  add constraint invoices_payment_url_not_blank check (payment_url is null or btrim(payment_url) <> ''),
  add constraint invoices_stripe_checkout_session_id_not_blank check (
    stripe_checkout_session_id is null or btrim(stripe_checkout_session_id) <> ''
  );

create unique index invoices_stripe_checkout_session_id_unique_idx
  on public.invoices (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  job_id uuid not null references public.jobs (id) on delete cascade,
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  provider text not null default 'stripe',
  status public.payment_status not null default 'succeeded',
  stripe_checkout_session_id text not null,
  stripe_payment_intent_id text,
  stripe_charge_id text,
  stripe_event_id text not null,
  amount_cents integer not null,
  currency_code text not null default 'USD',
  receipt_url text,
  paid_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint payments_provider_stripe check (provider = 'stripe'),
  constraint payments_checkout_session_not_blank check (btrim(stripe_checkout_session_id) <> ''),
  constraint payments_event_id_not_blank check (btrim(stripe_event_id) <> ''),
  constraint payments_amount_positive check (amount_cents > 0),
  constraint payments_currency_usd check (currency_code = 'USD'),
  constraint payments_receipt_url_not_blank check (receipt_url is null or btrim(receipt_url) <> ''),
  constraint payments_stripe_payment_intent_not_blank check (
    stripe_payment_intent_id is null or btrim(stripe_payment_intent_id) <> ''
  ),
  constraint payments_stripe_charge_not_blank check (
    stripe_charge_id is null or btrim(stripe_charge_id) <> ''
  )
);

create unique index payments_stripe_event_id_unique_idx
  on public.payments (stripe_event_id);

create unique index payments_stripe_checkout_session_id_unique_idx
  on public.payments (stripe_checkout_session_id);

create unique index payments_stripe_payment_intent_id_unique_idx
  on public.payments (stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

create index payments_company_id_idx on public.payments (company_id);
create index payments_job_id_idx on public.payments (job_id);
create index payments_invoice_id_idx on public.payments (invoice_id, paid_at desc);

create trigger payments_set_updated_at
before update on public.payments
for each row
execute function public.set_updated_at();

create or replace function public.enforce_payment_company_match()
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
    raise exception 'payments.company_id must match invoices.company_id';
  end if;

  if new.job_id <> target_invoice.job_id then
    raise exception 'payments.job_id must match invoices.job_id';
  end if;

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
    when current_status = 'issued' and next_status in ('partially_paid', 'paid', 'void') then true
    when current_status = 'partially_paid' and next_status in ('paid', 'void') then true
    else false
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
      new.payment_url = null;
      new.payment_url_expires_at = null;
      new.stripe_checkout_session_id = null;
    end if;

    if new.status = 'void' then
      if new.voided_at is null then
        new.voided_at = timezone('utc', now());
      end if;

      new.balance_due_cents = 0;
      new.payment_url = null;
      new.payment_url_expires_at = null;
      new.stripe_checkout_session_id = null;
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
  if current_setting('app.invoice_payment_reconciliation', true) = 'true' then
    return new;
  end if;

  if old.status in ('paid', 'void') then
    raise exception 'locked invoices cannot be modified';
  end if;

  if old.status in ('issued', 'partially_paid') then
    if new.status = old.status then
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
        raise exception 'issued and partially paid invoices cannot be modified';
      end if;

      return new;
    end if;

    if new.status <> 'void' then
      raise exception 'issued and partially paid invoices can only move to void outside payment reconciliation';
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
      raise exception 'issued and partially paid invoices cannot be modified except for voiding';
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

  if target_status in ('issued', 'partially_paid', 'paid', 'void') then
    raise exception 'locked invoices cannot be modified';
  end if;

  return coalesce(new, old);
end;
$$;

create or replace function public.record_stripe_invoice_payment(
  target_company_id uuid,
  target_job_id uuid,
  target_invoice_id uuid,
  target_stripe_checkout_session_id text,
  target_stripe_payment_intent_id text default null,
  target_stripe_charge_id text default null,
  target_stripe_event_id text default null,
  target_amount_cents integer default 0,
  target_currency_code text default 'USD',
  target_receipt_url text default null,
  target_paid_at timestamptz default timezone('utc', now())
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_invoice public.invoices%rowtype;
  existing_payment_id uuid;
  next_amount_paid integer;
begin
  select id
  into existing_payment_id
  from public.payments
  where stripe_event_id = target_stripe_event_id
     or stripe_checkout_session_id = target_stripe_checkout_session_id;

  if existing_payment_id is not null then
    return existing_payment_id;
  end if;

  if target_amount_cents <= 0 then
    raise exception 'payment amount must be positive';
  end if;

  select *
  into target_invoice
  from public.invoices
  where id = target_invoice_id;

  if target_invoice.id is null then
    raise exception 'invoice % not found', target_invoice_id;
  end if;

  if target_invoice.company_id <> target_company_id then
    raise exception 'payment company must match invoice company';
  end if;

  if target_invoice.job_id <> target_job_id then
    raise exception 'payment job must match invoice job';
  end if;

  if target_invoice.status not in ('issued', 'partially_paid', 'paid') then
    raise exception 'invoice % cannot accept Stripe reconciliation in status %', target_invoice_id, target_invoice.status;
  end if;

  if target_invoice.balance_due_cents = 0 and target_invoice.status = 'paid' then
    return existing_payment_id;
  end if;

  insert into public.payments (
    company_id,
    job_id,
    invoice_id,
    provider,
    status,
    stripe_checkout_session_id,
    stripe_payment_intent_id,
    stripe_charge_id,
    stripe_event_id,
    amount_cents,
    currency_code,
    receipt_url,
    paid_at
  )
  values (
    target_company_id,
    target_job_id,
    target_invoice_id,
    'stripe',
    'succeeded',
    target_stripe_checkout_session_id,
    nullif(btrim(coalesce(target_stripe_payment_intent_id, '')), ''),
    nullif(btrim(coalesce(target_stripe_charge_id, '')), ''),
    coalesce(nullif(btrim(coalesce(target_stripe_event_id, '')), ''), target_stripe_checkout_session_id),
    target_amount_cents,
    target_currency_code,
    nullif(btrim(coalesce(target_receipt_url, '')), ''),
    target_paid_at
  )
  returning id into existing_payment_id;

  next_amount_paid := least(target_invoice.total_cents, target_invoice.amount_paid_cents + target_amount_cents);

  perform set_config('app.invoice_payment_reconciliation', 'true', true);

  update public.invoices
  set
    amount_paid_cents = next_amount_paid,
    status = case
      when next_amount_paid >= target_invoice.total_cents then 'paid'
      else 'partially_paid'
    end,
    payment_url = null,
    payment_url_expires_at = null,
    stripe_checkout_session_id = null
  where id = target_invoice_id;

  return existing_payment_id;
end;
$$;
