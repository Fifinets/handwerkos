// Utility to create the project_team_members table
import { supabase } from '@/integrations/supabase/client';

export const createProjectTeamMembersTable = async () => {
  try {
    // First, try to create the table using raw SQL
    const { error } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS public.project_team_members (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
            employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
            assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            assigned_by UUID REFERENCES auth.users(id),
            role VARCHAR(50) DEFAULT 'team_member',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            UNIQUE(project_id, employee_id)
        );
        
        CREATE INDEX IF NOT EXISTS idx_project_team_members_project_id ON public.project_team_members(project_id);
        CREATE INDEX IF NOT EXISTS idx_project_team_members_employee_id ON public.project_team_members(employee_id);
        
        ALTER TABLE public.project_team_members ENABLE ROW LEVEL SECURITY;
        
        GRANT ALL ON public.project_team_members TO authenticated;
      `
    });

    if (error) {
      console.error('Error creating table with rpc:', error);
      return false;
    }

    console.log('project_team_members table created successfully');
    return true;
  } catch (error) {
    console.error('Error creating table:', error);
    return false;
  }
};

// Alternative approach - create table manually if rpc doesn't work
export const createTableManually = async () => {
  // You can copy this SQL and run it in the Supabase SQL editor:
  const sql = `
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
  `;
  
  console.log('Copy and run this SQL in the Supabase dashboard:', sql);
  return sql;
};