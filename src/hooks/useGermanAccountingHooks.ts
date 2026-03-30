// DATEV and German accounting hooks extracted from useApi.ts

import { useQuery, useMutation, useQueryClient, UseQueryOptions, UseMutationOptions } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { datevService } from '@/services/datevService';
import { germanAccountingService } from '@/services/germanAccountingService';
import { QUERY_KEYS } from './useQueryKeys';

// ============================================
// DATEV AND GERMAN ACCOUNTING HOOKS
// ============================================

/**
 * Generate DATEV CSV export
 */
export const useGenerateDATEVExport = (
  options?: UseMutationOptions<any, Error, {
    period: any;
    exportType?: 'FULL' | 'INCREMENTAL';
    consultantNumber?: string;
    clientNumber?: string;
  }>
) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ period, exportType = 'FULL', consultantNumber, clientNumber }) =>
      datevService.generateDATEVExport(period, exportType, consultantNumber, clientNumber),
    onSuccess: (exportData, variables) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.DATEV_EXPORTS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.AUDIT_LOGS] });

      toast({
        title: 'DATEV Export erstellt',
        description: `CSV Export für Periode ${variables.period.start_date} - ${variables.period.end_date} wurde generiert. ${exportData.total_transactions} Transaktionen exportiert.`,
      });
    },
    onError: (error, variables) => {
      toast({
        title: 'Fehler beim DATEV Export',
        description: error.message || 'Der DATEV CSV Export konnte nicht erstellt werden.',
        variant: 'destructive',
      });
    },
    ...options,
  });
};

/**
 * Get DATEV account mapping
 */
export const useDATEVAccountMapping = (
  entityType: string,
  entityId: string,
  options?: UseQueryOptions<any, Error>
) => {
  return useQuery({
    queryKey: [QUERY_KEYS.DATEV_ACCOUNT_MAPPINGS, entityType, entityId],
    queryFn: () => datevService.getAccountMapping(entityType, entityId),
    enabled: !!entityType && !!entityId,
    staleTime: 10 * 60 * 1000, // 10 minutes
    ...options,
  });
};

/**
 * Set DATEV account mapping
 */
export const useSetDATEVAccountMapping = (
  options?: UseMutationOptions<any, Error, {
    entityType: string;
    entityId: string;
    datevAccount: string;
    accountType: string;
    accountName: string;
    vatTreatment?: string;
  }>
) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ entityType, entityId, datevAccount, accountType, accountName, vatTreatment }) =>
      datevService.setAccountMapping(entityType, entityId, datevAccount, accountType, accountName, vatTreatment),
    onSuccess: (mapping, variables) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.DATEV_ACCOUNT_MAPPINGS] });

      toast({
        title: 'Kontozuordnung gespeichert',
        description: `${variables.entityType} wurde Konto ${variables.datevAccount} zugeordnet.`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Fehler bei Kontozuordnung',
        description: 'Die DATEV Kontozuordnung konnte nicht gespeichert werden.',
        variant: 'destructive',
      });
    },
    ...options,
  });
};

/**
 * Generate German VAT return (UStVA)
 */
export const useGenerateGermanVATReturn = (
  options?: UseMutationOptions<any, Error, any>
) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (period: any) => germanAccountingService.generateVATReturn(period),
    onSuccess: (vatReturn, period) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.GERMAN_VAT_RETURNS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.AUDIT_LOGS] });

      toast({
        title: 'UStVA generiert',
        description: `Umsatzsteuervoranmeldung für ${period.start_date} - ${period.end_date} erstellt. Zahllast: €${vatReturn.vat_payable.toFixed(2)}`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Fehler bei UStVA',
        description: 'Die Umsatzsteuervoranmeldung konnte nicht erstellt werden.',
        variant: 'destructive',
      });
    },
    ...options,
  });
};

/**
 * Generate German business expense report
 */
export const useGenerateGermanExpenseReport = (
  period: any,
  options?: UseQueryOptions<any, Error>
) => {
  return useQuery({
    queryKey: [QUERY_KEYS.GERMAN_EXPENSE_REPORTS, period],
    queryFn: () => germanAccountingService.generateBusinessExpenseReport(period),
    enabled: !!period,
    staleTime: 5 * 60 * 1000, // 5 minutes
    ...options,
  });
};

/**
 * Calculate German depreciation
 */
export const useCalculateGermanDepreciation = (
  options?: UseMutationOptions<any, Error, { assetId: string; calculationDate?: string }>
) => {
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ assetId, calculationDate }) =>
      germanAccountingService.calculateDepreciation(assetId, calculationDate),
    onSuccess: (depreciation) => {
      toast({
        title: 'Abschreibung berechnet',
        description: `${depreciation.asset_name}: Jährliche Abschreibung €${depreciation.annual_depreciation.toFixed(2)}, Buchwert €${depreciation.book_value.toFixed(2)}`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Fehler bei Abschreibungsberechnung',
        description: 'Die Abschreibung konnte nicht berechnet werden.',
        variant: 'destructive',
      });
    },
    ...options,
  });
};

/**
 * Validate German invoice compliance
 */
export const useValidateGermanInvoiceCompliance = (
  invoiceId: string,
  options?: UseQueryOptions<any, Error>
) => {
  return useQuery({
    queryKey: ['german-invoice-compliance', invoiceId],
    queryFn: () => germanAccountingService.validateGermanInvoiceCompliance(invoiceId),
    enabled: !!invoiceId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    ...options,
  });
};

/**
 * Create German accounting period
 */
export const useCreateGermanAccountingPeriod = (
  options?: UseMutationOptions<any, Error, {
    year: number;
    periodType: 'MONTHLY' | 'QUARTERLY' | 'ANNUAL';
    periodNumber?: number;
  }>
) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ year, periodType, periodNumber }) =>
      germanAccountingService.createAccountingPeriod(year, periodType, periodNumber),
    onSuccess: (period, variables) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.GERMAN_PERIODS] });

      toast({
        title: 'Buchungsperiode erstellt',
        description: `${variables.periodType} ${variables.year}${variables.periodNumber ? `/${variables.periodNumber}` : ''} wurde erstellt.`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Fehler bei Periodenerstellung',
        description: 'Die Buchungsperiode konnte nicht erstellt werden.',
        variant: 'destructive',
      });
    },
    ...options,
  });
};
