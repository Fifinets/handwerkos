// Order domain hooks extracted from useApi.ts

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import type {
  Order, OrderCreate,
  PaginationQuery,
  PaginationResponse,
} from '@/types';
import { orderService } from '@/services/orderService';
import { QUERY_KEYS, UseApiQueryOptions, UseApiMutationOptions } from './useQueryKeys';

export const useOrders = (
  pagination?: PaginationQuery,
  filters?: { status?: Order['status']; customer_id?: string; search?: string },
  options?: UseApiQueryOptions<PaginationResponse<Order>>
) => {
  return useQuery({
    queryKey: [...QUERY_KEYS.orders, pagination, filters],
    queryFn: () => orderService.getOrders(pagination, filters),
    ...options,
  });
};

export const useOrder = (id: string, options?: UseApiQueryOptions<Order>) => {
  return useQuery({
    queryKey: QUERY_KEYS.order(id),
    queryFn: () => orderService.getOrder(id),
    enabled: !!id,
    ...options,
  });
};

export const useCreateOrder = (options?: UseApiMutationOptions<Order, OrderCreate>) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: orderService.createOrder,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.orders });
      toast({
        title: 'Auftrag erstellt',
        description: `${data.title} wurde erfolgreich erstellt.`,
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

export const useStartOrder = (options?: UseApiMutationOptions<Order, string>) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: orderService.startOrder,
    onSuccess: (data, id) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.orders });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.order(id) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.projects });
      toast({
        title: 'Auftrag gestartet',
        description: `${data.title} wurde gestartet.`,
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

export const useCompleteOrder = (options?: UseApiMutationOptions<Order, string>) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: orderService.completeOrder,
    onSuccess: (data, id) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.orders });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.order(id) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.projects });
      toast({
        title: 'Auftrag abgeschlossen',
        description: `${data.title} wurde abgeschlossen.`,
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

export const useCancelOrder = (options?: UseApiMutationOptions<Order, { id: string; reason?: string }>) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ id, reason }) => orderService.cancelOrder(id, reason),
    onSuccess: (data, { id }) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.orders });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.order(id) });
      toast({
        title: 'Auftrag storniert',
        description: `${data.title} wurde storniert.`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Fehler beim Stornieren',
        description: error.message,
        variant: 'destructive',
      });
    },
    ...options,
  });
};

export const useOrderStats = (options?: UseApiQueryOptions<any>) => {
  return useQuery({
    queryKey: QUERY_KEYS.orderStats,
    queryFn: () => orderService.getOrderStats(),
    ...options,
  });
};
