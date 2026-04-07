create type public.estimate_status as enum (
  'draft',
  'sent',
  'accepted',
  'declined',
  'void'
);

create table public.estimates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  job_id uuid not null references public.jobs (id) on delete cascade,
  status public.estimate_status not null default 'draft',
  estimate_number text not null,
  title text not null,
  notes text,
  terms text,
  currency_code text not null default 'USD',
  tax_rate_basis_points integer not null default 0,
  subtotal_cents integer not null default 0,
  discount_cents integer not null default 0,
  tax_cents integer not null default 0,
  total_cents integer not null default 0,
  sent_at timestamptz,
  accepted_at timestamptz,
  declined_at timestamptz,
  voided_at timestamptz,
  created_by_user_id uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint estimates_estimate_number_not_blank check (btrim(estimate_number) <> ''),
  constraint estimates_title_not_blank check (btrim(title) <> ''),
  constraint estimates_currency_code_usd check (currency_code = 'USD'),
  constraint estimates_tax_rate_nonnegative check (tax_rate_basis_points >= 0),
  constraint estimates_subtotal_nonnegative check (subtotal_cents >= 0),
  constraint estimates_discount_nonnegative check (discount_cents >= 0),
  constraint estimates_tax_nonnegative check (tax_cents >= 0),
  constraint estimates_total_nonnegative check (total_cents >= 0),
  constraint estimates_company_estimate_number_unique unique (company_id, estimate_number),
  constraint estimates_job_id_unique unique (job_id)
);

create table public.estimate_line_items (
  id uuid primary key default gen_random_uuid(),
  estimate_id uuid not null references public.estimates (id) on delete cascade,
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
  constraint estimate_line_items_position_nonnegative check (position >= 0),
  constraint estimate_line_items_item_type_valid check (item_type in ('labor', 'part', 'fee')),
  constraint estimate_line_items_name_not_blank check (btrim(name) <> ''),
  constraint estimate_line_items_quantity_positive check (quantity > 0),
  constraint estimate_line_items_unit_price_nonnegative check (unit_price_cents >= 0),
  constraint estimate_line_items_line_subtotal_nonnegative check (line_subtotal_cents >= 0),
  constraint estimate_line_items_estimate_position_unique unique (estimate_id, position)
);

create index estimates_company_id_idx on public.estimates (company_id);
create index estimates_job_id_idx on public.estimates (job_id);
create index estimates_status_idx on public.estimates (company_id, status);
create index estimates_created_at_idx on public.estimates (company_id, created_at desc);

create index estimate_line_items_estimate_id_idx on public.estimate_line_items (estimate_id, position);
create index estimate_line_items_company_id_idx on public.estimate_line_items (company_id);
create index estimate_line_items_job_id_idx on public.estimate_line_items (job_id);

create trigger estimates_set_updated_at
before update on public.estimates
for each row
execute function public.set_updated_at();

create trigger estimate_line_items_set_updated_at
before update on public.estimate_line_items
for each row
execute function public.set_updated_at();

create or replace function public.enforce_estimate_company_match()
returns trigger
language plpgsql
as $$
declare
  target_job public.jobs%rowtype;
begin
  select *
  into target_job
  from public.jobs
  where id = new.job_id;

  if target_job.id is null then
    raise exception 'job % not found', new.job_id;
  end if;

  if new.company_id <> target_job.company_id then
    raise exception 'estimates.company_id must match jobs.company_id';
  end if;

  return new;
end;
$$;

create or replace function public.enforce_estimate_line_item_parent_match()
returns trigger
language plpgsql
as $$
declare
  target_estimate public.estimates%rowtype;
begin
  select *
  into target_estimate
  from public.estimates
  where id = new.estimate_id;

  if target_estimate.id is null then
    raise exception 'estimate % not found', new.estimate_id;
  end if;

  if new.company_id <> target_estimate.company_id then
    raise exception 'estimate_line_items.company_id must match estimates.company_id';
  end if;

  if new.job_id <> target_estimate.job_id then
    raise exception 'estimate_line_items.job_id must match estimates.job_id';
  end if;

  return new;
end;
$$;

create or replace function public.is_valid_estimate_status_transition(
  current_status public.estimate_status,
  next_status public.estimate_status
)
returns boolean
language sql
immutable
as $$
  select case
    when current_status = next_status then true
    when current_status = 'draft' and next_status in ('sent', 'void') then true
    when current_status = 'sent' and next_status in ('accepted', 'declined', 'void') then true
    else false
  end;
$$;

create or replace function public.validate_estimate_status_change()
returns trigger
language plpgsql
as $$
begin
  if not public.is_valid_estimate_status_transition(old.status, new.status) then
    raise exception 'invalid estimate status transition from % to %', old.status, new.status;
  end if;

  return new;
end;
$$;

create or replace function public.set_estimate_status_timestamps()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from old.status then
    if new.status = 'sent' and new.sent_at is null then
      new.sent_at = timezone('utc', now());
    end if;

    if new.status = 'accepted' and new.accepted_at is null then
      new.accepted_at = timezone('utc', now());
    end if;

    if new.status = 'declined' and new.declined_at is null then
      new.declined_at = timezone('utc', now());
    end if;

    if new.status = 'void' and new.voided_at is null then
      new.voided_at = timezone('utc', now());
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.prevent_terminal_estimate_mutation()
returns trigger
language plpgsql
as $$
begin
  if old.status in ('accepted', 'declined', 'void') then
    raise exception 'terminal estimates cannot be modified';
  end if;

  return new;
end;
$$;

create or replace function public.prevent_terminal_estimate_line_item_mutation()
returns trigger
language plpgsql
as $$
declare
  target_estimate_id uuid;
  target_status public.estimate_status;
begin
  target_estimate_id := coalesce(new.estimate_id, old.estimate_id);

  select status
  into target_status
  from public.estimates
  where id = target_estimate_id;

  if target_status is null then
    raise exception 'estimate % not found', target_estimate_id;
  end if;

  if target_status in ('accepted', 'declined', 'void') then
    raise exception 'terminal estimates cannot be modified';
  end if;

  return coalesce(new, old);
end;
$$;

create trigger estimates_enforce_company_match
before insert or update on public.estimates
for each row
execute function public.enforce_estimate_company_match();

create trigger estimates_validate_status_change
before update on public.estimates
for each row
when (new.status is distinct from old.status)
execute function public.validate_estimate_status_change();

create trigger estimates_set_status_timestamps
before update on public.estimates
for each row
execute function public.set_estimate_status_timestamps();

create trigger estimates_prevent_terminal_mutation
before update on public.estimates
for each row
when (old.status in ('accepted', 'declined', 'void'))
execute function public.prevent_terminal_estimate_mutation();

create trigger estimate_line_items_enforce_parent_match
before insert or update on public.estimate_line_items
for each row
execute function public.enforce_estimate_line_item_parent_match();

create trigger estimate_line_items_prevent_terminal_mutation
before insert or update or delete on public.estimate_line_items
for each row
execute function public.prevent_terminal_estimate_line_item_mutation();
