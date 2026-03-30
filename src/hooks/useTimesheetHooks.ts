// Timesheet / Time Tracking domain hooks extracted from useApi.ts

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import type {
  Timesheet, TimesheetCreate, TimesheetUpdate,
  PaginationQuery,
  PaginationResponse,
} from '@/types';
import { timesheetService } from '@/services/timesheetService';
import { QUERY_KEYS, UseApiQueryOptions, UseApiMutationOptions } from './useQueryKeys';

export const useTimesheets = (
  pagination?: PaginationQuery,
  filters?: {
    project_id?: string;
    employee_id?: string;
    date_from?: string;
    date_to?: string;
    approved?: boolean;
  },
  options?: UseApiQueryOptions<PaginationResponse<Timesheet>>
) => {
  return useQuery({
    queryKey: [...QUERY_KEYS.timesheets, pagination, filters],
    queryFn: () => timesheetService.getTimesheets(pagination, filters),
    ...options,
  });
};

export const useTimesheet = (id: string, options?: UseApiQueryOptions<Timesheet>) => {
  return useQuery({
    queryKey: QUERY_KEYS.timesheet(id),
    queryFn: () => timesheetService.getTimesheet(id),
    enabled: !!id,
    ...options,
  });
};

export const useCreateTimesheet = (options?: UseApiMutationOptions<Timesheet, TimesheetCreate>) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: timesheetService.createTimesheet,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.timesheets });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.projectStats(data.project_id || '') });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.employeeTimesheetStats(data.employee_id) });
      toast({
        title: 'Zeiteintrag erstellt',
        description: 'Der Zeiteintrag wurde erfolgreich erstellt.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Fehler beim Erstellen',
        description: error.message,
        variant: 'destructive',
      });
    },
    ...options,
  });
};

export const useUpdateTimesheet = (options?: UseApiMutationOptions<Timesheet, { id: string; data: TimesheetUpdate }>) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ id, data }) => timesheetService.updateTimesheet(id, data),
    onSuccess: (data, { id }) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.timesheets });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.timesheet(id) });
      toast({
        title: 'Zeiteintrag aktualisiert',
        description: 'Der Zeiteintrag wurde erfolgreich aktualisiert.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Fehler beim Aktualisieren',
        description: error.message,
        variant: 'destructive',
      });
    },
    ...options,
  });
};

export const useApproveTimesheet = (options?: UseApiMutationOptions<Timesheet, string>) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: timesheetService.approveTimesheet,
    onSuccess: (data, id) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.timesheets });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.timesheet(id) });
      toast({
        title: 'Zeiteintrag genehmigt',
        description: 'Der Zeiteintrag wurde erfolgreich genehmigt.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Fehler beim Genehmigen',
        description: error.message,
        variant: 'destructive',
      });
    },
    ...options,
  });
};

export const useBulkApproveTimesheets = (options?: UseApiMutationOptions<Timesheet[], string[]>) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: timesheetService.bulkApproveTimesheets,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.timesheets });
      toast({
        title: 'Zeiteinträge genehmigt',
        description: `${data.length} Zeiteinträge wurden erfolgreich genehmigt.`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Fehler beim Genehmigen',
        description: error.message,
        variant: 'destructive',
      });
    },
    ...options,
  });
};

export const useEmployeeTimesheetStats = (
  employeeId: string,
  dateFrom?: string,
  dateTo?: string,
  options?: UseApiQueryOptions<any>
) => {
  return useQuery({
    queryKey: [...QUERY_KEYS.employeeTimesheetStats(employeeId), dateFrom, dateTo],
    queryFn: () => timesheetService.getEmployeeTimesheetStats(employeeId, dateFrom, dateTo),
    enabled: !!employeeId,
    ...options,
  });
};

export const useProjectTimesheetSummary = (projectId: string, options?: UseApiQueryOptions<any>) => {
  return useQuery({
    queryKey: QUERY_KEYS.projectTimesheetSummary(projectId),
    queryFn: () => timesheetService.getProjectTimesheetSummary(projectId),
    enabled: !!projectId,
    ...options,
  });
};
