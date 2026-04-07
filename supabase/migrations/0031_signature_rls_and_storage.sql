alter table public.signatures enable row level security;

create policy "signatures_select_office"
on public.signatures
for select
to authenticated
using (
  public.has_company_role(
    company_id,
    array['owner', 'admin', 'dispatcher']::public.app_role[]
  )
);

create policy "signatures_select_assigned_technician"
on public.signatures
for select
to authenticated
using (
  public.has_company_role(
    company_id,
    array['owner', 'admin', 'technician']::public.app_role[]
  )
  and public.is_assigned_technician_estimate(estimate_id)
);

create policy "signatures_insert_office"
on public.signatures
for insert
to authenticated
with check (
  captured_by_user_id = auth.uid()
  and public.has_company_role(
    company_id,
    array['owner', 'admin', 'dispatcher']::public.app_role[]
  )
);

create policy "signatures_insert_assigned_technician"
on public.signatures
for insert
to authenticated
with check (
  captured_by_user_id = auth.uid()
  and public.has_company_role(
    company_id,
    array['owner', 'admin', 'technician']::public.app_role[]
  )
  and public.is_assigned_technician_estimate(estimate_id)
);

create policy "signatures_update_office"
on public.signatures
for update
to authenticated
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

create policy "signatures_delete_office"
on public.signatures
for delete
to authenticated
using (
  public.has_company_role(
    company_id,
    array['owner', 'admin', 'dispatcher']::public.app_role[]
  )
);

create policy "signatures_delete_assigned_technician_rollback"
on public.signatures
for delete
to authenticated
using (
  captured_by_user_id = auth.uid()
  and public.has_company_role(
    company_id,
    array['owner', 'admin', 'technician']::public.app_role[]
  )
  and public.is_assigned_technician_estimate(estimate_id)
  and exists (
    select 1
    from public.estimates estimate
    where estimate.id = signatures.estimate_id
      and estimate.status = 'sent'
  )
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'estimate-signatures',
  'estimate-signatures',
  false,
  2097152,
  array['image/png']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "estimate_signatures_select_authorized"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'estimate-signatures'
  and exists (
    select 1
    from public.signatures signature
    where signature.storage_bucket = bucket_id
      and signature.storage_path = name
      and (
        public.has_company_role(
          signature.company_id,
          array['owner', 'admin', 'dispatcher']::public.app_role[]
        )
        or (
          public.has_company_role(
            signature.company_id,
            array['owner', 'admin', 'technician']::public.app_role[]
          )
          and public.is_assigned_technician_estimate(signature.estimate_id)
        )
      )
  )
);

create policy "estimate_signatures_insert_authorized"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'estimate-signatures'
  and exists (
    select 1
    from public.signatures signature
    where signature.storage_bucket = bucket_id
      and signature.storage_path = name
      and signature.captured_by_user_id = auth.uid()
      and (
        public.has_company_role(
          signature.company_id,
          array['owner', 'admin', 'dispatcher']::public.app_role[]
        )
        or (
          public.has_company_role(
            signature.company_id,
            array['owner', 'admin', 'technician']::public.app_role[]
          )
          and public.is_assigned_technician_estimate(signature.estimate_id)
        )
      )
  )
);

create policy "estimate_signatures_delete_office"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'estimate-signatures'
  and exists (
    select 1
    from public.signatures signature
    where signature.storage_bucket = bucket_id
      and signature.storage_path = name
      and public.has_company_role(
        signature.company_id,
        array['owner', 'admin', 'dispatcher']::public.app_role[]
      )
  )
);

create policy "estimate_signatures_delete_assigned_technician_rollback"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'estimate-signatures'
  and exists (
    select 1
    from public.signatures signature
    join public.estimates estimate
      on estimate.id = signature.estimate_id
    where signature.storage_bucket = bucket_id
      and signature.storage_path = name
      and signature.captured_by_user_id = auth.uid()
      and estimate.status = 'sent'
      and public.has_company_role(
        signature.company_id,
        array['owner', 'admin', 'technician']::public.app_role[]
      )
      and public.is_assigned_technician_estimate(signature.estimate_id)
  )
);
