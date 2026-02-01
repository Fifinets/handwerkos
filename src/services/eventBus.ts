// Event Bus for HandwerkOS
// Handles system-wide events for workflow automation, notifications, and audit trails

import { supabase } from '@/integrations/supabase/client';

export type EventType =
  // Customer events
  | 'CUSTOMER_CREATED'
  | 'CUSTOMER_UPDATED'
  | 'CUSTOMER_DELETED'

  // Quote events
  | 'QUOTE_CREATED'
  | 'QUOTE_UPDATED'
  | 'QUOTE_SENT'
  | 'QUOTE_ACCEPTED'
  | 'QUOTE_REJECTED'
  | 'QUOTE_DELETED'

  // Offer events
  | 'OFFER_CREATED'
  | 'OFFER_UPDATED'
  | 'OFFER_SENT'
  | 'OFFER_ACCEPTED'
  | 'OFFER_REJECTED'
  | 'OFFER_CANCELLED'
  | 'OFFER_DELETED'
  | 'OFFER_ITEM_ADDED'
  | 'OFFER_ITEM_UPDATED'
  | 'OFFER_ITEM_DELETED'
  | 'OFFER_TARGETS_UPDATED'

  // Order events
  | 'ORDER_CREATED'
  | 'ORDER_CREATED_FROM_QUOTE'
  | 'ORDER_UPDATED'
  | 'ORDER_STARTED'
  | 'ORDER_COMPLETED'
  | 'ORDER_CANCELLED'
  | 'ORDER_DELETED'

  // Project events
  | 'PROJECT_CREATED'
  | 'PROJECT_UPDATED'
  | 'PROJECT_STATUS_CHANGED'
  | 'PROJECT_DELETED'

  // Timesheet events
  | 'TIMESHEET_CREATED'
  | 'TIMESHEET_UPDATED'
  | 'TIMESHEET_APPROVED'
  | 'TIMESHEET_REJECTED'
  | 'TIMESHEET_DELETED'

  // Material & Stock events
  | 'MATERIAL_CREATED'
  | 'MATERIAL_UPDATED'
  | 'MATERIAL_DELETED'
  | 'MATERIAL_LOW_STOCK'
  | 'STOCK_ADJUSTED'
  | 'STOCK_RECEIVED'
  | 'STOCK_CONSUMED'
  | 'STOCK_TRANSFER_CREATED'
  | 'STOCK_TRANSFER_STARTED'
  | 'STOCK_TRANSFER_COMPLETED'
  | 'INVENTORY_COUNT_CREATED'
  | 'INVENTORY_COUNT_COMPLETED'

  // Finance events
  | 'INVOICE_CREATED'
  | 'INVOICE_UPDATED'
  | 'INVOICE_SENT'
  | 'INVOICE_PAID'
  | 'EXPENSE_CREATED'
  | 'EXPENSE_APPROVED'

  // Document events
  | 'DOCUMENT_UPLOADED'
  | 'DOCUMENT_UPDATED'
  | 'DOCUMENT_DOWNLOADED'
  | 'DOCUMENT_DELETED'

  // System events
  | 'USER_LOGIN'
  | 'USER_LOGOUT'
  | 'SYSTEM_ERROR'
  | 'BACKUP_CREATED'
  | 'AUDIT_LOG_CREATED';

export interface EventData {
  [key: string]: any;
  user_id?: string;
  timestamp?: string;
}

export type EventHandler<T extends EventData = EventData> = (data: T) => void | Promise<void>;

export interface EventSubscription {
  id: string;
  event: EventType;
  handler: EventHandler;
  once?: boolean;
}

class EventBus {
  private subscriptions: Map<EventType, EventSubscription[]> = new Map();
  private eventHistory: Array<{ event: EventType; data: EventData; timestamp: string }> = [];
  private maxHistorySize = 1000;

  // Subscribe to an event
  on<T extends EventData = EventData>(
    event: EventType,
    handler: EventHandler<T>,
    once = false
  ): string {
    const subscription: EventSubscription = {
      id: this.generateId(),
      event,
      handler: handler as EventHandler,
      once,
    };

    if (!this.subscriptions.has(event)) {
      this.subscriptions.set(event, []);
    }

    this.subscriptions.get(event)!.push(subscription);

    return subscription.id;
  }

  // Subscribe to an event only once
  once<T extends EventData = EventData>(
    event: EventType,
    handler: EventHandler<T>
  ): string {
    return this.on(event, handler, true);
  }

