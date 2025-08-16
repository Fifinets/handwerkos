-- Fix RLS policy to use user_roles table instead of profiles.role
-- The issue was that policies checked profiles.role but we set the role in user_roles table

-- Drop the old policies first
DO $$ 
BEGIN
    BEGIN
        DROP POLICY "Managers can manage company projects" ON public.projects;
    EXCEPTION WHEN undefined_object THEN
        NULL;
    END;
    
    BEGIN
        DROP POLICY "Employees can view company projects" ON public.projects;
    EXCEPTION WHEN undefined_object THEN
        NULL;
    END;
END $$;

-- Re-enable RLS (in case it was disabled for testing)
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Create new policy that uses user_roles table
CREATE POLICY "Managers can manage company projects"
ON public.projects
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    INNER JOIN user_roles ON user_roles.user_id = profiles.id
    WHERE profiles.id = auth.uid() 
    AND profiles.company_id = projects.company_id
    AND user_roles.role = 'manager'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles 
    INNER JOIN user_roles ON user_roles.user_id = profiles.id
    WHERE profiles.id = auth.uid() 
    AND profiles.company_id = projects.company_id
    AND user_roles.role = 'manager'
  )
);

-- Create policy for employees (read-only access to company projects)
CREATE POLICY "Employees can view company projects"
ON public.projects
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.company_id = projects.company_id
  )
);