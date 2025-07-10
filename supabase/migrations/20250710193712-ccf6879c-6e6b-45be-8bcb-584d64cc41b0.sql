-- Add employee-specific fields to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS employee_number text,
ADD COLUMN IF NOT EXISTS phone text,
ADD COLUMN IF NOT EXISTS position text,
ADD COLUMN IF NOT EXISTS department text,
ADD COLUMN IF NOT EXISTS hire_date date,
ADD COLUMN IF NOT EXISTS hourly_rate numeric,
ADD COLUMN IF NOT EXISTS status text DEFAULT 'aktiv';

-- Update time_entries to reference profiles instead of employees
ALTER TABLE public.time_entries 
DROP CONSTRAINT IF EXISTS fk_time_entries_employee,
ADD CONSTRAINT fk_time_entries_profile 
FOREIGN KEY (employee_id) REFERENCES public.profiles(id);

-- Update other tables that reference employees to reference profiles
ALTER TABLE public.employee_absences 
DROP CONSTRAINT IF EXISTS employee_absences_employee_id_fkey,
ADD CONSTRAINT employee_absences_profile_id_fkey 
FOREIGN KEY (employee_id) REFERENCES public.profiles(id);

ALTER TABLE public.time_entry_corrections 
DROP CONSTRAINT IF EXISTS fk_corrections_requested_by,
DROP CONSTRAINT IF EXISTS fk_corrections_approved_by,
ADD CONSTRAINT fk_corrections_requested_by_profile 
FOREIGN KEY (requested_by) REFERENCES public.profiles(id),
ADD CONSTRAINT fk_corrections_approved_by_profile 
FOREIGN KEY (approved_by) REFERENCES public.profiles(id);

ALTER TABLE public.project_assignments 
DROP CONSTRAINT IF EXISTS project_assignments_employee_id_fkey,
ADD CONSTRAINT project_assignments_profile_id_fkey 
FOREIGN KEY (employee_id) REFERENCES public.profiles(id);

ALTER TABLE public.working_hours_config 
DROP CONSTRAINT IF EXISTS fk_working_hours_employee,
ADD CONSTRAINT fk_working_hours_profile 
FOREIGN KEY (employee_id) REFERENCES public.profiles(id);

ALTER TABLE public.calendar_events 
DROP CONSTRAINT IF EXISTS calendar_events_created_by_fkey,
ADD CONSTRAINT calendar_events_created_by_profile_fkey 
FOREIGN KEY (created_by) REFERENCES public.profiles(id);