// React hooks for API calls with type safety and error handling
// Built on top of TanStack Query for caching and synchronization

import { useQuery, useMutation, useQueryClient, UseQueryOptions, UseMutationOptions } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  apiCall, 
  createQuery, 
  createSuccessResponse, 
  createErrorResponse, 
  ApiError,
  API_ERROR_CODES 
} from '@/utils/api';
import type {
  Customer, CustomerCreate, CustomerUpdate,
  Material, MaterialCreate, MaterialUpdate,
  Quote, QuoteCreate, QuoteUpdate,
  Order, OrderCreate, OrderUpdate,
  Project, ProjectCreate, ProjectUpdate,
  Invoice, InvoiceCreate, InvoiceUpdate,
  Timesheet, TimesheetCreate, TimesheetUpdate,
  Expense, ExpenseCreate, ExpenseUpdate,
  StockMovement, StockMovementCreate,
  Employee, EmployeeCreate, EmployeeUpdate,
  ApiResponse,
  PaginationQuery,
  PaginationResponse,
} from '@/types/core';

// Query keys for consistent caching
export const QUERY_KEYS = {
  customers: ['customers'] as const,
  customer: (id: string) => ['customers', id] as const,
  materials: ['materials'] as const,
  material: (id: string) => ['materials', id] as const,
  quotes: ['quotes'] as const,
  quote: (id: string) => ['quotes', id] as const,
  orders: ['orders'] as const,
  order: (id: string) => ['orders', id] as const,
  projects: ['projects'] as const,
  project: (id: string) => ['projects', id] as const,
  invoices: ['invoices'] as const,
  invoice: (id: string) => ['invoices', id] as const,
  timesheets: ['timesheets'] as const,
  timesheet: (id: string) => ['timesheets', id] as const,
  expenses: ['expenses'] as const,
  expense: (id: string) => ['expenses', id] as const,
  stockMovements: ['stockMovements'] as const,
  employees: ['employees'] as const,
  employee: (id: string) => ['employees', id] as const,
} as const;

// Generic hooks
interface UseApiQueryOptions<T> extends Omit<UseQueryOptions<T, ApiError>, 'queryKey' | 'queryFn'> {}
interface UseApiMutationOptions<T, V> extends Omit<UseMutationOptions<T, ApiError, V>, 'mutationFn'> {}

// Customer hooks
export const useCustomers = (pagination?: PaginationQuery, options?: UseApiQueryOptions<Customer[]>) => {
  return useQuery({
    queryKey: [...QUERY_KEYS.customers, pagination],
    queryFn: () => apiCall(async () => {
      let query = supabase
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (pagination) {
        const offset = (pagination.page - 1) * pagination.limit;
        query = query.range(offset, offset + pagination.limit - 1);
      }
      
      return createQuery<Customer>(query).execute();
    }, 'Fetch customers'),
    ...options,
  });
};

export const useCustomer = (id: string, options?: UseApiQueryOptions<Customer>) => {
  return useQuery({
    queryKey: QUERY_KEYS.customer(id),
    queryFn: () => apiCall(async () => {
      const query = supabase
        .from('customers')
        .select('*')
        .eq('id', id);
      
      return createQuery<Customer>(query).executeSingle();
    }, `Fetch customer ${id}`),
    enabled: !!id,
    ...options,
  });
};

export const useCreateCustomer = (options?: UseApiMutationOptions<Customer, CustomerCreate>) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: (data: CustomerCreate) => apiCall(async () => {
      const query = supabase
        .from('customers')
        .insert(data)
        .select()
        .single();
      
      return createQuery<Customer>(query).executeSingle();
    }, 'Create customer'),
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
    mutationFn: ({ id, data }) => apiCall(async () => {
      const query = supabase
        .from('customers')
        .update(data)
        .eq('id', id)
        .select()
        .single();
      
      return createQuery<Customer>(query).executeSingle();
    }, `Update customer ${id}`),
    onSuccess: (data, { id }) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.customers });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.customer(id) });
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

// Material hooks
export const useMaterials = (pagination?: PaginationQuery, options?: UseApiQueryOptions<Material[]>) => {
  return useQuery({
    queryKey: [...QUERY_KEYS.materials, pagination],
    queryFn: () => apiCall(async () => {
      let query = supabase
        .from('materials')
        .select('*')
        .order('name');
      
      if (pagination) {
        const offset = (pagination.page - 1) * pagination.limit;
        query = query.range(offset, offset + pagination.limit - 1);
      }
      
      return createQuery<Material>(query).execute();
    }, 'Fetch materials'),
    ...options,
  });
};

export const useCreateMaterial = (options?: UseApiMutationOptions<Material, MaterialCreate>) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: (data: MaterialCreate) => apiCall(async () => {
      const query = supabase
        .from('materials')
        .insert(data)
        .select()
        .single();
      
      return createQuery<Material>(query).executeSingle();
    }, 'Create material'),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.materials });
      toast({
        title: 'Material erstellt',
        description: `${data.name} wurde erfolgreich erstellt.`,
      });
    },
    ...options,
  });
};

