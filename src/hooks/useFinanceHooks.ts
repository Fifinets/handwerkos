// Finance hooks extracted from useApi.ts
// Invoices, Expenses, and Financial KPIs

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { financeService } from '@/services/financeService';
import type {
  Invoice, InvoiceCreate,
  Expense, ExpenseCreate,
  PaginationQuery,
  PaginationResponse,
} from '@/types';
import { QUERY_KEYS, UseApiQueryOptions, UseApiMutationOptions } from './useQueryKeys';

// ==========================================
// FINANCE HOOKS
// ==========================================

export const useInvoices = (
  pagination?: PaginationQuery,
  filters?: {
    status?: Invoice['status'];
    customer_id?: string;
    project_id?: string;
    overdue?: boolean;
    date_from?: string;
    date_to?: string;
  },
  options?: UseApiQueryOptions<PaginationResponse<Invoice>>
) => {
  return useQuery({
    queryKey: [...QUERY_KEYS.invoices, pagination, filters],
    queryFn: () => financeService.getInvoices(pagination, filters),
    ...options,
  });
};

export const useInvoice = (id: string, options?: UseApiQueryOptions<Invoice>) => {
  return useQuery({
    queryKey: QUERY_KEYS.invoice(id),
    queryFn: () => financeService.getInvoice(id),
    enabled: !!id,
    ...options,
  });
};

export const useCreateInvoice = (options?: UseApiMutationOptions<Invoice, InvoiceCreate>) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: financeService.createInvoice,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.invoices });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.financialKpis });
      toast({
        title: 'Rechnung erstellt',
        description: `${data.invoice_number || 'Rechnung'} wurde erfolgreich erstellt.`,
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

export const useSendInvoice = (options?: UseApiMutationOptions<Invoice, string>) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: financeService.sendInvoice,
    onSuccess: (data, id) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.invoices });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.invoice(id) });
      toast({
        title: 'Rechnung versendet',
        description: `${data.invoice_number} wurde erfolgreich versendet.`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Fehler beim Versenden',
        description: error.message,
        variant: 'destructive',
      });
    },
    ...options,
  });
};

export const useMarkInvoicePaid = (options?: UseApiMutationOptions<Invoice, { id: string; paymentDate?: string; notes?: string }>) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ id, paymentDate, notes }) => financeService.markInvoicePaid(id, paymentDate, notes),
    onSuccess: (data, { id }) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.invoices });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.invoice(id) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.financialKpis });
      toast({
        title: 'Rechnung als bezahlt markiert',
        description: `${data.invoice_number} wurde als bezahlt markiert.`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Fehler beim Markieren',
        description: error.message,
        variant: 'destructive',
      });
    },
    ...options,
  });
};

export const useExpenses = (
  pagination?: PaginationQuery,
  filters?: {
    category?: string;
    project_id?: string;
    employee_id?: string;
    date_from?: string;
    date_to?: string;
    approved?: boolean;
  },
  options?: UseApiQueryOptions<PaginationResponse<Expense>>
) => {
  return useQuery({
    queryKey: [...QUERY_KEYS.expenses, pagination, filters],
    queryFn: () => financeService.getExpenses(pagination, filters),
    ...options,
  });
};

export const useCreateExpense = (options?: UseApiMutationOptions<Expense, ExpenseCreate>) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: financeService.createExpense,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.expenses });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.financialKpis });
      if (data.project_id) {
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.projectStats(data.project_id) });
      }
      toast({
        title: 'Ausgabe erstellt',
        description: 'Die Ausgabe wurde erfolgreich erstellt.',
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

export const useApproveExpense = (options?: UseApiMutationOptions<Expense, string>) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: financeService.approveExpense,
    onSuccess: (data, id) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.expenses });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.expense(id) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.financialKpis });
      toast({
        title: 'Ausgabe genehmigt',
        description: 'Die Ausgabe wurde erfolgreich genehmigt.',
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

export const useFinancialKpis = (dateRange?: { from: string; to: string }, options?: UseApiQueryOptions<any>) => {
  return useQuery({
    queryKey: [...QUERY_KEYS.financialKpis, dateRange],
    queryFn: () => financeService.getFinancialKPIs(dateRange),
    ...options,
  });
};

export const useRevenueByMonth = (months?: number, options?: UseApiQueryOptions<any[]>) => {
  return useQuery({
    queryKey: [...QUERY_KEYS.revenueByMonth, months],
    queryFn: () => financeService.getRevenueByMonth(months),
    ...options,
  });
};

export const useExpensesByCategory = (dateRange?: { from: string; to: string }, options?: UseApiQueryOptions<any[]>) => {
  return useQuery({
    queryKey: [...QUERY_KEYS.expensesByCategory, dateRange],
    queryFn: () => financeService.getExpensesByCategory(dateRange),
    ...options,
  });
};

export const useProfitLossReport = (dateRange: { from: string; to: string }, options?: UseApiQueryOptions<any>) => {
  return useQuery({
    queryKey: [...QUERY_KEYS.profitLossReport, dateRange],
    queryFn: () => financeService.getProfitLossReport(dateRange),
    enabled: !!dateRange.from && !!dateRange.to,
    ...options,
  });
};
