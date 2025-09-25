// Comprehensive React hooks for HandwerkOS API with TanStack Query
// Provides type-safe hooks for all business entities with caching, optimistic updates, and error handling

import { useQuery, useMutation, useQueryClient, UseQueryOptions, UseMutationOptions } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import type {
  Customer, CustomerCreate, CustomerUpdate,
  Material, MaterialCreate, MaterialUpdate,
  Quote, QuoteCreate, QuoteUpdate,
  Order, OrderCreate, OrderUpdate,
  Project, ProjectCreate, ProjectUpdate,
  Invoice, InvoiceCreate, InvoiceUpdate,
  Timesheet, TimesheetCreate, TimesheetUpdate,
  Expense, ExpenseCreate, ExpenseUpdate,
  Employee, EmployeeCreate, EmployeeUpdate,
  PaginationQuery,
  PaginationResponse,
} from '@/types';
import { ApiError } from '@/utils/api';
// Import services directly to avoid circular dependency issues
import { customerService, CustomerService } from '@/services/customerService';
import { quoteService } from '@/services/quoteService';
import { orderService } from '@/services/orderService';
import { ProjectService } from '@/services/projectService';
import { timesheetService } from '@/services/timesheetService';
import { materialService } from '@/services/materialService';
import { stockService } from '@/services/stockService';
import { financeService } from '@/services/financeService';
import { documentService } from '@/services/documentService';
import { projectKPIService } from '@/services/projectKPIService';
import { notificationService } from '@/services/notificationService';
import { workerService } from '@/services/workerService';
import { auditLogService } from '@/services/auditLogService';
import { gobdService } from '@/services/gobdService';
import { gobdHooks } from '@/services/gobdHooks';
import { datevService } from '@/services/datevService';
import { germanAccountingService } from '@/services/germanAccountingService';
import { aiRAGService } from '@/services/aiRAGService';
import { aiIntentService } from '@/services/aiIntentService';
import { aiEstimationService } from '@/services/aiEstimationService';
import { OCRService } from '@/services/ocrService';
import { eventBus } from '@/services/eventBus';

// Query keys for consistent caching and invalidation
export const QUERY_KEYS = {
  // KPI, Notification, and GoBD keys
  PROJECT_KPIS: 'project-kpis',
  PROJECT_KPIS_SUMMARY: 'project-kpis-summary',
  NOTIFICATIONS: 'notifications',
  NOTIFICATION_STATS: 'notification-stats',
  WORKER_STATUS: 'worker-status',
  AUDIT_LOGS: 'audit-logs',
  AUDIT_TRAIL: 'audit-trail',
  AUDIT_STATS: 'audit-stats',
  NUMBER_SEQUENCES: 'number-sequences',
  GOBD_DOCUMENTS: 'gobd-documents',
  IMMUTABILITY_CHECK: 'immutability-check',
  DATEV_EXPORTS: 'datev-exports',
  DATEV_ACCOUNT_MAPPINGS: 'datev-account-mappings',
  GERMAN_VAT_RETURNS: 'german-vat-returns',
  GERMAN_PERIODS: 'german-periods',
  GERMAN_EXPENSE_REPORTS: 'german-expense-reports',
  AI_DOCUMENTS: 'ai-documents',
  AI_SEARCH_RESULTS: 'ai-search-results',
  AI_INTENT_ANALYSES: 'ai-intent-analyses',
  AI_ESTIMATIONS: 'ai-estimations',
  AI_INDEXING_STATUS: 'ai-indexing-status',
  // OCR keys
  OCR_RESULTS: 'ocr-results',
  OCR_RESULT: (id: string) => ['ocr-results', id] as const,
  OCR_PENDING: 'ocr-pending',
  // Customer keys
  customers: ['customers'] as const,
  customer: (id: string) => ['customers', id] as const,
  customerStats: (id: string) => ['customers', id, 'stats'] as const,
  customerProjects: (id: string) => ['customers', id, 'projects'] as const,
  // Project keys
  projects: ['projects'] as const,
  project: (id: string) => ['projects', id] as const,
  customerQuotes: (id: string) => ['customers', id, 'quotes'] as const,
  customerInvoices: (id: string) => ['customers', id, 'invoices'] as const,
  
  // Quote keys
  quotes: ['quotes'] as const,
  quote: (id: string) => ['quotes', id] as const,
  quoteStats: ['quotes', 'stats'] as const,
  
  // Order keys
  orders: ['orders'] as const,
  order: (id: string) => ['orders', id] as const,
  orderStats: ['orders', 'stats'] as const,
  
  // Project keys
  projects: ['projects'] as const,
  project: (id: string) => ['projects', id] as const,
  projectStats: (id: string) => ['projects', id, 'stats'] as const,
  projectTimeline: (id: string) => ['projects', id, 'timeline'] as const,
  
  // Timesheet keys
  timesheets: ['timesheets'] as const,
  timesheet: (id: string) => ['timesheets', id] as const,
  employeeTimesheetStats: (employeeId: string) => ['timesheets', 'employee', employeeId, 'stats'] as const,
  projectTimesheetSummary: (projectId: string) => ['timesheets', 'project', projectId, 'summary'] as const,
  
  // Material & Stock keys
  materials: ['materials'] as const,
  material: (id: string) => ['materials', id] as const,
  materialStats: ['materials', 'stats'] as const,
  lowStockMaterials: ['materials', 'low-stock'] as const,
  stockMovements: ['stock-movements'] as const,
  stockValuation: ['stock', 'valuation'] as const,
  stockAnalytics: ['stock', 'analytics'] as const,
  
  // Finance keys
  invoices: ['invoices'] as const,
  invoice: (id: string) => ['invoices', id] as const,
  expenses: ['expenses'] as const,
  expense: (id: string) => ['expenses', id] as const,
  financialKpis: ['finance', 'kpis'] as const,
  revenueByMonth: ['finance', 'revenue-by-month'] as const,
  expensesByCategory: ['finance', 'expenses-by-category'] as const,
  profitLossReport: ['finance', 'profit-loss'] as const,
  
  // Document keys
  documents: ['documents'] as const,
  document: (id: string) => ['documents', id] as const,
  documentStats: ['documents', 'stats'] as const,
  expiringDocuments: ['documents', 'expiring'] as const,
  
  // Employee keys
  employees: ['employees'] as const,
  employee: (id: string) => ['employees', id] as const,
} as const;

