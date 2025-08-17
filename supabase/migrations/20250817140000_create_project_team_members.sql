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

-- Policy: Users can view team members for projects in their company
CREATE POLICY "Users can view project team members in their company" ON public.project_team_members
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.projects p
            JOIN public.profiles prof ON prof.company_id = p.company_id
            WHERE p.id = project_id 
            AND prof.id = auth.uid()
        )
    );

-- Policy: Users can insert team members for projects in their company
CREATE POLICY "Users can add project team members in their company" ON public.project_team_members
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.projects p
            JOIN public.profiles prof ON prof.company_id = p.company_id
            WHERE p.id = project_id 
            AND prof.id = auth.uid()
        )
    );

-- Policy: Users can update team members for projects in their company
CREATE POLICY "Users can update project team members in their company" ON public.project_team_members
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.projects p
            JOIN public.profiles prof ON prof.company_id = p.company_id
            WHERE p.id = project_id 
            AND prof.id = auth.uid()
        )
    );

-- Policy: Users can delete team members for projects in their company
CREATE POLICY "Users can delete project team members in their company" ON public.project_team_members
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.projects p
            JOIN public.profiles prof ON prof.company_id = p.company_id
            WHERE p.id = project_id 
            AND prof.id = auth.uid()
        )
    );

-- Grant permissions
GRANT ALL ON public.project_team_members TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_project_team_members_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER trigger_update_project_team_members_updated_at
    BEFORE UPDATE ON public.project_team_members
    FOR EACH ROW
    EXECUTE FUNCTION update_project_team_members_updated_at();