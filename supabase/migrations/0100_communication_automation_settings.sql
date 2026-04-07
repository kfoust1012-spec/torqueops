create table public.communication_automation_settings (
  company_id uuid primary key references public.companies(id) on delete cascade,
  dispatch_en_route_sms_enabled boolean not null default false,
  dispatch_running_late_sms_enabled boolean not null default false,
  invoice_payment_reminder_sms_enabled boolean not null default false,
  updated_by_user_id uuid not null references public.profiles(id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger set_communication_automation_settings_updated_at
before update on public.communication_automation_settings
for each row
execute function public.set_updated_at();