// Generic hook types
type UseApiQueryOptions<T> = Omit<UseQueryOptions<T, ApiError>, 'queryKey' | 'queryFn'>
type UseApiMutationOptions<T, V> = Omit<UseMutationOptions<T, ApiError, V>, 'mutationFn'>

// ==========================================
// CUSTOMER HOOKS
// ==========================================

export const useCustomers = (
  pagination?: PaginationQuery,
  filters?: { status?: Customer['status']; search?: string },
  options?: UseApiQueryOptions<PaginationResponse<Customer>>
) => {
  return useQuery({
    queryKey: [...QUERY_KEYS.customers, pagination, filters],
    queryFn: () => CustomerService.getCustomers(pagination, filters),
    ...options,
  });
};

export const useCustomer = (id: string, options?: UseApiQueryOptions<Customer>) => {
  return useQuery({
    queryKey: QUERY_KEYS.customer(id),
    queryFn: () => CustomerService.getCustomer(id),
    enabled: !!id,
    ...options,
  });
};

export const useCustomerStats = (id: string, options?: UseApiQueryOptions<any>) => {
  return useQuery({
    queryKey: QUERY_KEYS.customerStats(id),
    queryFn: () => CustomerService.getCustomerStats(id),
    enabled: !!id,
    ...options,
  });
};

export const useCreateCustomer = (options?: UseApiMutationOptions<Customer, CustomerCreate>) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: (data: CustomerCreate) => CustomerService.createCustomer(data),
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
    mutationFn: (id: string) => CustomerService.deleteCustomer(id),
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
    queryFn: () => CustomerService.searchCustomers(query, limit),
    enabled: query.length >= 2,
    ...options,
  });
};

// ==========================================
// QUOTE HOOKS
// ==========================================

export const useQuotes = (
  pagination?: PaginationQuery,
  filters?: { status?: Quote['status']; customer_id?: string; search?: string },
  options?: UseApiQueryOptions<PaginationResponse<Quote>>
) => {
  return useQuery({
    queryKey: [...QUERY_KEYS.quotes, pagination, filters],
    queryFn: () => quoteService.getQuotes(pagination, filters),
    ...options,
  });
};

export const useQuote = (id: string, options?: UseApiQueryOptions<Quote>) => {
  return useQuery({
    queryKey: QUERY_KEYS.quote(id),
    queryFn: () => quoteService.getQuote(id),
    enabled: !!id,
    ...options,
  });
};

export const useCreateQuote = (options?: UseApiMutationOptions<Quote, QuoteCreate>) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: quoteService.createQuote,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.quotes });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.customerQuotes(data.customer_id) });
      toast({
        title: 'Angebot erstellt',
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

export const useUpdateQuote = (options?: UseApiMutationOptions<Quote, { id: string; data: QuoteUpdate }>) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: ({ id, data }) => quoteService.updateQuote(id, data),
    onSuccess: (data, { id }) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.quotes });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.quote(id) });
      toast({
        title: 'Angebot aktualisiert',
        description: `${data.title} wurde erfolgreich aktualisiert.`,
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

export const useSendQuote = (options?: UseApiMutationOptions<Quote, string>) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: quoteService.sendQuote,
    onSuccess: (data, id) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.quotes });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.quote(id) });
      toast({
        title: 'Angebot versendet',
        description: `${data.title} wurde erfolgreich versendet.`,
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

export const useAcceptQuote = (options?: UseApiMutationOptions<{ quote: Quote; order: any }, string>) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: quoteService.acceptQuote,
    onSuccess: (data, id) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.quotes });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.quote(id) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.orders });
      toast({
        title: 'Angebot angenommen',
        description: `${data.quote.title} wurde angenommen und ein Auftrag erstellt.`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Fehler beim Annehmen',
        description: error.message,
        variant: 'destructive',
      });
    },
    ...options,
  });
};

export const useRejectQuote = (options?: UseApiMutationOptions<Quote, { id: string; reason?: string }>) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: ({ id, reason }) => quoteService.rejectQuote(id, reason),
    onSuccess: (data, { id }) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.quotes });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.quote(id) });
      toast({
        title: 'Angebot abgelehnt',
        description: `${data.title} wurde abgelehnt.`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Fehler beim Ablehnen',
        description: error.message,
        variant: 'destructive',
      });
    },
    ...options,
  });
};

