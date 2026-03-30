// Customer domain hooks extracted from useApi.ts

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import type {
  Customer, CustomerCreate, CustomerUpdate,
  PaginationQuery,
  PaginationResponse,
} from '@/types';
import { customerService } from '@/services/customerService';
import { QUERY_KEYS, UseApiQueryOptions, UseApiMutationOptions } from './useQueryKeys';

export const useCustomers = (
  pagination?: PaginationQuery,
  filters?: { status?: Customer['status']; search?: string },
  options?: UseApiQueryOptions<PaginationResponse<Customer>>
) => {
  return useQuery({
    queryKey: [...QUERY_KEYS.customers, pagination, filters],
    queryFn: () => customerService.getCustomers(pagination, filters),
    ...options,
  });
};

export const useCustomer = (id: string, options?: UseApiQueryOptions<Customer>) => {
  return useQuery({
    queryKey: QUERY_KEYS.customer(id),
    queryFn: () => customerService.getCustomer(id),
    enabled: !!id,
    ...options,
  });
};

export const useCustomerStats = (id: string, options?: UseApiQueryOptions<any>) => {
  return useQuery({
    queryKey: QUERY_KEYS.customerStats(id),
    queryFn: () => customerService.getCustomerStats(id),
    enabled: !!id,
    ...options,
  });
};

export const useCreateCustomer = (options?: UseApiMutationOptions<Customer, CustomerCreate>) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (data: CustomerCreate) => customerService.createCustomer(data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.customers });
      toast({
        title: 'Kunde erstellt',
        description: `${data.company_name} wurde erfolgreich erstellt.`,
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

export const useUpdateCustomer = (options?: UseApiMutationOptions<Customer, { id: string; data: CustomerUpdate }>) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ id, data }) => customerService.updateCustomer(id, data),
    onSuccess: (data, { id }) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.customers });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.customer(id) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.customerStats(id) });
      toast({
        title: 'Kunde aktualisiert',
        description: `${data.company_name} wurde erfolgreich aktualisiert.`,
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

export const useDeleteCustomer = (options?: UseApiMutationOptions<void, string>) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (id: string) => customerService.deleteCustomer(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.customers });
      queryClient.removeQueries({ queryKey: QUERY_KEYS.customer(id) });
      toast({
        title: 'Kunde gelöscht',
        description: 'Der Kunde wurde erfolgreich gelöscht.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Fehler beim Löschen',
        description: error.message,
        variant: 'destructive',
      });
    },
    ...options,
  });
};

export const useSearchCustomers = (query: string, limit?: number, options?: UseApiQueryOptions<Customer[]>) => {
  return useQuery({
    queryKey: [...QUERY_KEYS.customers, 'search', query, limit],
    queryFn: () => customerService.searchCustomers(query, limit),
    enabled: query.length >= 2,
    ...options,
  });
};
