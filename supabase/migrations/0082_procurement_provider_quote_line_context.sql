alter table public.procurement_provider_quote_lines
  add column if not exists provider_location_key text;

create or replace function public.enforce_procurement_provider_quote_line_context()
returns trigger
language plpgsql
as $$
declare
  quote_provider_account_id uuid;
  mapping_provider_account_id uuid;
  mapping_provider_location_key text;
begin
  if new.provider_supplier_mapping_id is null then
    return new;
  end if;

  select provider_account_id
  into quote_provider_account_id
  from public.procurement_provider_quotes
  where id = new.provider_quote_id
    and company_id = new.company_id;

  if quote_provider_account_id is null then
    raise exception 'Provider quote is missing or outside company context.'
      using errcode = '23514';
  end if;

  select provider_account_id, provider_location_key
  into mapping_provider_account_id, mapping_provider_location_key
  from public.procurement_provider_supplier_mappings
  where id = new.provider_supplier_mapping_id
    and company_id = new.company_id;

  if mapping_provider_account_id is null then
    raise exception 'Provider supplier mapping is missing or outside company context.'
      using errcode = '23514';
  end if;

  if mapping_provider_account_id <> quote_provider_account_id then
    raise exception 'Provider supplier mapping must belong to the same provider account as the quote.'
      using errcode = '23514';
  end if;

  if new.provider_location_key is null then
    new.provider_location_key := mapping_provider_location_key;
  end if;

  return new;
end;
$$;

drop trigger if exists procurement_provider_quote_lines_enforce_context
  on public.procurement_provider_quote_lines;

create trigger procurement_provider_quote_lines_enforce_context
before insert or update on public.procurement_provider_quote_lines
for each row
execute function public.enforce_procurement_provider_quote_line_context();