export const useQuoteStats = (options?: UseApiQueryOptions<any>) => {
  return useQuery({
    queryKey: QUERY_KEYS.quoteStats,
    queryFn: () => quoteService.getQuoteStats(),
    ...options,
  });
};

// ==========================================
// ORDER HOOKS
// ==========================================

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

// ==========================================
// PROJECT HOOKS
// ==========================================

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

// ==========================================
// TIMESHEET HOOKS
// ==========================================

export const useTimesheets = (
  pagination?: PaginationQuery,
  filters?: {
    project_id?: string;
    employee_id?: string;
    date_from?: string;
    date_to?: string;
    approved?: boolean;
  },
  options?: UseApiQueryOptions<PaginationResponse<Timesheet>>
) => {
  return useQuery({
    queryKey: [...QUERY_KEYS.timesheets, pagination, filters],
    queryFn: () => timesheetService.getTimesheets(pagination, filters),
    ...options,
  });
};

export const useTimesheet = (id: string, options?: UseApiQueryOptions<Timesheet>) => {
  return useQuery({
    queryKey: QUERY_KEYS.timesheet(id),
    queryFn: () => timesheetService.getTimesheet(id),
    enabled: !!id,
    ...options,
  });
};

export const useCreateTimesheet = (options?: UseApiMutationOptions<Timesheet, TimesheetCreate>) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: timesheetService.createTimesheet,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.timesheets });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.projectStats(data.project_id || '') });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.employeeTimesheetStats(data.employee_id) });
      toast({
        title: 'Zeiteintrag erstellt',
        description: 'Der Zeiteintrag wurde erfolgreich erstellt.',
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

export const useUpdateTimesheet = (options?: UseApiMutationOptions<Timesheet, { id: string; data: TimesheetUpdate }>) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: ({ id, data }) => timesheetService.updateTimesheet(id, data),
    onSuccess: (data, { id }) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.timesheets });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.timesheet(id) });
      toast({
        title: 'Zeiteintrag aktualisiert',
        description: 'Der Zeiteintrag wurde erfolgreich aktualisiert.',
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

export const useApproveTimesheet = (options?: UseApiMutationOptions<Timesheet, string>) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: timesheetService.approveTimesheet,
    onSuccess: (data, id) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.timesheets });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.timesheet(id) });
      toast({
        title: 'Zeiteintrag genehmigt',
        description: 'Der Zeiteintrag wurde erfolgreich genehmigt.',
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

export const useBulkApproveTimesheets = (options?: UseApiMutationOptions<Timesheet[], string[]>) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: timesheetService.bulkApproveTimesheets,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.timesheets });
      toast({
        title: 'Zeiteinträge genehmigt',
        description: `${data.length} Zeiteinträge wurden erfolgreich genehmigt.`,
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

export const useEmployeeTimesheetStats = (
  employeeId: string,
  dateFrom?: string,
  dateTo?: string,
  options?: UseApiQueryOptions<any>
) => {
  return useQuery({
    queryKey: [...QUERY_KEYS.employeeTimesheetStats(employeeId), dateFrom, dateTo],
    queryFn: () => timesheetService.getEmployeeTimesheetStats(employeeId, dateFrom, dateTo),
    enabled: !!employeeId,
    ...options,
  });
};

export const useProjectTimesheetSummary = (projectId: string, options?: UseApiQueryOptions<any>) => {
  return useQuery({
    queryKey: QUERY_KEYS.projectTimesheetSummary(projectId),
    queryFn: () => timesheetService.getProjectTimesheetSummary(projectId),
    enabled: !!projectId,
    ...options,
  });
};

// ==========================================
// MATERIAL & STOCK HOOKS
// ==========================================

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

// ==========================================
// EMPLOYEE HOOKS
// ==========================================

export const useEmployees = (options?: UseApiQueryOptions<any[]>) => {
  return useQuery({
    queryKey: QUERY_KEYS.employees,
    queryFn: async () => {
      try {
        // Get current user session to determine company_id
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          console.log('useEmployees: No session found');
          return { items: [] };
        }

        // Try multiple ways to get company_id like PersonalModule does
        const companyId = session.user.user_metadata?.company_id || 
                         session.user.app_metadata?.company_id || 
                         session.user.id;
        
        console.log('useEmployees: Using company_id:', companyId);
        console.log('useEmployees: Session user:', session.user);

        if (!companyId) {
          console.error('useEmployees: No company ID available');
          return { items: [] };
        }

        // First debug query - get ALL employees for this company
        const { data: allEmployeesData, error: debugError } = await supabase
          .from('employees')
          .select('id, email, status, user_id, company_id')
          .eq('company_id', companyId);
        
        console.log('useEmployees: DEBUG - All employees for company:', allEmployeesData);
        
        // Main employees query - only get employees who have registered (have user_id)
        // RLS should handle the company filtering automatically
        const { data: employeesData, error: employeesError } = await supabase
          .from('employees')
          .select(`
            id,
            user_id,
            first_name,
            last_name,
            email,
            phone,
            position,
            status,
            qualifications,
            license,
            company_id
          `)
          .not('user_id', 'is', null)  // Only employees who have registered
          .in('status', ['active', 'Active', 'aktiv', 'Aktiv'])  // Support all status variations
          .order('created_at', { ascending: false });
        
        console.log('useEmployees: Raw query (no company filter):', employeesData);

        console.log('useEmployees: Employees query result:', employeesData, employeesError);

        if (employeesError) {
          console.error('useEmployees: Error fetching employees:', employeesError);
          return { items: [] };
        }

        // Fetch profile names separately for employees with user_id
        const userIds = employeesData?.filter(emp => emp.user_id).map(emp => emp.user_id) || [];
        let profilesData = [];
        
        if (userIds.length > 0) {
          const { data, error } = await supabase
            .from('profiles')
            .select('id, first_name, last_name')
            .in('id', userIds);
          
          if (!error) {
            profilesData = data || [];
          }
        }

        // Map employee data - use profile names if available, fallback to employee names
        const employeeList = employeesData?.map(employee => {
          const profile = profilesData.find(p => p.id === employee.user_id);
          const firstName = profile?.first_name || employee.first_name || '';
          const lastName = profile?.last_name || employee.last_name || '';
          
          return {
            id: employee.id,
            first_name: firstName,
            last_name: lastName,
            name: `${firstName} ${lastName}`.trim(),
            email: employee.email,
            phone: employee.phone,
            position: employee.position,
            status: employee.status,
            qualifications: Array.isArray(employee.qualifications) ? employee.qualifications : [],
            license: employee.license
          };
        }) || [];

        console.log('useEmployees: Final employee list:', employeeList);
        return { items: employeeList };
        
      } catch (error) {
        console.error('useEmployees: Catch block error:', error);
        return { items: [] };
      }
    },
    ...options,
  });
};

export const useDeleteEmployee = (options?: UseApiMutationOptions<void, string>) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async (employeeId: string) => {
      const { error } = await supabase
        .from('employees')
        .delete()
        .eq('id', employeeId);

      if (error) {
        throw new Error(error.message);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.employees });
    },
    ...options,
  });
};

