create or replace function public.is_assigned_technician_estimate_request(target_request_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.part_requests request
    where request.id = target_request_id
      and request.estimate_id is not null
      and public.is_assigned_technician_draft_estimate(request.estimate_id)
  );
$$;

create or replace function public.is_assigned_technician_part_request_line(target_line_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.part_request_lines line
    where line.id = target_line_id
      and public.is_assigned_technician_estimate_request(line.part_request_id)
  );
$$;

create or replace function public.is_assigned_technician_estimate_manual_cart(target_cart_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.supplier_carts cart
    where cart.id = target_cart_id
      and cart.created_by_user_id = auth.uid()
      and (
        exists (
          select 1
          from public.supplier_cart_lines line
          where line.cart_id = cart.id
            and public.is_assigned_technician_part_request_line(line.part_request_line_id)
        )
        or (
          cart.status = 'open'
          and cart.source_bucket_key ~ '^estimate-manual:[0-9a-fA-F-]{36}$'
          and public.is_assigned_technician_estimate_request(
            split_part(cart.source_bucket_key, ':', 2)::uuid
          )
        )
      )
  );
$$;

create policy "supplier_accounts_select_technician"
on public.supplier_accounts
for select
to authenticated
using (
  public.has_company_role(
    company_id,
    array['owner', 'admin', 'dispatcher', 'technician']::public.app_role[]
  )
);

create policy "supplier_accounts_insert_technician"
on public.supplier_accounts
for insert
to authenticated
with check (
  public.has_company_role(
    company_id,
    array['owner', 'admin', 'dispatcher', 'technician']::public.app_role[]
  )
);

create policy "part_requests_select_assigned_technician_draft"
on public.part_requests
for select
to authenticated
using (public.is_assigned_technician_estimate_request(id));

create policy "part_requests_insert_assigned_technician_draft"
on public.part_requests
for insert
to authenticated
with check (
  requested_by_user_id = auth.uid()
  and estimate_id is not null
  and public.is_assigned_technician_draft_estimate(estimate_id)
);

create policy "part_requests_update_assigned_technician_draft"
on public.part_requests
for update
to authenticated
using (public.is_assigned_technician_estimate_request(id))
with check (
  estimate_id is not null
  and public.is_assigned_technician_draft_estimate(estimate_id)
);

create policy "part_request_lines_select_assigned_technician_draft"
on public.part_request_lines
for select
to authenticated
using (public.is_assigned_technician_part_request_line(id));

create policy "part_request_lines_insert_assigned_technician_draft"
on public.part_request_lines
for insert
to authenticated
with check (
  created_by_user_id = auth.uid()
  and public.is_assigned_technician_estimate_request(part_request_id)
);

create policy "part_request_lines_update_assigned_technician_draft"
on public.part_request_lines
for update
to authenticated
using (public.is_assigned_technician_part_request_line(id))
with check (
  public.is_assigned_technician_estimate_request(part_request_id)
);

create policy "part_request_lines_delete_assigned_technician_draft"
on public.part_request_lines
for delete
to authenticated
using (public.is_assigned_technician_part_request_line(id));

create policy "supplier_carts_select_assigned_technician_draft"
on public.supplier_carts
for select
to authenticated
using (public.is_assigned_technician_estimate_manual_cart(id));

create policy "supplier_carts_insert_assigned_technician_draft"
on public.supplier_carts
for insert
to authenticated
with check (
  created_by_user_id = auth.uid()
  and public.has_company_role(
    company_id,
    array['owner', 'admin', 'dispatcher', 'technician']::public.app_role[]
  )
  and source_bucket_key ~ '^estimate-manual:[0-9a-fA-F-]{36}$'
  and public.is_assigned_technician_estimate_request(
    split_part(source_bucket_key, ':', 2)::uuid
  )
);

create policy "supplier_cart_lines_select_assigned_technician_draft"
on public.supplier_cart_lines
for select
to authenticated
using (
  public.is_assigned_technician_estimate_manual_cart(cart_id)
  and public.is_assigned_technician_part_request_line(part_request_line_id)
);

create policy "supplier_cart_lines_insert_assigned_technician_draft"
on public.supplier_cart_lines
for insert
to authenticated
with check (
  public.is_assigned_technician_estimate_manual_cart(cart_id)
  and public.is_assigned_technician_part_request_line(part_request_line_id)
);

create policy "supplier_cart_lines_update_assigned_technician_draft"
on public.supplier_cart_lines
for update
to authenticated
using (
  public.is_assigned_technician_estimate_manual_cart(cart_id)
  and public.is_assigned_technician_part_request_line(part_request_line_id)
)
with check (
  public.is_assigned_technician_estimate_manual_cart(cart_id)
  and public.is_assigned_technician_part_request_line(part_request_line_id)
);

create policy "supplier_cart_lines_delete_assigned_technician_draft"
on public.supplier_cart_lines
for delete
to authenticated
using (
  public.is_assigned_technician_estimate_manual_cart(cart_id)
  and public.is_assigned_technician_part_request_line(part_request_line_id)
);
