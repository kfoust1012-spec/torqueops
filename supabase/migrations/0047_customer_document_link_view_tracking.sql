create or replace function public.increment_customer_document_link_view(
  target_link_id uuid,
  target_viewed_at timestamptz default timezone('utc', now())
)
returns public.customer_document_links
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_link public.customer_document_links;
begin
  update public.customer_document_links
  set
    first_viewed_at = coalesce(first_viewed_at, target_viewed_at),
    last_viewed_at = target_viewed_at,
    view_count = view_count + 1
  where id = target_link_id
  returning * into updated_link;

  return updated_link;
end;
$$;

grant execute on function public.increment_customer_document_link_view(uuid, timestamptz) to authenticated;
grant execute on function public.increment_customer_document_link_view(uuid, timestamptz) to service_role;