// ==========================================
// QUERY INVALIDATION UTILITIES
// ==========================================

export const useInvalidateQueries = () => {
  const queryClient = useQueryClient();
  
  return {
    invalidateAll: () => queryClient.invalidateQueries(),
    invalidateCustomers: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.customers }),
    invalidateQuotes: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.quotes }),
    invalidateOrders: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.orders }),
    invalidateProjects: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.projects }),
    invalidateTimesheets: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.timesheets }),
    invalidateMaterials: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.materials }),
    invalidateInvoices: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.invoices }),
    invalidateExpenses: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.expenses }),
    invalidateDocuments: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.documents }),
    invalidateFinance: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.financialKpis }),
  };
};

// ==========================================
// EVENT BUS INTEGRATION
// ==========================================

// Hook to initialize query invalidation based on events
export const useQueryInvalidation = () => {
  const queryClient = useQueryClient();
  
  React.useEffect(() => {
    // Customer events
    const customerCreatedUnsubscribe = eventBus.on('CUSTOMER_CREATED', () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.customers });
    });
    
    const customerUpdatedUnsubscribe = eventBus.on('CUSTOMER_UPDATED', () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.customers });
    });
    
    // Quote events
    const quoteAcceptedUnsubscribe = eventBus.on('QUOTE_ACCEPTED', (data) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.quotes });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.orders });
      if (data.quote?.id) {
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.quote(data.quote.id) });
      }
    });
    
    const quoteSentUnsubscribe = eventBus.on('QUOTE_SENT', (data) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.quotes });
      if (data.quote?.id) {
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.quote(data.quote.id) });
      }
    });
    
    // Order events
    const orderStartedUnsubscribe = eventBus.on('ORDER_STARTED', (data) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.orders });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.projects });
      if (data.order?.id) {
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.order(data.order.id) });
      }
    });
    
    const orderCompletedUnsubscribe = eventBus.on('ORDER_COMPLETED', (data) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.orders });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.projects });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.financialKpis });
      if (data.order?.id) {
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.order(data.order.id) });
      }
    });
    
    // Project events
    const projectStatusChangedUnsubscribe = eventBus.on('PROJECT_STATUS_CHANGED', (data) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.projects });
      if (data.project?.id) {
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.project(data.project.id) });
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.projectStats(data.project.id) });
      }
    });
    
    // Timesheet events
    const timesheetApprovedUnsubscribe = eventBus.on('TIMESHEET_APPROVED', (data) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.timesheets });
      if (data.timesheet?.id) {
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.timesheet(data.timesheet.id) });
      }
      if (data.timesheet?.project_id) {
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.projectStats(data.timesheet.project_id) });
      }
    });
    
    // Stock events
    const stockAdjustedUnsubscribe = eventBus.on('STOCK_ADJUSTED', () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.materials });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.stockMovements });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.materialStats });
    });
    
    const materialLowStockUnsubscribe = eventBus.on('MATERIAL_LOW_STOCK', () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.lowStockMaterials });
    });
    
    // Finance events
    const invoicePaidUnsubscribe = eventBus.on('INVOICE_PAID', () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.invoices });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.financialKpis });
    });
    
    const expenseApprovedUnsubscribe = eventBus.on('EXPENSE_APPROVED', () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.expenses });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.financialKpis });
    });
    
    // Document events
    const documentUploadedUnsubscribe = eventBus.on('DOCUMENT_UPLOADED', () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.documents });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.documentStats });
    });

    // Cleanup function
    return () => {
      eventBus.off(customerCreatedUnsubscribe);
      eventBus.off(customerUpdatedUnsubscribe);
      eventBus.off(quoteAcceptedUnsubscribe);
      eventBus.off(quoteSentUnsubscribe);
      eventBus.off(orderStartedUnsubscribe);
      eventBus.off(orderCompletedUnsubscribe);
      eventBus.off(projectStatusChangedUnsubscribe);
      eventBus.off(timesheetApprovedUnsubscribe);
      eventBus.off(stockAdjustedUnsubscribe);
      eventBus.off(materialLowStockUnsubscribe);
      eventBus.off(invoicePaidUnsubscribe);
      eventBus.off(expenseApprovedUnsubscribe);
      eventBus.off(documentUploadedUnsubscribe);
    };
  }, [queryClient]);
};


