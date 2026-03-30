// Customer service for HandwerkOS
// Handles CRUD operations and business logic for customers

import { supabase } from '@/integrations/supabase/client';
import {
  apiCall,
  createQuery,
  validateInput,
  getCurrentUserProfile,
  ApiError,
  API_ERROR_CODES
} from '@/utils/api';
import {
  Customer,
  CustomerCreate,
  CustomerUpdate,
  CustomerCreateSchema,
  CustomerUpdateSchema,
  PaginationQuery,
  PaginationResponse
} from '@/types';

export class CustomerService {

  // Get all customers with pagination and filtering
  async getCustomers(
    pagination?: PaginationQuery,
    filters?: {
      status?: Customer['status'];
      search?: string;
    }
  ): Promise<PaginationResponse<Customer>> {
    return apiCall(async () => {
      let query = supabase
        .from('customers')
        .select('*', { count: 'exact' });

      // Apply filters
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }

      if (filters?.search) {
        query = query.or(
          `company_name.ilike.%${filters.search}%,` +
          `contact_person.ilike.%${filters.search}%,` +
          `email.ilike.%${filters.search}%`
        );
      }

      // Apply pagination
      if (pagination) {
        const offset = (pagination.page - 1) * pagination.limit;
        query = query
          .range(offset, offset + pagination.limit - 1)
          .order(pagination.sort_by || 'created_at', {
            ascending: pagination.sort_order === 'asc'
          });
      } else {
        query = query.order('created_at', { ascending: false });
      }

      const { data, count } = await createQuery<Customer>(query).executeWithCount();

      return {
        items: data,
        pagination: {
          page: pagination?.page || 1,
          limit: pagination?.limit || data.length,
          total_items: count,
          total_pages: Math.ceil(count / (pagination?.limit || 20)),
          has_next: pagination ? (pagination.page * pagination.limit < count) : false,
          has_prev: pagination ? pagination.page > 1 : false,
        },
      };
    }, 'Get customers');
  }

  // Get customer by ID
  async getCustomer(id: string): Promise<Customer> {
    return apiCall(async () => {
      const query = supabase
        .from('customers')
        .select('*')
        .eq('id', id);

      return createQuery<Customer>(query).executeSingle();
    }, `Get customer ${id}`);
  }

  // Create new customer
  async createCustomer(data: CustomerCreate): Promise<Customer> {
    return apiCall(async () => {
      // Validate input
      const validatedData = validateInput(CustomerCreateSchema, data);

      // Generate customer number if not provided
      if (!validatedData.customer_number) {
        try {
          const customerNumber = await this.generateCustomerNumber();
          validatedData.customer_number = customerNumber;
        } catch {
          // Fallback: timestamp-based number if DB function fails
          validatedData.customer_number = `KD-${Date.now()}`;
        }
      }

      // Generate display_name if not provided
      if (!validatedData.display_name) {
        if (validatedData.customer_type === 'business' && validatedData.company_name) {
          validatedData.display_name = validatedData.company_name;
        } else if (validatedData.contact_person) {
          validatedData.display_name = validatedData.contact_person;
        } else {
          validatedData.display_name = 'Unbekannter Kunde';
        }
      }

      // Try inserting – if customer_number is a duplicate, generate a unique fallback
      const { data: created, error } = await supabase
        .from('customers')
        .insert(validatedData as any)
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          // Unique constraint: retry with timestamp-based fallback number
          const fallbackNumber = `KD-${Date.now()}`;
          const { data: retried, error: retryError } = await supabase
            .from('customers')
            .insert({ ...validatedData, customer_number: fallbackNumber } as any)
            .select()
            .single();
          if (retryError) {
            throw retryError;
          }
          return retried as Customer;
        }
        throw error;
      }

      return created as Customer;
    }, 'Create customer');
  }


  // Update existing customer
  async updateCustomer(id: string, data: CustomerUpdate): Promise<Customer> {
    return apiCall(async () => {
      // Validate input
      const validatedData = validateInput(CustomerUpdateSchema, data);

      // Check if customer exists and user has permission
      const existingCustomer = await this.getCustomer(id);

      // Generate display_name if not provided and customer type changed or names changed
      if (!validatedData.display_name) {
        const customerType = validatedData.customer_type || existingCustomer.customer_type || 'business';
        const companyName = validatedData.company_name !== undefined ? validatedData.company_name : existingCustomer.company_name;
        const contactPerson = validatedData.contact_person !== undefined ? validatedData.contact_person : existingCustomer.contact_person;

        if (customerType === 'business' && companyName) {
          validatedData.display_name = companyName;
        } else if (contactPerson) {
          validatedData.display_name = contactPerson;
        }
      }

      const query = supabase
        .from('customers')
        .update(validatedData)
        .eq('id', id)
        .select()
        .single();

      return createQuery<Customer>(query).executeSingle();
    }, `Update customer ${id}`);
  }

  // Delete customer (with safety checks)
  async deleteCustomer(id: string): Promise<void> {
    return apiCall(async () => {
      // Check if customer has related projects/quotes
      const { data: relatedProjects } = await supabase
        .from('projects')
        .select('id')
        .eq('customer_id', id)
        .limit(1);

      if (relatedProjects && relatedProjects.length > 0) {
        throw new ApiError(
          API_ERROR_CODES.BUSINESS_RULE_VIOLATION,
          'Kunde kann nicht gelöscht werden, da noch Projekte zugeordnet sind.',
          { relatedProjects: relatedProjects.length }
        );
      }

      const { data: relatedOffers } = await supabase
        .from('offers')
        .select('id')
        .eq('customer_id', id)
        .limit(1);

      if (relatedOffers && relatedOffers.length > 0) {
        throw new ApiError(
          API_ERROR_CODES.BUSINESS_RULE_VIOLATION,
          'Kunde kann nicht gelöscht werden, da noch Angebote (Offers) vorhanden sind.',
          { relatedOffers: relatedOffers.length }
        );
      }

      const { data: relatedOrders } = await supabase
        .from('orders')
        .select('id')
        .eq('customer_id', id)
        .limit(1);

      if (relatedOrders && relatedOrders.length > 0) {
        throw new ApiError(
          API_ERROR_CODES.BUSINESS_RULE_VIOLATION,
          'Kunde kann nicht gelöscht werden, da noch Aufträge zugeordnet sind.',
          { relatedOrders: relatedOrders.length }
        );
      }

      const { data: relatedInvoices } = await supabase
        .from('invoices')
        .select('id')
        .eq('customer_id', id)
        .limit(1);

      if (relatedInvoices && relatedInvoices.length > 0) {
        throw new ApiError(
          API_ERROR_CODES.BUSINESS_RULE_VIOLATION,
          'Kunde kann nicht gelöscht werden, da noch Rechnungen vorhanden sind.',
          { relatedInvoices: relatedInvoices.length }
        );
      }

      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', id);

      if (error) {
        throw error;
      }
    }, `Delete customer ${id}`);
  }

  // Get customer statistics
  async getCustomerStats(id: string): Promise<{
    total_projects: number;
    active_projects: number;
    completed_projects: number;
    total_revenue: number;
    pending_invoices: number;
    overdue_invoices: number;
  }> {
    return apiCall(async () => {
      // Get projects stats
      const { data: projects } = await supabase
        .from('projects')
        .select('status, budget')
        .eq('customer_id', id);

      // Get invoice stats
      const { data: invoices } = await supabase
        .from('invoices')
        .select('status, amount')
        .eq('customer_id', id);

      const stats = {
        total_projects: projects?.length || 0,
        active_projects: projects?.filter((p: any) => p.status === 'active').length || 0,
        completed_projects: projects?.filter((p: any) => p.status === 'completed').length || 0,
        total_revenue: (invoices as any[])?.filter((i: any) => i.status === 'paid')
          .reduce((sum: number, i: any) => sum + (i.amount || 0), 0) || 0,
        pending_invoices: (invoices as any[])?.filter((i: any) => i.status === 'sent').length || 0,
        overdue_invoices: (invoices as any[])?.filter((i: any) => i.status === 'overdue').length || 0,
      };

      return stats;
    }, `Get customer stats ${id}`);
  }

  // Search customers by query
  async searchCustomers(query: string, limit: number = 10): Promise<Customer[]> {
    return apiCall(async () => {
      const searchQuery = supabase
        .from('customers')
        .select('*')
        .or(
          `company_name.ilike.%${query}%,` +
          `contact_person.ilike.%${query}%,` +
          `email.ilike.%${query}%,` +
          `customer_number.ilike.%${query}%`
        )
        .order('company_name')
        .limit(limit);

      return createQuery<Customer>(searchQuery).execute();
    }, `Search customers: ${query}`);
  }

  // Generate next customer number
  async generateCustomerNumber(): Promise<string> {
    return apiCall(async () => {
      const profile = await getCurrentUserProfile();

      // Call the database function to get next number
      const { data, error } = await supabase
        .rpc('get_next_number', {
          seq_name: 'customers',
          comp_id: profile.company_id
        });

      if (error) {
        throw error;
      }

      return data as string;
    }, 'Generate customer number');
  }

  // Get customer projects
  async getCustomerProjects(id: string): Promise<any[]> {
    return apiCall(async () => {
      const query = supabase
        .from('projects')
        .select(`
          *
        `)
        .eq('customer_id', id)
        .order('created_at', { ascending: false });

      return createQuery(query).execute();
    }, `Get customer projects ${id}`);
  }

  // Get customer invoices
  async getCustomerInvoices(id: string): Promise<any[]> {
    return apiCall(async () => {
      const query = supabase
        .from('invoices')
        .select(`
          *,
          projects (
            name
          )
        `)
        .eq('customer_id', id)
        .order('created_at', { ascending: false });

      return createQuery(query).execute();
    }, `Get customer invoices ${id}`);
  }
}

// Export singleton instance
export const customerService = new CustomerService();