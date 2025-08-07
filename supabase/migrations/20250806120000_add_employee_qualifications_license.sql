-- Add missing columns to employees table for qualifications and license data
ALTER TABLE public.employees 
ADD COLUMN IF NOT EXISTS qualifications TEXT,
ADD COLUMN IF NOT EXISTS license TEXT;