// ============================================
// PROJECT KPI HOOKS  
// ============================================

/**
 * Get KPIs for a specific project
 */
export const useProjectKPIs = (
  projectId: string,
  dateRange?: { from?: string; to?: string },
  options?: UseQueryOptions<any, Error>
) => {
  return useQuery({
    queryKey: [QUERY_KEYS.PROJECT_KPIS, projectId, dateRange],
    queryFn: () => projectKPIService.getProjectKPIs(projectId, dateRange),
    enabled: !!projectId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    ...options,
  });
};

/**
 * Get KPIs summary for all projects
 */
export const useProjectKPIsSummary = (
  dateRange?: { from?: string; to?: string },
  options?: UseQueryOptions<any, Error>
) => {
  return useQuery({
    queryKey: [QUERY_KEYS.PROJECT_KPIS_SUMMARY, dateRange],
    queryFn: () => projectKPIService.getProjectKPIsSummary(dateRange),
    staleTime: 5 * 60 * 1000, // 5 minutes
    ...options,
  });
};

/**
 * Get projects with critical budget utilization (≥90%)
 */
export const useCriticalBudgetProjects = (
  options?: UseQueryOptions<any, Error>
) => {
  return useQuery({
    queryKey: [QUERY_KEYS.PROJECT_KPIS, 'critical'],
    queryFn: () => projectKPIService.getCriticalBudgetProjects(),
    staleTime: 2 * 60 * 1000, // 2 minutes (more frequent for critical data)
    ...options,
  });
};

// ============================================
// NOTIFICATION HOOKS
// ============================================

/**
 * Get notifications with pagination and filtering
 */
export const useNotifications = (
  pagination?: PaginationQuery,
  filters?: any,
  options?: UseQueryOptions<any, Error>
) => {
  return useQuery({
    queryKey: [QUERY_KEYS.NOTIFICATIONS, pagination, filters],
    queryFn: () => notificationService.getNotifications(pagination, filters),
    staleTime: 30 * 1000, // 30 seconds (fresh for notifications)
    ...options,
  });
};

/**
 * Get notification statistics
 */
export const useNotificationStats = (
  options?: UseQueryOptions<any, Error>
) => {
  return useQuery({
    queryKey: [QUERY_KEYS.NOTIFICATION_STATS],
    queryFn: () => notificationService.getNotificationStats(),
    staleTime: 60 * 1000, // 1 minute
    ...options,
  });
};

/**
 * Create a new notification
 */
export const useCreateNotification = (
  options?: UseMutationOptions<any, Error, any>
) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: any) => notificationService.createNotification(data),
    onSuccess: (newNotification, variables) => {
      // Invalidate notifications queries
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.NOTIFICATIONS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.NOTIFICATION_STATS] });
      
      toast({
        title: 'Benachrichtigung erstellt',
        description: 'Die Benachrichtigung wurde erfolgreich erstellt.',
      });
    },
    onError: (error) => {
      console.error('Create notification error:', error);
      toast({
        title: 'Fehler beim Erstellen',
        description: error.message || 'Die Benachrichtigung konnte nicht erstellt werden.',
        variant: 'destructive',
      });
    },
    ...options,
  });
};

/**
 * Mark notification as read
 */
export const useMarkNotificationRead = (
  options?: UseMutationOptions<any, Error, string>
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (notificationId: string) => notificationService.markAsRead(notificationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.NOTIFICATIONS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.NOTIFICATION_STATS] });
    },
    ...options,
  });
};

/**
 * Mark all notifications as read
 */
export const useMarkAllNotificationsRead = (
  options?: UseMutationOptions<void, Error, void>
) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => notificationService.markAllAsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.NOTIFICATIONS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.NOTIFICATION_STATS] });
      
      toast({
        title: 'Alle als gelesen markiert',
        description: 'Alle Benachrichtigungen wurden als gelesen markiert.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Fehler',
        description: 'Die Benachrichtigungen konnten nicht aktualisiert werden.',
        variant: 'destructive',
      });
    },
    ...options,
  });
};

/**
 * Archive notification
 */
