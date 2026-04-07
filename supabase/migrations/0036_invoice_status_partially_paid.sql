alter type public.invoice_status add value if not exists 'partially_paid' after 'issued';
