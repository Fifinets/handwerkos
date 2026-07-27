// Zugewiesene Projekte des aktuellen Mitarbeiters (project_team_assignments → projects).
// Ersetzt die inline-Fetches im ehemaligen DesktopEmployeePage-Monolithen.

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { QUERY_KEYS } from '@/hooks/useQueryKeys';

export interface EmployeeProject {
  id: string;
  name: string;
  status: string;
  location?: string;
  start_date?: string;
  end_date?: string;
  customer_name?: string;
}

export function mapTeamAssignmentsToProjects(rows: any[]): EmployeeProject[] {
  return (rows || [])
    .filter((r) => r.projects)
    .map((r) => ({
      id: r.projects.id,
      name: r.projects.name,
      status: r.projects.status,
      location: r.projects.location,
      start_date: r.projects.start_date,
      end_date: r.projects.end_date,
      customer_name: r.projects.customers?.company_name,
    }));
}

export function useEmployeeProjects(employeeId?: string) {
  return useQuery({
    queryKey: QUERY_KEYS.employeeProjects(employeeId ?? ''),
    enabled: !!employeeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_team_assignments')
        .select(
          `project_id, projects ( id, name, status, location, start_date, end_date, customers ( company_name ) )`
        )
        .eq('employee_id', employeeId);
      if (error) throw error;
      return mapTeamAssignmentsToProjects(data as any[]);
    },
  });
}
