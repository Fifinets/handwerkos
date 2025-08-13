import { supabase } from '@/integrations/supabase/client';
import { z } from 'zod';
import { apiCall, createQuery, validateInput, getCurrentUserProfile, ApiError, API_ERROR_CODES, PaginationOptions, PaginatedResult } from './common';
import { eventBus } from './eventBus';

// Notification types and interfaces
export type NotificationType = 
  | 'budget_warning' 
  | 'budget_critical' 
  | 'invoice_overdue' 
  | 'project_deadline' 
  | 'time_approval_needed'
  | 'material_low_stock'
  | 'system_update'
  | 'general';

export type NotificationPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  data?: Record<string, any>; // JSON data for additional context
  read: boolean;
  archived: boolean;
  created_at: string;
  read_at?: string;
  expires_at?: string;
  action_url?: string; // URL to navigate to when clicked
  entity_type?: string; // e.g., 'project', 'invoice', 'customer'
  entity_id?: string; // ID of the related entity
}

export interface NotificationCreate {
  user_id: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  data?: Record<string, any>;
  expires_at?: string;
  action_url?: string;
  entity_type?: string;
  entity_id?: string;
}

export interface NotificationUpdate {
  read?: boolean;
  archived?: boolean;
}

export interface NotificationFilters {
  type?: NotificationType;
  priority?: NotificationPriority;
  read?: boolean;
  archived?: boolean;
  entity_type?: string;
}

export interface NotificationStats {
  total_notifications: number;
  unread_notifications: number;
  urgent_notifications: number;
  notifications_by_type: Record<NotificationType, number>;
  notifications_by_priority: Record<NotificationPriority, number>;
}

// Zod schemas
const NotificationCreateSchema = z.object({
  user_id: z.string().uuid(),
  type: z.enum(['budget_warning', 'budget_critical', 'invoice_overdue', 'project_deadline', 'time_approval_needed', 'material_low_stock', 'system_update', 'general']),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  title: z.string().min(1).max(200),
  message: z.string().min(1).max(1000),
  data: z.record(z.any()).optional(),
  expires_at: z.string().datetime().optional(),
  action_url: z.string().url().optional(),
  entity_type: z.string().optional(),
  entity_id: z.string().optional(),
});

const NotificationUpdateSchema = z.object({
  read: z.boolean().optional(),
  archived: z.boolean().optional(),
});

export class NotificationService {
  
  /**
   * Get notifications for current user with pagination and filtering
   */
  static async getNotifications(
    pagination?: PaginationOptions,
    filters?: NotificationFilters
  ): Promise<PaginatedResult<Notification>> {
    return apiCall(async () => {
      const currentUser = await getCurrentUserProfile();
      
      let query = supabase
        .from('notifications')
        .select('*', { count: 'exact' })
        .eq('user_id', currentUser.id);

      // Apply filters
      if (filters?.type) {
        query = query.eq('type', filters.type);
      }
      
      if (filters?.priority) {
        query = query.eq('priority', filters.priority);
      }
      
      if (filters?.read !== undefined) {
        query = query.eq('read', filters.read);
      }
      
      if (filters?.archived !== undefined) {
        query = query.eq('archived', filters.archived);
      }
      
      if (filters?.entity_type) {
        query = query.eq('entity_type', filters.entity_type);
      }

      // Apply pagination and sorting
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

      const { data, count } = await createQuery<Notification>(query).executeWithCount();

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
    }, 'Get notifications');
  }

  /**
   * Create a new notification
   */
  static async createNotification(data: NotificationCreate): Promise<Notification> {
    return apiCall(async () => {
      const validatedData = validateInput(NotificationCreateSchema, data);

      const query = supabase
        .from('notifications')
        .insert(validatedData)
        .select()
        .single();

      const notification = await createQuery<Notification>(query).executeSingle();

      // Emit event for real-time updates
      eventBus.emit('NOTIFICATION_CREATED', {
        notification,
        user_id: data.user_id,
      });

      return notification;
    }, 'Create notification');
  }

  /**
   * Mark notification as read
   */
  static async markAsRead(id: string): Promise<Notification> {
    return apiCall(async () => {
      const currentUser = await getCurrentUserProfile();

      const updateData = {
        read: true,
        read_at: new Date().toISOString(),
      };

      const query = supabase
        .from('notifications')
        .update(updateData)
        .eq('id', id)
        .eq('user_id', currentUser.id)
        .select()
        .single();

      return await createQuery<Notification>(query).executeSingle();
    }, 'Mark notification as read');
  }

  /**
   * Mark all notifications as read
   */
  static async markAllAsRead(): Promise<void> {
    return apiCall(async () => {
      const currentUser = await getCurrentUserProfile();

      const updateData = {
        read: true,
        read_at: new Date().toISOString(),
      };

      await supabase
        .from('notifications')
        .update(updateData)
        .eq('user_id', currentUser.id)
        .eq('read', false);

      // Emit event for real-time updates
      eventBus.emit('NOTIFICATIONS_ALL_READ', {
        user_id: currentUser.id,
      });

    }, 'Mark all notifications as read');
  }

