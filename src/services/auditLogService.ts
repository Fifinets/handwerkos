import { supabase } from '@/integrations/supabase/client';
import { z } from 'zod';
import { apiCall, createQuery, validateInput, getCurrentUserProfile, ApiError, API_ERROR_CODES, PaginationOptions, PaginatedResult } from './common';
import { eventBus } from './eventBus';

// GoBD-compliant audit log types
export type AuditAction = 
  | 'CREATE' 
  | 'UPDATE' 
  | 'DELETE' 
  | 'VIEW' 
  | 'PRINT' 
  | 'EXPORT' 
  | 'SEND' 
  | 'APPROVE' 
  | 'REJECT' 
  | 'CANCEL'
  | 'RESTORE';

export type AuditEntityType = 
  | 'customer' 
  | 'invoice' 
  | 'quote' 
  | 'order' 
  | 'project' 
  | 'timesheet' 
  | 'material' 
  | 'expense' 
  | 'employee'
  | 'document'
  | 'payment';

export interface AuditLog {
  id: string;
  entity_type: AuditEntityType;
  entity_id: string;
  action: AuditAction;
  user_id: string;
  user_email: string;
  user_name: string;
  old_values: Record<string, any> | null;
  new_values: Record<string, any> | null;
  changed_fields: string[];
  ip_address: string | null;
  user_agent: string | null;
  session_id: string | null;
  timestamp: string;
  reason: string | null; // Optional reason for the change
  is_automated: boolean; // Whether this was an automated action
  gobd_compliant: boolean; // GoBD compliance flag
  retention_until: string; // 10+ years for GoBD
}

export interface AuditLogCreate {
  entity_type: AuditEntityType;
  entity_id: string;
  action: AuditAction;
  old_values?: Record<string, any> | null;
  new_values?: Record<string, any> | null;
  reason?: string | null;
  is_automated?: boolean;
}

export interface AuditLogFilters {
  entity_type?: AuditEntityType;
  entity_id?: string;
  action?: AuditAction;
  user_id?: string;
  date_from?: string;
  date_to?: string;
  is_automated?: boolean;
}

export interface AuditTrail {
  entity_type: AuditEntityType;
  entity_id: string;
  logs: AuditLog[];
  creation_log: AuditLog;
  last_modification_log: AuditLog | null;
  total_modifications: number;
  is_immutable: boolean; // For GoBD immutable records
}

// Zod schemas
const AuditLogCreateSchema = z.object({
  entity_type: z.enum(['customer', 'invoice', 'quote', 'order', 'project', 'timesheet', 'material', 'expense', 'employee', 'document', 'payment']),
  entity_id: z.string().min(1),
  action: z.enum(['CREATE', 'UPDATE', 'DELETE', 'VIEW', 'PRINT', 'EXPORT', 'SEND', 'APPROVE', 'REJECT', 'CANCEL', 'RESTORE']),
  old_values: z.record(z.any()).nullable().optional(),
  new_values: z.record(z.any()).nullable().optional(),
  reason: z.string().nullable().optional(),
  is_automated: z.boolean().optional().default(false),
});

