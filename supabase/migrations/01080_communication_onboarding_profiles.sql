create table public.communication_onboarding_profiles (
  company_id uuid primary key references public.companies(id) on delete cascade,
  legal_business_name text null,
  doing_business_as text null,
  business_address text null,
  business_phone text null,
  website_url text null,
  privacy_policy_url text null,
  terms_url text null,
  support_email text null,
  opt_in_workflow text null,
  preferred_sender_type text null check (
    preferred_sender_type in ('local_10dlc', 'toll_free')
  ),
  campaign_description text null,
  sample_on_the_way_message text null,
  sample_running_late_message text null,
  sample_invoice_reminder_message text null,
  help_reply_text text null,
  stop_reply_text text null,
  updated_by_user_id uuid not null references public.profiles(id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger set_communication_onboarding_profiles_updated_at
before update on public.communication_onboarding_profiles
for each row
execute function public.set_updated_at();
