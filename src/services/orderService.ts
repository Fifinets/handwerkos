// Order service for HandwerkOS
// Handles CRUD operations and workflow transitions for orders

import { supabase } from '@/integrations/supabase/client';
import { 
  apiCall, 
  createQuery, 
  validateInput,
  ApiError,
  API_ERROR_CODES 
} from '@/utils/api';
import {
  Order,
  OrderCreate,
  OrderUpdate,
  OrderCreateSchema,
  OrderUpdateSchema,
  PaginationQuery,
  PaginationResponse,
  Quote
} from '@/types';
import { eventBus } from './eventBus';

export class OrderService {
  
  // Get all orders with pagination and filtering
  static async getOrders(
    pagination?: PaginationQuery,
    filters?: {
      status?: Order['status'];
      customer_id?: string;
      search?: string;
    }
  ): Promise<PaginationResponse<Order>> {
    return apiCall(async () => {
      let query = supabase
        .from('orders')
        .select(`
          *,
          customers (
            company_name,
            contact_person,
            email
          ),
          projects (
            name,
            status
          )
        `, { count: 'exact' });
      
      // Apply filters
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      
      if (filters?.customer_id) {
        query = query.eq('customer_id', filters.customer_id);
      }
      
      if (filters?.search) {
        query = query.or(
          `title.ilike.%${filters.search}%,` +
          `description.ilike.%${filters.search}%,` +
          `order_number.ilike.%${filters.search}%`
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
      
      const { data, count } = await createQuery<Order>(query).executeWithCount();
      
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
    }, 'Get orders');
  }
  
  // Get order by ID
  static async getOrder(id: string): Promise<Order> {
    return apiCall(async () => {
      const query = supabase
        .from('orders')
        .select(`
          *,
          customers (
            company_name,
            contact_person,
            email,
            address,
            city,
            postal_code
          ),
          quotes (
            quote_number,
            title
          ),
          projects (
            name,
            status,
            start_date,
            end_date
          )
        `)
        .eq('id', id);
      
      return createQuery<Order>(query).executeSingle();
    }, `Get order ${id}`);
  }
  
  // Create new order
  static async createOrder(data: OrderCreate): Promise<Order> {
    return apiCall(async () => {
      // Validate input
      const validatedData = validateInput(OrderCreateSchema, data);
      
      // Calculate totals from items
      const items = validatedData.body?.items || [];
      const totalNet = items.reduce((sum, item) => sum + item.total_price, 0);
      const taxRate = validatedData.tax_rate || 19;
      const totalGross = totalNet * (1 + taxRate / 100);
      
      const orderData = {
        ...validatedData,
        total_amount: totalGross,
        status: 'open' as const,
      };
      
      const query = supabase
        .from('orders')
        .insert(orderData)
        .select()
        .single();
      
      const order = await createQuery<Order>(query).executeSingle();
      
      // Emit event for audit trail and notifications
      eventBus.emit('ORDER_CREATED', {
        order,
        user_id: (await supabase.auth.getUser()).data.user?.id,
      });
      
      return order;
    }, 'Create order');
  }
  
  // Create order from accepted quote
  static async createOrderFromQuote(quote: Quote): Promise<Order> {
    return apiCall(async () => {
      // Validate quote is accepted
      if (quote.status !== 'accepted') {
        throw new ApiError(
          API_ERROR_CODES.BUSINESS_RULE_VIOLATION,
          'Nur akzeptierte Angebote können in Aufträge umgewandelt werden.',
          { quoteStatus: quote.status }
        );
      }
      
      // Create order data from quote
      const orderData: OrderCreate = {
        customer_id: quote.customer_id,
        quote_id: quote.id,
        title: quote.title,
        description: quote.description,
        body: quote.body,
        tax_rate: quote.tax_rate,
        expected_delivery_date: quote.valid_until || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      };
      
      const order = await this.createOrder(orderData);
      
      // Emit specific event for quote-to-order conversion
      eventBus.emit('ORDER_CREATED_FROM_QUOTE', {
        order,
        quote,
        user_id: (await supabase.auth.getUser()).data.user?.id,
      });
      
      return order;
    }, `Create order from quote ${quote.id}`);
  }
  
  // Update existing order
  static async updateOrder(id: string, data: OrderUpdate): Promise<Order> {
    return apiCall(async () => {
      // Get existing order for validation
      const existingOrder = await this.getOrder(id);
      
      // Validate business rules
      if (existingOrder.status === 'completed') {
        throw new ApiError(
          API_ERROR_CODES.IMMUTABLE_RECORD,
          'Abgeschlossene Aufträge können nicht mehr bearbeitet werden.',
          { currentStatus: existingOrder.status }
        );
      }
      
      if (existingOrder.status === 'in_progress' && data.order_number) {
        throw new ApiError(
          API_ERROR_CODES.IMMUTABLE_RECORD,
          'Auftragsnummer kann nach dem Start nicht mehr geändert werden.',
          { currentStatus: existingOrder.status }
        );
      }
      
      // Validate input
      const validatedData = validateInput(OrderUpdateSchema, data);
      
      // Recalculate totals if items changed
      if (validatedData.body?.items) {
        const items = validatedData.body.items;
        const totalNet = items.reduce((sum, item) => sum + item.total_price, 0);
        const taxRate = validatedData.tax_rate || existingOrder.tax_rate || 19;
        validatedData.total_amount = totalNet * (1 + taxRate / 100);
      }
      
      const query = supabase
        .from('orders')
        .update(validatedData)
        .eq('id', id)
        .select()
        .single();
      
      const updatedOrder = await createQuery<Order>(query).executeSingle();
      
      // Emit event for audit trail
      eventBus.emit('ORDER_UPDATED', {
        order: updatedOrder,
        previous_order: existingOrder,
        changes: validatedData,
        user_id: (await supabase.auth.getUser()).data.user?.id,
      });
      
      return updatedOrder;
    }, `Update order ${id}`);
  }
  
  // Start order (transition to in_progress)
  static async startOrder(id: string): Promise<Order> {
    return apiCall(async () => {
      const existingOrder = await this.getOrder(id);
      
      // Validate order can be started
      if (existingOrder.status !== 'open') {
        throw new ApiError(
          API_ERROR_CODES.BUSINESS_RULE_VIOLATION,
          'Nur offene Aufträge können gestartet werden.',
          { currentStatus: existingOrder.status }
        );
      }
      
      // Update status to 'in_progress' (this triggers order numbering via database trigger)
      const updateData = {
        status: 'in_progress' as const,
        started_at: new Date().toISOString(),
      };
      
      const query = supabase
        .from('orders')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
      
      const startedOrder = await createQuery<Order>(query).executeSingle();
      
      // Auto-create project if none exists
      if (!startedOrder.project_id) {
        const projectData = {
          name: startedOrder.title,
          description: startedOrder.description,
          customer_id: startedOrder.customer_id,
          order_id: startedOrder.id,
          status: 'active',
          start_date: new Date().toISOString().split('T')[0],
          budget: startedOrder.total_amount,
        };
        
        const { data: project } = await supabase
          .from('projects')
          .insert(projectData)
          .select()
          .single();
        
        // Update order with project_id
        await supabase
          .from('orders')
          .update({ project_id: project?.id })
          .eq('id', id);
      }
      
      // Emit event for workflow automation
      eventBus.emit('ORDER_STARTED', {
        order: startedOrder,
        user_id: (await supabase.auth.getUser()).data.user?.id,
      });
      
      return startedOrder;
    }, `Start order ${id}`);
  }
  
  // Complete order
  static async completeOrder(id: string): Promise<Order> {
    return apiCall(async () => {
      const existingOrder = await this.getOrder(id);
      
      // Validate order can be completed
      if (existingOrder.status !== 'in_progress') {
        throw new ApiError(
          API_ERROR_CODES.BUSINESS_RULE_VIOLATION,
          'Nur laufende Aufträge können abgeschlossen werden.',
          { currentStatus: existingOrder.status }
        );
      }
      
      const updateData = {
        status: 'completed' as const,
        completed_at: new Date().toISOString(),
      };
      
      const query = supabase
        .from('orders')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
      
      const completedOrder = await createQuery<Order>(query).executeSingle();
      
      // Update related project status
      if (completedOrder.project_id) {
        await supabase
          .from('projects')
          .update({ 
            status: 'completed',
            end_date: new Date().toISOString().split('T')[0] 
          })
          .eq('id', completedOrder.project_id);
      }
      
      // Emit event for invoicing workflow
      eventBus.emit('ORDER_COMPLETED', {
        order: completedOrder,
        user_id: (await supabase.auth.getUser()).data.user?.id,
      });
      
      return completedOrder;
    }, `Complete order ${id}`);
  }
  
  // Cancel order
  static async cancelOrder(id: string, reason?: string): Promise<Order> {
    return apiCall(async () => {
      const existingOrder = await this.getOrder(id);
      
      // Validate order can be cancelled
      if (existingOrder.status === 'completed') {
        throw new ApiError(
          API_ERROR_CODES.BUSINESS_RULE_VIOLATION,
          'Abgeschlossene Aufträge können nicht storniert werden.',
          { currentStatus: existingOrder.status }
        );
      }
      
      const updateData = {
        status: 'cancelled' as const,
        // Store cancellation reason in description
        description: reason 
          ? `${existingOrder.description || ''}\n\nStornierungsgrund: ${reason}`.trim()
          : existingOrder.description,
      };
      
      const query = supabase
        .from('orders')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
      
      const cancelledOrder = await createQuery<Order>(query).executeSingle();
      
      // Update related project status
      if (cancelledOrder.project_id) {
        await supabase
          .from('projects')
          .update({ status: 'cancelled' })
          .eq('id', cancelledOrder.project_id);
      }
      
      // Emit event for notifications
      eventBus.emit('ORDER_CANCELLED', {
        order: cancelledOrder,
        reason,
        user_id: (await supabase.auth.getUser()).data.user?.id,
      });
      
      return cancelledOrder;
    }, `Cancel order ${id}`);
  }
  
  // Get order statistics
  static async getOrderStats(): Promise<{
    total: number;
    by_status: Record<Order['status'], number>;
    total_value: Record<Order['status'], number>;
    avg_completion_time: number;
  }> {
    return apiCall(async () => {
      const query = supabase
        .from('orders')
        .select('status, total_amount, created_at, completed_at');
      
      const orders = await createQuery<Order>(query).execute();
      
      const stats = {
        total: orders.length,
        by_status: {
          open: 0,
          in_progress: 0,
          completed: 0,
          cancelled: 0,
        } as Record<Order['status'], number>,
        total_value: {
          open: 0,
          in_progress: 0,
          completed: 0,
          cancelled: 0,
        } as Record<Order['status'], number>,
        avg_completion_time: 0,
      };
      
      let totalCompletionTime = 0;
      let completedCount = 0;
      
      orders.forEach(order => {
        stats.by_status[order.status]++;
        stats.total_value[order.status] += order.total_amount || 0;
        
        if (order.status === 'completed' && order.completed_at) {
          const completionTime = new Date(order.completed_at).getTime() - new Date(order.created_at).getTime();
          totalCompletionTime += completionTime / (1000 * 60 * 60 * 24); // Convert to days
          completedCount++;
        }
      });
      
      // Calculate average completion time in days
      if (completedCount > 0) {
        stats.avg_completion_time = totalCompletionTime / completedCount;
      }
      
      return stats;
    }, 'Get order statistics');
  }
  
  // Delete order (with safety checks)
  static async deleteOrder(id: string): Promise<void> {
    return apiCall(async () => {
      const existingOrder = await this.getOrder(id);
      
      // Only allow deletion of open orders without project
      if (existingOrder.status !== 'open') {
        throw new ApiError(
          API_ERROR_CODES.BUSINESS_RULE_VIOLATION,
          'Nur offene Aufträge können gelöscht werden.',
          { currentStatus: existingOrder.status }
        );
      }
      
      if (existingOrder.project_id) {
        throw new ApiError(
          API_ERROR_CODES.BUSINESS_RULE_VIOLATION,
          'Aufträge mit verknüpften Projekten können nicht gelöscht werden.',
          { projectId: existingOrder.project_id }
        );
      }
      
      const { error } = await supabase
        .from('orders')
        .delete()
        .eq('id', id);
      
      if (error) {
        throw error;
      }
      
      // Emit event for audit trail
      eventBus.emit('ORDER_DELETED', {
        order: existingOrder,
        user_id: (await supabase.auth.getUser()).data.user?.id,
      });
    }, `Delete order ${id}`);
  }
  
  // Duplicate order
  static async duplicateOrder(id: string): Promise<Order> {
    return apiCall(async () => {
      const originalOrder = await this.getOrder(id);
      
      // Create new order from original
      const duplicateData: OrderCreate = {
        customer_id: originalOrder.customer_id,
        title: `${originalOrder.title} (Kopie)`,
        description: originalOrder.description,
        body: originalOrder.body,
        tax_rate: originalOrder.tax_rate,
        expected_delivery_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days from now
      };
      
      return this.createOrder(duplicateData);
    }, `Duplicate order ${id}`);
  }
}

// Export singleton instance
export const orderService = OrderService;