-- Fix project access issues
-- Ensure users can see and create projects in their company

-- First, ensure RLS is enabled on projects table
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to recreate them properly
DROP POLICY IF EXISTS "Users can view their company projects" ON public.projects;
DROP POLICY IF EXISTS "Users can create projects for their company" ON public.projects;
DROP POLICY IF EXISTS "Users can update their company projects" ON public.projects;
DROP POLICY IF EXISTS "Users can delete their company projects" ON public.projects;

-- Create comprehensive RLS policies for projects
-- View policy: Users can see all projects in their company
CREATE POLICY "Users can view their company projects" ON public.projects
    FOR SELECT
    USING (
        company_id IN (
            SELECT company_id 
            FROM public.profiles 
            WHERE id = auth.uid()
        )
        OR
        -- Also allow if user is in user_roles table with same company
        company_id IN (
            SELECT company_id 
            FROM public.user_roles 
            WHERE user_id = auth.uid()
        )
    );

-- Insert policy: Users can create projects for their company
CREATE POLICY "Users can create projects for their company" ON public.projects
    FOR INSERT
    WITH CHECK (
        company_id IN (
            SELECT company_id 
            FROM public.profiles 
            WHERE id = auth.uid()
        )
        OR
        company_id IN (
            SELECT company_id 
            FROM public.user_roles 
            WHERE user_id = auth.uid()
        )
    );

-- Update policy: Users can update projects in their company
CREATE POLICY "Users can update their company projects" ON public.projects
    FOR UPDATE
    USING (
        company_id IN (
            SELECT company_id 
            FROM public.profiles 
            WHERE id = auth.uid()
        )
        OR
        company_id IN (
            SELECT company_id 
            FROM public.user_roles 
            WHERE user_id = auth.uid()
        )
    )
    WITH CHECK (
        company_id IN (
            SELECT company_id 
            FROM public.profiles 
            WHERE id = auth.uid()
        )
        OR
        company_id IN (
            SELECT company_id 
            FROM public.user_roles 
            WHERE user_id = auth.uid()
        )
    );

-- Delete policy: Only admins and managers can delete projects
CREATE POLICY "Admins can delete company projects" ON public.projects
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 
            FROM public.user_roles 
            WHERE user_id = auth.uid() 
            AND role IN ('admin', 'manager')
            AND company_id = projects.company_id
        )
    );

-- Ensure all existing projects have a company_id
-- First, create a default company if none exists
INSERT INTO public.companies (id, name, created_at, updated_at)
VALUES ('00000000-0000-0000-0000-000000000000', 'Default Company', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Update any projects without a company_id to use the default company
UPDATE public.projects
SET company_id = '00000000-0000-0000-0000-000000000000'
WHERE company_id IS NULL;

-- Make company_id NOT NULL to prevent future issues
ALTER TABLE public.projects 
ALTER COLUMN company_id SET NOT NULL;

-- Ensure user has a profile and company assignment
-- This helps users who registered but don't have proper company assignment
DO $$
BEGIN
    -- Check if current user exists and needs company assignment
    IF EXISTS (
        SELECT 1 FROM auth.users WHERE id = auth.uid()
    ) AND NOT EXISTS (
        SELECT 1 FROM public.profiles WHERE id = auth.uid() AND company_id IS NOT NULL
    ) THEN
        -- Update profile to have default company
        UPDATE public.profiles
        SET company_id = '00000000-0000-0000-0000-000000000000'
        WHERE id = auth.uid() AND company_id IS NULL;
        
        -- Also add to user_roles if not exists
        INSERT INTO public.user_roles (user_id, role, company_id, created_at, updated_at)
        VALUES (auth.uid(), 'admin', '00000000-0000-0000-0000-000000000000', NOW(), NOW())
        ON CONFLICT (user_id) DO UPDATE 
        SET company_id = '00000000-0000-0000-0000-000000000000',
            updated_at = NOW();
    END IF;
END $$;