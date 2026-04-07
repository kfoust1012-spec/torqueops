alter type public.inventory_location_type add value if not exists 'van';

alter type public.inventory_transaction_type add value if not exists 'job_issue';
alter type public.inventory_transaction_type add value if not exists 'job_return';
alter type public.inventory_transaction_type add value if not exists 'cycle_count_gain';
alter type public.inventory_transaction_type add value if not exists 'cycle_count_loss';
alter type public.inventory_transaction_type add value if not exists 'core_hold_in';
alter type public.inventory_transaction_type add value if not exists 'core_hold_out';
alter type public.inventory_transaction_type add value if not exists 'core_return_out';

alter type public.inventory_transaction_source_type add value if not exists 'transfer';
alter type public.inventory_transaction_source_type add value if not exists 'job_issue';
alter type public.inventory_transaction_source_type add value if not exists 'job_return';
alter type public.inventory_transaction_source_type add value if not exists 'cycle_count';
alter type public.inventory_transaction_source_type add value if not exists 'core_event';
