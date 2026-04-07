create type public.communication_channel as enum (
  'email',
  'sms'
);

create type public.communication_type as enum (
  'estimate_notification',
  'invoice_notification',
  'payment_reminder',
  'appointment_confirmation',
  'dispatch_update'
);

create type public.communication_status as enum (
  'queued',
  'processing',
  'sent',
  'delivered',
  'failed',
  'canceled'
);

create type public.communication_event_type as enum (
  'estimate_notification_requested',
  'invoice_notification_requested',
  'payment_reminder_requested',
  'appointment_confirmation_requested',
  'dispatch_update_requested'
);

create type public.communication_trigger_source as enum (
  'manual',
  'workflow',
  'system',
  'webhook'
);

alter table public.invoices
  add column due_at timestamptz;

create table public.customer_communication_preferences (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  preferred_channel public.communication_channel,
  email_enabled boolean not null default true,
  sms_enabled boolean not null default true,
  allow_estimate_notifications boolean not null default true,
  allow_invoice_notifications boolean not null default true,
  allow_payment_reminders boolean not null default true,
  allow_appointment_confirmations boolean not null default true,
  allow_dispatch_updates boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint customer_communication_preferences_company_customer_unique unique (company_id, customer_id)
);

create table public.communication_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  job_id uuid references public.jobs (id) on delete cascade,
  estimate_id uuid references public.estimates (id) on delete cascade,
  invoice_id uuid references public.invoices (id) on delete cascade,
  payment_id uuid references public.payments (id) on delete cascade,
  event_type public.communication_event_type not null,
  communication_type public.communication_type not null,
  trigger_source public.communication_trigger_source not null,
  actor_user_id uuid references auth.users (id) on delete set null,
  idempotency_key text not null,
  scheduled_for timestamptz not null default timezone('utc', now()),
  occurred_at timestamptz not null default timezone('utc', now()),
  payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz,
  failed_at timestamptz,
  failure_message text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint communication_events_idempotency_key_not_blank check (btrim(idempotency_key) <> '')
);

create unique index communication_events_idempotency_key_unique_idx
  on public.communication_events (idempotency_key);

create table public.customer_communications (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  job_id uuid references public.jobs (id) on delete cascade,
  estimate_id uuid references public.estimates (id) on delete set null,
  invoice_id uuid references public.invoices (id) on delete set null,
  payment_id uuid references public.payments (id) on delete set null,
  event_id uuid references public.communication_events (id) on delete set null,
  communication_type public.communication_type not null,
  channel public.communication_channel not null,
  status public.communication_status not null default 'queued',
  recipient_name text not null,
  recipient_email extensions.citext,
  recipient_phone text,
  subject text,
  body_text text not null,
  body_html text,
  provider text not null,
  provider_message_id text,
  provider_metadata jsonb not null default '{}'::jsonb,
  error_code text,
  error_message text,
  queued_at timestamptz not null default timezone('utc', now()),
  sent_at timestamptz,
  delivered_at timestamptz,
  failed_at timestamptz,
  created_by_user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint customer_communications_recipient_name_not_blank check (btrim(recipient_name) <> ''),
  constraint customer_communications_body_text_not_blank check (btrim(body_text) <> ''),
  constraint customer_communications_provider_not_blank check (btrim(provider) <> ''),
  constraint customer_communications_email_required check (
    channel <> 'email' or recipient_email is not null
  ),
  constraint customer_communications_sms_required check (
    channel <> 'sms' or (recipient_phone is not null and btrim(recipient_phone) <> '')
  )
);

create unique index customer_communications_event_id_unique_idx
  on public.customer_communications (event_id)
  where event_id is not null;

create table public.communication_delivery_attempts (
  id uuid primary key default gen_random_uuid(),
  communication_id uuid not null references public.customer_communications (id) on delete cascade,
  attempt_number integer not null,
  provider text not null,
  request_payload jsonb not null default '{}'::jsonb,
  response_payload jsonb not null default '{}'::jsonb,
  succeeded boolean not null,
  error_message text,
  attempted_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint communication_delivery_attempts_attempt_number_positive check (attempt_number > 0),
  constraint communication_delivery_attempts_provider_not_blank check (btrim(provider) <> '')
);

