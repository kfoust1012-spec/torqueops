alter type public.customer_document_kind add value if not exists 'job_visit';

alter table public.profiles
  add column if not exists technician_bio text,
  add column if not exists technician_certifications text[] not null default '{}'::text[],
  add column if not exists years_experience integer,
  add column if not exists meet_your_mechanic_enabled boolean not null default false,
  add column if not exists profile_photo_bucket text,
  add column if not exists profile_photo_path text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_technician_bio_not_blank'
  ) then
    alter table public.profiles
      add constraint profiles_technician_bio_not_blank
      check (technician_bio is null or btrim(technician_bio) <> '');
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_technician_certifications_limit'
  ) then
    alter table public.profiles
      add constraint profiles_technician_certifications_limit
      check (cardinality(technician_certifications) <= 8);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_years_experience_range'
  ) then
    alter table public.profiles
      add constraint profiles_years_experience_range
      check (years_experience is null or (years_experience >= 0 and years_experience <= 60));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_profile_photo_pair_check'
  ) then
    alter table public.profiles
      add constraint profiles_profile_photo_pair_check
      check (
        (profile_photo_bucket is null and profile_photo_path is null)
        or (
          profile_photo_bucket = 'technician-profile-photos'
          and profile_photo_path is not null
          and btrim(profile_photo_path) <> ''
        )
      );
  end if;
end;
$$;