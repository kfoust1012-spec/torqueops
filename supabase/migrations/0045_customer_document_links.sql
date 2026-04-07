create type public.customer_document_kind as enum (
  'estimate',
  'invoice'
);

create type public.customer_document_link_status as enum (
  'active',
  'expired',
  'revoked',
  'completed'
);

create type public.customer_document_event_type as enum (
  'created',
  'sent',
  'viewed',
  'copied',
  'approval_started',
  'approved',
  'declined',
  'payment_started',
  'payment_succeeded',
  'payment_failed',
  'expired',
  'revoked'
);

alter table public.signatures
  alter column captured_by_user_id drop not null;

create table public.customer_document_links (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  job_id uuid not null references public.jobs (id) on delete cascade,
  document_kind public.customer_document_kind not null,
  estimate_id uuid references public.estimates (id) on delete cascade,
  invoice_id uuid references public.invoices (id) on delete cascade,
  access_token_hash text not null,
  status public.customer_document_link_status not null default 'active',
  expires_at timestamptz not null,
  first_viewed_at timestamptz,
  last_viewed_at timestamptz,
  view_count integer not null default 0,
  sent_at timestamptz,
  completed_at timestamptz,
  revoked_at timestamptz,
  revoked_reason text,
  last_sent_communication_id uuid references public.customer_communications (id) on delete set null,
  created_by_user_id uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint customer_document_links_access_token_hash_not_blank check (btrim(access_token_hash) <> ''),
  constraint customer_document_links_view_count_nonnegative check (view_count >= 0),
  constraint customer_document_links_revoke_reason_not_blank check (
    revoked_reason is null or btrim(revoked_reason) <> ''
  ),
  constraint customer_document_links_target_check check (
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
  ),
  constraint customer_document_links_completed_state_check check (
    (status = 'completed' and completed_at is not null)
    or (status <> 'completed' and completed_at is null)
  ),
  constraint customer_document_links_revoked_state_check check (
    (status = 'revoked' and revoked_at is not null)
    or (status <> 'revoked' and revoked_at is null)
  ),
  constraint customer_document_links_access_token_hash_unique unique (access_token_hash)
);

create unique index customer_document_links_active_estimate_unique_idx
  on public.customer_document_links (estimate_id)
  where document_kind = 'estimate' and status = 'active';

create unique index customer_document_links_active_invoice_unique_idx
  on public.customer_document_links (invoice_id)
  where document_kind = 'invoice' and status = 'active';

create index customer_document_links_company_idx
  on public.customer_document_links (company_id, created_at desc);

create index customer_document_links_estimate_status_idx
  on public.customer_document_links (estimate_id, status)
  where estimate_id is not null;

create index customer_document_links_invoice_status_idx
  on public.customer_document_links (invoice_id, status)
  where invoice_id is not null;

create table public.customer_document_link_events (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null references public.customer_document_links (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  job_id uuid not null references public.jobs (id) on delete cascade,
  document_kind public.customer_document_kind not null,
  estimate_id uuid references public.estimates (id) on delete cascade,
  invoice_id uuid references public.invoices (id) on delete cascade,
  event_type public.customer_document_event_type not null,
  occurred_at timestamptz not null default timezone('utc', now()),
  ip_address inet,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  created_by_user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint customer_document_link_events_target_check check (
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
  )
);

create index customer_document_link_events_link_idx
  on public.customer_document_link_events (link_id, occurred_at desc);

create index customer_document_link_events_company_idx
  on public.customer_document_link_events (company_id, occurred_at desc);

create trigger customer_document_links_set_updated_at
before update on public.customer_document_links
for each row
execute function public.set_updated_at();

create or replace function public.enforce_customer_document_link_parent_match()
returns trigger
language plpgsql
as $$
declare
  target_estimate public.estimates%rowtype;
  target_invoice public.invoices%rowtype;
  target_job public.jobs%rowtype;
begin
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
  else
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
  end if;

  select *
  into target_job
  from public.jobs
  where id = new.job_id;

  if target_job.id is null then
    raise exception 'job % not found', new.job_id;
  end if;

  if target_job.customer_id <> new.customer_id then
    raise exception 'customer_document_links.customer_id must match jobs.customer_id';
  end if;

  return new;
end;
$$;

create or replace function public.enforce_customer_document_link_event_match()
returns trigger
language plpgsql
as $$
declare
  target_link public.customer_document_links%rowtype;
begin
  select *
  into target_link
  from public.customer_document_links
  where id = new.link_id;

  if target_link.id is null then
    raise exception 'customer document link % not found', new.link_id;
  end if;

  if new.company_id <> target_link.company_id then
    raise exception 'customer_document_link_events.company_id must match customer_document_links.company_id';
  end if;

  if new.customer_id <> target_link.customer_id then
    raise exception 'customer_document_link_events.customer_id must match customer_document_links.customer_id';
  end if;

  if new.job_id <> target_link.job_id then
    raise exception 'customer_document_link_events.job_id must match customer_document_links.job_id';
  end if;

  if new.document_kind <> target_link.document_kind then
    raise exception 'customer_document_link_events.document_kind must match customer_document_links.document_kind';
  end if;

  if new.estimate_id is distinct from target_link.estimate_id then
    raise exception 'customer_document_link_events.estimate_id must match customer_document_links.estimate_id';
  end if;

  if new.invoice_id is distinct from target_link.invoice_id then
    raise exception 'customer_document_link_events.invoice_id must match customer_document_links.invoice_id';
  end if;

  return new;
end;
$$;

create trigger customer_document_links_enforce_parent_match
before insert or update on public.customer_document_links
for each row
execute function public.enforce_customer_document_link_parent_match();

create trigger customer_document_link_events_enforce_match
before insert or update on public.customer_document_link_events
for each row
execute function public.enforce_customer_document_link_event_match();