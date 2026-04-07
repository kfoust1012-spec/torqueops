create or replace function public.sync_invoice_balance_due()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'paid' then
    new.amount_paid_cents = new.total_cents;
    new.balance_due_cents = 0;
    return new;
  end if;

  if new.status = 'void' then
    new.balance_due_cents = 0;
    return new;
  end if;

  new.balance_due_cents = greatest(new.total_cents - new.amount_paid_cents, 0);
  return new;
end;
$$;

create trigger invoices_sync_balance_due
before insert or update on public.invoices
for each row
execute function public.sync_invoice_balance_due();
