// React Query hooks for VDE inspection module
// Provides type-safe hooks for devices, protocols, measurements, defects, and schedules

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { InspectionService } from '@/services/inspectionService';
import type {
  InspectionDevice,
  InspectionDeviceCreate,
  InspectionDeviceUpdate,
  InspectionProtocol,
  InspectionProtocolCreate,
  InspectionProtocolUpdate,
  ProtocolWithRelations,
  InspectionMeasurement,
  InspectionMeasurementCreate,
  InspectionDefect,
  InspectionDefectCreate,
  InspectionDefectUpdate,
  InspectionSchedule,
  InspectionScheduleCreate,
  InspectionFilter,
} from '@/types/inspection';

// ============================================================================
// QUERY KEYS
// ============================================================================

export const INSPECTION_KEYS = {
  devices: ['inspection-devices'] as const,
  device: (id: string) => ['inspection-devices', id] as const,
  protocols: ['inspection-protocols'] as const,
  protocol: (id: string) => ['inspection-protocols', id] as const,
  upcoming: (days: number) => ['inspection-upcoming', days] as const,
  overdue: ['inspection-overdue'] as const,
} as const;

// ============================================================================
// DEVICE HOOKS
// ============================================================================

export const useInspectionDevices = (customerId?: string) => {
  return useQuery({
    queryKey: [...INSPECTION_KEYS.devices, customerId],
    queryFn: () => InspectionService.getDevices(customerId),
  });
};

export const useInspectionDevice = (id: string) => {
  return useQuery({
    queryKey: INSPECTION_KEYS.device(id),
    queryFn: () => InspectionService.getDevice(id),
    enabled: !!id,
  });
};

export const useCreateDevice = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (data: InspectionDeviceCreate) => InspectionService.createDevice(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: INSPECTION_KEYS.devices });
      toast({
        title: 'Geraet angelegt',
        description: 'Das Geraet wurde erfolgreich erstellt.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Fehler beim Anlegen',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
};

export const useUpdateDevice = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: InspectionDeviceUpdate }) =>
      InspectionService.updateDevice(id, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: INSPECTION_KEYS.devices });
      queryClient.invalidateQueries({ queryKey: INSPECTION_KEYS.device(variables.id) });
      toast({
        title: 'Geraet aktualisiert',
        description: 'Die Aenderungen wurden gespeichert.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Fehler beim Aktualisieren',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
};

export const useDeleteDevice = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (id: string) => InspectionService.deleteDevice(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: INSPECTION_KEYS.devices });
      toast({
        title: 'Geraet geloescht',
        description: 'Das Geraet wurde entfernt.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Fehler beim Loeschen',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
};

// ============================================================================
// PROTOCOL HOOKS
// ============================================================================

export const useInspectionProtocols = (filters?: InspectionFilter) => {
  return useQuery({
    queryKey: [...INSPECTION_KEYS.protocols, filters],
    queryFn: () => InspectionService.getProtocols(filters),
  });
};

export const useInspectionProtocol = (id: string) => {
  return useQuery({
    queryKey: INSPECTION_KEYS.protocol(id),
    queryFn: () => InspectionService.getProtocol(id),
    enabled: !!id,
  });
};

export const useCreateProtocol = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (data: InspectionProtocolCreate) => InspectionService.createProtocol(data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: INSPECTION_KEYS.protocols });
      toast({
        title: 'Protokoll erstellt',
        description: `Pruefprotokoll ${data.protocol_number} wurde angelegt.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Fehler beim Erstellen',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
};

export const useUpdateProtocol = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: InspectionProtocolUpdate }) =>
      InspectionService.updateProtocol(id, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: INSPECTION_KEYS.protocols });
      queryClient.invalidateQueries({ queryKey: INSPECTION_KEYS.protocol(variables.id) });
      toast({
        title: 'Protokoll aktualisiert',
        description: 'Die Aenderungen wurden gespeichert.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Fehler beim Aktualisieren',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
};

export const useFinalizeProtocol = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (id: string) => InspectionService.finalizeProtocol(id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: INSPECTION_KEYS.protocols });
      queryClient.invalidateQueries({ queryKey: INSPECTION_KEYS.protocol(data.id) });
      queryClient.invalidateQueries({ queryKey: INSPECTION_KEYS.devices });
      queryClient.invalidateQueries({ queryKey: INSPECTION_KEYS.overdue });
      toast({
        title: 'Protokoll finalisiert',
        description: `Ergebnis: ${data.overall_result === 'pass' ? 'Bestanden' : data.overall_result === 'fail' ? 'Nicht bestanden' : 'Bedingt bestanden'}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Fehler beim Finalisieren',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
};

// ============================================================================
// MEASUREMENT HOOKS
// ============================================================================

export const useAddMeasurement = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (data: InspectionMeasurementCreate) => InspectionService.addMeasurement(data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: INSPECTION_KEYS.protocol(data.protocol_id) });
      toast({
        title: 'Messung hinzugefuegt',
        description: 'Die Messung wurde erfolgreich erfasst.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Fehler beim Erfassen',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
};

export const useDeleteMeasurement = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ id, protocolId }: { id: string; protocolId: string }) =>
      InspectionService.deleteMeasurement(id),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: INSPECTION_KEYS.protocol(variables.protocolId) });
      toast({
        title: 'Messung geloescht',
        description: 'Die Messung wurde entfernt.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Fehler beim Loeschen',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
};

// ============================================================================
// DEFECT HOOKS
// ============================================================================

export const useAddDefect = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (data: InspectionDefectCreate) => InspectionService.addDefect(data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: INSPECTION_KEYS.protocol(data.protocol_id) });
      toast({
        title: 'Mangel erfasst',
        description: 'Der Mangel wurde dokumentiert.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Fehler beim Erfassen',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
};

export const useUpdateDefect = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ id, data, protocolId }: { id: string; data: InspectionDefectUpdate; protocolId: string }) =>
      InspectionService.updateDefect(id, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: INSPECTION_KEYS.protocol(variables.protocolId) });
      toast({
        title: 'Mangel aktualisiert',
        description: variables.data.resolved
          ? 'Der Mangel wurde als behoben markiert.'
          : 'Die Aenderungen wurden gespeichert.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Fehler beim Aktualisieren',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
};

// ============================================================================
// SCHEDULING HOOKS
// ============================================================================

export const useUpcomingInspections = (withinDays: number = 30) => {
  return useQuery({
    queryKey: INSPECTION_KEYS.upcoming(withinDays),
    queryFn: () => InspectionService.getUpcomingInspections(withinDays),
  });
};

export const useOverdueInspections = () => {
  return useQuery({
    queryKey: INSPECTION_KEYS.overdue,
    queryFn: () => InspectionService.getOverdueInspections(),
  });
};

export const useCreateSchedule = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (data: InspectionScheduleCreate) => InspectionService.createSchedule(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: INSPECTION_KEYS.devices });
      toast({
        title: 'Pruefplan erstellt',
        description: 'Der Pruefplan wurde erfolgreich angelegt.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Fehler beim Erstellen',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
};
