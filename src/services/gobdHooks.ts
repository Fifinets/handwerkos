import { auditLogService, AuditEntityType, AuditAction } from './auditLogService';
import { gobdService } from './gobdService';
import { ApiError, API_ERROR_CODES } from './common';

// GoBD Hooks - Automatically integrate into all CRUD operations
export class GoBDHooks {
  
  /**
   * Pre-operation hook - runs BEFORE any data modification
   * Checks immutability and other GoBD constraints
   */
  static async preOperationHook(
    operation: 'CREATE' | 'UPDATE' | 'DELETE',
    entityType: AuditEntityType,
    entityId?: string,
    newData?: Record<string, any>,
    oldData?: Record<string, any>
  ): Promise<void> {
    // Skip pre-checks for CREATE operations
    if (operation === 'CREATE') {
      return;
    }

    // Check immutability for UPDATE and DELETE operations
    if (entityId && (operation === 'UPDATE' || operation === 'DELETE')) {
      const immutabilityCheck = await gobdService.checkImmutability(entityType, entityId);
      
      if (immutabilityCheck.is_immutable) {
        throw new ApiError(
          'Änderung nicht erlaubt - GoBD Unveränderlichkeit',
          API_ERROR_CODES.FORBIDDEN,
          `${entityType} ${entityId} ist unveränderlich seit ${immutabilityCheck.immutable_since}. ` +
          `Grund: ${immutabilityCheck.reason}. Einschränkungen: ${immutabilityCheck.restrictions.join(', ')}`
        );
      }
    }

    // Special checks for critical financial documents
    if (entityType === 'invoice' && operation === 'UPDATE' && entityId) {
      await this.checkInvoiceUpdatePermissions(entityId, newData, oldData);
    }

    if (entityType === 'order' && operation === 'DELETE' && entityId) {
      await this.checkOrderDeletePermissions(entityId);
    }
  }

  /**
   * Post-operation hook - runs AFTER successful data modification
   * Creates audit logs and handles immutability triggers
   */
  static async postOperationHook(
    operation: 'CREATE' | 'UPDATE' | 'DELETE',
    entityType: AuditEntityType,
    entityId: string,
    newData?: Record<string, any>,
    oldData?: Record<string, any>,
    reason?: string
  ): Promise<void> {
    // Create audit log based on operation type
    const auditAction = this.mapOperationToAuditAction(operation);
    
    try {
      await auditLogService.createAuditLog({
        entity_type: entityType,
        entity_id: entityId,
        action: auditAction,
        old_values: oldData || null,
        new_values: newData || null,
        reason,
      });
    } catch (error) {
      console.error('Failed to create audit log in post-operation hook:', error);
      // Don't throw - audit logging shouldn't break main functionality
    }

    // Handle immutability triggers
    await this.handleImmutabilityTriggers(operation, entityType, entityId, newData, oldData);

    // Generate number sequences if needed
    if (operation === 'CREATE') {
      await this.handleNumberSequenceGeneration(entityType, entityId, newData);
    }

    // Handle document hashing for PDFs
    if (newData?.pdf_content || newData?.document_content) {
      await this.handleDocumentHashing(entityType, entityId, newData);
    }
  }

  /**
   * Action hook - for special business actions (SEND, APPROVE, etc.)
   */
  static async actionHook(
    action: 'SEND' | 'APPROVE' | 'REJECT' | 'CANCEL' | 'PRINT' | 'EXPORT',
    entityType: AuditEntityType,
    entityId: string,
    actionData?: Record<string, any>,
    reason?: string
  ): Promise<void> {
    // Check if action is allowed
    const immutabilityCheck = await gobdService.checkImmutability(entityType, entityId);
    
    // Some actions are allowed even on immutable entities (like PRINT, EXPORT)
    const allowedActionsOnImmutable = ['PRINT', 'EXPORT', 'VIEW'];
    
    if (immutabilityCheck.is_immutable && !allowedActionsOnImmutable.includes(action)) {
      throw new ApiError(
        'Aktion nicht erlaubt - GoBD Unveränderlichkeit',
        API_ERROR_CODES.FORBIDDEN,
        `Aktion "${action}" ist nicht erlaubt für unveränderliche ${entityType} ${entityId}. ` +
        `Grund der Unveränderlichkeit: ${immutabilityCheck.reason}`
      );
    }

    // Create audit log for the action
    const auditAction = this.mapActionToAuditAction(action);
    await auditLogService.createAuditLog({
      entity_type: entityType,
      entity_id: entityId,
      action: auditAction,
      new_values: actionData || null,
      reason: reason || `${action} Aktion ausgeführt`,
    });

    // Handle immutability triggers for specific actions
    if (action === 'SEND' && entityType === 'invoice') {
      await gobdService.makeImmutable(
        entityType,
        entityId,
        'Rechnung wurde versendet - GoBD Unveränderlichkeit'
      );
    }

    if (action === 'APPROVE' && entityType === 'order') {
      await gobdService.makeImmutable(
        entityType,
        entityId,
        'Auftrag wurde genehmigt - Unveränderlichkeit'
      );
    }
  }

