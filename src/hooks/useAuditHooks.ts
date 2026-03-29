// Audit and GoBD compliance hooks extracted from useApi.ts

import { useQuery, useMutation, useQueryClient, UseQueryOptions, UseMutationOptions } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { auditLogService, type AuditEntityType } from '@/services/auditLogService';
import { gobdService, type NumberSequenceType } from '@/services/gobdService';
import type { PaginationQuery } from '@/types';
import { QUERY_KEYS } from './useQueryKeys';

// ============================================
// GOBD AND AUDIT HOOKS
// ============================================

/**
 * Get audit logs with pagination and filtering
 */
export const useAuditLogs = (
  pagination?: PaginationQuery,
  filters?: any,
  options?: UseQueryOptions<any, Error>
) => {
  return useQuery({
    queryKey: [QUERY_KEYS.AUDIT_LOGS, pagination, filters],
    queryFn: () => auditLogService.getAuditLogs(pagination, filters),
    staleTime: 30 * 1000, // 30 seconds
    ...options,
  });
};

/**
 * Get audit trail for specific entity
 */
export const useAuditTrail = (
  entityType: string,
  entityId: string,
  options?: UseQueryOptions<any, Error>
) => {
  return useQuery({
    queryKey: [QUERY_KEYS.AUDIT_TRAIL, entityType, entityId],
    queryFn: () => auditLogService.getAuditTrail(entityType as AuditEntityType, entityId),
    enabled: !!entityType && !!entityId,
    staleTime: 60 * 1000, // 1 minute
    ...options,
  });
};

/**
 * Get audit statistics
 */
export const useAuditStatistics = (
  dateRange?: { from?: string; to?: string },
  options?: UseQueryOptions<any, Error>
) => {
  return useQuery({
    queryKey: [QUERY_KEYS.AUDIT_STATS, dateRange],
    queryFn: () => auditLogService.getAuditStatistics(dateRange),
    staleTime: 5 * 60 * 1000, // 5 minutes
    ...options,
  });
};

/**
 * Check entity immutability
 */
export const useImmutabilityCheck = (
  entityType: string,
  entityId: string,
  options?: UseQueryOptions<any, Error>
) => {
  return useQuery({
    queryKey: [QUERY_KEYS.IMMUTABILITY_CHECK, entityType, entityId],
    queryFn: () => gobdService.checkImmutability(entityType, entityId),
    enabled: !!entityType && !!entityId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    ...options,
  });
};

/**
 * Get or create number sequence
 */
export const useNumberSequence = (
  sequenceType: string,
  year?: number,
  options?: UseQueryOptions<any, Error>
) => {
  return useQuery({
    queryKey: [QUERY_KEYS.NUMBER_SEQUENCES, sequenceType, year],
    queryFn: () => gobdService.getOrCreateNumberSequence(sequenceType as NumberSequenceType, year),
    enabled: !!sequenceType,
    staleTime: 10 * 60 * 1000, // 10 minutes
    ...options,
  });
};

/**
 * Get next number in sequence
 */
export const useGetNextNumber = (
  options?: UseMutationOptions<any, Error, { sequenceType: string; year?: number }>
) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ sequenceType, year }: { sequenceType: string; year?: number }) =>
      gobdService.getNextNumber(sequenceType as NumberSequenceType, year),
    onSuccess: (data, variables) => {
      // Invalidate number sequences
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.NUMBER_SEQUENCES] });

      toast({
        title: 'Nummer generiert',
        description: `Nächste Nummer: ${data.number}`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Fehler bei Nummerngenierung',
        description: error.message || 'Die Nummer konnte nicht generiert werden.',
        variant: 'destructive',
      });
    },
    ...options,
  });
};

/**
 * Make entity immutable
 */
export const useMakeImmutable = (
  options?: UseMutationOptions<void, Error, { entityType: string; entityId: string; reason: string }>
) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ entityType, entityId, reason }) =>
      gobdService.makeImmutable(entityType, entityId, reason),
    onSuccess: (_, variables) => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.IMMUTABILITY_CHECK] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.AUDIT_TRAIL, variables.entityType, variables.entityId] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.AUDIT_LOGS] });

      toast({
        title: 'Unveränderlich gemacht',
        description: `${variables.entityType} ${variables.entityId} ist jetzt unveränderlich.`,
      });
    },
    onError: (error, variables) => {
      toast({
        title: 'Fehler bei Unveränderlichkeit',
        description: error.message || 'Die Entität konnte nicht unveränderlich gemacht werden.',
        variant: 'destructive',
      });
    },
    ...options,
  });
};

/**
 * Create document hash for GoBD compliance
 */
export const useCreateDocumentHash = (
  options?: UseMutationOptions<any, Error, {
    entityType: string;
    entityId: string;
    documentContent: string;
    fileName: string;
    mimeType: string;
  }>
) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ entityType, entityId, documentContent, fileName, mimeType }) =>
      gobdService.createDocumentHash(entityType, entityId, documentContent, fileName, mimeType),
    onSuccess: (document, variables) => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.GOBD_DOCUMENTS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.AUDIT_LOGS] });

      toast({
        title: 'Dokument-Hash erstellt',
        description: `Hash für ${variables.fileName} wurde erstellt (GoBD-Compliance).`,
      });
    },
    onError: (error, variables) => {
      toast({
        title: 'Fehler bei Hash-Erstellung',
        description: `Hash für ${variables.fileName} konnte nicht erstellt werden.`,
        variant: 'destructive',
      });
    },
    ...options,
  });
};

/**
 * Verify document integrity
 */
export const useVerifyDocumentIntegrity = (
  options?: UseMutationOptions<any, Error, string>
) => {
  const { toast } = useToast();

  return useMutation({
    mutationFn: (documentId: string) => gobdService.verifyDocumentIntegrity(documentId),
    onSuccess: (verification) => {
      toast({
        title: verification.integrity_maintained ? 'Integrität bestätigt' : 'Integrität verletzt',
        description: verification.integrity_maintained
          ? 'Das Dokument ist unverändert und integer.'
          : 'Das Dokument wurde verändert! GoBD-Verletzung!',
        variant: verification.integrity_maintained ? 'default' : 'destructive',
      });
    },
    onError: (error) => {
      toast({
        title: 'Fehler bei Integritätsprüfung',
        description: 'Die Integritätsprüfung konnte nicht durchgeführt werden.',
        variant: 'destructive',
      });
    },
    ...options,
  });
};
