-- Add absence_type column to distinguish vacation from sick days
ALTER TABLE public.vacation_requests
  ADD COLUMN IF NOT EXISTS absence_type TEXT NOT NULL DEFAULT 'vacation';

-- Add check constraint (only if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'vacation_requests_absence_type_check'
  ) THEN
    ALTER TABLE public.vacation_requests
      ADD CONSTRAINT vacation_requests_absence_type_check
      CHECK (absence_type IN ('vacation', 'sick', 'other'));
  END IF;
END $$;
