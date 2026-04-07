alter type public.job_status add value if not exists 'en_route';
alter type public.job_status add value if not exists 'arrived';
alter type public.job_status add value if not exists 'diagnosing';
alter type public.job_status add value if not exists 'waiting_approval';
alter type public.job_status add value if not exists 'waiting_parts';
alter type public.job_status add value if not exists 'repairing';
alter type public.job_status add value if not exists 'ready_for_payment';

create or replace function public.is_valid_job_status_transition(
  current_status public.job_status,
  next_status public.job_status
)
returns boolean
language sql
immutable
as $$
  select case
    when current_status = next_status then true
    when current_status::text = 'new' and next_status::text in ('scheduled', 'dispatched', 'canceled') then true
    when current_status::text = 'scheduled' and next_status::text in ('dispatched', 'en_route', 'canceled') then true
    when current_status::text = 'dispatched' and next_status::text in ('scheduled', 'en_route', 'canceled') then true
    when current_status::text = 'en_route' and next_status::text in ('scheduled', 'dispatched', 'arrived', 'canceled') then true
    when current_status::text = 'arrived' and next_status::text in ('diagnosing', 'waiting_approval', 'waiting_parts', 'repairing', 'ready_for_payment', 'completed', 'canceled') then true
    when current_status::text = 'diagnosing' and next_status::text in ('waiting_approval', 'waiting_parts', 'repairing', 'ready_for_payment', 'completed', 'canceled') then true
    when current_status::text = 'waiting_approval' and next_status::text in ('diagnosing', 'waiting_parts', 'repairing', 'ready_for_payment', 'completed', 'canceled') then true
    when current_status::text = 'waiting_parts' and next_status::text in ('diagnosing', 'repairing', 'ready_for_payment', 'completed', 'canceled') then true
    when current_status::text = 'repairing' and next_status::text in ('waiting_parts', 'ready_for_payment', 'completed', 'canceled') then true
    when current_status::text = 'ready_for_payment' and next_status::text in ('repairing', 'completed', 'canceled') then true
    when current_status::text = 'in_progress' and next_status::text in ('diagnosing', 'waiting_approval', 'waiting_parts', 'repairing', 'ready_for_payment', 'completed', 'canceled') then true
    else false
  end;
$$;

create or replace function public.set_job_status_timestamps()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from old.status then
    if new.status::text in ('arrived', 'diagnosing', 'waiting_approval', 'waiting_parts', 'repairing', 'ready_for_payment', 'in_progress')
      and new.started_at is null then
      new.started_at = timezone('utc', now());
    end if;

    if new.status::text = 'completed' then
      if new.started_at is null then
        new.started_at = timezone('utc', now());
      end if;

      if new.completed_at is null then
        new.completed_at = timezone('utc', now());
      end if;
    end if;

    if new.status::text = 'canceled' and new.canceled_at is null then
      new.canceled_at = timezone('utc', now());
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.is_valid_assigned_technician_job_transition(
  current_status public.job_status,
  next_status public.job_status
)
returns boolean
language sql
immutable
as $$
  select case
    when current_status::text = 'scheduled' and next_status::text = 'en_route' then true
    when current_status::text = 'dispatched' and next_status::text = 'en_route' then true
    when current_status::text = 'en_route' and next_status::text = 'arrived' then true
    when current_status::text = 'arrived' and next_status::text in ('diagnosing', 'waiting_approval', 'waiting_parts', 'repairing', 'ready_for_payment', 'completed') then true
    when current_status::text = 'diagnosing' and next_status::text in ('waiting_approval', 'waiting_parts', 'repairing', 'ready_for_payment', 'completed') then true
    when current_status::text = 'waiting_approval' and next_status::text in ('diagnosing', 'waiting_parts', 'repairing', 'ready_for_payment', 'completed') then true
    when current_status::text = 'waiting_parts' and next_status::text in ('diagnosing', 'repairing', 'ready_for_payment', 'completed') then true
    when current_status::text = 'repairing' and next_status::text in ('waiting_parts', 'ready_for_payment', 'completed') then true
    when current_status::text = 'ready_for_payment' and next_status::text in ('repairing', 'completed') then true
    when current_status::text = 'in_progress' and next_status::text in ('diagnosing', 'waiting_approval', 'waiting_parts', 'repairing', 'ready_for_payment', 'completed') then true
    else false
  end;
$$;
