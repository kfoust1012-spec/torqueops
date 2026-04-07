alter table public.purchase_order_lines
  add constraint purchase_order_lines_quantity_received_lte_ordered_check check (
    quantity_received <= quantity_ordered
  ),
  add constraint purchase_order_lines_quantity_installed_and_returned_lte_received_check check (
    quantity_installed + quantity_returned <= quantity_received
  ),
  add constraint purchase_order_lines_quantity_core_due_lte_received_check check (
    quantity_core_due <= quantity_received
  ),
  add constraint purchase_order_lines_quantity_core_returned_lte_due_check check (
    quantity_core_returned <= quantity_core_due
  );

alter table public.part_request_lines
  add constraint part_request_lines_quantity_received_lte_ordered_check check (
    quantity_received <= quantity_ordered
  ),
  add constraint part_request_lines_quantity_installed_and_returned_lte_received_check check (
    quantity_installed + quantity_returned <= quantity_received
  ),
  add constraint part_request_lines_quantity_core_due_lte_received_check check (
    quantity_core_due <= quantity_received
  ),
  add constraint part_request_lines_quantity_core_returned_lte_due_check check (
    quantity_core_returned <= quantity_core_due
  );
