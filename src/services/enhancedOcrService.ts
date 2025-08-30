// Enhanced OCR Service - Implements the new structured data format from the plan
import { createWorker, Worker } from 'tesseract.js';
import { supabase } from '@/integrations/supabase/client';
import { apiCall, createQuery, getCurrentUserProfile, ApiError, API_ERROR_CODES } from './common';
import { AuditLogService } from './auditLogService';
import { eventBus } from './eventBus';
import { extractInvoiceWithAI, isOpenAIConfigured } from './openaiService';

// New structured data format according to the plan
export interface StructuredInvoiceData {
  supplier: {
    name: string;
    vat_id?: string;
    tax_number?: string;
    iban?: string;
    bic?: string;
    address?: string;
  };
  invoice: {
    number: string;
    date: string;
    due_date?: string;
    currency: string;
    payment_terms?: string;
  };
  totals: {
    net: number;
    gross: number;
    taxes: Array<{
      rate: number;
      base: number;
      amount: number;
      type?: 'standard' | 'reduced' | 'reverse_charge' | 'exempt';
    }>;
  };
  items?: Array<{
    pos?: number;
    description: string;
    qty: number;
    unit?: string;
    unit_price: number;
    discount_percent?: number;
    net: number;
    tax_rate: number;
    tax_amount?: number;
  }>;
  references?: {
    project_id?: string;
    order_id?: string;
    delivery_note?: string;
    customer_number?: string;
  };
}

// Enhanced confidence scores for field-level tracking
export interface DetailedConfidenceScores {
  overall: number;
  'invoice.number': number;
  'invoice.date': number;
  'invoice.due_date'?: number;
  'supplier.name': number;
  'supplier.vat_id'?: number;
  'supplier.iban'?: number;
  'totals.gross': number;
  'totals.net'?: number;
  'totals.taxes'?: number;
  [key: string]: number | undefined;
}

export interface EnhancedOCRResult {
  id: string;
  original_file_path: string;
  original_filename?: string;
  file_hash?: string;
  filesize?: number;
  mime_type?: string;
  page_count?: number;
  ocr_engine: string;
  ocr_engine_version?: string;
  version: number;
  extracted_text: string;
  structured_data: StructuredInvoiceData;
  confidence_scores: DetailedConfidenceScores;
  status: 'pending' | 'validated' | 'rejected' | 'imported';
  validation_notes?: string;
  processing_errors?: string[];
  company_id?: string;
  duplicates_of?: string;
  created_at: string;
  created_by: string;
  validated_at?: string;
  validated_by?: string;
  updated_at: string;
}

export class EnhancedOCRService {
  private static worker: Worker | null = null;
  private static isInitialized = false;
  private static readonly OCR_ENGINE = 'tesseract';
  private static readonly OCR_VERSION = '5.0.0';

  /**
   * Initialize Tesseract Worker with optimized settings for German invoices
   */
  static async initialize(): Promise<void> {
    if (this.isInitialized && this.worker) {
      return;
    }

    try {
      console.log('Initializing Enhanced OCR Service...');
      
      // Try to load German and English languages
      try {
        this.worker = await createWorker(['deu', 'eng']);
        console.log('German and English language packs loaded');
      } catch (langError) {
        console.warn('Multi-language initialization failed, using English only:', langError);
        this.worker = await createWorker('eng');
        console.log('English language pack loaded');
      }
      
      // Optimized parameters for invoice recognition
      await this.worker.setParameters({
        tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzäöüÄÖÜß.,:-€$%/@()[]{}|_+=*&!?"\' \t\n',
        tessedit_pageseg_mode: '1', // Automatic page segmentation with OSD
        preserve_interword_spaces: '1',
        tessedit_ocr_engine_mode: '1', // LSTM only for better accuracy
        tessedit_min_confidence: '50'
      });
      
      this.isInitialized = true;
      console.log('Enhanced OCR Service successfully initialized');
    } catch (error) {
      console.error('Failed to initialize Enhanced OCR Service:', error);
      throw new ApiError(
        'Enhanced OCR Service could not be initialized',
        API_ERROR_CODES.SERVER_ERROR,
        'Tesseract Worker initialization failed'
      );
    }
  }

