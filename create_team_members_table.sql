-- MANUAL SQL TO CREATE PROJECT_TEAM_MEMBERS TABLE
-- Copy and paste this into your Supabase SQL Editor and run it

-- Create project_team_members table for managing project team assignments
CREATE TABLE IF NOT EXISTS public.project_team_members (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    assigned_by UUID REFERENCES auth.users(id),
    role VARCHAR(50) DEFAULT 'team_member',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure unique project-employee combinations
    UNIQUE(project_id, employee_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_project_team_members_project_id ON public.project_team_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_team_members_employee_id ON public.project_team_members(employee_id);

-- Add RLS policies
ALTER TABLE public.project_team_members ENABLE ROW LEVEL SECURITY;

-- Grant permissions
GRANT ALL ON public.project_team_members TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

-- Add RLS policies (optional - for security)
DROP POLICY IF EXISTS "Users can view project team members in their company" ON public.project_team_members;
CREATE POLICY "Users can view project team members in their company" ON public.project_team_members
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.projects p
            JOIN public.profiles prof ON prof.company_id = p.company_id
            WHERE p.id = project_id 
            AND prof.id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can add project team members in their company" ON public.project_team_members;
CREATE POLICY "Users can add project team members in their company" ON public.project_team_members
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.projects p
            JOIN public.profiles prof ON prof.company_id = p.company_id
            WHERE p.id = project_id 
            AND prof.id = auth.uid()
        )
    );

-- Test the table creation
SELECT 'project_team_members table created successfully!' as result;