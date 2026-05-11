// Event Bus for HandwerkOS
//
// In-process pub/sub for two concerns ONLY:
//   1. UI cache invalidation — subscribers call queryClient.invalidateQueries()
//      so the React UI refetches after a write. See App.tsx / hooks/useApi.ts.
//   2. Audit trail logging — business-critical events get persisted to the
//      audit_logs table via logToAuditTrail() below.
//
// THIS IS NOT A WORKFLOW ORCHESTRATOR. Cross-cutting automation (mahnungen,
// OCR, AI indexing, etc.) MUST live in Supabase Edge Functions triggered by
// pg_cron, because the eventBus only runs while a browser tab is open. If
// the user logs out, the eventBus is gone — but the business still needs
// mahnungen to be sent. See:
//   - supabase/functions/notification-cron/       (mahnungen, deadlines, etc.)
//   - supabase/functions/time-tracking-cron/      (auto-stop, weekly reports)
//   - supabase/functions/process-ai-queue/        (embeddings, RAG indexing)
//
// Do not add a workflow-trigger method to this file. If you find yourself
// writing "when X happens, also do Y on the server", that belongs in a
// database trigger or an edge function — not here.

import { supabase } from '@/integrations/supabase/client';

export type EventType =
  // Customer events
  | 'CUSTOMER_CREATED'
  | 'CUSTOMER_UPDATED'
  | 'CUSTOMER_DELETED'

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

  // Article events
  | 'ARTICLE_IMPORTED'
  | 'ARTICLE_CREATED'
  | 'ARTICLE_UPDATED'
  | 'ARTICLE_DELETED'
  | 'DATANORM_IMPORT_STARTED'
  | 'DATANORM_IMPORT_COMPLETED'
  | 'DATANORM_IMPORT_FAILED'

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

      await supabase.from('audit_logs').insert({
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
    if (event.startsWith('ORDER_')) return 'orders';
    if (event.startsWith('PROJECT_')) return 'projects';
    if (event.startsWith('INVOICE_')) return 'invoices';
    if (event.startsWith('TIMESHEET_')) return 'timesheets';
    if (event.startsWith('MATERIAL_') || event.startsWith('STOCK_')) return 'materials';
    if (event.startsWith('DOCUMENT_')) return 'documents';
    return 'unknown';
  }

}

// Create singleton instance
export const eventBus = new EventBus();

// Initialize system event handlers
eventBus.on('SYSTEM_ERROR', (data) => {
  // Could integrate with error reporting service
});

eventBus.on('USER_LOGIN', (data) => {
  // Track user activity
});

eventBus.on('USER_LOGOUT', (data) => {
  // Track user activity
});

// Export types for external use
// export type { EventHandler, EventSubscription }; // Removed duplicate export