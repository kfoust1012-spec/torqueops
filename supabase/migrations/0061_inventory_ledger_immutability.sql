drop policy if exists "inventory_transactions_update_office" on public.inventory_transactions;
drop policy if exists "inventory_transactions_delete_office" on public.inventory_transactions;

create or replace function public.prevent_inventory_transaction_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'inventory_transactions is append-only and cannot be updated or deleted';
end;
$$;

drop trigger if exists inventory_transactions_prevent_update on public.inventory_transactions;
create trigger inventory_transactions_prevent_update
before update on public.inventory_transactions
for each row
execute function public.prevent_inventory_transaction_mutation();

drop trigger if exists inventory_transactions_prevent_delete on public.inventory_transactions;
create trigger inventory_transactions_prevent_delete
before delete on public.inventory_transactions
for each row
execute function public.prevent_inventory_transaction_mutation();
