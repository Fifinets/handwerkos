// OCR Pipeline Service - Orchestrates the complete invoice processing pipeline
import { supabase } from '@/integrations/supabase/client';
import { apiCall, createQuery, getCurrentUserProfile, ApiError, API_ERROR_CODES } from './common';
import { EnhancedOCRService, EnhancedOCRResult, StructuredInvoiceData } from './enhancedOcrService';
import { AuditLogService } from './auditLogService';
import { eventBus } from './eventBus';

export interface PipelineValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  calculated_totals?: {
    net_from_items: number;
    tax_from_breakdown: number;
  };
}

export interface SupplierMatch {
  supplier_id: string;
  match_score: number;
  match_reason: string;
  supplier_data?: {
    id: string;
    name: string;
    vat_id?: string;
    iban?: string;
  };
}

export interface DuplicateWarning {
  invoice_id: string;
  duplicate_type: 'exact' | 'likely' | 'possible' | 'cross_supplier';
  confidence: number;
  details: {
    existing_invoice_number: string;
    existing_date: string;
    existing_amount: number;
    existing_supplier: string;
    date_difference_days: number;
    amount_difference: number;
  };
}

export interface PipelineImportResult {
  success: boolean;
  invoice_id?: string;
  supplier_id?: string;
  supplier_was_created?: boolean;
  validation_result?: PipelineValidationResult;
  duplicate_warnings?: DuplicateWarning[];
  error?: string;
  code?: string;
  details?: any;
}

export interface PipelineStatus {
  stage: 'upload' | 'ocr' | 'validation' | 'supplier_match' | 'duplicate_check' | 'import' | 'complete' | 'error';
  progress: number;
  message: string;
  details?: any;
}

export class OCRPipelineService {
  /**
   * Complete pipeline: Upload → OCR → Validation → Import
   */
  static async processInvoiceComplete(
    file: File,
    autoApprove: boolean = false,
    onProgress?: (status: PipelineStatus) => void
  ): Promise<PipelineImportResult> {
    return apiCall(async () => {
      const currentUser = await getCurrentUserProfile();

      try {
        // Stage 1: Upload and OCR
        onProgress?.({
          stage: 'upload',
          progress: 10,
          message: 'Datei wird hochgeladen und OCR wird gestartet...'
        });

        const ocrResult = await EnhancedOCRService.processInvoiceImage(file);

        onProgress?.({
          stage: 'ocr',
          progress: 30,
          message: 'OCR-Verarbeitung abgeschlossen, validiere Daten...'
        });

        // Stage 2: Validation
        const validationResult = await this.validateOCRData(ocrResult.id);

        if (!validationResult.valid) {
          onProgress?.({
            stage: 'validation',
            progress: 40,
            message: 'Validierungsfehler gefunden',
            details: validationResult
          });

          return {
            success: false,
            error: 'Validation failed',
            code: 'VALIDATION_ERROR',
            details: validationResult
          };
        }

        onProgress?.({
          stage: 'validation',
          progress: 50,
          message: 'Datenvalidierung erfolgreich, suche Lieferant...'
        });

        // Stage 3: Supplier Matching
        const supplierMatches = await this.findSupplierMatches(ocrResult.structured_data);

        onProgress?.({
          stage: 'supplier_match',
          progress: 70,
          message: 'Lieferant-Matching abgeschlossen, prüfe Duplikate...'
        });

        // Stage 4: Duplicate Check
        const duplicateCheck = await this.checkForDuplicates(ocrResult.structured_data);

        if (duplicateCheck.length > 0 && duplicateCheck[0].duplicate_type === 'exact') {
          onProgress?.({
            stage: 'duplicate_check',
            progress: 80,
            message: 'Exaktes Duplikat gefunden - Import abgebrochen',
            details: duplicateCheck
          });

          return {
            success: false,
            error: 'Exact duplicate invoice found',
            code: 'DUPLICATE_INVOICE',
            duplicate_warnings: duplicateCheck
          };
        }

        onProgress?.({
          stage: 'import',
          progress: 90,
          message: 'Rechnung wird importiert...'
        });

        // Stage 5: Import
        const importResult = await EnhancedOCRService.importInvoiceFromOCR(ocrResult.id, autoApprove);

        onProgress?.({
          stage: 'complete',
          progress: 100,
          message: 'Import erfolgreich abgeschlossen'
        });

        return {
          ...importResult,
          validation_result: validationResult,
          duplicate_warnings: duplicateCheck.length > 0 ? duplicateCheck : undefined
        };

      } catch (error) {
        onProgress?.({
          stage: 'error',
          progress: 0,
          message: `Fehler: ${error instanceof Error ? error.message : 'Unknown error'}`
        });

        throw error;
      }
    }, 'Complete OCR Pipeline Processing');
  }