export const useArchiveNotification = (
  options?: UseMutationOptions<any, Error, string>
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (notificationId: string) => notificationService.archiveNotification(notificationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.NOTIFICATIONS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.NOTIFICATION_STATS] });
    },
    ...options,
  });
};

// ============================================
// WORKER SERVICE HOOKS
// ============================================

/**
 * Get worker service status
 */
export const useWorkerStatus = (
  options?: UseQueryOptions<any, Error>
) => {
  return useQuery({
    queryKey: [QUERY_KEYS.WORKER_STATUS],
    queryFn: () => workerService.getWorkerStatus(),
    staleTime: 30 * 1000, // 30 seconds
    ...options,
  });
};

/**
 * Run a worker job manually
 */
export const useRunWorkerJob = (
  options?: UseMutationOptions<void, Error, string>
) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (jobName: string) => workerService.runJobNow(jobName),
    onSuccess: (_, jobName) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.WORKER_STATUS] });
      // Also invalidate related data that might have been updated
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.PROJECT_KPIS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.NOTIFICATIONS] });
      
      toast({
        title: 'Worker Job ausgeführt',
        description: `Der Job "${jobName}" wurde erfolgreich ausgeführt.`,
      });
    },
    onError: (error, jobName) => {
      console.error('Worker job execution error:', error);
      toast({
        title: 'Fehler beim Ausführen',
        description: `Der Job "${jobName}" konnte nicht ausgeführt werden: ${error.message}`,
        variant: 'destructive',
      });
    },
    ...options,
  });
};

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
    queryFn: () => auditLogService.getAuditTrail(entityType as any, entityId),
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
    queryFn: () => gobdService.getOrCreateNumberSequence(sequenceType as any, year),
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
      gobdService.getNextNumber(sequenceType as any, year),
    onSuccess: (data, variables) => {
      // Invalidate number sequences
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.NUMBER_SEQUENCES] });
      
      toast({
        title: 'Nummer generiert',
        description: `Nächste Nummer: ${data.number}`,
      });
    },
    onError: (error) => {
      console.error('Get next number error:', error);
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
      console.error('Make immutable error:', error);
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
      console.error('Create document hash error:', error);
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
      console.error('DATEV export error:', error);
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

// ============================================
// AI MODULE HOOKS
// ============================================

/**
 * Search documents using AI RAG
 */
export const useAISearchDocuments = (
  options?: UseMutationOptions<any, Error, any>
) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (searchQuery: any) => aiRAGService.searchDocuments(searchQuery),
    onSuccess: (searchResult) => {
      queryClient.setQueryData([QUERY_KEYS.AI_SEARCH_RESULTS, searchResult.query_context.query], searchResult);
      
      toast({
        title: 'AI-Suche abgeschlossen',
        description: `${searchResult.results.length} relevante Dokumente gefunden.`,
      });
    },
    onError: (error) => {
      console.error('AI search error:', error);
      toast({
        title: 'Fehler bei AI-Suche',
        description: error.message || 'Die Dokumentensuche konnte nicht durchgeführt werden.',
        variant: 'destructive',
      });
    },
    ...options,
  });
};

/**
 * Index document for AI search
 */
export const useIndexDocument = (
  options?: UseMutationOptions<any, Error, {
    documentType: string;
    entityId: string;
    title: string;
    content: string;
    metadata?: Record<string, any>;
    searchTags?: string[];
  }>
) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ documentType, entityId, title, content, metadata = {}, searchTags = [] }) =>
      aiRAGService.indexDocument(documentType as any, entityId, title, content, metadata, searchTags),
    onSuccess: (document) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.AI_DOCUMENTS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.AI_INDEXING_STATUS] });
      
      toast({
        title: 'Dokument indexiert',
        description: `"${document.title}" wurde für AI-Suche indexiert.`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Fehler beim Indexieren',
        description: 'Das Dokument konnte nicht für die AI-Suche indexiert werden.',
        variant: 'destructive',
      });
    },
    ...options,
  });
};

/**
 * Generate contextual AI response
 */
export const useGenerateAIResponse = (
  options?: UseMutationOptions<any, Error, {
    contextId: string;
    question: string;
    responseLanguage?: 'de' | 'en';
  }>
) => {
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ contextId, question, responseLanguage = 'de' }) =>
      aiRAGService.generateContextualResponse(contextId, question, responseLanguage),
    onSuccess: (response) => {
      toast({
        title: 'AI-Antwort generiert',
        description: `Antwort mit ${(response.confidence_score * 100).toFixed(1)}% Konfidenz erstellt.`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Fehler bei AI-Antwort',
        description: 'Die AI-Antwort konnte nicht generiert werden.',
        variant: 'destructive',
      });
    },
    ...options,
  });
};

/**
 * Analyze user intent
 */
export const useAnalyzeIntent = (
  options?: UseMutationOptions<any, Error, string>
) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userInput: string) => aiIntentService.analyzeIntent(userInput),
    onSuccess: (analysis) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.AI_INTENT_ANALYSES] });
      
      if (analysis.confidence_score < 0.6) {
        toast({
          title: 'Intent-Analyse abgeschlossen',
          description: `Intent "${analysis.detected_intent}" erkannt (Unsicher: ${(analysis.confidence_score * 100).toFixed(1)}%)`,
          variant: 'default',
        });
      }
    },
    onError: (error) => {
      toast({
        title: 'Fehler bei Intent-Analyse',
        description: 'Die Benutzerabsicht konnte nicht analysiert werden.',
        variant: 'destructive',
      });
    },
    ...options,
  });
};