create unique index communication_delivery_attempts_unique_idx
  on public.communication_delivery_attempts (communication_id, attempt_number);

create index customer_communication_preferences_company_idx
  on public.customer_communication_preferences (company_id, customer_id);

create index communication_events_company_schedule_idx
  on public.communication_events (company_id, processed_at, scheduled_for asc);

create index communication_events_customer_idx
  on public.communication_events (customer_id, created_at desc);

create index communication_events_job_idx
  on public.communication_events (job_id, created_at desc)
  where job_id is not null;

create index customer_communications_customer_idx
  on public.customer_communications (customer_id, created_at desc);

create index customer_communications_job_idx
  on public.customer_communications (job_id, created_at desc)
  where job_id is not null;

create index customer_communications_estimate_idx
  on public.customer_communications (estimate_id, created_at desc)
  where estimate_id is not null;

create index customer_communications_invoice_idx
  on public.customer_communications (invoice_id, created_at desc)
  where invoice_id is not null;

create index communication_delivery_attempts_communication_idx
  on public.communication_delivery_attempts (communication_id, attempted_at desc);

create index invoices_company_due_at_idx
  on public.invoices (company_id, status, due_at asc)
  where due_at is not null
    and status in ('issued', 'partially_paid');

create or replace function public.enforce_customer_communication_preference_company_match()
returns trigger
language plpgsql
as $$
declare
  target_customer public.customers%rowtype;
begin
  select *
  into target_customer
  from public.customers
  where id = new.customer_id;

  if target_customer.id is null then
    raise exception 'customer % not found', new.customer_id;
  end if;

  if target_customer.company_id <> new.company_id then
    raise exception 'customer communication preferences must match customer company';
  end if;

  return new;
end;
$$;

create or replace function public.enforce_communication_event_context_match()
returns trigger
language plpgsql
as $$
declare
  target_customer public.customers%rowtype;
  target_job public.jobs%rowtype;
  target_estimate public.estimates%rowtype;
  target_invoice public.invoices%rowtype;
  target_payment public.payments%rowtype;
begin
  select *
  into target_customer
  from public.customers
  where id = new.customer_id;

  if target_customer.id is null then
    raise exception 'customer % not found', new.customer_id;
  end if;

  if target_customer.company_id <> new.company_id then
    raise exception 'communication event customer must belong to the same company';
  end if;

  if new.job_id is not null then
    select * into target_job from public.jobs where id = new.job_id;

    if target_job.id is null then
      raise exception 'job % not found', new.job_id;
    end if;

    if target_job.company_id <> new.company_id or target_job.customer_id <> new.customer_id then
      raise exception 'communication event job must belong to the same company and customer';
    end if;
  end if;

  if new.estimate_id is not null then
    select * into target_estimate from public.estimates where id = new.estimate_id;

    if target_estimate.id is null then
      raise exception 'estimate % not found', new.estimate_id;
    end if;

    if target_estimate.company_id <> new.company_id then
      raise exception 'communication event estimate must belong to the same company';
    end if;

    if new.job_id is null or target_estimate.job_id <> new.job_id then
      raise exception 'communication event estimate must match job context';
    end if;
  end if;

  if new.invoice_id is not null then
    select * into target_invoice from public.invoices where id = new.invoice_id;

    if target_invoice.id is null then
      raise exception 'invoice % not found', new.invoice_id;
    end if;

    if target_invoice.company_id <> new.company_id then
      raise exception 'communication event invoice must belong to the same company';
    end if;

    if new.job_id is null or target_invoice.job_id <> new.job_id then
      raise exception 'communication event invoice must match job context';
    end if;
  end if;

  if new.payment_id is not null then
    select * into target_payment from public.payments where id = new.payment_id;

    if target_payment.id is null then
      raise exception 'payment % not found', new.payment_id;
    end if;

    if target_payment.company_id <> new.company_id then
      raise exception 'communication event payment must belong to the same company';
    end if;

    if new.job_id is null or target_payment.job_id <> new.job_id then
      raise exception 'communication event payment must match job context';
    end if;

    if new.invoice_id is null or target_payment.invoice_id <> new.invoice_id then
      raise exception 'communication event payment must match invoice context';
    end if;
  end if;

  case new.communication_type
    when 'estimate_notification' then
      if new.estimate_id is null or new.job_id is null then
        raise exception 'estimate notifications require estimate and job context';
      end if;
    when 'invoice_notification' then
      if new.invoice_id is null or new.job_id is null then
        raise exception 'invoice notifications require invoice and job context';
      end if;
    when 'payment_reminder' then
      if new.invoice_id is null or new.job_id is null then
        raise exception 'payment reminders require invoice and job context';
      end if;
    when 'appointment_confirmation' then
      if new.job_id is null then
        raise exception 'appointment confirmations require job context';
      end if;
    when 'dispatch_update' then
      if new.job_id is null then
        raise exception 'dispatch updates require job context';
      end if;
  end case;

  return new;