  /**
   * Validate OCR data using the database validation function
   */
  static async validateOCRData(ocrResultId: string): Promise<PipelineValidationResult> {
    return apiCall(async () => {
      const currentUser = await getCurrentUserProfile();

      // Get company_id
      const { data: employee } = await supabase
        .from('employees')
        .select('company_id')
        .eq('user_id', currentUser.id)
        .single();

      if (!employee?.company_id) {
        throw new ApiError('Company not found', API_ERROR_CODES.VALIDATION_ERROR);
      }

      // Get OCR result
      const { data: ocrResult, error: ocrError } = await supabase
        .from('ocr_results')
        .select('structured_data')
        .eq('id', ocrResultId)
        .single();

      if (ocrError || !ocrResult) {
        throw new ApiError('OCR result not found', API_ERROR_CODES.NOT_FOUND);
      }

      // Call validation function
      const { data: validationResult, error: validationError } = await supabase
        .rpc('fn_validate_invoice_data', {
          p_structured_data: ocrResult.structured_data,
          p_company_id: employee.company_id
        });

      if (validationError) {
        throw new ApiError(
          'Validation failed',
          API_ERROR_CODES.SERVER_ERROR,
          validationError.message
        );
      }

      return validationResult as PipelineValidationResult;
    }, 'Validate OCR Data');
  }

  /**
   * Find supplier matches using the database function
   */
  static async findSupplierMatches(structuredData: StructuredInvoiceData): Promise<SupplierMatch[]> {
    return apiCall(async () => {
      const currentUser = await getCurrentUserProfile();

      // Get company_id
      const { data: employee } = await supabase
        .from('employees')
        .select('company_id')
        .eq('user_id', currentUser.id)
        .single();

      if (!employee?.company_id) {
        return [];
      }

      // Call supplier matching function
      const { data: matches, error } = await supabase
        .rpc('fn_find_supplier_matches', {
          p_company_id: employee.company_id,
          p_name: structuredData.supplier.name,
          p_vat_id: structuredData.supplier.vat_id || null,
          p_iban: structuredData.supplier.iban || null
        });

      if (error) {
        console.warn('Supplier matching failed:', error);
        return [];
      }

      // Get full supplier data for matches
      if (matches && matches.length > 0) {
        const supplierIds = matches.map((m: any) => m.supplier_id);
        const { data: suppliers } = await supabase
          .from('suppliers')
          .select('id, name, vat_id, iban')
          .in('id', supplierIds);

        return matches.map((match: any) => ({
          supplier_id: match.supplier_id,
          match_score: match.match_score,
          match_reason: match.match_reason,
          supplier_data: suppliers?.find(s => s.id === match.supplier_id)
        }));
      }

      return [];
    }, 'Find Supplier Matches');
  }

