alter table public.payments
  drop constraint payments_provider_stripe,
  drop constraint payments_checkout_session_not_blank,
  drop constraint payments_event_id_not_blank,
  drop constraint payments_stripe_payment_intent_not_blank,
  drop constraint payments_stripe_charge_not_blank;

alter table public.payments
  alter column stripe_checkout_session_id drop not null,
  alter column stripe_event_id drop not null,
  add column manual_tender_type text,
  add column manual_reference_note text,
  add column recorded_by_user_id uuid references public.profiles (id) on delete set null,
  add constraint payments_provider_supported check (provider in ('stripe', 'manual')),
  add constraint payments_provider_fields_valid check (
    (
      provider = 'stripe'
      and stripe_checkout_session_id is not null
      and btrim(stripe_checkout_session_id) <> ''
      and stripe_event_id is not null
      and btrim(stripe_event_id) <> ''
      and manual_tender_type is null
    )
    or
    (
      provider = 'manual'
      and stripe_checkout_session_id is null
      and stripe_payment_intent_id is null
      and stripe_charge_id is null
      and stripe_event_id is null
      and manual_tender_type in ('cash', 'check', 'other')
    )
  ),
  add constraint payments_receipt_url_manual_guard check (
    provider <> 'manual' or receipt_url is null
  ),
  add constraint payments_manual_reference_note_not_blank check (
    manual_reference_note is null or btrim(manual_reference_note) <> ''
  );

create or replace function public.record_manual_invoice_payment(
  target_company_id uuid,
  target_job_id uuid,
  target_invoice_id uuid,
  target_manual_tender_type text,
  target_amount_cents integer default 0,
  target_currency_code text default 'USD',
  target_manual_reference_note text default null,
  target_recorded_by_user_id uuid default null,
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
  if target_amount_cents <= 0 then
    raise exception 'payment amount must be positive';
  end if;

  if target_manual_tender_type not in ('cash', 'check', 'other') then
    raise exception 'manual tender type must be cash, check, or other';
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
    raise exception 'invoice % cannot accept manual payment reconciliation in status %', target_invoice_id, target_invoice.status;
  end if;

  if target_invoice.balance_due_cents = 0 and target_invoice.status = 'paid' then
    raise exception 'invoice % has already been reconciled and cannot accept another payment', target_invoice_id;
  end if;

  insert into public.payments (
    company_id,
    job_id,
    invoice_id,
    provider,
    status,
    amount_cents,
    currency_code,
    manual_tender_type,
    manual_reference_note,
    recorded_by_user_id,
    paid_at
  )
  values (
    target_company_id,
    target_job_id,
    target_invoice_id,
    'manual',
    'succeeded',
    target_amount_cents,
    target_currency_code,
    target_manual_tender_type,
    nullif(btrim(coalesce(target_manual_reference_note, '')), ''),
    target_recorded_by_user_id,
    target_paid_at
  )
  returning id into existing_payment_id;

  next_amount_paid := least(target_invoice.total_cents, target_invoice.amount_paid_cents + target_amount_cents);

  perform set_config('app.invoice_payment_reconciliation', 'true', true);

  update public.invoices
  set
    amount_paid_cents = next_amount_paid,
    status = (
      case
        when next_amount_paid >= target_invoice.total_cents then 'paid'
        else 'partially_paid'
      end
    )::public.invoice_status,
    payment_url = null,
    payment_url_expires_at = null,
    stripe_checkout_session_id = null
  where id = target_invoice_id;

  return existing_payment_id;
end;
$$;
