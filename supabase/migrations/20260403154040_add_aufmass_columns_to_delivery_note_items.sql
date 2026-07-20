ALTER TABLE public.delivery_note_items
  ADD COLUMN IF NOT EXISTS planned_quantity decimal(15,3),
  ADD COLUMN IF NOT EXISTS actual_quantity decimal(15,3),
  ADD COLUMN IF NOT EXISTS measurement_note text,
  ADD COLUMN IF NOT EXISTS measurement_photo_url text;
