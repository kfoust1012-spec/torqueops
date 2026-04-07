create or replace function public.recalculate_invoice_totals(target_invoice_id uuid)
returns void
language plpgsql
as $$
declare
  target_invoice public.invoices%rowtype;
  subtotal_value integer;
  taxable_subtotal_value integer;
  effective_discount integer;
  effective_taxable_discount integer;
  tax_value integer;
  total_value integer;
begin
  select *
  into target_invoice
  from public.invoices
  where id = target_invoice_id;

  if target_invoice.id is null then
    raise exception 'invoice % not found', target_invoice_id;
  end if;

  select coalesce(sum(line_subtotal_cents), 0)
  into subtotal_value
  from public.invoice_line_items
  where invoice_id = target_invoice_id;

  select coalesce(sum(line_subtotal_cents), 0)
  into taxable_subtotal_value
  from public.invoice_line_items
  where invoice_id = target_invoice_id
    and taxable = true;

  effective_discount := least(target_invoice.discount_cents, subtotal_value);
  effective_taxable_discount := least(target_invoice.discount_cents, taxable_subtotal_value);

  tax_value := round(
    greatest(taxable_subtotal_value - effective_taxable_discount, 0)
    * target_invoice.tax_rate_basis_points / 10000.0
  )::integer;
  total_value := greatest(subtotal_value - effective_discount, 0) + tax_value;

  update public.invoices
  set
    subtotal_cents = subtotal_value,
    tax_cents = tax_value,
    total_cents = total_value
  where id = target_invoice_id;
end;
$$;