export class AuditLogService {
  /**
   * Create an audit log entry (GoBD compliant)
   */
  static async createAuditLog(data: AuditLogCreate): Promise<AuditLog> {
    return apiCall(async () => {
      const validatedData = validateInput(AuditLogCreateSchema, data);
      
      // Get current user profile
      const currentUser = await getCurrentUserProfile();
      
      // Calculate changed fields
      const changedFields: string[] = [];
      if (validatedData.old_values && validatedData.new_values) {
        const oldKeys = Object.keys(validatedData.old_values);
        const newKeys = Object.keys(validatedData.new_values);
        const allKeys = [...new Set([...oldKeys, ...newKeys])];
        
        for (const key of allKeys) {
          const oldValue = validatedData.old_values[key];
          const newValue = validatedData.new_values[key];
          if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
            changedFields.push(key);
          }
        }
      }

      // Get client information (if available in browser)
      const clientInfo = this.getClientInfo();
      
      // Calculate retention date (10 years + current year for GoBD)
      const retentionDate = new Date();
      retentionDate.setFullYear(retentionDate.getFullYear() + 11);

      const auditLogData = {
        entity_type: validatedData.entity_type,
        entity_id: validatedData.entity_id,
        action: validatedData.action,
        user_id: currentUser.id,
        user_email: currentUser.email,
        user_name: `${currentUser.first_name || ''} ${currentUser.last_name || ''}`.trim(),
        old_values: validatedData.old_values || null,
        new_values: validatedData.new_values || null,
        changed_fields: changedFields,
        ip_address: clientInfo.ip_address,
        user_agent: clientInfo.user_agent,
        session_id: clientInfo.session_id,
        timestamp: new Date().toISOString(),
        reason: validatedData.reason,
        is_automated: validatedData.is_automated || false,
        gobd_compliant: true,
        retention_until: retentionDate.toISOString(),
      };

      const query = supabase
        .from('audit_logs')
        .insert(auditLogData)
        .select()
        .single();

      const auditLog = await createQuery<AuditLog>(query).executeSingle();

      // Emit event for real-time monitoring
      eventBus.emit('AUDIT_LOG_CREATED', {
        audit_log: auditLog,
        entity_type: validatedData.entity_type,
        entity_id: validatedData.entity_id,
        action: validatedData.action,
      });

      return auditLog;
    }, 'Create audit log');
  }

  /**
   * Get audit logs with pagination and filtering
   */
  static async getAuditLogs(
    pagination?: PaginationOptions,
    filters?: AuditLogFilters
  ): Promise<PaginatedResult<AuditLog>> {
    return apiCall(async () => {
      let query = supabase
        .from('audit_logs')
        .select('*', { count: 'exact' });

      // Apply filters
      if (filters?.entity_type) {
        query = query.eq('entity_type', filters.entity_type);
      }
      
      if (filters?.entity_id) {
        query = query.eq('entity_id', filters.entity_id);
      }
      
      if (filters?.action) {
        query = query.eq('action', filters.action);
      }
      
      if (filters?.user_id) {
        query = query.eq('user_id', filters.user_id);
      }
      
      if (filters?.is_automated !== undefined) {
        query = query.eq('is_automated', filters.is_automated);
      }
      
      if (filters?.date_from) {
        query = query.gte('timestamp', filters.date_from);
      }
      
      if (filters?.date_to) {
        query = query.lte('timestamp', filters.date_to);
      }

      // Apply pagination and sorting
      if (pagination) {
        const offset = (pagination.page - 1) * pagination.limit;
        query = query
          .range(offset, offset + pagination.limit - 1)
          .order(pagination.sort_by || 'timestamp', { 
            ascending: pagination.sort_order === 'asc' 
          });
      } else {
        query = query.order('timestamp', { ascending: false });
      }

      const { data, count } = await createQuery<AuditLog>(query).executeWithCount();

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
    }, 'Get audit logs');
  }

  /**
   * Get complete audit trail for an entity (GoBD requirement)
   */
  static async getAuditTrail(entityType: AuditEntityType, entityId: string): Promise<AuditTrail> {
    return apiCall(async () => {
      const query = supabase
        .from('audit_logs')
        .select('*')
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .order('timestamp', { ascending: true });

      const logs = await createQuery<AuditLog>(query).execute();

      if (logs.length === 0) {
        throw new ApiError(
          'Keine Audit-Logs gefunden',
          API_ERROR_CODES.NOT_FOUND,
          `Keine Audit-Logs für ${entityType} ${entityId} gefunden`
        );
      }

      const creationLog = logs.find(log => log.action === 'CREATE') || logs[0];
      const modificationLogs = logs.filter(log => log.action === 'UPDATE');
      const lastModificationLog = modificationLogs.length > 0 ? modificationLogs[modificationLogs.length - 1] : null;

      // Check if entity is immutable (invoices after sending, etc.)
      const isImmutable = this.isEntityImmutable(entityType, logs);

      return {
        entity_type: entityType,
        entity_id: entityId,
        logs,
        creation_log: creationLog,
        last_modification_log: lastModificationLog,
        total_modifications: modificationLogs.length,
        is_immutable: isImmutable,
      };
    }, 'Get audit trail');
  }

  /**
   * Get audit statistics for compliance reporting
   */
  static async getAuditStatistics(dateRange?: { from?: string; to?: string }): Promise<{
    total_logs: number;
    logs_by_action: Record<AuditAction, number>;
    logs_by_entity_type: Record<AuditEntityType, number>;
    unique_users: number;
    automated_logs: number;
    manual_logs: number;
    compliance_score: number;
  }> {
    return apiCall(async () => {
      let query = supabase
        .from('audit_logs')
        .select('action, entity_type, user_id, is_automated');

      if (dateRange?.from) {
        query = query.gte('timestamp', dateRange.from);
      }
      if (dateRange?.to) {
        query = query.lte('timestamp', dateRange.to);
      }

      const logs = await createQuery<AuditLog>(query).execute();

      const logsByAction: Record<AuditAction, number> = {
        CREATE: 0, UPDATE: 0, DELETE: 0, VIEW: 0, PRINT: 0, 
        EXPORT: 0, SEND: 0, APPROVE: 0, REJECT: 0, CANCEL: 0, RESTORE: 0
      };

      const logsByEntityType: Record<AuditEntityType, number> = {
        customer: 0, invoice: 0, quote: 0, order: 0, project: 0,
        timesheet: 0, material: 0, expense: 0, employee: 0, document: 0, payment: 0
      };

      const uniqueUsers = new Set<string>();
      let automatedLogs = 0;

      logs.forEach(log => {
        logsByAction[log.action]++;
        logsByEntityType[log.entity_type]++;
        uniqueUsers.add(log.user_id);
        if (log.is_automated) automatedLogs++;
      });

      // Calculate compliance score (higher is better)
      const totalLogs = logs.length;
      const manualLogs = totalLogs - automatedLogs;
      const complianceScore = totalLogs > 0 ? Math.min(100, (totalLogs / 1000) * 100) : 0;

      return {
        total_logs: totalLogs,
        logs_by_action: logsByAction,
        logs_by_entity_type: logsByEntityType,
        unique_users: uniqueUsers.size,
        automated_logs: automatedLogs,
        manual_logs: manualLogs,
        compliance_score: Math.round(complianceScore),
      };
    }, 'Get audit statistics');
  }

  /**
   * Helper method to get client information
   */
  private static getClientInfo(): {
    ip_address: string | null;
    user_agent: string | null;
    session_id: string | null;
  } {
    if (typeof window === 'undefined') {
      return { ip_address: null, user_agent: null, session_id: null };
    }

    return {
      ip_address: null, // Would need server-side detection
      user_agent: navigator.userAgent || null,
      session_id: sessionStorage.getItem('session_id') || null,
    };
  }

  /**
   * Check if an entity is immutable based on audit trail
   */
  private static isEntityImmutable(entityType: AuditEntityType, logs: AuditLog[]): boolean {
    // Invoices become immutable after SEND action
    if (entityType === 'invoice') {
      return logs.some(log => log.action === 'SEND');
    }
    
    // Orders become immutable after APPROVE
    if (entityType === 'order') {
      return logs.some(log => log.action === 'APPROVE');
    }
    
    // Add more immutability rules as needed
    return false;
  }

  /**
   * Create audit log hooks for automatic tracking
   */
  static createAuditHooks() {
    return {
      /**
       * Hook for CREATE operations
       */
      onCreate: async (entityType: AuditEntityType, entityId: string, newValues: Record<string, any>, reason?: string) => {
        try {
          await this.createAuditLog({
            entity_type: entityType,
            entity_id: entityId,
            action: 'CREATE',
            new_values: newValues,
            reason,
          });
        } catch (error) {
          console.error('Failed to create audit log for CREATE:', error);
          // Don't throw - audit logging shouldn't break main functionality
        }
      },

      /**
       * Hook for UPDATE operations
       */
      onUpdate: async (entityType: AuditEntityType, entityId: string, oldValues: Record<string, any>, newValues: Record<string, any>, reason?: string) => {
        try {
          await this.createAuditLog({
            entity_type: entityType,
            entity_id: entityId,
            action: 'UPDATE',
            old_values: oldValues,
            new_values: newValues,
            reason,
          });
        } catch (error) {
          console.error('Failed to create audit log for UPDATE:', error);
        }
      },

      /**
       * Hook for DELETE operations
       */
      onDelete: async (entityType: AuditEntityType, entityId: string, oldValues: Record<string, any>, reason?: string) => {
        try {
          await this.createAuditLog({
            entity_type: entityType,
            entity_id: entityId,
            action: 'DELETE',
            old_values: oldValues,
            reason,
          });
        } catch (error) {
          console.error('Failed to create audit log for DELETE:', error);
        }
      },

      /**
       * Hook for special actions (SEND, APPROVE, etc.)
       */
      onAction: async (entityType: AuditEntityType, entityId: string, action: AuditAction, reason?: string, isAutomated = false) => {
        try {
          await this.createAuditLog({
            entity_type: entityType,
            entity_id: entityId,
            action,
            reason,
            is_automated: isAutomated,
          });
        } catch (error) {
          console.error(`Failed to create audit log for ${action}:`, error);
        }
      },
    };
  }
}

export const auditLogService = AuditLogService;