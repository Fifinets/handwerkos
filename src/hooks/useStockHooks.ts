// Materials & Stock domain hooks extracted from useApi.ts

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import type {
  Material, MaterialCreate, MaterialUpdate,
  PaginationQuery,
  PaginationResponse,
} from '@/types';
import { materialService } from '@/services/materialService';
import { stockService } from '@/services/stockService';
import { QUERY_KEYS, UseApiQueryOptions, UseApiMutationOptions } from './useQueryKeys';

export const useMaterials = (
  pagination?: PaginationQuery,
  filters?: { category?: string; supplier?: string; low_stock?: boolean; search?: string },
  options?: UseApiQueryOptions<PaginationResponse<Material>>
) => {
  return useQuery({
    queryKey: [...QUERY_KEYS.materials, pagination, filters],
    queryFn: () => materialService.getMaterials(pagination, filters),
    ...options,
  });
};

export const useMaterial = (id: string, options?: UseApiQueryOptions<Material>) => {
  return useQuery({
    queryKey: QUERY_KEYS.material(id),
    queryFn: () => materialService.getMaterial(id),
    enabled: !!id,
    ...options,
  });
};

export const useCreateMaterial = (options?: UseApiMutationOptions<Material, MaterialCreate>) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: materialService.createMaterial,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.materials });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.materialStats });
      toast({
        title: 'Material erstellt',
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

export const useUpdateMaterial = (options?: UseApiMutationOptions<Material, { id: string; data: MaterialUpdate }>) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ id, data }) => materialService.updateMaterial(id, data),
    onSuccess: (data, { id }) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.materials });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.material(id) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.materialStats });
      toast({
        title: 'Material aktualisiert',
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

export const useAdjustStock = (options?: UseApiMutationOptions<Material, { id: string; adjustment: number; reason: string; reference?: string }>) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ id, adjustment, reason, reference }) => materialService.adjustStock(id, adjustment, reason, reference),
    onSuccess: (data, { id }) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.materials });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.material(id) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.stockMovements });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.materialStats });
      toast({
        title: 'Bestand angepasst',
        description: `Bestand für ${data.name} wurde angepasst.`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Fehler beim Anpassen',
        description: error.message,
        variant: 'destructive',
      });
    },
    ...options,
  });
};

export const useAddStock = (options?: UseApiMutationOptions<Material, { id: string; quantity: number; unitCost?: number; supplier?: string; invoiceReference?: string }>) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ id, quantity, unitCost, supplier, invoiceReference }) =>
      materialService.addStock(id, quantity, unitCost, supplier, invoiceReference),
    onSuccess: (data, { id }) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.materials });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.material(id) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.stockMovements });
      toast({
        title: 'Wareneingang erfasst',
        description: `Wareneingang für ${data.name} wurde erfasst.`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Fehler beim Wareneingang',
        description: error.message,
        variant: 'destructive',
      });
    },
    ...options,
  });
};

export const useRemoveStock = (options?: UseApiMutationOptions<Material, { id: string; quantity: number; projectId?: string; reason?: string }>) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ id, quantity, projectId, reason }) =>
      materialService.removeStock(id, quantity, projectId, reason),
    onSuccess: (data, { id }) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.materials });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.material(id) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.stockMovements });
      toast({
        title: 'Verbrauch erfasst',
        description: `Verbrauch für ${data.name} wurde erfasst.`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Fehler beim Verbrauch',
        description: error.message,
        variant: 'destructive',
      });
    },
    ...options,
  });
};

export const useLowStockMaterials = (options?: UseApiQueryOptions<Material[]>) => {
  return useQuery({
    queryKey: QUERY_KEYS.lowStockMaterials,
    queryFn: () => materialService.getLowStockMaterials(),
    ...options,
  });
};

export const useMaterialStats = (options?: UseApiQueryOptions<any>) => {
  return useQuery({
    queryKey: QUERY_KEYS.materialStats,
    queryFn: () => materialService.getMaterialStats(),
    ...options,
  });
};

export const useSearchMaterials = (query: string, limit?: number, options?: UseApiQueryOptions<Material[]>) => {
  return useQuery({
    queryKey: [...QUERY_KEYS.materials, 'search', query, limit],
    queryFn: () => materialService.searchMaterials(query, limit),
    enabled: query.length >= 2,
    ...options,
  });
};

// Stock operations
export const useStockMovements = (
  pagination?: PaginationQuery,
  filters?: {
    material_id?: string;
    movement_type?: any;
    project_id?: string;
    date_from?: string;
    date_to?: string;
  },
  options?: UseApiQueryOptions<any>
) => {
  return useQuery({
    queryKey: [...QUERY_KEYS.stockMovements, pagination, filters],
    queryFn: () => stockService.getStockMovements(pagination, filters),
    ...options,
  });
};

export const useStockValuation = (location?: string, options?: UseApiQueryOptions<any>) => {
  return useQuery({
    queryKey: [...QUERY_KEYS.stockValuation, location],
    queryFn: () => stockService.getStockValuation(location),
    ...options,
  });
};

export const useStockAnalytics = (dateFrom: string, dateTo: string, options?: UseApiQueryOptions<any>) => {
  return useQuery({
    queryKey: [...QUERY_KEYS.stockAnalytics, dateFrom, dateTo],
    queryFn: () => stockService.getStockAnalytics(dateFrom, dateTo),
    enabled: !!dateFrom && !!dateTo,
    ...options,
  });
};
