-- Fix RLS policies for projects table
-- Drop existing policies that use undefined has_role function
DROP POLICY IF EXISTS "Employees can view projects" ON public.projects;
DROP POLICY IF EXISTS "Managers can manage projects" ON public.projects;

-- Create simpler policies that work without custom functions
-- Allow authenticated users to view projects
CREATE POLICY "Authenticated users can view projects" 
ON public.projects 
FOR SELECT 
USING (auth.role() = 'authenticated');

-- Allow authenticated users to insert projects
CREATE POLICY "Authenticated users can create projects" 
ON public.projects 
FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

-- Allow authenticated users to update projects
CREATE POLICY "Authenticated users can update projects" 
ON public.projects 
FOR UPDATE 
USING (auth.role() = 'authenticated');

-- Allow authenticated users to delete projects  
CREATE POLICY "Authenticated users can delete projects" 
ON public.projects 
FOR DELETE 
USING (auth.role() = 'authenticated');

-- Also fix employees table policies
DROP POLICY IF EXISTS "Managers can manage employees" ON public.employees;
DROP POLICY IF EXISTS "Employees can view other employees" ON public.employees;

CREATE POLICY "Authenticated users can view employees" 
ON public.employees 
FOR SELECT 
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage employees" 
ON public.employees 
FOR ALL 
USING (auth.role() = 'authenticated');