// Document hooks extracted from useApi.ts
// Document management, stats, search, and downloads

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { documentService } from '@/services/documentService';
import type { PaginationQuery, PaginationResponse } from '@/types';
import { QUERY_KEYS, UseApiQueryOptions, UseApiMutationOptions } from './useQueryKeys';

// ==========================================
// DOCUMENT HOOKS
// ==========================================

export const useDocuments = (
  pagination?: PaginationQuery,
  filters?: {
    category?: any;
    legal_category?: any;
    project_id?: string;
    customer_id?: string;
    tags?: string[];
    uploaded_by?: string;
    date_from?: string;
    date_to?: string;
    search?: string;
  },
  options?: UseApiQueryOptions<PaginationResponse<any>>
) => {
  return useQuery({
    queryKey: [...QUERY_KEYS.documents, pagination, filters],
    queryFn: () => documentService.getDocuments(pagination, filters),
    ...options,
  });
};

export const useDocument = (id: string, options?: UseApiQueryOptions<any>) => {
  return useQuery({
    queryKey: QUERY_KEYS.document(id),
    queryFn: () => documentService.getDocument(id),
    enabled: !!id,
    ...options,
  });
};

export const useUploadDocument = (options?: UseApiMutationOptions<any, any>) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: documentService.uploadDocument,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.documents });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.documentStats });
      toast({
        title: 'Dokument hochgeladen',
        description: `${data.original_filename} wurde erfolgreich hochgeladen.`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Fehler beim Upload',
        description: error.message,
        variant: 'destructive',
      });
    },
    ...options,
  });
};

export const useUpdateDocument = (options?: UseApiMutationOptions<any, { id: string; data: any }>) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ id, data }) => documentService.updateDocument(id, data),
    onSuccess: (data, { id }) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.documents });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.document(id) });
      toast({
        title: 'Dokument aktualisiert',
        description: 'Das Dokument wurde erfolgreich aktualisiert.',
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

export const useDeleteDocument = (options?: UseApiMutationOptions<void, string>) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: documentService.deleteDocument,
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.documents });
      queryClient.removeQueries({ queryKey: QUERY_KEYS.document(id) });
      toast({
        title: 'Dokument gelöscht',
        description: 'Das Dokument wurde erfolgreich gelöscht.',
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

export const useDocumentStats = (options?: UseApiQueryOptions<any>) => {
  return useQuery({
    queryKey: QUERY_KEYS.documentStats,
    queryFn: () => documentService.getDocumentStats(),
    ...options,
  });
};

export const useExpiringDocuments = (days?: number, options?: UseApiQueryOptions<any[]>) => {
  return useQuery({
    queryKey: [...QUERY_KEYS.expiringDocuments, days],
    queryFn: () => documentService.getExpiringDocuments(days),
    ...options,
  });
};

export const useSearchDocuments = (query: string, limit?: number, options?: UseApiQueryOptions<any[]>) => {
  return useQuery({
    queryKey: [...QUERY_KEYS.documents, 'search', query, limit],
    queryFn: () => documentService.searchDocuments(query, limit),
    enabled: query.length >= 2,
    ...options,
  });
};

export const useGetDocumentDownloadUrl = (options?: UseApiMutationOptions<string, { id: string; expiresIn?: number }>) => {
  return useMutation({
    mutationFn: ({ id, expiresIn }) => documentService.getDownloadUrl(id, expiresIn),
    ...options,
  });
};
