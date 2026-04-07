alter table public.attachments enable row level security;

create or replace function public.enforce_assigned_technician_attachment_update()
returns trigger
language plpgsql
as $$
begin
  if public.has_company_role(
    old.company_id,
    array['owner', 'admin', 'dispatcher']::public.app_role[]
  ) then
    return new;
  end if;

  if old.uploaded_by_user_id is distinct from auth.uid() then
    return new;
  end if;

  if new.company_id is distinct from old.company_id
    or new.job_id is distinct from old.job_id
    or new.inspection_id is distinct from old.inspection_id
    or new.inspection_item_id is distinct from old.inspection_item_id
    or new.uploaded_by_user_id is distinct from old.uploaded_by_user_id
    or new.storage_bucket is distinct from old.storage_bucket
    or new.storage_path is distinct from old.storage_path
    or new.file_name is distinct from old.file_name
    or new.mime_type is distinct from old.mime_type
    or new.file_size_bytes is distinct from old.file_size_bytes
    or new.created_at is distinct from old.created_at
  then
    raise exception 'assigned technicians may only update attachment category and caption';
  end if;

  return new;
end;
$$;

create trigger attachments_enforce_assigned_technician_update
before update on public.attachments
for each row
execute function public.enforce_assigned_technician_attachment_update();

create policy "attachments_select_office"
on public.attachments
for select
to authenticated
using (
  public.has_company_role(
    company_id,
    array['owner', 'admin', 'dispatcher']::public.app_role[]
  )
);

create policy "attachments_select_assigned_technician"
on public.attachments
for select
to authenticated
using (
  public.has_company_role(
    company_id,
    array['owner', 'admin', 'technician']::public.app_role[]
  )
  and public.is_assigned_technician_job(job_id)
);

create policy "attachments_insert_office"
on public.attachments
for insert
to authenticated
with check (
  uploaded_by_user_id = auth.uid()
  and public.has_company_role(
    company_id,
    array['owner', 'admin', 'dispatcher']::public.app_role[]
  )
);

create policy "attachments_insert_assigned_technician"
on public.attachments
for insert
to authenticated
with check (
  uploaded_by_user_id = auth.uid()
  and public.has_company_role(
    company_id,
    array['owner', 'admin', 'technician']::public.app_role[]
  )
  and public.is_assigned_technician_job(job_id)
);

create policy "attachments_update_office"
on public.attachments
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

create policy "attachments_update_assigned_technician"
on public.attachments
for update
to authenticated
using (
  uploaded_by_user_id = auth.uid()
  and public.has_company_role(
    company_id,
    array['owner', 'admin', 'technician']::public.app_role[]
  )
  and public.is_assigned_technician_job(job_id)
)
with check (
  uploaded_by_user_id = auth.uid()
  and public.has_company_role(
    company_id,
    array['owner', 'admin', 'technician']::public.app_role[]
  )
  and public.is_assigned_technician_job(job_id)
);

create policy "attachments_delete_office"
on public.attachments
for delete
to authenticated
using (
  public.has_company_role(
    company_id,
    array['owner', 'admin', 'dispatcher']::public.app_role[]
  )
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'job-attachments',
  'job-attachments',
  false,
  15728640,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "job_attachments_select_authorized"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'job-attachments'
  and exists (
    select 1
    from public.attachments attachment
    where attachment.storage_bucket = bucket_id
      and attachment.storage_path = name
      and (
        public.has_company_role(
          attachment.company_id,
          array['owner', 'admin', 'dispatcher']::public.app_role[]
        )
        or (
          public.has_company_role(
            attachment.company_id,
            array['owner', 'admin', 'technician']::public.app_role[]
          )
          and public.is_assigned_technician_job(attachment.job_id)
        )
      )
  )
);

create policy "job_attachments_insert_authorized"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'job-attachments'
  and exists (
    select 1
    from public.attachments attachment
    where attachment.storage_bucket = bucket_id
      and attachment.storage_path = name
      and attachment.uploaded_by_user_id = auth.uid()
      and (
        public.has_company_role(
          attachment.company_id,
          array['owner', 'admin', 'dispatcher']::public.app_role[]
        )
        or (
          public.has_company_role(
            attachment.company_id,
            array['owner', 'admin', 'technician']::public.app_role[]
          )
          and public.is_assigned_technician_job(attachment.job_id)
        )
      )
  )
);

create policy "job_attachments_delete_office"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'job-attachments'
  and exists (
    select 1
    from public.attachments attachment
    where attachment.storage_bucket = bucket_id
      and attachment.storage_path = name
      and public.has_company_role(
        attachment.company_id,
        array['owner', 'admin', 'dispatcher']::public.app_role[]
      )
  )
);
