alter table public.customer_document_links enable row level security;
alter table public.customer_document_link_events enable row level security;

create policy "customer_document_links_select_office"
on public.customer_document_links
for select
using (
  public.has_company_role(
    company_id,
    array['owner', 'admin', 'dispatcher']::public.app_role[]
  )
);

create policy "customer_document_links_insert_office"
on public.customer_document_links
for insert
with check (
  public.has_company_role(
    company_id,
    array['owner', 'admin', 'dispatcher']::public.app_role[]
  )
);

create policy "customer_document_links_update_office"
on public.customer_document_links
for update
using (
  public.has_company_role(
    company_id,
    array['owner', 'admin', 'dispatcher']::public.app_role[]
  )
)
with check (
  public.has_company_role(
    company_id,
    array['owner', 'admin', 'dispatcher']::public.app_role[]
  )
);

create policy "customer_document_link_events_select_office"
on public.customer_document_link_events
for select
using (
  public.has_company_role(
    company_id,
    array['owner', 'admin', 'dispatcher']::public.app_role[]
  )
);

create policy "customer_document_link_events_insert_office"
on public.customer_document_link_events
for insert
with check (
  public.has_company_role(
    company_id,
    array['owner', 'admin', 'dispatcher']::public.app_role[]
  )
);