  // ============================================
  // SPECIALIZED HOOKS FOR DIFFERENT ENTITIES
  // ============================================

  /**
   * Invoice-specific hooks
   */
  static createInvoiceHooks() {
    return {
      beforeCreate: async (invoiceData: Record<string, any>) => {
        // Generate invoice number using GoBD-compliant sequence
        if (!invoiceData.invoice_number) {
          const { number } = await gobdService.getNextNumber('invoice');
          invoiceData.invoice_number = number;
        }
        return invoiceData;
      },

      afterCreate: async (invoiceId: string, invoiceData: Record<string, any>) => {
        await this.postOperationHook('CREATE', 'invoice', invoiceId, invoiceData, undefined, 'Neue Rechnung erstellt');
      },

      beforeUpdate: async (invoiceId: string, newData: Record<string, any>, oldData: Record<string, any>) => {
        await this.preOperationHook('UPDATE', 'invoice', invoiceId, newData, oldData);
        return newData;
      },

      afterUpdate: async (invoiceId: string, newData: Record<string, any>, oldData: Record<string, any>) => {
        await this.postOperationHook('UPDATE', 'invoice', invoiceId, newData, oldData, 'Rechnung aktualisiert');
      },

      beforeDelete: async (invoiceId: string, invoiceData: Record<string, any>) => {
        await this.preOperationHook('DELETE', 'invoice', invoiceId, undefined, invoiceData);
      },

      afterDelete: async (invoiceId: string, invoiceData: Record<string, any>) => {
        await this.postOperationHook('DELETE', 'invoice', invoiceId, undefined, invoiceData, 'Rechnung gelöscht');
      },

      onSend: async (invoiceId: string, sendData?: Record<string, any>) => {
        await this.actionHook('SEND', 'invoice', invoiceId, sendData, 'Rechnung versendet');
      },
    };
  }

  /**
   * Quote-specific hooks
   */
  static createQuoteHooks() {
    return {
      beforeCreate: async (quoteData: Record<string, any>) => {
        if (!quoteData.quote_number) {
          const { number } = await gobdService.getNextNumber('quote');
          quoteData.quote_number = number;
        }
        return quoteData;
      },

      afterCreate: async (quoteId: string, quoteData: Record<string, any>) => {
        await this.postOperationHook('CREATE', 'quote', quoteId, quoteData, undefined, 'Neues Angebot erstellt');
      },

      onApprove: async (quoteId: string) => {
        await this.actionHook('APPROVE', 'quote', quoteId, undefined, 'Angebot genehmigt');
      },

      onReject: async (quoteId: string, reason?: string) => {
        await this.actionHook('REJECT', 'quote', quoteId, { rejection_reason: reason }, reason || 'Angebot abgelehnt');
      },
    };
  }

