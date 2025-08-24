import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { addTeamMembersToTestProject } from '@/utils/addTeamMembersToProject';

const TeamMemberDebug: React.FC = () => {
  const [debugData, setDebugData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const runDebug = async () => {
    setLoading(true);
    try {
      // 1. Check all projects
      const { data: projects, error: projectsError } = await supabase
        .from('projects')
        .select('id, name')
        .limit(5);

      // 2. Check all team members
      const { data: teamMembers, error: teamError } = await supabase
        .from('project_team_members')
        .select('*');

      // 3. Check all employees
      const { data: employees, error: employeesError } = await supabase
        .from('employees')
        .select('id, first_name, last_name, email')
        .limit(10);

      // 4. Test specific join query
      const { data: joinResult, error: joinError } = await supabase
        .from('project_team_members')
        .select(`
          project_id,
          employee_id,
          employees!inner(first_name, last_name, email)
        `);

      setDebugData({
        projects: { data: projects, error: projectsError },
        teamMembers: { data: teamMembers, error: teamError },
        employees: { data: employees, error: employeesError },
        joinResult: { data: joinResult, error: joinError }
      });

    } catch (error) {
      console.error('Debug error:', error);
      setDebugData({ error: error.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runDebug();
  }, []);

  return (
    <Card className="m-4">
      <CardHeader>
        <CardTitle>Team Member Debug Info</CardTitle>
        <Button onClick={runDebug} disabled={loading}>
          {loading ? 'Loading...' : 'Refresh Debug Data'}
        </Button>
      </CardHeader>
      <CardContent>
        <pre className="text-xs bg-gray-100 p-4 rounded overflow-auto max-h-96">
          {JSON.stringify(debugData, null, 2)}
        </pre>
      </CardContent>
    </Card>
  );
};

export default TeamMemberDebug;