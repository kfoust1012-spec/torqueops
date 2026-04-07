create or replace function public.prevent_sending_empty_estimate()
returns trigger
language plpgsql
as $$
declare
  line_item_count bigint;
begin
  if new.status = 'sent' and new.status is distinct from old.status then
    select count(*)
    into line_item_count
    from public.estimate_line_items
    where estimate_id = new.id;

    if line_item_count = 0 then
      raise exception 'estimate must contain at least one line item before it can be sent';
    end if;
  end if;

  return new;
end;
$$;

create trigger estimates_prevent_sending_empty
before update on public.estimates
for each row
when (new.status is distinct from old.status)
execute function public.prevent_sending_empty_estimate();
