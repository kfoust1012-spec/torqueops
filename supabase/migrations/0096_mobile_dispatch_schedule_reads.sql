create policy "dispatch_calendar_settings_select_mobile"
on public.dispatch_calendar_settings
for select
to authenticated
using (
  public.has_company_role(
    company_id,
    array['owner', 'admin', 'dispatcher', 'technician']::public.app_role[]
  )
);

create policy "technician_availability_blocks_select_self"
on public.technician_availability_blocks
for select
to authenticated
using (
  public.has_company_role(
    company_id,
    array['owner', 'admin', 'dispatcher']::public.app_role[]
  )
  or (
    technician_user_id = auth.uid()
    and public.has_company_role(
      company_id,
      array['technician']::public.app_role[]
    )
  )
);