  /**
   * Archive notification
   */
  static async archiveNotification(id: string): Promise<Notification> {
    return apiCall(async () => {
      const currentUser = await getCurrentUserProfile();

      const query = supabase
        .from('notifications')
        .update({ archived: true })
        .eq('id', id)
        .eq('user_id', currentUser.id)
        .select()
        .single();

      return await createQuery<Notification>(query).executeSingle();
    }, 'Archive notification');
  }

  /**
   * Get notification statistics for current user
   */
  static async getNotificationStats(): Promise<NotificationStats> {
    return apiCall(async () => {
      const currentUser = await getCurrentUserProfile();

      const query = supabase
        .from('notifications')
        .select('type, priority, read, archived')
        .eq('user_id', currentUser.id)
        .eq('archived', false);

      const notifications = await createQuery<Notification>(query).execute();

      const unreadNotifications = notifications.filter(n => !n.read).length;
      const urgentNotifications = notifications.filter(n => n.priority === 'urgent' && !n.read).length;

      const notificationsByType: Record<NotificationType, number> = {
        budget_warning: 0,
        budget_critical: 0,
        invoice_overdue: 0,
        project_deadline: 0,
        time_approval_needed: 0,
        material_low_stock: 0,
        system_update: 0,
        general: 0,
      };

      const notificationsByPriority: Record<NotificationPriority, number> = {
        low: 0,
        medium: 0,
        high: 0,
        urgent: 0,
      };

      notifications.forEach(notification => {
        notificationsByType[notification.type]++;
        notificationsByPriority[notification.priority]++;
      });

      return {
        total_notifications: notifications.length,
        unread_notifications: unreadNotifications,
        urgent_notifications: urgentNotifications,
        notifications_by_type: notificationsByType,
        notifications_by_priority: notificationsByPriority,
      };
    }, 'Get notification statistics');
  }

  /**
   * Clean up expired notifications
   */
  static async cleanupExpiredNotifications(): Promise<void> {
    return apiCall(async () => {
      const now = new Date().toISOString();
      
      await supabase
        .from('notifications')
        .delete()
        .lt('expires_at', now);

    }, 'Cleanup expired notifications');
  }

  // ============================================
  // HELPER METHODS FOR SPECIFIC NOTIFICATIONS
  // ============================================

  /**
   * Create budget warning notification
   */
  static async createBudgetWarningNotification(
    userId: string, 
    projectId: string, 
    projectName: string, 
    utilizationPercentage: number
  ): Promise<Notification> {
    return this.createNotification({
      user_id: userId,
      type: 'budget_critical',
      priority: utilizationPercentage >= 90 ? 'urgent' : 'high',
      title: `Budget-Warnung: ${projectName}`,
      message: `Das Projekt "${projectName}" hat bereits ${utilizationPercentage}% des Budgets verbraucht. Bitte prüfen Sie die Kosten.`,
      data: {
        project_id: projectId,
        project_name: projectName,
        utilization_percentage: utilizationPercentage,
      },
      action_url: `/projects/${projectId}`,
      entity_type: 'project',
      entity_id: projectId,
    });
  }

  /**
   * Create overdue invoice notification
   */
  static async createOverdueInvoiceNotification(
    userId: string,
    invoiceId: string,
    invoiceNumber: string,
    customerName: string,
    amount: number,
    daysPastDue: number
  ): Promise<Notification> {
    return this.createNotification({
      user_id: userId,
      type: 'invoice_overdue',
      priority: daysPastDue > 30 ? 'urgent' : 'high',
      title: `Überfällige Rechnung: ${invoiceNumber}`,
      message: `Die Rechnung ${invoiceNumber} an ${customerName} über €${amount.toFixed(2)} ist seit ${daysPastDue} Tagen überfällig.`,
      data: {
        invoice_id: invoiceId,
        invoice_number: invoiceNumber,
        customer_name: customerName,
        amount,
        days_past_due: daysPastDue,
      },
      action_url: `/invoices/${invoiceId}`,
      entity_type: 'invoice',
      entity_id: invoiceId,
    });
  }

  /**
   * Create time approval notification
   */
  static async createTimeApprovalNotification(
    userId: string,
    employeeName: string,
    hoursCount: number,
    weekStartDate: string
  ): Promise<Notification> {
    return this.createNotification({
      user_id: userId,
      type: 'time_approval_needed',
      priority: 'medium',
      title: `Stundenzettel-Genehmigung erforderlich`,
      message: `${employeeName} hat ${hoursCount} Stunden für die Woche vom ${weekStartDate} eingereicht und wartet auf Genehmigung.`,
      data: {
        employee_name: employeeName,
        hours_count: hoursCount,
        week_start_date: weekStartDate,
      },
      action_url: `/timesheets/approvals`,
      entity_type: 'timesheet',
    });
  }
}

export const notificationService = NotificationService;