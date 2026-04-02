import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { QUERY_KEYS } from '@/hooks/useQueryKeys';
import { useQueryClient } from '@tanstack/react-query';
import type { PlannerProject, PlannerEmployee, VacationRequest, CalendarEvent, PlannerDevice, EquipmentAssignment } from '../types';

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
    staleTime: 30_000,
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
    staleTime: 30_000,
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
    staleTime: 30_000,
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
    staleTime: 30_000,
  });

  const devicesQuery = useQuery({
    queryKey: QUERY_KEYS.plannerDevices(companyId || ''),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inspection_devices')
        .select('id, device_name, category, condition, operating_hours, current_location')
        .eq('company_id', companyId!)
        .eq('status', 'active');
      if (error) throw error;
      return (data || []) as PlannerDevice[];
    },
    enabled: !!companyId,
    staleTime: 30_000,
  });

  // Company-filtered via RLS policy (joins inspection_devices.company_id)
  const equipmentAssignmentsQuery = useQuery({
    queryKey: QUERY_KEYS.plannerEquipmentAssignments(companyId || ''),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('equipment_assignments')
        .select('device_id, project_id, start_date, end_date, is_active')
        .eq('is_active', true);
      if (error) throw error;
      return (data || []) as EquipmentAssignment[];
    },
    enabled: !!companyId,
    staleTime: 30_000,
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
    devices: devicesQuery.data || [],
    equipmentAssignments: equipmentAssignmentsQuery.data || [],
    isLoading: employeesQuery.isLoading || projectsQuery.isLoading || vacationsQuery.isLoading || calendarEventsQuery.isLoading || devicesQuery.isLoading,
    invalidateAll,
    companyId,
  };
}