/**
 * Execute intent action
 */
export const useExecuteIntent = (
  options?: UseMutationOptions<any, Error, { intentId: string; userConfirmation?: boolean }>
) => {
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ intentId, userConfirmation = false }) =>
      aiIntentService.executeIntent(intentId, userConfirmation),
    onSuccess: (action) => {
      if (action.status === 'COMPLETED') {
        toast({
          title: 'Aktion ausgeführt',
          description: `${action.action_type} für ${action.target_entity} erfolgreich abgeschlossen.`,
        });
      } else if (action.status === 'FAILED') {
        toast({
          title: 'Aktion fehlgeschlagen',
          description: action.error_message || 'Die Aktion konnte nicht ausgeführt werden.',
          variant: 'destructive',
        });
      }
    },
    onError: (error) => {
      toast({
        title: 'Fehler bei Aktionsausführung',
        description: error.message || 'Die Aktion konnte nicht ausgeführt werden.',
        variant: 'destructive',
      });
    },
    ...options,
  });
};

/**
 * Create project estimation using AI
 */
export const useCreateAIEstimation = (
  options?: UseMutationOptions<any, Error, any>
) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (estimationRequest: any) => aiEstimationService.createProjectEstimation(estimationRequest),
    onSuccess: (estimation) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.AI_ESTIMATIONS] });
      
      toast({
        title: 'AI-Schätzung erstellt',
        description: `Projektkosten: €${estimation.estimated_costs.total.toLocaleString()} (${(estimation.confidence_score * 100).toFixed(1)}% Konfidenz)`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Fehler bei AI-Schätzung',
        description: 'Die Projektschätzung konnte nicht erstellt werden.',
        variant: 'destructive',
      });
    },
    ...options,
  });
};

/**
 * Get quick cost estimate
 */
export const useQuickAIEstimate = (
  projectCategory: string,
  areaSqm: number,
  complexityLevel: 1 | 2 | 3 | 4 | 5,
  options?: UseQueryOptions<any, Error>
) => {
  return useQuery({
    queryKey: ['quick-ai-estimate', projectCategory, areaSqm, complexityLevel],
    queryFn: () => aiEstimationService.getQuickEstimate(projectCategory as any, areaSqm, complexityLevel),
    enabled: !!projectCategory && areaSqm > 0,
    staleTime: 10 * 60 * 1000, // 10 minutes
    ...options,
  });
};

/**
 * Get AI indexing status
 */
export const useAIIndexingStatus = (
  options?: UseQueryOptions<any, Error>
) => {
  return useQuery({
    queryKey: [QUERY_KEYS.AI_INDEXING_STATUS],
    queryFn: () => aiRAGService.getIndexingStatus(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    ...options,
  });
};

/**
 * Bulk index entities
 */
export const useBulkIndexEntities = (
  options?: UseMutationOptions<any, Error, string[]>
) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (entityTypes: string[]) => aiRAGService.bulkIndexEntities(entityTypes as any),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.AI_INDEXING_STATUS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.AI_DOCUMENTS] });
      
      toast({
        title: 'Bulk-Indexierung abgeschlossen',
        description: `${result.indexed_count} Dokumente indexiert, ${result.errors.length} Fehler.`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Fehler bei Bulk-Indexierung',
        description: 'Die Dokumente konnten nicht indexiert werden.',
        variant: 'destructive',
      });
    },
    ...options,
  });
};

/**
 * Update estimation accuracy
 */
export const useUpdateEstimationAccuracy = (
  options?: UseMutationOptions<any, Error, {
    estimationId: string;
    actualCosts: { materials: number; labor: number; total: number };
    actualTimeline: { start_date: string; end_date: string; total_hours: number };
    lessonsLearned?: string[];
    feedbackNotes?: string;
  }>
) => {
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ estimationId, actualCosts, actualTimeline, lessonsLearned = [], feedbackNotes = '' }) =>
      aiEstimationService.updateEstimationAccuracy(estimationId, actualCosts, actualTimeline, lessonsLearned, feedbackNotes),
    onSuccess: (accuracy) => {
      toast({
        title: 'Schätzungsgenauigkeit aktualisiert',
        description: `Genauigkeit: ${(accuracy.accuracy_score * 100).toFixed(1)}%, Abweichung: ${accuracy.variance_percentage.toFixed(1)}%`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Fehler bei Genauigkeits-Update',
        description: 'Die Schätzungsgenauigkeit konnte nicht aktualisiert werden.',
        variant: 'destructive',
      });
    },
    ...options,
  });
};

/**
 * Get estimation statistics
 */
export const useEstimationStatistics = (
  dateRange?: { from: string; to: string },
  options?: UseQueryOptions<any, Error>
) => {
  return useQuery({
    queryKey: ['estimation-statistics', dateRange],
    queryFn: () => aiEstimationService.getEstimationStatistics(dateRange),
    staleTime: 10 * 60 * 1000, // 10 minutes
    ...options,
  });
};

// ==========================================
// OCR HOOKS
// ==========================================

/**
 * Process invoice image with OCR
 */
