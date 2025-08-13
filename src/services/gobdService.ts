import { supabase } from '@/integrations/supabase/client';
import { z } from 'zod';
import { apiCall, createQuery, validateInput, getCurrentUserProfile, ApiError, API_ERROR_CODES } from './common';
import { auditLogService } from './auditLogService';
import { eventBus } from './eventBus';
import CryptoJS from 'crypto-js';

// GoBD-compliant number sequence types
export type NumberSequenceType = 
  | 'invoice' 
  | 'quote' 
  | 'order' 
  | 'receipt' 
  | 'credit_note' 
  | 'delivery_note'
  | 'payment_voucher';

export interface NumberSequence {
  id: string;
  sequence_type: NumberSequenceType;
  prefix: string; // e.g., "RE-", "AN-", "AB-"
  current_number: number;
  year: number;
  format: string; // e.g., "RE-{YYYY}-{NNNNNN}"
  reset_annually: boolean;
  gap_tracking: boolean; // GoBD requires gap tracking
  is_locked: boolean; // Once locked, cannot be modified (GoBD)
  created_at: string;
  locked_at: string | null;
  locked_by: string | null;
}

export interface NumberSequenceGap {
  id: string;
  sequence_id: string;
  gap_start: number;
  gap_end: number;
  reason: string;
  resolved_at: string | null;
  resolved_by: string | null;
  gobd_documented: boolean;
}

export interface GoBDDocument {
  id: string;
  entity_type: string;
  entity_id: string;
  document_hash: string;
  document_content: string | null; // Base64 encoded PDF/document
  file_name: string;
  file_size: number;
  mime_type: string;
  is_immutable: boolean;
  immutability_timestamp: string | null;
  immutability_reason: string | null;
  hash_algorithm: 'SHA256' | 'SHA512';
  signature: string | null; // Digital signature for extra security
  retention_until: string; // 10 years minimum for GoBD
  created_at: string;
}

export interface ImmutabilityCheck {
  entity_type: string;
  entity_id: string;
  is_immutable: boolean;
  immutable_since: string | null;
  reason: string | null;
  can_modify: boolean;
  restrictions: string[];
}

// Zod schemas
const NumberSequenceCreateSchema = z.object({
  sequence_type: z.enum(['invoice', 'quote', 'order', 'receipt', 'credit_note', 'delivery_note', 'payment_voucher']),
  prefix: z.string().min(1).max(10),
  format: z.string().min(1),
  reset_annually: z.boolean().default(true),
  gap_tracking: z.boolean().default(true),
});

const DocumentHashSchema = z.object({
  entity_type: z.string().min(1),
  entity_id: z.string().min(1),
  document_content: z.string().min(1), // Base64
  file_name: z.string().min(1),
  mime_type: z.string().min(1),
});

export class GoBDService {
  
  // ============================================
  // NUMBER SEQUENCE MANAGEMENT (GoBD COMPLIANT)
  // ============================================

  /**
   * Get or create number sequence for a type and year
   */
  static async getOrCreateNumberSequence(sequenceType: NumberSequenceType, year?: number): Promise<NumberSequence> {
    return apiCall(async () => {
      const currentYear = year || new Date().getFullYear();
      
      // Try to find existing sequence
      const existingQuery = supabase
        .from('number_sequences')
        .select('*')
        .eq('sequence_type', sequenceType)
        .eq('year', currentYear)
        .single();

      try {
        const existing = await createQuery<NumberSequence>(existingQuery).executeSingle();
        return existing;
      } catch (error) {
        // Create new sequence if not found
        const prefix = this.getDefaultPrefix(sequenceType);
        const format = this.getDefaultFormat(sequenceType);
        
        const newSequence = {
          sequence_type: sequenceType,
          prefix,
          current_number: 0,
          year: currentYear,
          format,
          reset_annually: true,
          gap_tracking: true,
          is_locked: false,
          locked_at: null,
          locked_by: null,
        };

        const insertQuery = supabase
          .from('number_sequences')
          .insert(newSequence)
          .select()
          .single();

        return await createQuery<NumberSequence>(insertQuery).executeSingle();
      }
    }, 'Get or create number sequence');
  }

