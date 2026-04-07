alter table public.vehicles
  add constraint vehicles_plate_state_pair_check
    check (
      (license_plate is null and license_state is null)
      or (license_plate is not null and license_state is not null)
    );
