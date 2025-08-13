import { supabase } from '@/integrations/supabase/client';
import { z } from 'zod';
import { apiCall, createQuery, validateInput, getCurrentUserProfile, ApiError, API_ERROR_CODES } from './common';
import { auditLogService } from './auditLogService';
import { eventBus } from './eventBus';

// DATEV-specific types for German accounting
export type DATEVAccountingPeriod = {
  year: number;
  quarter: 1 | 2 | 3 | 4;
  month?: number;
  from_date: string;
  to_date: string;
};

export type DATEVTransactionType = 
  | 'INVOICE' 
  | 'CREDIT_NOTE' 
  | 'PAYMENT_RECEIVED' 
  | 'PAYMENT_SENT' 
  | 'EXPENSE' 
  | 'BANK_TRANSFER'
  | 'VAT_CORRECTION'
  | 'DEPRECIATION'
  | 'OPENING_BALANCE';

export type DATEVVATRate = 0 | 7 | 19; // German VAT rates: 0%, 7%, 19%

export interface DATEVTransaction {
  id: string;
  transaction_type: DATEVTransactionType;
  booking_date: string; // Buchungsdatum
  value_date: string; // Valutadatum
  document_number: string; // Belegnummer
  debit_account: string; // Sollkonto (4-stellig)
  credit_account: string; // Habenkonto (4-stellig)
  amount: number; // Betrag in Euro (ohne Vorzeichen)
  vat_rate: DATEVVATRate;
  vat_amount: number;
  net_amount: number;
  currency: string; // EUR
  booking_text: string; // Buchungstext (max 60 Zeichen)
  customer_vendor_number?: string; // Kunden-/Lieferantennummer
  cost_center?: string; // Kostenstelle
  cost_object?: string; // Kostenträger
  invoice_reference?: string; // Rechnungsreferenz
  payment_reference?: string; // Zahlungsreferenz
  exchange_rate?: number; // Wechselkurs (bei Fremdwährung)
  bu_code?: string; // BU-Schlüssel (Umsatzsteuer)
  posting_key?: string; // Buchungsschlüssel
}

export interface DATEVCSVExport {
  id: string;
  export_period: DATEVAccountingPeriod;
  transactions: DATEVTransaction[];
  total_transactions: number;
  total_amount: number;
  csv_content: string;
  file_name: string;
  created_at: string;
  created_by: string;
  export_type: 'FULL' | 'INCREMENTAL';
  datev_version: string; // DATEV Format version
  consultant_number?: string; // Berater-Nr.
  client_number?: string; // Mandanten-Nr.
}

export interface DATEVAccountMapping {
  id: string;
  entity_type: 'customer' | 'supplier' | 'employee' | 'bank' | 'expense_category';
  entity_id: string;
  datev_account: string; // 4-8 digit DATEV account number
  account_type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
  account_name: string;
  vat_treatment: 'TAXABLE' | 'TAX_FREE' | 'REVERSE_CHARGE' | 'EU_INTRA';
  is_active: boolean;
  created_at: string;
}

export interface DATEVVATMapping {
  vat_rate: DATEVVATRate;
  bu_code: string; // BU-Schlüssel für DATEV
  account_revenue: string; // Erlöskonto
  account_vat_out: string; // Umsatzsteuerkonto
  account_vat_in: string; // Vorsteuerkonto
  description: string;
}

