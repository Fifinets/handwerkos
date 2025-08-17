// Utility to manually add team members to existing projects
import { supabase } from '@/integrations/supabase/client';

export const addTeamMembersToProject = async (projectId: string, employeeIds: string[]) => {
  try {
    console.log('Adding team members to project:', { projectId, employeeIds });

    const teamMemberInserts = employeeIds.map(employeeId => ({
      project_id: projectId,
      employee_id: employeeId,
      assigned_at: new Date().toISOString()
    }));

    const { data, error } = await supabase
      .from('project_team_members')
      .insert(teamMemberInserts)
      .select();

    if (error) {
      console.error('Error adding team members:', error);
      return { success: false, error: error.message };
    }

    console.log('Team members added successfully:', data);
    return { success: true, data };

  } catch (error) {
    console.error('Unexpected error:', error);
    return { success: false, error: error.message };
  }
};

// Test function to add team members to your existing "Test" project
export const addTeamMembersToTestProject = async () => {
  const projectId = "6c81e627-8c38-472b-ae6b-5c63af8b9016"; // Your Test project ID
  const employeeIds = [
    "54916bdb-7316-4554-ae43-fc5d14b69ea1", // Filip Bosz 1
    "67f0469f-78f3-4193-a6c5-ce2dcfcf7f97", // Filip Bosz 2
  ];

  console.log('🔧 Adding team members to Test project...');
  const result = await addTeamMembersToProject(projectId, employeeIds);
  
  if (result.success) {
    console.log('✅ Team members added to Test project!');
    alert('Team-Mitglieder wurden zum Test-Projekt hinzugefügt!');
  } else {
    console.log('❌ Failed to add team members:', result.error);
    alert('Fehler beim Hinzufügen der Team-Mitglieder: ' + result.error);
  }

  return result;
};

// Usage in browser console:
// import { addTeamMembersToTestProject } from '@/utils/addTeamMembersToProject';
// await addTeamMembersToTestProject();