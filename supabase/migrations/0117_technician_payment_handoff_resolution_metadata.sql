create type public.technician_payment_handoff_resolution_disposition as enum (
  'manual_tender_reconciled',
  'promise_accepted',
  'link_resent',
  'follow_up_completed',
  'escalated_to_billing_owner',
  'other_resolved'
);

alter table public.technician_payment_handoffs
add column resolution_disposition public.technician_payment_handoff_resolution_disposition,
add column resolution_note text;

alter table public.technician_payment_handoffs
add constraint technician_payment_handoffs_resolution_note_not_blank check (
  resolution_note is null or btrim(resolution_note) <> ''
);

update public.technician_payment_handoffs
set resolution_disposition = 'other_resolved'
where status = 'resolved'
  and resolution_disposition is null;

alter table public.technician_payment_handoffs
drop constraint technician_payment_handoffs_resolution_check;

alter table public.technician_payment_handoffs
add constraint technician_payment_handoffs_resolution_check check (
  (
    status = 'open'
    and resolved_at is null
    and resolved_by_user_id is null
    and resolution_disposition is null
    and resolution_note is null
  )
  or (
    status = 'resolved'
    and resolved_by_user_id is not null
    and resolution_disposition is not null
  )
);

create or replace function public.set_technician_payment_handoff_resolution()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'resolved' then
    if new.resolved_at is null then
      new.resolved_at = timezone('utc', now());
    end if;
  else
    new.resolved_at = null;
    new.resolved_by_user_id = null;
    new.resolution_disposition = null;
    new.resolution_note = null;
  end if;

  return new;
end;
$$;