// German accounting constants
const DATEV_CONSTANTS = {
  // Standard German chart of accounts (SKR03/SKR04)
  ACCOUNTS: {
    CASH: '1000',
    BANK_MAIN: '1200',
    ACCOUNTS_RECEIVABLE: '1400',
    ACCOUNTS_PAYABLE: '1600',
    VAT_IN: '1576', // Vorsteuer 19%
    VAT_IN_7: '1571', // Vorsteuer 7%
    VAT_OUT: '1776', // Umsatzsteuer 19%
    VAT_OUT_7: '1771', // Umsatzsteuer 7%
    REVENUE_19: '8400', // Erlöse 19% USt
    REVENUE_7: '8300', // Erlöse 7% USt
    REVENUE_0: '8100', // Steuerfreie Erlöse
    EXPENSES: '4400',
    BANK_CHARGES: '6855',
  },
  
  // German VAT (Umsatzsteuer) BU-Codes
  BU_CODES: {
    UST_19: '1', // 19% Umsatzsteuer
    UST_7: '2', // 7% Umsatzsteuer
    UST_0: '0', // Steuerfrei
    VST_19: '9', // 19% Vorsteuer
    VST_7: '5', // 7% Vorsteuer
    EU_UST: '3', // Innergemeinschaftliche Lieferung
    REVERSE_CHARGE: '21', // Reverse Charge
  },

  // DATEV CSV format specifications
  CSV_HEADERS: [
    'Umsatz (ohne Soll/Haben-Kz)',
    'Soll/Haben-Kennzeichen',
    'WKZ Umsatz',
    'Kurs',
    'Basis-Umsatz',
    'WKZ Basis-Umsatz',
    'Konto',
    'Gegenkonto (ohne BU-Schlüssel)',
    'BU-Schlüssel',
    'Belegdatum',
    'Belegfeld 1',
    'Belegfeld 2',
    'Skonto',
    'Buchungstext',
    'Postensperre',
    'Diverse Adressnummer',
    'Geschäftspartnerbank',
    'Sachverhalt',
    'Zinssperre',
    'Beleglink',
    'Beleginfo - Art 1',
    'Beleginfo - Inhalt 1',
    'Beleginfo - Art 2',
    'Beleginfo - Inhalt 2',
    'Beleginfo - Art 3',
    'Beleginfo - Inhalt 3',
    'Beleginfo - Art 4',
    'Beleginfo - Inhalt 4',
    'Beleginfo - Art 5',
    'Beleginfo - Inhalt 5',
    'Beleginfo - Art 6',
    'Beleginfo - Inhalt 6',
    'Beleginfo - Art 7',
    'Beleginfo - Inhalt 7',
    'Beleginfo - Art 8',
    'Beleginfo - Inhalt 8',
    'KOST1 - Kostenstelle',
    'KOST2 - Kostenträger',
    'Kost-Menge',
    'EU-Land u. UStID',
    'EU-Steuersatz',
    'Abw. Versteuerungsart',
    'Sachverhalt L+L',
    'Funktionsergänzung L+L',
    'BU 49 Hauptfunktionstyp',
    'BU 49 Hauptfunktionsnummer',
    'BU 49 Funktionsergänzung',
    'Zusatzinformation - Art 1',
    'Zusatzinformation - Inhalt 1',
    'Zusatzinformation - Art 2',
    'Zusatzinformation - Inhalt 2',
    'Zusatzinformation - Art 3',
    'Zusatzinformation - Inhalt 3',
    'Zusatzinformation - Art 4',
    'Zusatzinformation - Inhalt 4',
    'Zusatzinformation - Art 5',
    'Zusatzinformation - Inhalt 5',
    'Zusatzinformation - Art 6',
    'Zusatzinformation - Inhalt 6',
    'Zusatzinformation - Art 7',
    'Zusatzinformation - Inhalt 7',
    'Zusatzinformation - Art 8',
    'Zusatzinformation - Inhalt 8',
    'Zusatzinformation - Art 9',
    'Zusatzinformation - Inhalt 9',
    'Zusatzinformation - Art 10',
    'Zusatzinformation - Inhalt 10',
    'Stück',
    'Gewicht',
    'Zahlweise',
    'Forderungsart',
    'Veranlagungsjahr',
    'Zugeordnete Fälligkeit',
    'Skontotyp',
    'Auftragsnummer',
    'Buchungstyp',
    'Ust-Schlüssel (Anzahlungen)',
    'EU-Land (Anzahlungen)',
    'Sachverhalt L+L (Anzahlungen)',
    'EU-Steuersatz (Anzahlungen)',
    'Erlöskonto (Anzahlungen)',
    'Herkunft-Kz',
    'Leerfeld',
    'KOST-Datum',
    'Mandatsreferenz',
    'Skontosperre',
    'Gesellschaftername',
    'Beteiligtennummer',
    'Identifikationsnummer',
    'Zeichnernummer',
    'Postensperre bis',
    'Bezeichnung SoBil-Sachverhalt',
    'Kennzeichen SoBil-Buchung',
    'Festschreibung',
    'Leistungsdatum',
    'Datum Zuord.Steuerperiode'
  ]
};