end;
$$;

create or replace function public.enforce_customer_communication_company_match()
returns trigger
language plpgsql
as $$
declare
  target_customer public.customers%rowtype;
  target_job public.jobs%rowtype;
  target_estimate public.estimates%rowtype;
  target_invoice public.invoices%rowtype;
  target_payment public.payments%rowtype;
  target_event public.communication_events%rowtype;
begin
  select *
  into target_customer
  from public.customers
  where id = new.customer_id;

  if target_customer.id is null then
    raise exception 'customer % not found', new.customer_id;
  end if;

  if target_customer.company_id <> new.company_id then
    raise exception 'customer communication must belong to the same customer company';
  end if;

  if new.job_id is not null then
    select * into target_job from public.jobs where id = new.job_id;

    if target_job.id is null then
      raise exception 'job % not found', new.job_id;
    end if;

    if target_job.company_id <> new.company_id or target_job.customer_id <> new.customer_id then
      raise exception 'customer communication job must match company and customer';
    end if;
  end if;

  if new.estimate_id is not null then
    select * into target_estimate from public.estimates where id = new.estimate_id;

    if target_estimate.id is null then
      raise exception 'estimate % not found', new.estimate_id;
    end if;

    if target_estimate.company_id <> new.company_id then
      raise exception 'customer communication estimate must match company';
    end if;
  end if;

  if new.invoice_id is not null then
    select * into target_invoice from public.invoices where id = new.invoice_id;

    if target_invoice.id is null then
      raise exception 'invoice % not found', new.invoice_id;
    end if;

    if target_invoice.company_id <> new.company_id then
      raise exception 'customer communication invoice must match company';
    end if;
  end if;

  if new.payment_id is not null then
    select * into target_payment from public.payments where id = new.payment_id;

    if target_payment.id is null then
      raise exception 'payment % not found', new.payment_id;
    end if;

    if target_payment.company_id <> new.company_id then
      raise exception 'customer communication payment must match company';
    end if;
  end if;

  if new.event_id is not null then
    select * into target_event from public.communication_events where id = new.event_id;

    if target_event.id is null then
      raise exception 'communication event % not found', new.event_id;
    end if;

    if target_event.company_id <> new.company_id
      or target_event.customer_id <> new.customer_id
      or target_event.communication_type <> new.communication_type then
      raise exception 'customer communication event must match communication context';
    end if;
  end if;

  return new;
end;
$$;

create trigger customer_communication_preferences_set_updated_at
before update on public.customer_communication_preferences
for each row
execute function public.set_updated_at();

create trigger communication_events_set_updated_at
before update on public.communication_events
for each row
execute function public.set_updated_at();

create trigger customer_communications_set_updated_at
before update on public.customer_communications
for each row
execute function public.set_updated_at();

create trigger communication_delivery_attempts_set_updated_at
before update on public.communication_delivery_attempts
for each row
execute function public.set_updated_at();

create trigger customer_communication_preferences_enforce_match
before insert or update on public.customer_communication_preferences
for each row
execute function public.enforce_customer_communication_preference_company_match();

create trigger communication_events_enforce_match
before insert or update on public.communication_events
for each row
execute function public.enforce_communication_event_context_match();

create trigger customer_communications_enforce_match
before insert or update on public.customer_communications
for each row
execute function public.enforce_customer_communication_company_match();
