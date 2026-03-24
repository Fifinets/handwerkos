// React hooks for AMGE-Kalkulator
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { AMGEService } from '@/services/amgeService';
import type { AMGEFormData } from '@/types/amge';

const AMGE_KEYS = {
  all: ['amge-calculations'] as const,
  active: ['amge-calculations', 'active'] as const,
  detail: (id: string) => ['amge-calculations', id] as const,
};

export function useAMGECalculations() {
  return useQuery({
    queryKey: AMGE_KEYS.all,
    queryFn: () => AMGEService.getCalculations(),
  });
}

export function useActiveAMGE() {
  return useQuery({
    queryKey: AMGE_KEYS.active,
    queryFn: () => AMGEService.getActiveCalculation(),
  });
}

export function useAMGECalculation(id: string) {
  return useQuery({
    queryKey: AMGE_KEYS.detail(id),
    queryFn: () => AMGEService.getCalculation(id),
    enabled: !!id,
  });
}

export function useCreateAMGE() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (data: AMGEFormData) => AMGEService.createCalculation(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: AMGE_KEYS.all });
      queryClient.invalidateQueries({ queryKey: AMGE_KEYS.active });
      toast({ title: 'AMGE-Kalkulation erstellt' });
    },
    onError: (error: Error) => {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
    },
  });
}

export function useUpdateAMGE() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<AMGEFormData> }) =>
      AMGEService.updateCalculation(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: AMGE_KEYS.all });
      queryClient.invalidateQueries({ queryKey: AMGE_KEYS.active });
      queryClient.invalidateQueries({ queryKey: AMGE_KEYS.detail(variables.id) });
      toast({ title: 'Kalkulation aktualisiert' });
    },
    onError: (error: Error) => {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
    },
  });
}

export function useDeleteAMGE() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (id: string) => AMGEService.deleteCalculation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: AMGE_KEYS.all });
      queryClient.invalidateQueries({ queryKey: AMGE_KEYS.active });
      toast({ title: 'Kalkulation gelöscht' });
    },
    onError: (error: Error) => {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
    },
  });
}

export function useSetActiveAMGE() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (id: string) => AMGEService.setActive(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: AMGE_KEYS.all });
      queryClient.invalidateQueries({ queryKey: AMGE_KEYS.active });
      toast({ title: 'Aktive Kalkulation geändert' });
    },
    onError: (error: Error) => {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
    },
  });
}