  /**
   * Calculate SHA-256 hash of file for duplicate detection
   */
  private static async calculateFileHash(file: File): Promise<string> {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Process invoice image with enhanced OCR
   */
  static async processInvoiceImage(file: File): Promise<EnhancedOCRResult> {
    return apiCall(async () => {
      const currentUser = await getCurrentUserProfile();

      // Initialize OCR if needed
      if (!this.isInitialized || !this.worker) {
        await this.initialize();
      }

      // Calculate file hash for duplicate detection
      const fileHash = await this.calculateFileHash(file);

      // Check for existing OCR result with same hash
      const { data: existingResult } = await supabase
        .from('ocr_results')
        .select('id')
        .eq('file_hash', fileHash)
        .eq('created_by', currentUser.id)
        .single();

      if (existingResult) {
        throw new ApiError(
          'Diese Datei wurde bereits verarbeitet',
          API_ERROR_CODES.VALIDATION_ERROR,
          'Duplicate file detected'
        );
      }

      // Convert file to base64 for storage and display
      const base64Image = await this.fileToBase64(file);
      const fileExtension = file.name.split('.').pop() || 'jpg';
      const fileName = `invoice_${Date.now()}_${fileHash.substring(0, 8)}.${fileExtension}`;

      // Extract text using Tesseract
      console.log('Starting OCR text extraction...');
      const ocrResult = await this.worker!.recognize(file);
      const extractedText = ocrResult.data.text;
      console.log('OCR text extraction completed');

      // Clean extracted text
      const cleanedText = this.cleanExtractedText(extractedText);

      // Extract structured data
      let structuredData: StructuredInvoiceData;
      let confidenceScores: DetailedConfidenceScores;

      if (isOpenAIConfigured()) {
        console.log('Using AI-enhanced data extraction...');
        try {
          const aiResult = await extractInvoiceWithAI(base64Image);
          structuredData = this.convertAIToStructuredFormat(aiResult);
          confidenceScores = this.calculateAIConfidenceScores(aiResult, structuredData);
        } catch (aiError) {
          console.warn('AI extraction failed, falling back to pattern matching:', aiError);
          structuredData = this.extractInvoiceDataEnhanced(cleanedText);
          confidenceScores = this.calculateConfidenceScores(cleanedText, structuredData);
        }
      } else {
        console.log('Using pattern-based data extraction...');
        structuredData = this.extractInvoiceDataEnhanced(cleanedText);
        confidenceScores = this.calculateConfidenceScores(cleanedText, structuredData);
      }

      // Get company_id from user profile
      const { data: employee } = await supabase
        .from('employees')
        .select('company_id')
        .eq('user_id', currentUser.id)
        .single();

      const companyId = employee?.company_id;

      // Create OCR result record
      const ocrData = {
        original_file_path: base64Image, // Store as base64 for now
        original_filename: file.name,
        file_hash: fileHash,
        filesize: file.size,
        mime_type: file.type,
        page_count: 1,
        ocr_engine: this.OCR_ENGINE,
        ocr_engine_version: this.OCR_VERSION,
        version: 1,
        extracted_text: extractedText,
        structured_data: structuredData,
        confidence_scores: confidenceScores,
        status: 'pending' as const,
        company_id: companyId,
        created_by: currentUser.id,
      };

      const query = supabase
        .from('ocr_results')
        .insert(ocrData)
        .select()
        .single();

      const result = await createQuery<EnhancedOCRResult>(query).executeSingle();

      // Create audit log entry
      try {
        await AuditLogService.createAuditLog({
          entity_type: 'ocr_results',
          entity_id: result.id,
          action: 'INSERT',
          new_values: result,
          reason: 'OCR processing completed'
        });
      } catch (auditError) {
        console.warn('Failed to create audit log:', auditError);
      }

      // Emit event
      eventBus.emit('OCR_PROCESSED', {
        ocr_id: result.id,
        confidence: confidenceScores.overall,
        supplier_name: structuredData.supplier.name,
        user_id: currentUser.id,
        company_id: companyId
      });

      return result;
    }, 'Process invoice with Enhanced OCR');
  }

  /**
   * Import validated OCR result using the new RPC function
   */
  static async importInvoiceFromOCR(
    ocrId: string,
    autoApprove: boolean = false
  ): Promise<{ success: boolean; invoice_id?: string; error?: string; details?: any }> {
    return apiCall(async () => {
      const currentUser = await getCurrentUserProfile();

      // Get company_id
      const { data: employee } = await supabase
        .from('employees')
        .select('company_id')
        .eq('user_id', currentUser.id)
        .single();

      if (!employee?.company_id) {
        throw new ApiError(
          'Company not found for user',
          API_ERROR_CODES.VALIDATION_ERROR,
          'User is not associated with a company'
        );
      }

      // Call the import RPC function
      const { data: importResult, error } = await supabase
        .rpc('rpc_import_supplier_invoice_from_ocr', {
          p_ocr_result_id: ocrId,
          p_company_id: employee.company_id,
          p_auto_approve: autoApprove
        });

      if (error) {
        throw new ApiError(
          'Invoice import failed',
          API_ERROR_CODES.SERVER_ERROR,
          error.message
        );
      }

      // Emit event on successful import
      if (importResult.success) {
        eventBus.emit('INVOICE_IMPORTED', {
          ocr_id: ocrId,
          invoice_id: importResult.invoice_id,
          supplier_id: importResult.supplier_id,
          user_id: currentUser.id,
          company_id: employee.company_id
        });
      }

      return importResult;
    }, 'Import invoice from OCR');
  }

  /**
   * Enhanced data extraction with new structured format
   */
  private static extractInvoiceDataEnhanced(text: string): StructuredInvoiceData {
    const cleanText = this.cleanExtractedText(text);
    
    // Extract basic invoice information
    const invoiceNumber = this.extractInvoiceNumber(cleanText);
    const dates = this.extractDates(cleanText);
    const supplier = this.extractSupplierInfo(cleanText);
    const amounts = this.extractAmounts(cleanText);
    const taxes = this.extractTaxInfo(cleanText);
    const items = this.extractLineItems(cleanText);

    return {
      supplier: {
        name: supplier.name || 'Unknown Supplier',
        vat_id: supplier.vatId,
        iban: supplier.iban,
        address: supplier.address
      },
      invoice: {
        number: invoiceNumber || 'Unknown',
        date: dates.invoiceDate || new Date().toISOString().split('T')[0],
        due_date: dates.dueDate,
        currency: 'EUR',
        payment_terms: this.extractPaymentTerms(cleanText)
      },
      totals: {
        net: amounts.net || 0,
        gross: amounts.gross || amounts.total || 0,
        taxes: taxes.length > 0 ? taxes : [{
          rate: amounts.vatRate || 19,
          base: amounts.net || 0,
          amount: amounts.vat || 0,
          type: 'standard' as const
        }]
      },
      items: items.length > 0 ? items : undefined,
      references: {
        project_id: undefined,
        order_id: undefined
      }
    };
  }

  /**
   * Extract supplier information from text
   */
  private static extractSupplierInfo(text: string): {
    name?: string;
    vatId?: string;
    iban?: string;
    address?: string;
  } {
    // Company name patterns (usually at the beginning)
    const companyPatterns = [
      /^([A-Z][A-Za-zäöüÄÖÜß\s&.-]+(?:GmbH|AG|KG|OHG|UG|e\.K\.|Ltd|Inc|Corp))/m,
      /([A-Z][A-Za-zäöüÄÖÜß\s&.-]+(?:GmbH|AG|KG|OHG|UG|e\.K\.|Ltd|Inc|Corp))/,
      /^([A-Z][A-Za-zäöüÄÖÜß\s&.-]{3,50})/m
    ];

    let name: string | undefined;
    for (const pattern of companyPatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        name = match[1].trim();
        break;
      }
    }

    // VAT ID patterns
    const vatPatterns = [
      /(?:USt[.-]?IdNr\.?|VAT[.-]?ID|Ust[.-]?ID)[:\s]*([A-Z]{2}[0-9A-Z]{8,12})/i,
      /DE[0-9]{9}/,
      /([A-Z]{2}[0-9A-Z]{8,12})/
    ];

    let vatId: string | undefined;
    for (const pattern of vatPatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        vatId = match[1];
        break;
      } else if (match && match[0] && match[0].startsWith('DE')) {
        vatId = match[0];
        break;
      }
    }