  // Unsubscribe from an event
  off(subscriptionId: string): void {
    for (const [event, subscriptions] of this.subscriptions.entries()) {
      const index = subscriptions.findIndex(sub => sub.id === subscriptionId);
      if (index >= 0) {
        subscriptions.splice(index, 1);
        if (subscriptions.length === 0) {
          this.subscriptions.delete(event);
        }
        break;
      }
    }
  }

  // Emit an event
  async emit(event: EventType, data: EventData = {}): Promise<void> {
    const eventData = {
      ...data,
      timestamp: data.timestamp || new Date().toISOString(),
    };

    // Add to history
    this.addToHistory(event, eventData);

    // Log to audit trail for important business events
    if (this.shouldLogToAudit(event)) {
      await this.logToAuditTrail(event, eventData);
    }

    // Get subscribers for this event
    const subscriptions = this.subscriptions.get(event) || [];

    // Execute handlers
    const promises = subscriptions.map(async (subscription) => {
      try {
        await subscription.handler(eventData);

        // Remove one-time subscriptions
        if (subscription.once) {
          this.off(subscription.id);
        }
      } catch (error) {
        console.error(`Event handler error for ${event}:`, error);

        // Emit system error event (but avoid infinite loops)
        if (event !== 'SYSTEM_ERROR') {
          this.emit('SYSTEM_ERROR', {
            error: error instanceof Error ? error.message : 'Unknown error',
            event,
            data: eventData,
          });
        }
      }
    });

    await Promise.all(promises);

    // Trigger workflow automations
    await this.triggerWorkflowAutomations(event, eventData);
  }

  // Get event history
  getHistory(event?: EventType, limit?: number): Array<{ event: EventType; data: EventData; timestamp: string }> {
    let history = event
      ? this.eventHistory.filter(item => item.event === event)
      : this.eventHistory;

    if (limit) {
      history = history.slice(-limit);
    }

    return history;
  }

  // Clear event history
  clearHistory(): void {
    this.eventHistory = [];
  }

  // Get subscription count for debugging
  getSubscriptionCount(event?: EventType): number {
    if (event) {
      return this.subscriptions.get(event)?.length || 0;
    }

    let total = 0;
    for (const subscriptions of this.subscriptions.values()) {
      total += subscriptions.length;
    }
    return total;
  }

