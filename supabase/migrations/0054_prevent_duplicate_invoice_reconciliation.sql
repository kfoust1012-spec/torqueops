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
    raise exception 'invoice % has already been reconciled and cannot accept another checkout session', target_invoice_id;
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
