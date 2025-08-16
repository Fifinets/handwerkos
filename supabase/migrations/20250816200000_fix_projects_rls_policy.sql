-- Fix projects RLS policy to be company-based instead of user-based
-- This allows multiple managers in the same company to collaborate on projects

-- Drop any existing policies (ignore errors if they don't exist)
DO $$ 
BEGIN
    -- Drop old policies if they exist
    BEGIN
        DROP POLICY "Users can manage their projects" ON public.projects;
    EXCEPTION WHEN undefined_object THEN
        NULL; -- Ignore if policy doesn't exist
    END;
    
    BEGIN
        DROP POLICY "Users can manage company projects" ON public.projects;
    EXCEPTION WHEN undefined_object THEN
        NULL;
    END;
    
    BEGIN
        DROP POLICY "Managers can manage projects" ON public.projects;
    EXCEPTION WHEN undefined_object THEN
        NULL;
    END;
    
    BEGIN
        DROP POLICY "Employees can view projects" ON public.projects;
    EXCEPTION WHEN undefined_object THEN
        NULL;
    END;
    
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

-- Ensure RLS is enabled
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Create new company-based policy for full access (managers)
CREATE POLICY "Managers can manage company projects"
ON public.projects
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.company_id = projects.company_id
    AND profiles.role = 'manager'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.company_id = projects.company_id
    AND profiles.role = 'manager'
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

-- Ensure projects have company_id (add if missing)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'projects' 
        AND column_name = 'company_id'
    ) THEN
        ALTER TABLE public.projects 
        ADD COLUMN company_id uuid REFERENCES public.companies(id);
    END IF;
END $$;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_projects_company_id ON public.projects(company_id);