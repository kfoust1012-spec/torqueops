alter table public.attachments
  add constraint attachments_inspection_item_requires_inspection_check
    check (inspection_item_id is null or inspection_id is not null);
