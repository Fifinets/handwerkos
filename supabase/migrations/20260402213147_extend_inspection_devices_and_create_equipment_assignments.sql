-- Extend inspection_devices with equipment tracking fields
ALTER TABLE public.inspection_devices
  ADD COLUMN IF NOT EXISTS category text DEFAULT 'werkzeug'
    CHECK (category IN ('werkzeug', 'fahrzeug', 'messgeraet')),
  ADD COLUMN IF NOT EXISTS operating_hours integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS condition text DEFAULT 'gut'
    CHECK (condition IN ('gut', 'maessig', 'schlecht', 'defekt')),
  ADD COLUMN IF NOT EXISTS current_location text,
  ADD COLUMN IF NOT EXISTS purchase_date date,
  ADD COLUMN IF NOT EXISTS purchase_price decimal(10,2);

-- Equipment assignments table
CREATE TABLE IF NOT EXISTS public.equipment_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid NOT NULL REFERENCES public.inspection_devices(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  start_date date,
  end_date date,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (device_id, project_id)
);

CREATE INDEX IF NOT EXISTS equipment_assignments_device_idx
  ON public.equipment_assignments (device_id, is_active);
CREATE INDEX IF NOT EXISTS equipment_assignments_project_idx
  ON public.equipment_assignments (project_id, is_active);

-- RLS
ALTER TABLE public.equipment_assignments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users see own company equipment assignments"
    ON public.equipment_assignments FOR SELECT
    USING (device_id IN (
      SELECT id FROM public.inspection_devices WHERE company_id IN (
        SELECT company_id FROM public.employees WHERE user_id = auth.uid()
      )
    ));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users manage own company equipment assignments"
    ON public.equipment_assignments FOR ALL
    USING (device_id IN (
      SELECT id FROM public.inspection_devices WHERE company_id IN (
        SELECT company_id FROM public.employees WHERE user_id = auth.uid()
      )
    ));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
