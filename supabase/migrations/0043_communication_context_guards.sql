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

  case new.communication_type
    when 'estimate_notification' then
      if new.event_type <> 'estimate_notification_requested' then
        raise exception 'estimate notifications require estimate_notification_requested event type';
      end if;
    when 'invoice_notification' then
      if new.event_type <> 'invoice_notification_requested' then
        raise exception 'invoice notifications require invoice_notification_requested event type';
      end if;
    when 'payment_reminder' then
      if new.event_type <> 'payment_reminder_requested' then
        raise exception 'payment reminders require payment_reminder_requested event type';
      end if;
    when 'appointment_confirmation' then
      if new.event_type <> 'appointment_confirmation_requested' then
        raise exception 'appointment confirmations require appointment_confirmation_requested event type';
      end if;
    when 'dispatch_update' then
      if new.event_type <> 'dispatch_update_requested' then
        raise exception 'dispatch updates require dispatch_update_requested event type';
      end if;
  end case;

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

    if new.job_id is null or target_estimate.job_id <> new.job_id then
      raise exception 'customer communication estimate must match job context';
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

    if new.job_id is null or target_invoice.job_id <> new.job_id then
      raise exception 'customer communication invoice must match job context';
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

    if new.job_id is null or target_payment.job_id <> new.job_id then
      raise exception 'customer communication payment must match job context';
    end if;

    if new.invoice_id is null or target_payment.invoice_id <> new.invoice_id then
      raise exception 'customer communication payment must match invoice context';
    end if;
  end if;

  if new.event_id is not null then
    select * into target_event from public.communication_events where id = new.event_id;

    if target_event.id is null then
      raise exception 'communication event % not found', new.event_id;
    end if;

    if target_event.company_id <> new.company_id
      or target_event.customer_id <> new.customer_id
      or target_event.communication_type <> new.communication_type
      or target_event.job_id is distinct from new.job_id
      or target_event.estimate_id is distinct from new.estimate_id
      or target_event.invoice_id is distinct from new.invoice_id
      or target_event.payment_id is distinct from new.payment_id then
      raise exception 'customer communication event must match full communication context';
    end if;
  end if;

  return new;
end;
$$;