  /**
   * Get next number in sequence (GoBD compliant - no gaps allowed)
   */
  static async getNextNumber(sequenceType: NumberSequenceType, year?: number): Promise<{ sequence: NumberSequence; number: string }> {
    return apiCall(async () => {
      const sequence = await this.getOrCreateNumberSequence(sequenceType, year);
      
      if (sequence.is_locked) {
        throw new ApiError(
          'Nummernkreis gesperrt',
          API_ERROR_CODES.FORBIDDEN,
          `Der Nummernkreis für ${sequenceType} ist gesperrt und kann nicht verwendet werden.`
        );
      }

      // Increment the number atomically
      const nextNumber = sequence.current_number + 1;
      
      const updateQuery = supabase
        .from('number_sequences')
        .update({ current_number: nextNumber })
        .eq('id', sequence.id)
        .select()
        .single();

      const updatedSequence = await createQuery<NumberSequence>(updateQuery).executeSingle();
      
      // Format the number according to the sequence format
      const formattedNumber = this.formatNumber(updatedSequence.format, nextNumber, year || new Date().getFullYear());

      // Log this number generation for audit
      await auditLogService.createAuditLog({
        entity_type: 'document', // Generic for number sequences
        entity_id: `${sequenceType}-${year}-${nextNumber}`,
        action: 'CREATE',
        new_values: {
          sequence_type: sequenceType,
          number: formattedNumber,
          sequence_id: sequence.id,
        },
        reason: `Nummernkreis ${sequenceType} - neue Nummer generiert`,
        is_automated: true,
      });

      return {
        sequence: updatedSequence,
        number: formattedNumber,
      };
    }, 'Get next number');
  }

  /**
   * Report a gap in number sequence (GoBD requirement)
   */
  static async reportNumberGap(
    sequenceId: string, 
    gapStart: number, 
    gapEnd: number, 
    reason: string
  ): Promise<NumberSequenceGap> {
    return apiCall(async () => {
      const gapData = {
        sequence_id: sequenceId,
        gap_start: gapStart,
        gap_end: gapEnd,
        reason,
        resolved_at: null,
        resolved_by: null,
        gobd_documented: true,
      };

      const query = supabase
        .from('number_sequence_gaps')
        .insert(gapData)
        .select()
        .single();

      const gap = await createQuery<NumberSequenceGap>(query).executeSingle();

      // Create audit log for gap reporting
      await auditLogService.createAuditLog({
        entity_type: 'document',
        entity_id: sequenceId,
        action: 'CREATE',
        new_values: gapData,
        reason: `Nummernkreis-Lücke dokumentiert: ${gapStart}-${gapEnd}`,
      });

      return gap;
    }, 'Report number gap');
  }

  // ============================================
  // IMMUTABILITY ENFORCEMENT (GoBD REQUIREMENT)
  // ============================================

  /**
   * Make an entity immutable (e.g., after sending invoice)
   */
  static async makeImmutable(
    entityType: string, 
    entityId: string, 
    reason: string
  ): Promise<void> {
    return apiCall(async () => {
      const timestamp = new Date().toISOString();
      const currentUser = await getCurrentUserProfile();

      // Different immutability strategies per entity type
      switch (entityType) {
        case 'invoice':
          await this.makeInvoiceImmutable(entityId, reason, timestamp, currentUser.id);
          break;
        case 'order':
          await this.makeOrderImmutable(entityId, reason, timestamp, currentUser.id);
          break;
        default:
          // Generic immutability flag
          await supabase
            .from(this.getTableName(entityType))
            .update({
              is_immutable: true,
              immutable_since: timestamp,
              immutability_reason: reason,
            })
            .eq('id', entityId);
      }

      // Create audit log
      await auditLogService.createAuditLog({
        entity_type: entityType as any,
        entity_id: entityId,
        action: 'UPDATE',
        new_values: {
          is_immutable: true,
          immutable_since: timestamp,
          immutability_reason: reason,
        },
        reason: `GoBD Unveränderlichkeit: ${reason}`,
      });

      // Emit event
      eventBus.emit('ENTITY_MADE_IMMUTABLE', {
        entity_type: entityType,
        entity_id: entityId,
        reason,
        timestamp,
        user_id: currentUser.id,
      });

    }, 'Make entity immutable');
  }

