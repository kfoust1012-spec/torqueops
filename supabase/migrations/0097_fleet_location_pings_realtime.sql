do $$
begin
  alter publication supabase_realtime add table public.technician_location_pings;
exception
  when duplicate_object then null;
end;
$$;
