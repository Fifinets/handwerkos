// Project domain hooks extracted from useApi.ts

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import type {
  Project, ProjectCreate, ProjectUpdate,
  PaginationQuery,
  PaginationResponse,
} from '@/types';
import { ProjectService } from '@/services/projectService';
import { QUERY_KEYS, UseApiQueryOptions, UseApiMutationOptions } from './useQueryKeys';

export const useProjects = (
  pagination?: PaginationQuery,
  filters?: { status?: Project['status']; customer_id?: string; employee_id?: string; search?: string },
  options?: UseApiQueryOptions<PaginationResponse<Project>>
) => {
  return useQuery({
    queryKey: [...QUERY_KEYS.projects, pagination, filters],
    queryFn: () => ProjectService.getProjects(pagination, filters),
    ...options,
  });
};

export const useProject = (id: string, options?: UseApiQueryOptions<Project>) => {
  return useQuery({
    queryKey: QUERY_KEYS.project(id),
    queryFn: () => ProjectService.getProject(id),
    enabled: !!id,
    ...options,
  });
};

export const useProjectStats = (id: string, options?: UseApiQueryOptions<any>) => {
  return useQuery({
    queryKey: QUERY_KEYS.projectStats(id),
    queryFn: () => ProjectService.getProjectStats(id),
    enabled: !!id,
    ...options,
  });
};

export const useProjectTimeline = (id: string, limit?: number, options?: UseApiQueryOptions<any[]>) => {
  return useQuery({
    queryKey: [...QUERY_KEYS.projectTimeline(id), limit],
    queryFn: () => ProjectService.getProjectTimeline(id, limit),
    enabled: !!id,
    ...options,
  });
};

export const useCreateProject = (options?: UseApiMutationOptions<Project, ProjectCreate>) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ProjectService.createProject,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.projects });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.customerProjects(data.customer_id || '') });
      toast({
        title: 'Projekt erstellt',
        description: `${data.name} wurde erfolgreich erstellt.`,
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

export const useUpdateProject = (options?: UseApiMutationOptions<Project, { id: string; data: ProjectUpdate }>) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ id, data }) => ProjectService.updateProject(id, data),
    onSuccess: (data, { id }) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.projects });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.project(id) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.projectStats(id) });
      toast({
        title: 'Projekt aktualisiert',
        description: `${data.name} wurde erfolgreich aktualisiert.`,
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

export const useStartProject = (options?: UseApiMutationOptions<Project, string>) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ProjectService.startProject,
    onSuccess: (data, id) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.projects });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.project(id) });
      toast({
        title: 'Projekt gestartet',
        description: `${data.name} wurde gestartet.`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Fehler beim Starten',
        description: error.message,
        variant: 'destructive',
      });
    },
    ...options,
  });
};

export const useCompleteProject = (options?: UseApiMutationOptions<Project, string>) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ProjectService.completeProject,
    onSuccess: (data, id) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.projects });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.project(id) });
      toast({
        title: 'Projekt abgeschlossen',
        description: `${data.name} wurde abgeschlossen.`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Fehler beim Abschließen',
        description: error.message,
        variant: 'destructive',
      });
    },
    ...options,
  });
};

export const useBlockProject = (options?: UseApiMutationOptions<Project, { id: string; reason?: string }>) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ id, reason }) => ProjectService.blockProject(id, reason),
    onSuccess: (data, { id }) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.projects });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.project(id) });
      toast({
        title: 'Projekt blockiert',
        description: `${data.name} wurde blockiert.`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Fehler beim Blockieren',
        description: error.message,
        variant: 'destructive',
      });
    },
    ...options,
  });
};

export const useSearchProjects = (query: string, limit?: number, options?: UseApiQueryOptions<Project[]>) => {
  return useQuery({
    queryKey: [...QUERY_KEYS.projects, 'search', query, limit],
    queryFn: () => ProjectService.searchProjects(query, limit),
    enabled: query.length >= 2,
    ...options,
  });
};