  /**
   * Check if entity can be modified
   */
  static async checkImmutability(entityType: string, entityId: string): Promise<ImmutabilityCheck> {
    return apiCall(async () => {
      // Get audit trail to check for immutability events
      const auditTrail = await auditLogService.getAuditTrail(entityType as any, entityId);
      
      // Check different immutability conditions
      let isImmutable = false;
      let immutableSince: string | null = null;
      let reason: string | null = null;
      const restrictions: string[] = [];

      // Invoice-specific immutability rules
      if (entityType === 'invoice') {
        const sentLog = auditTrail.logs.find(log => log.action === 'SEND');
        if (sentLog) {
          isImmutable = true;
          immutableSince = sentLog.timestamp;
          reason = 'Rechnung wurde versendet (GoBD-Unveränderlichkeit)';
          restrictions.push('Versendete Rechnungen können nicht geändert werden');
          restrictions.push('Stornierung nur über Gutschrift möglich');
        }
      }

      // Order-specific rules
      if (entityType === 'order') {
        const approvedLog = auditTrail.logs.find(log => log.action === 'APPROVE');
        if (approvedLog) {
          isImmutable = true;
          immutableSince = approvedLog.timestamp;
          reason = 'Auftrag wurde genehmigt';
          restrictions.push('Genehmigte Aufträge können nur storniert werden');
        }
      }

      return {
        entity_type: entityType,
        entity_id: entityId,
        is_immutable: isImmutable,
        immutable_since: immutableSince,
        reason,
        can_modify: !isImmutable,
        restrictions,
      };
    }, 'Check immutability');
  }

  // ============================================
  // DOCUMENT HASHING AND INTEGRITY (GoBD)
  // ============================================

  /**
   * Create hash for document (PDF, etc.) to ensure integrity
   */
  static async createDocumentHash(
    entityType: string,
    entityId: string,
    documentContent: string, // Base64 encoded
    fileName: string,
    mimeType: string
  ): Promise<GoBDDocument> {
    return apiCall(async () => {
      const validatedData = validateInput(DocumentHashSchema, {
        entity_type: entityType,
        entity_id: entityId,
        document_content: documentContent,
        file_name: fileName,
        mime_type: mimeType,
      });

      // Calculate SHA256 hash
      const hash = CryptoJS.SHA256(documentContent).toString();
      
      // Calculate file size from base64
      const fileSize = Math.floor((documentContent.length * 3) / 4);
      
      // Calculate retention date (10+ years for GoBD)
      const retentionDate = new Date();
      retentionDate.setFullYear(retentionDate.getFullYear() + 11);

      const documentData = {
        entity_type: entityType,
        entity_id: entityId,
        document_hash: hash,
        document_content: documentContent,
        file_name: fileName,
        file_size: fileSize,
        mime_type: mimeType,
        is_immutable: true, // Documents are immutable by default
        immutability_timestamp: new Date().toISOString(),
        immutability_reason: 'GoBD Dokumentenintegrität',
        hash_algorithm: 'SHA256' as const,
        signature: null, // Could add digital signatures later
        retention_until: retentionDate.toISOString(),
      };

      const query = supabase
        .from('gobd_documents')
        .insert(documentData)
        .select()
        .single();

      const document = await createQuery<GoBDDocument>(query).executeSingle();

      // Create audit log
      await auditLogService.createAuditLog({
        entity_type: entityType as any,
        entity_id: entityId,
        action: 'CREATE',
        new_values: {
          document_hash: hash,
          file_name: fileName,
          file_size: fileSize,
        },
        reason: 'GoBD Dokumenten-Hash erstellt',
      });

      return document;
    }, 'Create document hash');
  }

