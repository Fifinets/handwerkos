// Quick fix to create project_team_members table
import { supabase } from '@/integrations/supabase/client';

export const createProjectTeamMembersTable = async () => {
  try {
    console.log('Creating project_team_members table...');

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

      -- Policy: Users can view team members for projects in their company
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

      -- Policy: Users can insert team members for projects in their company
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

      -- Policy: Users can update team members for projects in their company
      DROP POLICY IF EXISTS "Users can update project team members in their company" ON public.project_team_members;
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
      DROP POLICY IF EXISTS "Users can delete project team members in their company" ON public.project_team_members;
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
    `;

    // Execute the SQL
    const { error } = await supabase.rpc('exec_sql', { sql });

    if (error) {
      console.error('Error creating table:', error);
      
      // If rpc doesn't work, show manual SQL
      console.log('📋 Please run this SQL manually in Supabase SQL Editor:');
      console.log(sql);
      return { success: false, sql };
    }

    console.log('✅ project_team_members table created successfully!');
    console.log('Team members should now be visible in projects.');
    return { success: true, sql };

  } catch (error) {
    console.error('Error:', error);
    
    const sql = `
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
    `;
    
    console.log('📋 Manual SQL to create table:');
    console.log(sql);
    return { success: false, sql };
  }
};

// Function to check if table exists
export const checkProjectTeamMembersTable = async () => {
  try {
    const { data, error } = await supabase
      .from('project_team_members')
      .select('id')
      .limit(1);

    if (error && error.message.includes('does not exist')) {
      console.log('❌ project_team_members table does not exist');
      return false;
    }

    console.log('✅ project_team_members table exists');
    return true;
  } catch (error) {
    console.log('❌ project_team_members table does not exist');
    return false;
  }
};