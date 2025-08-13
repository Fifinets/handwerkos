// Comprehensive React hooks for HandwerkOS API with TanStack Query
// Provides type-safe hooks for all business entities with caching, optimistic updates, and error handling

import { useQuery, useMutation, useQueryClient, UseQueryOptions, UseMutationOptions } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
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
import { 
  customerService,
  quoteService,
  orderService,
  projectService,
  timesheetService,
  materialService,
  stockService,
  financeService,
  documentService,
  projectKPIService,
  notificationService,
  workerService,
  auditLogService,
  gobdService,
  gobdHooks,
  eventBus
} from '@/services';

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
  // Customer keys
  customers: ['customers'] as const,
  customer: (id: string) => ['customers', id] as const,
  customerStats: (id: string) => ['customers', id, 'stats'] as const,
  customerProjects: (id: string) => ['customers', id, 'projects'] as const,
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
interface UseApiQueryOptions<T> extends Omit<UseQueryOptions<T, ApiError>, 'queryKey' | 'queryFn'> {}
interface UseApiMutationOptions<T, V> extends Omit<UseMutationOptions<T, ApiError, V>, 'mutationFn'> {}

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
    mutationFn: customerService.createCustomer,
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
    mutationFn: customerService.deleteCustomer,
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
    queryFn: () => projectService.getProjects(pagination, filters),
    ...options,
  });
};

export const useProject = (id: string, options?: UseApiQueryOptions<Project>) => {
  return useQuery({
    queryKey: QUERY_KEYS.project(id),
    queryFn: () => projectService.getProject(id),
    enabled: !!id,
    ...options,
  });
};

export const useProjectStats = (id: string, options?: UseApiQueryOptions<any>) => {
  return useQuery({
    queryKey: QUERY_KEYS.projectStats(id),
    queryFn: () => projectService.getProjectStats(id),
    enabled: !!id,
    ...options,
  });
};

export const useProjectTimeline = (id: string, limit?: number, options?: UseApiQueryOptions<any[]>) => {
  return useQuery({
    queryKey: [...QUERY_KEYS.projectTimeline(id), limit],
    queryFn: () => projectService.getProjectTimeline(id, limit),
    enabled: !!id,
    ...options,
  });
};

export const useCreateProject = (options?: UseApiMutationOptions<Project, ProjectCreate>) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: projectService.createProject,
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
    mutationFn: ({ id, data }) => projectService.updateProject(id, data),
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
    mutationFn: projectService.startProject,
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
    mutationFn: projectService.completeProject,
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
    mutationFn: ({ id, reason }) => projectService.blockProject(id, reason),
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
    queryFn: () => projectService.searchProjects(query, limit),
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

// Initialize query invalidation based on events
export const initializeQueryInvalidation = () => {
  const queryClient = useQueryClient();
  
  // Customer events
  eventBus.on('CUSTOMER_CREATED', () => {
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.customers });
  });
  
  eventBus.on('CUSTOMER_UPDATED', () => {
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.customers });
  });
  
  // Quote events
  eventBus.on('QUOTE_ACCEPTED', (data) => {
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.quotes });
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.orders });
    if (data.quote?.id) {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.quote(data.quote.id) });
    }
  });
  
  eventBus.on('QUOTE_SENT', (data) => {
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.quotes });
    if (data.quote?.id) {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.quote(data.quote.id) });
    }
  });
  
  // Order events
  eventBus.on('ORDER_STARTED', (data) => {
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.orders });
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.projects });
    if (data.order?.id) {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.order(data.order.id) });
    }
  });
  
  eventBus.on('ORDER_COMPLETED', (data) => {
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.orders });
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.projects });
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.financialKpis });
    if (data.order?.id) {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.order(data.order.id) });
    }
  });
  
  // Project events
  eventBus.on('PROJECT_STATUS_CHANGED', (data) => {
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.projects });
    if (data.project?.id) {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.project(data.project.id) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.projectStats(data.project.id) });
    }
  });
  
  // Timesheet events
  eventBus.on('TIMESHEET_APPROVED', (data) => {
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.timesheets });
    if (data.timesheet?.id) {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.timesheet(data.timesheet.id) });
    }
    if (data.timesheet?.project_id) {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.projectStats(data.timesheet.project_id) });
    }
  });
  
  // Stock events
  eventBus.on('STOCK_ADJUSTED', () => {
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.materials });
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.stockMovements });
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.materialStats });
  });
  
  eventBus.on('MATERIAL_LOW_STOCK', () => {
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.lowStockMaterials });
  });
  
  // Finance events
  eventBus.on('INVOICE_PAID', () => {
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.invoices });
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.financialKpis });
  });
  
  eventBus.on('EXPENSE_APPROVED', () => {
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.expenses });
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.financialKpis });
  });
  
  // Document events
  eventBus.on('DOCUMENT_UPLOADED', () => {
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.documents });
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.documentStats });
  });
};

export default {
  // Export all hooks for convenience
  useCustomers, useCustomer, useCreateCustomer, useUpdateCustomer, useDeleteCustomer, useSearchCustomers,
  useQuotes, useQuote, useCreateQuote, useUpdateQuote, useSendQuote, useAcceptQuote, useRejectQuote, useQuoteStats,
  useOrders, useOrder, useCreateOrder, useStartOrder, useCompleteOrder, useCancelOrder, useOrderStats,
  useProjects, useProject, useCreateProject, useUpdateProject, useStartProject, useCompleteProject, useBlockProject, useSearchProjects,
  useTimesheets, useTimesheet, useCreateTimesheet, useUpdateTimesheet, useApproveTimesheet, useBulkApproveTimesheets,
  useMaterials, useMaterial, useCreateMaterial, useUpdateMaterial, useAdjustStock, useAddStock, useRemoveStock, useSearchMaterials,
  useInvoices, useInvoice, useCreateInvoice, useSendInvoice, useMarkInvoicePaid,
  useExpenses, useCreateExpense, useApproveExpense,
  useDocuments, useDocument, useUploadDocument, useUpdateDocument, useDeleteDocument, useSearchDocuments,
  useFinancialKpis, useRevenueByMonth, useExpensesByCategory, useProfitLossReport,
  useInvalidateQueries, initializeQueryInvalidation,
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

// Export all hooks
export {
  // KPI, Notification, and Worker hooks
  useProjectKPIs, useProjectKPIsSummary, useCriticalBudgetProjects,
  useNotifications, useNotificationStats, useMarkNotificationRead, useMarkAllNotificationsRead, 
  useArchiveNotification, useCreateNotification,
  useWorkerStatus, useRunWorkerJob,
  // GoBD and Audit hooks
  useAuditLogs, useAuditTrail, useAuditStatistics,
  useImmutabilityCheck, useNumberSequence, useGetNextNumber, useMakeImmutable,
  useCreateDocumentHash, useVerifyDocumentIntegrity,
};