create or replace function public.prevent_locked_estimate_mutation()
returns trigger
language plpgsql
as $$
begin
  if old.status in ('accepted', 'declined', 'void') then
    raise exception 'locked estimates cannot be modified';
  end if;

  if old.status = 'sent' then
    if new.status = old.status then
      raise exception 'sent estimates cannot be modified';
    end if;

    if new.status not in ('accepted', 'declined', 'void') then
      raise exception 'invalid estimate status transition from sent to %', new.status;
    end if;

    if new.estimate_number is distinct from old.estimate_number
      or new.title is distinct from old.title
      or new.notes is distinct from old.notes
      or new.terms is distinct from old.terms
      or new.currency_code is distinct from old.currency_code
      or new.tax_rate_basis_points is distinct from old.tax_rate_basis_points
      or new.subtotal_cents is distinct from old.subtotal_cents
      or new.discount_cents is distinct from old.discount_cents
      or new.tax_cents is distinct from old.tax_cents
      or new.total_cents is distinct from old.total_cents
      or new.company_id is distinct from old.company_id
      or new.job_id is distinct from old.job_id
      or new.created_by_user_id is distinct from old.created_by_user_id
    then
      raise exception 'sent estimates cannot be modified except for final status change';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.prevent_locked_estimate_line_item_mutation()
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

  if target_status in ('sent', 'accepted', 'declined', 'void') then
    raise exception 'locked estimates cannot be modified';
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists estimates_prevent_terminal_mutation on public.estimates;
create trigger estimates_prevent_locked_mutation
before update on public.estimates
for each row
when (old.status in ('sent', 'accepted', 'declined', 'void'))
execute function public.prevent_locked_estimate_mutation();

drop trigger if exists estimate_line_items_prevent_terminal_mutation on public.estimate_line_items;
create trigger estimate_line_items_prevent_locked_mutation
before insert or update or delete on public.estimate_line_items
for each row
execute function public.prevent_locked_estimate_line_item_mutation();