// Zod schemas
const DATEVPeriodSchema = z.object({
  year: z.number().min(2020).max(2030),
  quarter: z.number().min(1).max(4).optional(),
  month: z.number().min(1).max(12).optional(),
  from_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export class DATEVService {

  /**
   * Generate DATEV CSV export for a specific period
   */
  static async generateDATEVExport(
    period: DATEVAccountingPeriod,
    exportType: 'FULL' | 'INCREMENTAL' = 'FULL',
    consultantNumber?: string,
    clientNumber?: string
  ): Promise<DATEVCSVExport> {
    return apiCall(async () => {
      const validatedPeriod = validateInput(DATEVPeriodSchema, period);
      const currentUser = await getCurrentUserProfile();

      // Get all financial transactions for the period
      const transactions = await this.getTransactionsForPeriod(validatedPeriod);

      // Convert to DATEV format
      const datevTransactions = await this.convertToDATEVTransactions(transactions);

      // Generate CSV content
      const csvContent = this.generateCSVContent(datevTransactions, consultantNumber, clientNumber);

      // Generate filename
      const fileName = this.generateFileName(validatedPeriod, exportType);

      const exportData = {
        export_period: validatedPeriod,
        transactions: datevTransactions,
        total_transactions: datevTransactions.length,
        total_amount: datevTransactions.reduce((sum, t) => sum + t.amount, 0),
        csv_content: csvContent,
        file_name: fileName,
        created_by: currentUser.id,
        export_type: exportType,
        datev_version: 'EXTF_700',
        consultant_number: consultantNumber,
        client_number: clientNumber,
      };

      // Save export to database
      const query = supabase
        .from('datev_exports')
        .insert(exportData)
        .select()
        .single();

      const exportRecord = await createQuery<DATEVCSVExport>(query).executeSingle();

      // Create audit log
      await auditLogService.createAuditLog({
        entity_type: 'document',
        entity_id: exportRecord.id,
        action: 'EXPORT',
        new_values: {
          export_type: exportType,
          period: validatedPeriod,
          transaction_count: datevTransactions.length,
          total_amount: exportData.total_amount,
        },
        reason: `DATEV CSV Export generiert für Periode ${period.from_date} - ${period.to_date}`,
      });

      // Emit event
      eventBus.emit('DATEV_EXPORT_CREATED', {
        export_id: exportRecord.id,
        period: validatedPeriod,
        transaction_count: datevTransactions.length,
        user_id: currentUser.id,
      });

      return exportRecord;
    }, 'Generate DATEV export');
  }

  /**
   * Get account mapping for DATEV integration
   */
  static async getAccountMapping(
    entityType: string,
    entityId: string
  ): Promise<DATEVAccountMapping | null> {
    return apiCall(async () => {
      const query = supabase
        .from('datev_account_mappings')
        .select('*')
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .eq('is_active', true)
        .single();

      try {
        return await createQuery<DATEVAccountMapping>(query).executeSingle();
      } catch (error) {
        // Return null if no mapping found
        return null;
      }
    }, 'Get account mapping');
  }

  /**
   * Create or update account mapping
   */
  static async setAccountMapping(
    entityType: string,
    entityId: string,
    datevAccount: string,
    accountType: string,
    accountName: string,
    vatTreatment: string = 'TAXABLE'
  ): Promise<DATEVAccountMapping> {
    return apiCall(async () => {
      const mappingData = {
        entity_type: entityType,
        entity_id: entityId,
        datev_account: datevAccount,
        account_type: accountType,
        account_name: accountName,
        vat_treatment: vatTreatment,
        is_active: true,
      };

      // Upsert mapping
      const query = supabase
        .from('datev_account_mappings')
        .upsert(mappingData, { onConflict: 'entity_type,entity_id' })
        .select()
        .single();

      const mapping = await createQuery<DATEVAccountMapping>(query).executeSingle();

      // Create audit log
      await auditLogService.createAuditLog({
        entity_type: 'document',
        entity_id: mapping.id,
        action: 'UPDATE',
        new_values: mappingData,
        reason: `DATEV Kontozuordnung aktualisiert: ${entityType} ${entityId} → Konto ${datevAccount}`,
      });

      return mapping;
    }, 'Set account mapping');
  }

  /**
   * Get available VAT mappings
   */
  static async getVATMappings(): Promise<DATEVVATMapping[]> {
    return [
      {
        vat_rate: 19,
        bu_code: DATEV_CONSTANTS.BU_CODES.UST_19,
        account_revenue: DATEV_CONSTANTS.ACCOUNTS.REVENUE_19,
        account_vat_out: DATEV_CONSTANTS.ACCOUNTS.VAT_OUT,
        account_vat_in: DATEV_CONSTANTS.ACCOUNTS.VAT_IN,
        description: 'Standardsteuersatz 19%'
      },
      {
        vat_rate: 7,
        bu_code: DATEV_CONSTANTS.BU_CODES.UST_7,
        account_revenue: DATEV_CONSTANTS.ACCOUNTS.REVENUE_7,
        account_vat_out: DATEV_CONSTANTS.ACCOUNTS.VAT_OUT_7,
        account_vat_in: DATEV_CONSTANTS.ACCOUNTS.VAT_IN_7,
        description: 'Ermäßigter Steuersatz 7%'
      },
      {
        vat_rate: 0,
        bu_code: DATEV_CONSTANTS.BU_CODES.UST_0,
        account_revenue: DATEV_CONSTANTS.ACCOUNTS.REVENUE_0,
        account_vat_out: DATEV_CONSTANTS.ACCOUNTS.REVENUE_0,
        account_vat_in: DATEV_CONSTANTS.ACCOUNTS.REVENUE_0,
        description: 'Steuerfrei/nicht steuerbar'
      }
    ];
  }

  /**
   * Validate DATEV format compliance
   */
  static async validateDATEVCompliance(
    transactions: DATEVTransaction[]
  ): Promise<{
    is_valid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    for (const transaction of transactions) {
      // Account number validation
      if (!this.isValidAccountNumber(transaction.debit_account)) {
        errors.push(`Ungültige Sollkonto-Nummer: ${transaction.debit_account}`);
      }
      if (!this.isValidAccountNumber(transaction.credit_account)) {
        errors.push(`Ungültige Habenkonto-Nummer: ${transaction.credit_account}`);
      }

      // Amount validation
      if (transaction.amount <= 0) {
        errors.push(`Ungültiger Betrag: ${transaction.amount}`);
      }

      // VAT validation
      if (![0, 7, 19].includes(transaction.vat_rate)) {
        errors.push(`Ungültiger USt-Satz: ${transaction.vat_rate}%`);
      }

      // Date validation
      if (!this.isValidDate(transaction.booking_date)) {
        errors.push(`Ungültiges Buchungsdatum: ${transaction.booking_date}`);
      }

      // Text length validation
      if (transaction.booking_text.length > 60) {
        warnings.push(`Buchungstext zu lang (${transaction.booking_text.length} Zeichen): ${transaction.booking_text.substring(0, 30)}...`);
      }

      // Document number validation
      if (!transaction.document_number || transaction.document_number.length > 36) {
        errors.push(`Ungültige Belegnummer: ${transaction.document_number}`);
      }
    }

    return {
      is_valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  // ============================================
  // PRIVATE HELPER METHODS
  // ============================================

  private static async getTransactionsForPeriod(
    period: DATEVAccountingPeriod
  ): Promise<any[]> {
    const transactions = [];

    // Get invoices
    const invoiceQuery = supabase
      .from('invoices')
      .select(`
        *,
        customers (company_name, customer_number),
        invoice_items (*)
      `)
      .gte('invoice_date', period.from_date)
      .lte('invoice_date', period.to_date)
      .neq('status', 'draft');

    const invoices = await createQuery(invoiceQuery).execute();
    transactions.push(...invoices.map(inv => ({ ...inv, _type: 'invoice' })));

    // Get payments
    const paymentQuery = supabase
      .from('payments')
      .select('*')
      .gte('payment_date', period.from_date)
      .lte('payment_date', period.to_date);

    const payments = await createQuery(paymentQuery).execute();
    transactions.push(...payments.map(pay => ({ ...pay, _type: 'payment' })));

    // Get expenses
    const expenseQuery = supabase
      .from('expenses')
      .select('*')
      .gte('expense_date', period.from_date)
      .lte('expense_date', period.to_date)
      .not('approved_at', 'is', null);

    const expenses = await createQuery(expenseQuery).execute();
    transactions.push(...expenses.map(exp => ({ ...exp, _type: 'expense' })));

    return transactions;
  }

  private static async convertToDATEVTransactions(
    transactions: any[]
  ): Promise<DATEVTransaction[]> {
    const datevTransactions: DATEVTransaction[] = [];

    for (const transaction of transactions) {
      switch (transaction._type) {
        case 'invoice':
          datevTransactions.push(...await this.convertInvoiceToDATEV(transaction));
          break;
        case 'payment':
          datevTransactions.push(await this.convertPaymentToDATEV(transaction));
          break;
        case 'expense':
          datevTransactions.push(await this.convertExpenseToDATEV(transaction));
          break;
      }
    }

    return datevTransactions;
  }

  private static async convertInvoiceToDATEV(invoice: any): Promise<DATEVTransaction[]> {
    const transactions: DATEVTransaction[] = [];
    const vatRate: DATEVVATRate = invoice.tax_rate || 19;
    const vatMapping = (await this.getVATMappings()).find(m => m.vat_rate === vatRate);

    // Customer account mapping
    const customerMapping = await this.getAccountMapping('customer', invoice.customer_id);
    const customerAccount = customerMapping?.datev_account || DATEV_CONSTANTS.ACCOUNTS.ACCOUNTS_RECEIVABLE;

    // Main revenue transaction
    transactions.push({
      id: `invoice_${invoice.id}_revenue`,
      transaction_type: 'INVOICE',
      booking_date: invoice.invoice_date,
      value_date: invoice.invoice_date,
      document_number: invoice.invoice_number,
      debit_account: customerAccount,
      credit_account: vatMapping?.account_revenue || DATEV_CONSTANTS.ACCOUNTS.REVENUE_19,
      amount: invoice.amount,
      vat_rate: vatRate,
      vat_amount: invoice.tax_amount || 0,
      net_amount: invoice.amount - (invoice.tax_amount || 0),
      currency: 'EUR',
      booking_text: `Rechnung ${invoice.invoice_number}${invoice.customers?.company_name ? ` - ${invoice.customers.company_name}` : ''}`.substring(0, 60),
      customer_vendor_number: invoice.customers?.customer_number,
      invoice_reference: invoice.invoice_number,
      bu_code: vatMapping?.bu_code,
    });

    // VAT transaction (if applicable)
    if (invoice.tax_amount && invoice.tax_amount > 0) {
      transactions.push({
        id: `invoice_${invoice.id}_vat`,
        transaction_type: 'INVOICE',
        booking_date: invoice.invoice_date,
        value_date: invoice.invoice_date,
        document_number: invoice.invoice_number,
        debit_account: customerAccount,
        credit_account: vatMapping?.account_vat_out || DATEV_CONSTANTS.ACCOUNTS.VAT_OUT,
        amount: invoice.tax_amount,
        vat_rate: 0, // VAT account itself is not taxed
        vat_amount: 0,
        net_amount: invoice.tax_amount,
        currency: 'EUR',
        booking_text: `USt ${vatRate}% RE ${invoice.invoice_number}`.substring(0, 60),
        customer_vendor_number: invoice.customers?.customer_number,
        invoice_reference: invoice.invoice_number,
        bu_code: '0', // No VAT on VAT account
      });
    }

    return transactions;
  }

  private static async convertPaymentToDATEV(payment: any): Promise<DATEVTransaction> {
    return {
      id: `payment_${payment.id}`,
      transaction_type: 'PAYMENT_RECEIVED',
      booking_date: payment.payment_date,
      value_date: payment.payment_date,
      document_number: payment.payment_reference || `PAY-${payment.id}`,
      debit_account: DATEV_CONSTANTS.ACCOUNTS.BANK_MAIN,
      credit_account: DATEV_CONSTANTS.ACCOUNTS.ACCOUNTS_RECEIVABLE,
      amount: payment.amount,
      vat_rate: 0, // Payments are not subject to VAT
      vat_amount: 0,
      net_amount: payment.amount,
      currency: 'EUR',
      booking_text: `Zahlungseingang ${payment.payment_reference || ''}`.substring(0, 60),
      payment_reference: payment.payment_reference,
      bu_code: '0',
    };
  }

  private static async convertExpenseToDATEV(expense: any): Promise<DATEVTransaction> {
    const vatRate: DATEVVATRate = expense.tax_rate || 19;
    const vatMapping = (await this.getVATMappings()).find(m => m.vat_rate === vatRate);

    return {
      id: `expense_${expense.id}`,
      transaction_type: 'EXPENSE',
      booking_date: expense.expense_date,
      value_date: expense.expense_date,
      document_number: expense.receipt_number || `EXP-${expense.id}`,
      debit_account: DATEV_CONSTANTS.ACCOUNTS.EXPENSES,
      credit_account: DATEV_CONSTANTS.ACCOUNTS.ACCOUNTS_PAYABLE,
      amount: expense.amount,
      vat_rate: vatRate,
      vat_amount: expense.tax_amount || 0,
      net_amount: expense.amount - (expense.tax_amount || 0),
      currency: 'EUR',
      booking_text: `Ausgabe ${expense.description}`.substring(0, 60),
      cost_center: expense.cost_center,
      bu_code: vatMapping?.bu_code,
    };
  }

  private static generateCSVContent(
    transactions: DATEVTransaction[],
    consultantNumber?: string,
    clientNumber?: string
  ): string {
    const rows: string[] = [];

    // DATEV header row
    const headerData = [
      'EXTF', // Data exchange format
      '700', // Version
      '1', // Format category
      'Buchungsstapel', // Format name
      '7', // Format version
      new Date().toISOString().split('T')[0].replace(/-/g, ''), // Created date
      '', // Time
      '', // Import
      'HandwerkOS', // Origin
      '', // Import user
      consultantNumber || '', // Consultant number
      clientNumber || '', // Client number
      '', // WJ-Beginn
      '', // Sachkontenlänge
      '', // Date from
      '', // Date to
      '', // Currency
    ];

    rows.push(headerData.map(field => `"${field}"`).join(';'));

    // Column headers
    rows.push(DATEV_CONSTANTS.CSV_HEADERS.map(header => `"${header}"`).join(';'));

    // Transaction rows
    for (const transaction of transactions) {
      const row = this.transactionToCSVRow(transaction);
      rows.push(row);
    }

    return rows.join('\r\n');
  }

  private static transactionToCSVRow(transaction: DATEVTransaction): string {
    const formatAmount = (amount: number) => amount.toFixed(2).replace('.', ',');
    const formatDate = (date: string) => date.replace(/-/g, '');

    const fields = [
      formatAmount(transaction.amount), // Umsatz
      'S', // Soll/Haben (S = Soll)
      'EUR', // WKZ Umsatz
      '', // Kurs
      formatAmount(transaction.net_amount), // Basis-Umsatz
      'EUR', // WKZ Basis-Umsatz
      transaction.debit_account, // Konto
      transaction.credit_account, // Gegenkonto
      transaction.bu_code || '', // BU-Schlüssel
      formatDate(transaction.booking_date), // Belegdatum
      transaction.document_number, // Belegfeld 1
      '', // Belegfeld 2
      '', // Skonto
      transaction.booking_text, // Buchungstext
      '', // Postensperre
      transaction.customer_vendor_number || '', // Diverse Adressnummer
      '', // Geschäftspartnerbank
      '', // Sachverhalt
      '', // Zinssperre
      '', // Beleglink
    ];

    // Fill remaining fields with empty strings
    while (fields.length < DATEV_CONSTANTS.CSV_HEADERS.length) {
      fields.push('');
    }

    return fields.map(field => `"${field}"`).join(';');
  }

  private static generateFileName(
    period: DATEVAccountingPeriod,
    exportType: 'FULL' | 'INCREMENTAL'
  ): string {
    const dateStr = period.from_date.replace(/-/g, '');
    const typeStr = exportType === 'FULL' ? 'FULL' : 'INCR';
    return `DATEV_${typeStr}_${dateStr}.csv`;
  }

  private static isValidAccountNumber(account: string): boolean {
    return /^\d{4,8}$/.test(account);
  }

  private static isValidDate(dateStr: string): boolean {
    const date = new Date(dateStr);
    return date instanceof Date && !isNaN(date.getTime());
  }
}

export const datevService = DATEVService;