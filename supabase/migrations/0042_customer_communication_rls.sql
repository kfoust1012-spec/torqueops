alter table public.customer_communication_preferences enable row level security;
alter table public.communication_events enable row level security;
alter table public.customer_communications enable row level security;
alter table public.communication_delivery_attempts enable row level security;

create policy "customer_communication_preferences_select_office"
on public.customer_communication_preferences
for select
using (
  public.has_company_role(
    company_id,
    array['owner', 'admin', 'dispatcher']::public.app_role[]
  )
);

create policy "customer_communication_preferences_insert_office"
on public.customer_communication_preferences
for insert
with check (
  public.has_company_role(
    company_id,
    array['owner', 'admin', 'dispatcher']::public.app_role[]
  )
);

create policy "customer_communication_preferences_update_office"
on public.customer_communication_preferences
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

create policy "communication_events_select_office"
on public.communication_events
for select
using (
  public.has_company_role(
    company_id,
    array['owner', 'admin', 'dispatcher']::public.app_role[]
  )
);

create policy "communication_events_insert_office"
on public.communication_events
for insert
with check (
  public.has_company_role(
    company_id,
    array['owner', 'admin', 'dispatcher']::public.app_role[]
  )
);

create policy "customer_communications_select_office"
on public.customer_communications
for select
using (
  public.has_company_role(
    company_id,
    array['owner', 'admin', 'dispatcher']::public.app_role[]
  )
);

create policy "customer_communications_insert_office"
on public.customer_communications
for insert
with check (
  public.has_company_role(
    company_id,
    array['owner', 'admin', 'dispatcher']::public.app_role[]
  )
);

create policy "communication_delivery_attempts_select_office"
on public.communication_delivery_attempts
for select
using (
  exists (
    select 1
    from public.customer_communications communication
    where communication.id = communication_id
      and public.has_company_role(
        communication.company_id,
        array['owner', 'admin', 'dispatcher']::public.app_role[]
      )
  )
);