  /**
   * Check for duplicate invoices
   */
  static async checkForDuplicates(structuredData: StructuredInvoiceData): Promise<DuplicateWarning[]> {
    return apiCall(async () => {
      const currentUser = await getCurrentUserProfile();

      // Get company_id
      const { data: employee } = await supabase
        .from('employees')
        .select('company_id')
        .eq('user_id', currentUser.id)
        .single();

      if (!employee?.company_id) {
        return [];
      }

      // First try to find supplier matches to get supplier_id
      const supplierMatches = await this.findSupplierMatches(structuredData);
      const supplierId = supplierMatches.length > 0 ? supplierMatches[0].supplier_id : null;

      if (!supplierId) {
        // No supplier found, can't do meaningful duplicate check
        return [];
      }

      // Call duplicate detection function
      const { data: duplicates, error } = await supabase
        .rpc('fn_detect_invoice_duplicates', {
          p_company_id: employee.company_id,
          p_supplier_id: supplierId,
          p_invoice_number: structuredData.invoice.number,
          p_invoice_date: structuredData.invoice.date,
          p_gross_total: structuredData.totals.gross
        });

      if (error) {
        console.warn('Duplicate detection failed:', error);
        return [];
      }

      return duplicates || [];
    }, 'Check for Duplicates');
  }

  /**
   * Get invoice statistics for a company
   */
  static async getInvoiceStats(): Promise<{
    total_invoices: number;
    unpaid_count: number;
    paid_count: number;
    overdue_count: number;
    pending_approval: number;
    total_amount: number;
    unpaid_amount: number;
    overdue_amount: number;
  }> {
    return apiCall(async () => {
      const currentUser = await getCurrentUserProfile();

      // Get company_id
      const { data: employee } = await supabase
        .from('employees')
        .select('company_id')
        .eq('user_id', currentUser.id)
        .single();

      if (!employee?.company_id) {
        throw new ApiError('Company not found', API_ERROR_CODES.VALIDATION_ERROR);
      }

      // Call stats function
      const { data: stats, error } = await supabase
        .rpc('fn_get_invoice_stats', {
          p_company_id: employee.company_id
        });

      if (error) {
        throw new ApiError(
          'Failed to get invoice statistics',
          API_ERROR_CODES.SERVER_ERROR,
          error.message
        );
      }

      return stats;
    }, 'Get Invoice Statistics');
  }

  /**
   * Get detailed invoice information
   */
  static async getInvoiceDetails(invoiceId: string): Promise<any> {
    return apiCall(async () => {
      const currentUser = await getCurrentUserProfile();

      // Get company_id
      const { data: employee } = await supabase
        .from('employees')
        .select('company_id')
        .eq('user_id', currentUser.id)
        .single();

      const companyId = employee?.company_id;

      // Call detailed invoice function
      const { data: result, error } = await supabase
        .rpc('rpc_get_invoice_details', {
          p_invoice_id: invoiceId,
          p_company_id: companyId
        });

      if (error) {
        throw new ApiError(
          'Failed to get invoice details',
          API_ERROR_CODES.SERVER_ERROR,
          error.message
        );
      }

      if (!result.success) {
        throw new ApiError(
          result.error || 'Invoice not found',
          API_ERROR_CODES.NOT_FOUND
        );
      }

      return result.data;
    }, 'Get Invoice Details');
  }

  /**
   * Approve/reject invoice
   */
  static async setInvoiceApproval(
    invoiceId: string,
    approvalStatus: 'approved' | 'rejected' | 'pending',
    reason?: string
  ): Promise<{ success: boolean; old_status: string; new_status: string }> {
    return apiCall(async () => {
      const currentUser = await getCurrentUserProfile();

      // Get company_id
      const { data: employee } = await supabase
        .from('employees')
        .select('company_id')
        .eq('user_id', currentUser.id)
        .single();

      const companyId = employee?.company_id;

      // Call approval function
      const { data: result, error } = await supabase
        .rpc('rpc_set_invoice_approval', {
          p_invoice_id: invoiceId,
          p_approval_status: approvalStatus,
          p_reason: reason || null,
          p_company_id: companyId
        });

      if (error) {
        throw new ApiError(
          'Failed to update approval status',
          API_ERROR_CODES.SERVER_ERROR,
          error.message
        );
      }

      if (!result.success) {
        throw new ApiError(
          result.error || 'Failed to update approval status',
          API_ERROR_CODES.VALIDATION_ERROR
        );
      }

      // Emit event
      eventBus.emit('INVOICE_APPROVAL_CHANGED', {
        invoice_id: invoiceId,
        old_status: result.old_status,
        new_status: result.new_status,
        user_id: currentUser.id,
        reason
      });

      return result;
    }, 'Set Invoice Approval');
  }

