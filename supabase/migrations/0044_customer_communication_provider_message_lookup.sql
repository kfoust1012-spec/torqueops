create unique index customer_communications_provider_message_unique_idx
  on public.customer_communications (provider, provider_message_id)
  where provider_message_id is not null;