// Quote hooks
export const useQuotes = (pagination?: PaginationQuery, options?: UseApiQueryOptions<Quote[]>) => {
  return useQuery({
    queryKey: [...QUERY_KEYS.quotes, pagination],
    queryFn: () => apiCall(async () => {
      let query = supabase
        .from('quotes')
        .select(`
          *,
          customers (
            company_name,
            contact_person
          )
        `)
        .order('created_at', { ascending: false });
      
      if (pagination) {
        const offset = (pagination.page - 1) * pagination.limit;
        query = query.range(offset, offset + pagination.limit - 1);
      }
      
      return createQuery<Quote>(query).execute();
    }, 'Fetch quotes'),
    ...options,
  });
};

export const useCreateQuote = (options?: UseApiMutationOptions<Quote, QuoteCreate>) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: (data: QuoteCreate) => apiCall(async () => {
      // Calculate totals from body.items
      const items = data.body?.items || [];
      const totalNet = items.reduce((sum, item) => sum + item.total_price, 0);
      const totalGross = totalNet * (1 + (data.tax_rate || 19) / 100);
      
      const quoteData = {
        ...data,
        total_net: totalNet,
        total_gross: totalGross,
      };
      
      const query = supabase
        .from('quotes')
        .insert(quoteData)
        .select()
        .single();
      
      return createQuery<Quote>(query).executeSingle();
    }, 'Create quote'),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.quotes });
      toast({
        title: 'Angebot erstellt',
        description: `${data.title} wurde erfolgreich erstellt.`,
      });
    },
    ...options,
  });
};

// Project hooks
export const useProjects = (pagination?: PaginationQuery, options?: UseApiQueryOptions<Project[]>) => {
  return useQuery({
    queryKey: [...QUERY_KEYS.projects, pagination],
    queryFn: () => apiCall(async () => {
      let query = supabase
        .from('projects')
        .select(`
          *,
          customers (
            company_name,
            contact_person
          ),
          orders (
            order_number,
            total_amount
          )
        `)
        .order('created_at', { ascending: false });
      
      if (pagination) {
        const offset = (pagination.page - 1) * pagination.limit;
        query = query.range(offset, offset + pagination.limit - 1);
      }
      
      return createQuery<Project>(query).execute();
    }, 'Fetch projects'),
    ...options,
  });
};

// Timesheet hooks
export const useTimesheets = (projectId?: string, options?: UseApiQueryOptions<Timesheet[]>) => {
  return useQuery({
    queryKey: [...QUERY_KEYS.timesheets, projectId],
    queryFn: () => apiCall(async () => {
      let query = supabase
        .from('timesheets')
        .select(`
          *,
          projects (name),
          employees (first_name, last_name)
        `)
        .order('date', { ascending: false });
      
      if (projectId) {
        query = query.eq('project_id', projectId);
      }
      
      return createQuery<Timesheet>(query).execute();
    }, `Fetch timesheets${projectId ? ` for project ${projectId}` : ''}`),
    ...options,
  });
};

export const useCreateTimesheet = (options?: UseApiMutationOptions<Timesheet, TimesheetCreate>) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: (data: TimesheetCreate) => apiCall(async () => {
      const query = supabase
        .from('timesheets')
        .insert(data)
        .select()
        .single();
      
      return createQuery<Timesheet>(query).executeSingle();
    }, 'Create timesheet'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.timesheets });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.projects });
      toast({
        title: 'Zeiteintrag erstellt',
        description: 'Der Zeiteintrag wurde erfolgreich erstellt.',
      });
    },
    ...options,
  });
};

// Stock movement hooks
export const useCreateStockMovement = (options?: UseApiMutationOptions<StockMovement, StockMovementCreate>) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: (data: StockMovementCreate) => apiCall(async () => {
      const query = supabase
        .from('stock_movements')
        .insert(data)
        .select()
        .single();
      
      return createQuery<StockMovement>(query).executeSingle();
    }, 'Create stock movement'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.stockMovements });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.materials });
      toast({
        title: 'Lagerbewegung erstellt',
        description: 'Die Lagerbewegung wurde erfolgreich erfasst.',
      });
    },
    ...options,
  });
};

// Generic delete hook
export const useDeleteEntity = <T>(
  entity: string,
  onSuccess?: (deletedId: string) => void
) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: (id: string) => apiCall(async () => {
      const { error } = await supabase
        .from(entity)
        .delete()
        .eq('id', id);
      
      if (error) {
        if (error.code === '23503') {
          throw new ApiError(
            API_ERROR_CODES.BUSINESS_RULE_VIOLATION,
            'Dieser Datensatz wird noch von anderen Daten referenziert und kann nicht gelöscht werden.',
            { constraint: error.constraint }
          );
        }
        throw error;
      }
      
      return id;
    }, `Delete ${entity}`),
    onSuccess: (deletedId) => {
      // Invalidate all related queries
      queryClient.invalidateQueries();
      onSuccess?.(deletedId);
      toast({
        title: 'Datensatz gelöscht',
        description: 'Der Datensatz wurde erfolgreich gelöscht.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Fehler beim Löschen',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
};