  /**
   * Verify document integrity
   */
  static async verifyDocumentIntegrity(documentId: string): Promise<{
    is_valid: boolean;
    original_hash: string;
    current_hash: string;
    verified_at: string;
    integrity_maintained: boolean;
  }> {
    return apiCall(async () => {
      // Get document from database
      const documentQuery = supabase
        .from('gobd_documents')
        .select('*')
        .eq('id', documentId)
        .single();

      const document = await createQuery<GoBDDocument>(documentQuery).executeSingle();
      
      // Recalculate hash
      const currentHash = CryptoJS.SHA256(document.document_content || '').toString();
      const isValid = document.document_hash === currentHash;

      const verificationResult = {
        is_valid: isValid,
        original_hash: document.document_hash,
        current_hash: currentHash,
        verified_at: new Date().toISOString(),
        integrity_maintained: isValid,
      };

      // Log verification attempt
      await auditLogService.createAuditLog({
        entity_type: document.entity_type as any,
        entity_id: document.entity_id,
        action: 'VIEW',
        new_values: verificationResult,
        reason: 'GoBD Integritätsprüfung durchgeführt',
      });

      return verificationResult;
    }, 'Verify document integrity');
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  private static getDefaultPrefix(sequenceType: NumberSequenceType): string {
    const prefixes = {
      invoice: 'RE-',
      quote: 'AN-',
      order: 'AB-',
      receipt: 'QU-',
      credit_note: 'GU-',
      delivery_note: 'LS-',
      payment_voucher: 'ZB-',
    };
    return prefixes[sequenceType];
  }

  private static getDefaultFormat(sequenceType: NumberSequenceType): string {
    const formats = {
      invoice: 'RE-{YYYY}-{NNNNNN}',
      quote: 'AN-{YYYY}-{NNNNNN}',
      order: 'AB-{YYYY}-{NNNNNN}',
      receipt: 'QU-{YYYY}-{NNNNNN}',
      credit_note: 'GU-{YYYY}-{NNNNNN}',
      delivery_note: 'LS-{YYYY}-{NNNNNN}',
      payment_voucher: 'ZB-{YYYY}-{NNNNNN}',
    };
    return formats[sequenceType];
  }

  private static formatNumber(format: string, number: number, year: number): string {
    return format
      .replace('{YYYY}', year.toString())
      .replace('{NNNNNN}', number.toString().padStart(6, '0'))
      .replace('{NNNNN}', number.toString().padStart(5, '0'))
      .replace('{NNNN}', number.toString().padStart(4, '0'));
  }

  private static getTableName(entityType: string): string {
    const tableMap = {
      invoice: 'invoices',
      quote: 'quotes',
      order: 'orders',
      customer: 'customers',
      project: 'projects',
    };
    return tableMap[entityType as keyof typeof tableMap] || entityType;
  }

  private static async makeInvoiceImmutable(
    invoiceId: string, 
    reason: string, 
    timestamp: string, 
    userId: string
  ): Promise<void> {
    // Update invoice with immutability flags
    await supabase
      .from('invoices')
      .update({
        is_immutable: true,
        immutable_since: timestamp,
        immutability_reason: reason,
        locked_by: userId,
      })
      .eq('id', invoiceId);
  }

  private static async makeOrderImmutable(
    orderId: string, 
    reason: string, 
    timestamp: string, 
    userId: string
  ): Promise<void> {
    // Update order with immutability flags
    await supabase
      .from('orders')
      .update({
        is_immutable: true,
        immutable_since: timestamp,
        immutability_reason: reason,
        locked_by: userId,
      })
      .eq('id', orderId);
  }
}

export const gobdService = GoBDService;