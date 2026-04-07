create or replace function public.sync_estimate_line_item_subtotal()
returns trigger
language plpgsql
as $$
begin
  new.line_subtotal_cents := round((new.quantity * new.unit_price_cents)::numeric)::integer;
  return new;
end;
$$;

create trigger estimate_line_items_sync_subtotal
before insert or update on public.estimate_line_items
for each row
execute function public.sync_estimate_line_item_subtotal();