  // Private helper methods
  private generateId(): string {
    return `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private addToHistory(event: EventType, data: EventData): void {
    this.eventHistory.push({
      event,
      data: { ...data }, // Clone to avoid mutations
      timestamp: data.timestamp || new Date().toISOString(),
    });

    // Limit history size
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }
  }

  private shouldLogToAudit(event: EventType): boolean {
    // Only log business-critical events to audit trail
    const auditableEvents: EventType[] = [
      'QUOTE_SENT',
      'QUOTE_ACCEPTED',
      'QUOTE_REJECTED',
      'ORDER_STARTED',
      'ORDER_COMPLETED',
      'ORDER_CANCELLED',
      'PROJECT_STATUS_CHANGED',
      'INVOICE_SENT',
      'INVOICE_PAID',
      'TIMESHEET_APPROVED',
      'STOCK_ADJUSTED',
      'DOCUMENT_UPLOADED',
      'DOCUMENT_DELETED',
    ];

    return auditableEvents.includes(event);
  }

  private async logToAuditTrail(event: EventType, data: EventData): Promise<void> {
    try {
      // Extract relevant information for audit log
      const auditData = this.extractAuditData(event, data);

      await supabase.from('audit_logs' as any).insert({
        action: this.mapEventToAuditAction(event),
        table_name: this.extractTableName(event),
        record_id: auditData.recordId,
        old_values: auditData.oldValues,
        new_values: auditData.newValues,
        user_id: data.user_id,
        metadata: {
          event_type: event,
          ...auditData.metadata,
        },
      });
    } catch (error) {
      console.error('Failed to log audit trail:', error);
      // Don't throw - audit logging should not break business operations
    }
  }

  private extractAuditData(event: EventType, data: EventData): {
    recordId?: string;
    oldValues?: any;
    newValues?: any;
    metadata?: any;
  } {
    // Extract audit-relevant data based on event type
    switch (event) {
      case 'QUOTE_ACCEPTED':
      case 'QUOTE_REJECTED':
        return {
          recordId: data.quote?.id,
          newValues: { status: data.quote?.status },
          metadata: { reason: data.reason },
        };

      case 'PROJECT_STATUS_CHANGED':
        return {
          recordId: data.project?.id,
          oldValues: { status: data.previous_status },
          newValues: { status: data.new_status },
        };

      case 'INVOICE_PAID':
        return {
          recordId: data.invoice?.id,
          newValues: { status: 'paid', paid_at: data.payment_date },
          metadata: { notes: data.notes },
        };

      case 'STOCK_ADJUSTED':
        return {
          recordId: data.material?.id,
          metadata: {
            adjustment: data.adjustment,
            reason: data.reason,
            reference: data.reference,
          },
        };

      default:
        return {
          recordId: data.id || data.quote?.id || data.project?.id || data.invoice?.id,
          metadata: { event_data: data },
        };
    }
  }

  private mapEventToAuditAction(event: EventType): string {
    const actionMap: Partial<Record<EventType, string>> = {
      'QUOTE_SENT': 'STATUS_CHANGE',
      'QUOTE_ACCEPTED': 'STATUS_CHANGE',
      'QUOTE_REJECTED': 'STATUS_CHANGE',
      'ORDER_STARTED': 'STATUS_CHANGE',
      'ORDER_COMPLETED': 'STATUS_CHANGE',
      'ORDER_CANCELLED': 'STATUS_CHANGE',
      'PROJECT_STATUS_CHANGED': 'STATUS_CHANGE',
      'INVOICE_SENT': 'STATUS_CHANGE',
      'INVOICE_PAID': 'STATUS_CHANGE',
      'TIMESHEET_APPROVED': 'UPDATE',
      'STOCK_ADJUSTED': 'UPDATE',
      'DOCUMENT_UPLOADED': 'INSERT',
      'DOCUMENT_DELETED': 'DELETE',
    };

    return actionMap[event] || 'UPDATE';
  }

  private extractTableName(event: EventType): string {
    if (event.startsWith('QUOTE_')) return 'quotes';
    if (event.startsWith('ORDER_')) return 'orders';
    if (event.startsWith('PROJECT_')) return 'projects';
    if (event.startsWith('INVOICE_')) return 'invoices';
    if (event.startsWith('TIMESHEET_')) return 'timesheets';
    if (event.startsWith('MATERIAL_') || event.startsWith('STOCK_')) return 'materials';
    if (event.startsWith('DOCUMENT_')) return 'documents';
    return 'unknown';
  }

  private async triggerWorkflowAutomations(event: EventType, data: EventData): Promise<void> {
    // Implement workflow automations based on events
    try {
      switch (event) {
        case 'QUOTE_ACCEPTED':
          // Auto-create order workflow is handled in quoteService
          await this.sendNotification('quote_accepted', data);
          break;

        case 'ORDER_COMPLETED':
          // Auto-create invoice workflow
          await this.autoCreateInvoice(data);
          break;

        case 'INVOICE_SENT':
          // Schedule payment reminders
          await this.schedulePaymentReminders(data);
          break;

        case 'MATERIAL_LOW_STOCK':
          // Send low stock alerts
          await this.sendLowStockAlert(data);
          break;

        case 'PROJECT_STATUS_CHANGED':
          // Update team notifications
          await this.notifyProjectTeam(data);
          break;

        default:
          // No automation for this event
          break;
      }
    } catch (error) {
      console.error(`Workflow automation error for ${event}:`, error);
      // Don't throw - workflow automations should not break business operations
    }
  }

  // Workflow automation methods
  private async sendNotification(type: string, data: EventData): Promise<void> {
    // Implementation would integrate with notification service
    console.log(`Notification: ${type}`, data);
  }

  private async autoCreateInvoice(data: EventData): Promise<void> {
    // Implementation would auto-create invoice from completed order
    if (data.order) {
      console.log('Auto-creating invoice for order:', data.order.id);
      // This would call financeService.createInvoiceFromOrder(data.order)
    }
  }

  private async schedulePaymentReminders(data: EventData): Promise<void> {
    // Implementation would schedule payment reminder emails
    if (data.invoice) {
      console.log('Scheduling payment reminders for invoice:', data.invoice.id);
    }
  }

  private async sendLowStockAlert(data: EventData): Promise<void> {
    // Implementation would send low stock notifications
    if (data.material) {
      console.log('Low stock alert for material:', data.material.name);
    }
  }

  private async notifyProjectTeam(data: EventData): Promise<void> {
    // Implementation would notify project team members
    if (data.project) {
      console.log('Notifying project team of status change:', data.project.name);
    }
  }
}

// Create singleton instance
export const eventBus = new EventBus();

// Initialize system event handlers
eventBus.on('SYSTEM_ERROR', (data) => {
  console.error('System error:', data);
  // Could integrate with error reporting service
});

eventBus.on('USER_LOGIN', (data) => {
  console.log('User logged in:', data.user_id);
  // Track user activity
});

eventBus.on('USER_LOGOUT', (data) => {
  console.log('User logged out:', data.user_id);
  // Track user activity
});

// Export types for external use
// export type { EventHandler, EventSubscription }; // Removed duplicate export