-- First, add employee-specific fields to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS employee_number text,
ADD COLUMN IF NOT EXISTS phone text,
ADD COLUMN IF NOT EXISTS position text,
ADD COLUMN IF NOT EXISTS department text,
ADD COLUMN IF NOT EXISTS hire_date date,
ADD COLUMN IF NOT EXISTS hourly_rate numeric,
ADD COLUMN IF NOT EXISTS status text DEFAULT 'aktiv';

-- Copy data from employees to profiles for Yale Herz
UPDATE public.profiles 
SET 
  position = 'Mitarbeiter',
  department = 'Allgemein',
  hourly_rate = 30.00,
  status = 'aktiv'
WHERE id = 'e78606a0-b358-4a56-931d-6a8801551f23';