export const useProcessInvoiceOCR = (options?: UseMutationOptions<any, Error, File>) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (file: File) => OCRService.processInvoiceImage(file),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.OCR_RESULTS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.OCR_PENDING] });
      toast({
        title: 'OCR-Verarbeitung abgeschlossen',
        description: `Rechnung von "${result.structured_data.supplierName}" wurde verarbeitet.`,
      });
    },
    onError: (error) => {
      toast({
        title: 'OCR-Verarbeitung fehlgeschlagen',
        description: error.message,
        variant: 'destructive',
      });
    },
    ...options,
  });
};

/**
 * Get OCR results
 */
export const useOCRResults = (
  status?: 'pending' | 'validated' | 'rejected',
  options?: UseQueryOptions<any[], Error>
) => {
  return useQuery({
    queryKey: [QUERY_KEYS.OCR_RESULTS, status],
    queryFn: () => OCRService.getOCRResults(status),
    staleTime: 5 * 60 * 1000, // 5 minutes
    ...options,
  });
};

/**
 * Get pending OCR results
 */
export const usePendingOCRResults = (options?: UseQueryOptions<any[], Error>) => {
  return useOCRResults('pending', options);
};

/**
 * Validate OCR result and create invoice
 */
export const useValidateOCRResult = (
  options?: UseMutationOptions<any, Error, { ocrId: string; validatedData: any; notes?: string }>
) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ ocrId, validatedData, notes }) => 
      OCRService.validateAndCreateInvoice(ocrId, validatedData, notes),
    onSuccess: (result, { ocrId }) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.OCR_RESULTS] });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.OCR_RESULT(ocrId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.invoices });
      toast({
        title: 'Rechnung erstellt',
        description: `Rechnung wurde erfolgreich aus OCR-Daten erstellt.`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Validierung fehlgeschlagen',
        description: error.message,
        variant: 'destructive',
      });
    },
    ...options,
  });
};

/**
 * Reject OCR result
 */
export const useRejectOCRResult = (
  options?: UseMutationOptions<void, Error, { ocrId: string; reason: string }>
) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ ocrId, reason }) => OCRService.rejectOCRResult(ocrId, reason),
    onSuccess: (_, { ocrId }) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.OCR_RESULTS] });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.OCR_RESULT(ocrId) });
      toast({
        title: 'OCR-Ergebnis abgelehnt',
        description: 'Das OCR-Ergebnis wurde abgelehnt und markiert.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Ablehnung fehlgeschlagen',
        description: error.message,
        variant: 'destructive',
      });
    },
    ...options,
  });
};


// Export all hooks as default export (moved to end to avoid hoisting issues)
export default {
  // Export all hooks for convenience
  useCustomers, useCustomer, useCreateCustomer, useUpdateCustomer, useDeleteCustomer, useSearchCustomers,
  useEmployees,
  useQuotes, useQuote, useCreateQuote, useUpdateQuote, useSendQuote, useAcceptQuote, useRejectQuote, useQuoteStats,
  useOrders, useOrder, useCreateOrder, useStartOrder, useCompleteOrder, useCancelOrder, useOrderStats,
  useProjects, useProject, useCreateProject, useUpdateProject, useStartProject, useCompleteProject, useBlockProject, useSearchProjects,
  useTimesheets, useTimesheet, useCreateTimesheet, useUpdateTimesheet, useApproveTimesheet, useBulkApproveTimesheets,
  useMaterials, useMaterial, useCreateMaterial, useUpdateMaterial, useAdjustStock, useAddStock, useRemoveStock, useSearchMaterials,
  useInvoices, useInvoice, useCreateInvoice, useSendInvoice, useMarkInvoicePaid,
  useExpenses, useCreateExpense, useApproveExpense,
  useDocuments, useDocument, useUploadDocument, useUpdateDocument, useDeleteDocument, useSearchDocuments,
  useFinancialKpis, useRevenueByMonth, useExpensesByCategory, useProfitLossReport,
  useInvalidateQueries, useQueryInvalidation,
  // KPI, Notification, and Worker hooks
  useProjectKPIs, useProjectKPIsSummary, useCriticalBudgetProjects,
  useNotifications, useNotificationStats, useMarkNotificationRead, useMarkAllNotificationsRead, 
  useArchiveNotification, useCreateNotification,
  useWorkerStatus, useRunWorkerJob,
  // GoBD and Audit hooks
  useAuditLogs, useAuditTrail, useAuditStatistics,
  useImmutabilityCheck, useNumberSequence, useGetNextNumber, useMakeImmutable,
  useCreateDocumentHash, useVerifyDocumentIntegrity,
  // DATEV and German Accounting hooks
  useGenerateDATEVExport, useDATEVAccountMapping, useSetDATEVAccountMapping,
  useGenerateGermanVATReturn, useGenerateGermanExpenseReport, useCalculateGermanDepreciation,
  useValidateGermanInvoiceCompliance, useCreateGermanAccountingPeriod,
  // AI Module hooks
  useAISearchDocuments, useIndexDocument, useGenerateAIResponse, useAnalyzeIntent, useExecuteIntent,
  useCreateAIEstimation, useQuickAIEstimate, useAIIndexingStatus, useBulkIndexEntities,
  useUpdateEstimationAccuracy, useEstimationStatistics,
};

