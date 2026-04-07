alter table public.vehicle_carfax_summaries
  add constraint vehicle_carfax_summaries_ready_payload_check
    check (
      (status = 'ready' and summary is not null and fetched_at is not null)
      or (status in ('not_available', 'provider_error') and summary is null and fetched_at is null)
    );