  /**
   * Record payment for invoice
   */
  static async recordPayment(
    invoiceId: string,
    amount: number,
    paidAt: Date,
    reference?: string,
    bankTransactionId?: string
  ): Promise<{ success: boolean; payment_id: string; new_status: string }> {
    return apiCall(async () => {
      const currentUser = await getCurrentUserProfile();

      // Get company_id
      const { data: employee } = await supabase
        .from('employees')
        .select('company_id')
        .eq('user_id', currentUser.id)
        .single();

      const companyId = employee?.company_id;

      // Call payment function
      const { data: result, error } = await supabase
        .rpc('rpc_mark_invoice_paid', {
          p_invoice_id: invoiceId,
          p_amount: amount,
          p_paid_at: paidAt.toISOString(),
          p_reference: reference || null,
          p_bank_tx_id: bankTransactionId || null,
          p_company_id: companyId
        });

      if (error) {
        throw new ApiError(
          'Failed to record payment',
          API_ERROR_CODES.SERVER_ERROR,
          error.message
        );
      }

      if (!result.success) {
        throw new ApiError(
          result.error || 'Failed to record payment',
          API_ERROR_CODES.VALIDATION_ERROR
        );
      }

      // Emit event
      eventBus.emit('PAYMENT_RECORDED', {
        invoice_id: invoiceId,
        payment_id: result.payment_id,
        amount,
        new_status: result.new_status,
        user_id: currentUser.id
      });

      return result;
    }, 'Record Payment');
  }

  /**
   * Revalidate invoice after manual edits
   */
  static async revalidateInvoice(invoiceId: string): Promise<PipelineValidationResult> {
    return apiCall(async () => {
      const currentUser = await getCurrentUserProfile();

      // Get company_id
      const { data: employee } = await supabase
        .from('employees')
        .select('company_id')
        .eq('user_id', currentUser.id)
        .single();

      if (!employee?.company_id) {
        throw new ApiError('Company not found', API_ERROR_CODES.VALIDATION_ERROR);
      }

      // Call revalidation function
      const { data: result, error } = await supabase
        .rpc('rpc_revalidate_invoice', {
          p_invoice_id: invoiceId,
          p_company_id: employee.company_id
        });

      if (error) {
        throw new ApiError(
          'Revalidation failed',
          API_ERROR_CODES.SERVER_ERROR,
          error.message
        );
      }

      if (!result.success) {
        throw new ApiError(
          result.error || 'Revalidation failed',
          API_ERROR_CODES.VALIDATION_ERROR
        );
      }

      return {
        valid: result.valid,
        errors: result.errors || [],
        warnings: [],
        calculated_totals: result.totals_check
      };
    }, 'Revalidate Invoice');
  }

  /**
   * Bulk approve multiple invoices
   */
  static async bulkApproveInvoices(invoiceIds: string[]): Promise<{
    success: boolean;
    updated_count: number;
    total_requested: number;
  }> {
    return apiCall(async () => {
      const currentUser = await getCurrentUserProfile();

      // Get company_id
      const { data: employee } = await supabase
        .from('employees')
        .select('company_id')
        .eq('user_id', currentUser.id)
        .single();

      if (!employee?.company_id) {
        throw new ApiError('Company not found', API_ERROR_CODES.VALIDATION_ERROR);
      }

      // Call bulk approval function
      const { data: result, error } = await supabase
        .rpc('rpc_bulk_approve_invoices', {
          p_invoice_ids: invoiceIds,
          p_company_id: employee.company_id
        });

      if (error) {
        throw new ApiError(
          'Bulk approval failed',
          API_ERROR_CODES.SERVER_ERROR,
          error.message
        );
      }

      // Emit event for each approved invoice
      eventBus.emit('BULK_INVOICES_APPROVED', {
        invoice_ids: invoiceIds,
        updated_count: result.updated_count,
        user_id: currentUser.id,
        company_id: employee.company_id
      });

      return result;
    }, 'Bulk Approve Invoices');
  }
}

export default OCRPipelineService;