    // IBAN patterns
    const ibanPattern = /([A-Z]{2}[0-9]{2}[A-Z0-9]{4}[0-9]{7}[A-Z0-9]{0,16})/;
    const ibanMatch = text.match(ibanPattern);
    const iban = ibanMatch ? ibanMatch[1] : undefined;

    return { name, vatId, iban };
  }

  /**
   * Extract tax information
   */
  private static extractTaxInfo(text: string): Array<{
    rate: number;
    base: number;
    amount: number;
    type: 'standard' | 'reduced' | 'reverse_charge' | 'exempt';
  }> {
    const taxes: Array<{
      rate: number;
      base: number;
      amount: number;
      type: 'standard' | 'reduced' | 'reverse_charge' | 'exempt';
    }> = [];

    // Look for tax breakdown tables
    const taxPatterns = [
      /(\d{1,2}(?:[,.]\d{1,2})?)\s*%.*?(\d+[,.]\d{2}).*?(\d+[,.]\d{2})/g,
      /(?:MwSt|USt|VAT)[.,:\s]*(\d{1,2}(?:[,.]\d{1,2})?)\s*%[.,:\s]*(\d+[,.]\d{2})/gi
    ];

    for (const pattern of taxPatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const rate = parseFloat(match[1].replace(',', '.'));
        const base = match[2] ? this.parseAmount(match[2]) : 0;
        const amount = match[3] ? this.parseAmount(match[3]) : 0;

        if (rate >= 0 && rate <= 100 && amount > 0) {
          taxes.push({
            rate,
            base,
            amount,
            type: rate === 19 ? 'standard' : rate === 7 ? 'reduced' : 'standard'
          });
        }
      }
    }

    return taxes;
  }

  /**
   * Extract line items from invoice
   */
  private static extractLineItems(text: string): Array<{
    pos?: number;
    description: string;
    qty: number;
    unit?: string;
    unit_price: number;
    net: number;
    tax_rate: number;
  }> {
    const items: Array<{
      pos?: number;
      description: string;
      qty: number;
      unit?: string;
      unit_price: number;
      net: number;
      tax_rate: number;
    }> = [];

    // Look for table-like structures with positions
    const lines = text.split('\n');
    let inItemSection = false;

    for (const line of lines) {
      // Detect if we're in the items section
      if (/(?:pos|artikel|beschreibung|menge|preis)/i.test(line)) {
        inItemSection = true;
        continue;
      }

      if (inItemSection) {
        // Stop if we reach totals section
        if (/(?:summe|gesamt|netto|brutto|mwst|total)/i.test(line)) {
          break;
        }

        // Try to parse item line
        const itemMatch = line.match(/(\d+)?\s+(.+?)\s+(\d+(?:[.,]\d+)?)\s+([A-Za-z]+)?\s+(\d+(?:[.,]\d{2,4})?)\s+(\d+(?:[.,]\d{2}))/);
        
        if (itemMatch) {
          const pos = itemMatch[1] ? parseInt(itemMatch[1]) : undefined;
          const description = itemMatch[2].trim();
          const qty = parseFloat(itemMatch[3].replace(',', '.'));
          const unit = itemMatch[4] || 'Stk';
          const unitPrice = this.parseAmount(itemMatch[5]);
          const netAmount = this.parseAmount(itemMatch[6]);

          if (description.length > 2 && qty > 0 && unitPrice > 0 && netAmount > 0) {
            items.push({
              pos,
              description,
              qty,
              unit,
              unit_price: unitPrice,
              net: netAmount,
              tax_rate: 19 // Default tax rate, should be determined from context
            });
          }
        }
      }
    }

    return items;
  }

  /**
   * Calculate detailed confidence scores
   */
  private static calculateConfidenceScores(
    text: string, 
    data: StructuredInvoiceData
  ): DetailedConfidenceScores {
    const scores: DetailedConfidenceScores = {
      overall: 0,
      'invoice.number': 0,
      'invoice.date': 0,
      'supplier.name': 0,
      'totals.gross': 0
    };

    // Base confidence on data completeness and text quality
    const textQuality = this.assessTextQuality(text);
    
    // Invoice number confidence
    scores['invoice.number'] = this.hasValidInvoiceNumber(data.invoice.number) ? 0.9 : 0.3;
    
    // Date confidence
    scores['invoice.date'] = this.isValidDate(data.invoice.date) ? 0.95 : 0.2;
    
    // Supplier name confidence
    scores['supplier.name'] = data.supplier.name.length > 3 ? 0.8 : 0.3;
    
    // Amount confidence
    scores['totals.gross'] = data.totals.gross > 0 ? 0.85 : 0.1;

    // VAT ID confidence if present
    if (data.supplier.vat_id) {
      scores['supplier.vat_id'] = this.isValidVatId(data.supplier.vat_id) ? 0.95 : 0.4;
    }

    // Calculate overall confidence
    const scoreValues = Object.values(scores).filter(s => typeof s === 'number' && s > 0) as number[];
    scores.overall = scoreValues.reduce((sum, score) => sum + score, 0) / scoreValues.length;

    return scores;
  }

  /**
   * Utility methods
   */
  private static hasValidInvoiceNumber(number: string): boolean {
    return number !== 'Unknown' && number.length >= 3 && /[0-9]/.test(number);
  }

  private static isValidDate(dateStr: string): boolean {
    const date = new Date(dateStr);
    return !isNaN(date.getTime()) && 
           date > new Date('2020-01-01') && 
           date < new Date(Date.now() + 86400000 * 30); // Not more than 30 days in future
  }

  private static isValidVatId(vatId: string): boolean {
    return /^[A-Z]{2}[0-9A-Z]{8,12}$/.test(vatId);
  }

  private static assessTextQuality(text: string): number {
    // Simple text quality assessment
    const words = text.split(/\s+/).filter(w => w.length > 2);
    const avgWordLength = words.reduce((sum, w) => sum + w.length, 0) / words.length;
    const numberCount = (text.match(/\d/g) || []).length;
    const specialCharCount = (text.match(/[€$%@]/g) || []).length;
    
    // Higher score for balanced text with numbers and reasonable word length
    if (avgWordLength > 2 && avgWordLength < 12 && numberCount > 5 && specialCharCount > 0) {
      return 0.8;
    }
    return 0.5;
  }

  // Include existing utility methods from original OCRService
  private static fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  }

  private static cleanExtractedText(text: string): string {
    return text
      .replace(/[^\w\säöüÄÖÜß.,;:()\[\]{}€$%@\-+*/_=|"'!?]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private static parseAmount(amountStr: string): number {
    if (!amountStr) return 0;
    return parseFloat(amountStr.replace(/[^\d,.-]/g, '').replace(',', '.')) || 0;
  }

  private static extractInvoiceNumber(text: string): string | undefined {
    const patterns = [
      /(?:Rechnung(?:s-?Nr\.?|snummer)|Invoice(?:\s+No\.?|[\s-]?Number)|Rechnungs?-?Nr\.?)[:\s]*([A-Z0-9\/-]+)/i,
      /Nr\.?\s*([A-Z0-9\/-]{3,})/i
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    return undefined;
  }

  private static extractDates(text: string): { invoiceDate?: string; dueDate?: string } {
    // Enhanced date extraction logic would go here
    const datePattern = /(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})/g;
    const dates: string[] = [];
    let match;

    while ((match = datePattern.exec(text)) !== null) {
      const day = match[1].padStart(2, '0');
      const month = match[2].padStart(2, '0');
      const year = match[3];
      dates.push(`${year}-${month}-${day}`);
    }

    return {
      invoiceDate: dates[0],
      dueDate: dates[1]
    };
  }

  private static extractAmounts(text: string): {
    net?: number;
    vat?: number;
    gross?: number;
    total?: number;
    vatRate?: number;
  } {
    // Enhanced amount extraction logic would go here
    const amountPattern = /(\d+[,.]\d{2})/g;
    const amounts = [...text.matchAll(amountPattern)].map(m => this.parseAmount(m[1]));
    
    return {
      net: amounts[0],
      vat: amounts[1],
      gross: amounts[amounts.length - 1],
      total: amounts[amounts.length - 1],
      vatRate: 19
    };
  }

  private static extractPaymentTerms(text: string): string | undefined {
    const patterns = [
      /(?:Zahlungsziel|Zahlbar|Payment terms)[:\s]*(.{5,50})/i,
      /(\d+\s+Tage(?:\s+netto)?)/i
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    return undefined;
  }

  private static convertAIToStructuredFormat(aiResult: any): StructuredInvoiceData {
    // Convert AI extraction result to our structured format
    // This would need to be implemented based on the AI service response format
    return {
      supplier: {
        name: aiResult.supplierName || 'Unknown',
        vat_id: aiResult.supplierVatId,
        iban: aiResult.iban
      },
      invoice: {
        number: aiResult.invoiceNumber || 'Unknown',
        date: aiResult.date || new Date().toISOString().split('T')[0],
        due_date: aiResult.dueDate,
        currency: 'EUR'
      },
      totals: {
        net: aiResult.netAmount || 0,
        gross: aiResult.totalAmount || 0,
        taxes: [{
          rate: aiResult.vatRate || 19,
          base: aiResult.netAmount || 0,
          amount: aiResult.vatAmount || 0,
          type: 'standard'
        }]
      }
    };
  }

  private static calculateAIConfidenceScores(
    aiResult: any, 
    data: StructuredInvoiceData
  ): DetailedConfidenceScores {
    // Calculate confidence scores from AI extraction
    return {
      overall: aiResult.confidence || 0.8,
      'invoice.number': 0.9,
      'invoice.date': 0.9,
      'supplier.name': 0.85,
      'totals.gross': 0.9
    };
  }
}

export default EnhancedOCRService;