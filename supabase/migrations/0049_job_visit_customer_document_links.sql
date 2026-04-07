alter table public.customer_document_links
  drop constraint if exists customer_document_links_target_check;

alter table public.customer_document_links
  add constraint customer_document_links_target_check check (
    (
      document_kind = 'estimate'
      and estimate_id is not null
      and invoice_id is null
    )
    or (
      document_kind = 'invoice'
      and invoice_id is not null
      and estimate_id is null
    )
    or (
      document_kind = 'job_visit'
      and estimate_id is null
      and invoice_id is null
    )
  );

alter table public.customer_document_link_events
  drop constraint if exists customer_document_link_events_target_check;

alter table public.customer_document_link_events
  add constraint customer_document_link_events_target_check check (
    (
      document_kind = 'estimate'
      and estimate_id is not null
      and invoice_id is null
    )
    or (
      document_kind = 'invoice'
      and invoice_id is not null
      and estimate_id is null
    )
    or (
      document_kind = 'job_visit'
      and estimate_id is null
      and invoice_id is null
    )
  );

create unique index customer_document_links_active_job_visit_unique_idx
  on public.customer_document_links (job_id)
  where document_kind = 'job_visit' and status = 'active';

create index customer_document_links_job_visit_status_idx
  on public.customer_document_links (job_id, status)
  where document_kind = 'job_visit';

create or replace function public.enforce_customer_document_link_parent_match()
returns trigger
language plpgsql
as $$
declare
  target_estimate public.estimates%rowtype;
  target_invoice public.invoices%rowtype;
  target_job public.jobs%rowtype;
begin
  select *
  into target_job
  from public.jobs
  where id = new.job_id;

  if target_job.id is null then
    raise exception 'job % not found', new.job_id;
  end if;

  if target_job.company_id <> new.company_id then
    raise exception 'customer_document_links.company_id must match jobs.company_id';
  end if;

  if target_job.customer_id <> new.customer_id then
    raise exception 'customer_document_links.customer_id must match jobs.customer_id';
  end if;

  if new.document_kind = 'estimate' then
    select *
    into target_estimate
    from public.estimates
    where id = new.estimate_id;

    if target_estimate.id is null then
      raise exception 'estimate % not found', new.estimate_id;
    end if;

    if target_estimate.company_id <> new.company_id then
      raise exception 'customer_document_links.company_id must match estimates.company_id';
    end if;

    if target_estimate.job_id <> new.job_id then
      raise exception 'customer_document_links.job_id must match estimates.job_id';
    end if;
  elsif new.document_kind = 'invoice' then
    select *
    into target_invoice
    from public.invoices
    where id = new.invoice_id;

    if target_invoice.id is null then
      raise exception 'invoice % not found', new.invoice_id;
    end if;

    if target_invoice.company_id <> new.company_id then
      raise exception 'customer_document_links.company_id must match invoices.company_id';
    end if;

    if target_invoice.job_id <> new.job_id then
      raise exception 'customer_document_links.job_id must match invoices.job_id';
    end if;
  else
    if new.estimate_id is not null or new.invoice_id is not null then
      raise exception 'job visit links must not reference estimate or invoice';
    end if;
  end if;

  return new;
end;
$$;