-- Temporarily disable RLS for projects table to fix immediate issues
-- This is a temporary fix until proper role-based policies are implemented

-- Disable RLS on projects table
ALTER TABLE public.projects DISABLE ROW LEVEL SECURITY;

-- Disable RLS on employees table  
ALTER TABLE public.employees DISABLE ROW LEVEL SECURITY;

-- Disable RLS on other related tables
ALTER TABLE public.employee_absences DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_assignments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_events DISABLE ROW LEVEL SECURITY;

-- Note: This is temporary and should be re-enabled with proper policies later
-- To re-enable: ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;