import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { QUERY_KEYS } from '@/hooks/useQueryKeys';
import { useQueryClient } from '@tanstack/react-query';
import type { PlannerProject, PlannerEmployee, VacationRequest, CalendarEvent } from '../types';

export function usePlannerData() {
  const { companyId } = useSupabaseAuth();
  const queryClient = useQueryClient();

  const employeesQuery = useQuery({
    queryKey: QUERY_KEYS.plannerEmployees(companyId || ''),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employees')
        .select('id, first_name, last_name, status, position')
        .eq('company_id', companyId!)
        .not('status', 'in', '("Inaktiv","Gekündigt")');
      if (error) throw error;
      return (data || []) as PlannerEmployee[];
    },
    enabled: !!companyId,
  });

  const projectsQuery = useQuery({
    queryKey: QUERY_KEYS.plannerProjects(companyId || ''),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name, status, start_date, end_date, location, work_start_date, work_end_date, project_team_assignments(employee_id, is_active, start_date, end_date, role)')
        .eq('company_id', companyId!)
        .not('status', 'in', '("abgeschlossen","storniert")');
      if (error) throw error;
      return (data || []) as PlannerProject[];
    },
    enabled: !!companyId,
  });

  const vacationsQuery = useQuery({
    queryKey: QUERY_KEYS.plannerVacations(companyId || ''),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vacation_requests')
        .select('id, employee_id, start_date, end_date, status, reason, absence_type')
        .eq('company_id', companyId!)
        .eq('status', 'approved');
      if (error) throw error;
      return (data || []) as VacationRequest[];
    },
    enabled: !!companyId,
  });

  const calendarEventsQuery = useQuery({
    queryKey: QUERY_KEYS.plannerCalendarEvents(companyId || ''),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('calendar_events')
        .select('id, title, start_date, end_date, start_time, end_time, type, project_id, assigned_employees')
        .eq('company_id', companyId!);
      if (error) throw error;
      return (data || []) as CalendarEvent[];
    },
    enabled: !!companyId,
  });

  const invalidateAll = () => {
    if (!companyId) return;
    queryClient.invalidateQueries({ queryKey: ['planner'] });
  };

  return {
    employees: employeesQuery.data || [],
    projects: projectsQuery.data || [],
    vacations: vacationsQuery.data || [],
    calendarEvents: calendarEventsQuery.data || [],
    isLoading: employeesQuery.isLoading || projectsQuery.isLoading || vacationsQuery.isLoading || calendarEventsQuery.isLoading,
    invalidateAll,
    companyId,
  };
}