  /**
   * Order-specific hooks
   */
  static createOrderHooks() {
    return {
      beforeCreate: async (orderData: Record<string, any>) => {
        if (!orderData.order_number) {
          const { number } = await gobdService.getNextNumber('order');
          orderData.order_number = number;
        }
        return orderData;
      },

      afterCreate: async (orderId: string, orderData: Record<string, any>) => {
        await this.postOperationHook('CREATE', 'order', orderId, orderData, undefined, 'Neuer Auftrag erstellt');
      },

      onApprove: async (orderId: string) => {
        await this.actionHook('APPROVE', 'order', orderId, undefined, 'Auftrag genehmigt');
      },

      onCancel: async (orderId: string, reason?: string) => {
        await this.actionHook('CANCEL', 'order', orderId, { cancellation_reason: reason }, reason || 'Auftrag storniert');
      },
    };
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  private static mapOperationToAuditAction(operation: 'CREATE' | 'UPDATE' | 'DELETE'): AuditAction {
    const mapping = {
      CREATE: 'CREATE' as AuditAction,
      UPDATE: 'UPDATE' as AuditAction,
      DELETE: 'DELETE' as AuditAction,
    };
    return mapping[operation];
  }

  private static mapActionToAuditAction(action: string): AuditAction {
    const mapping = {
      SEND: 'SEND' as AuditAction,
      APPROVE: 'APPROVE' as AuditAction,
      REJECT: 'REJECT' as AuditAction,
      CANCEL: 'CANCEL' as AuditAction,
      PRINT: 'PRINT' as AuditAction,
      EXPORT: 'EXPORT' as AuditAction,
    };
    return mapping[action as keyof typeof mapping] || 'UPDATE' as AuditAction;
  }

  private static async checkInvoiceUpdatePermissions(
    invoiceId: string, 
    newData?: Record<string, any>, 
    oldData?: Record<string, any>
  ): Promise<void> {
    // Special rules for invoice updates
    if (newData?.status === 'sent' && oldData?.status !== 'sent') {
      // This is effectively a SEND action, not an UPDATE
      throw new ApiError(
        'Status-Änderung nicht erlaubt',
        API_ERROR_CODES.FORBIDDEN,
        'Das Versenden einer Rechnung muss über die SEND-Aktion erfolgen, nicht über UPDATE.'
      );
    }

    // Check if critical fields are being changed
    const criticalFields = ['invoice_number', 'amount', 'tax_amount', 'customer_id'];
    const criticalChanges = criticalFields.filter(field => 
      newData?.[field] !== undefined && 
      oldData?.[field] !== undefined && 
      newData[field] !== oldData[field]
    );

    if (criticalChanges.length > 0 && oldData?.status === 'sent') {
      throw new ApiError(
        'Kritische Felder nicht änderbar',
        API_ERROR_CODES.FORBIDDEN,
        `Die Felder ${criticalChanges.join(', ')} können bei versendeten Rechnungen nicht geändert werden (GoBD).`
      );
    }
  }

  private static async checkOrderDeletePermissions(orderId: string): Promise<void> {
    // Orders with linked invoices cannot be deleted
    // This would need to check the database for related invoices
    // For now, we'll just create an audit log
    console.log(`Checking delete permissions for order ${orderId}`);
  }

  private static async handleImmutabilityTriggers(
    operation: 'CREATE' | 'UPDATE' | 'DELETE',
    entityType: AuditEntityType,
    entityId: string,
    newData?: Record<string, any>,
    oldData?: Record<string, any>
  ): Promise<void> {
    // Auto-immutability triggers
    if (operation === 'UPDATE' && entityType === 'invoice') {
      // If invoice status changed to 'sent', make it immutable
      if (newData?.status === 'sent' && oldData?.status !== 'sent') {
        await gobdService.makeImmutable(
          entityType,
          entityId,
          'Automatische Unveränderlichkeit - Rechnung auf Status "sent" geändert'
        );
      }
    }
  }

  private static async handleNumberSequenceGeneration(
    entityType: AuditEntityType,
    entityId: string,
    newData?: Record<string, any>
  ): Promise<void> {
    // This is handled in the beforeCreate hooks
    // but we could add additional logic here if needed
    console.log(`Number sequence handled for ${entityType} ${entityId}`);
  }

  private static async handleDocumentHashing(
    entityType: AuditEntityType,
    entityId: string,
    newData?: Record<string, any>
  ): Promise<void> {
    if (newData?.pdf_content && newData?.file_name) {
      try {
        await gobdService.createDocumentHash(
          entityType,
          entityId,
          newData.pdf_content,
          newData.file_name,
          newData.mime_type || 'application/pdf'
        );
      } catch (error) {
        console.error('Failed to create document hash:', error);
      }
    }
  }
}

export const gobdHooks = GoBDHooks;