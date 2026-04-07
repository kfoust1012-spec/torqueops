insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'technician-profile-photos',
  'technician-profile-photos',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "technician_profile_photos_select_authorized"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'technician-profile-photos'
  and exists (
    select 1
    from public.profiles profile
    where profile.profile_photo_bucket = bucket_id
      and profile.profile_photo_path = name
      and (
        profile.id = auth.uid()
        or exists (
          select 1
          from public.company_memberships viewer
          join public.company_memberships target
            on target.company_id = viewer.company_id
          where viewer.user_id = auth.uid()
            and viewer.is_active = true
            and viewer.role in ('owner', 'admin', 'dispatcher')
            and target.user_id = profile.id
            and target.is_active = true
        )
      )
  )
);

create policy "technician_profile_photos_insert_own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'technician-profile-photos'
  and name like auth.uid()::text || '/%'
  and exists (
    select 1
    from public.profiles profile
    where profile.id = auth.uid()
      and profile.profile_photo_bucket = bucket_id
      and profile.profile_photo_path = name
  )
);

create policy "technician_profile_photos_delete_own"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'technician-profile-photos'
  and name like auth.uid()::text || '/%'
);