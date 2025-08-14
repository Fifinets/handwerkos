import { supabase } from '@/integrations/supabase/client';
import { z } from 'zod';
import { apiCall, createQuery, validateInput, getCurrentUserProfile, ApiError, API_ERROR_CODES } from './common';
import { auditLogService } from './auditLogService';
import { eventBus } from './eventBus';

// German accounting specific types
export type GermanAccountingPeriod = {
  year: number;
  quarter?: 1 | 2 | 3 | 4;
  month?: number;
  period_type: 'MONTHLY' | 'QUARTERLY' | 'ANNUAL';
  start_date: string;
  end_date: string;
  is_closed: boolean;
  ustva_submitted?: boolean; // Umsatzsteuervoranmeldung submitted
};

export type GermanVATType = 
  | 'STANDARD_19' // Regelsteuersatz 19%
  | 'REDUCED_7'   // Ermäßigter Steuersatz 7%
  | 'ZERO_RATED'  // Steuerfrei
  | 'EXEMPT'      // Nicht steuerbar
  | 'EU_SUPPLY'   // Innergemeinschaftliche Lieferung
  | 'EU_ACQUISITION' // Innergemeinschaftlicher Erwerb
  | 'REVERSE_CHARGE' // Reverse Charge
  | 'IMPORT_VAT'; // Einfuhrumsatzsteuer

export interface GermanVATReturn {
  id: string;
  period: GermanAccountingPeriod;
  
  // Umsatzsteuervoranmeldung (UStVA) fields
  // Line numbers refer to official UStVA form
  line_81: number; // Lieferungen und sonstige Leistungen (19% USt)
  line_86: number; // Lieferungen und sonstige Leistungen (7% USt)
  line_35: number; // Steuerfreie Umsätze
  line_77: number; // Innergemeinschaftliche Lieferungen
  line_76: number; // Umsätze nach §4 Nr. 1 bis 7 UStG
  line_80: number; // Übrige nicht steuerbare Umsätze
  
  // Input VAT
  line_66: number; // Abziehbare Vorsteuer
  line_61: number; // Vorsteuer aus Rechnungen von anderen Unternehmern
  line_62: number; // Vorsteuer aus innergemeinschaftlichem Erwerb
  line_67: number; // Vorsteuer aus Einfuhr
  
  // Calculations
  total_output_vat: number; // Umsatzsteuer gesamt
  total_input_vat: number; // Vorsteuer gesamt
  vat_payable: number; // Zu zahlende Umsatzsteuer
  vat_refund: number; // Vorsteuerüberhang
  
  created_at: string;
  created_by: string;
  submitted_at?: string;
  submission_id?: string; // ELSTER transmission ID
}

export interface GermanTaxReport {
  id: string;
  report_type: 'UStVA' | 'EÜR' | 'BWA' | 'GUV'; // UStVA, Einnahmen-Überschuss-Rechnung, BWA, GuV
  period: GermanAccountingPeriod;
  data: Record<string, any>;
  generated_at: string;
  generated_by: string;
}

export interface GermanBusinessExpenseCategory {
  id: string;
  category_code: string; // e.g., "4400", "6300"
  category_name: string;
  description: string;
  account_number: string; // SKR03/SKR04 account
  vat_treatment: GermanVATType;
  deductible_percentage: number; // 0-100% for business use
  requires_documentation: boolean;
  max_amount_without_receipt?: number; // Kleinbetragsgrenze
  is_active: boolean;
}

export interface GermanDepreciationSchedule {
  id: string;
  asset_id: string;
  asset_name: string;
  purchase_date: string;
  purchase_price: number;
  useful_life_years: number;
  depreciation_method: 'LINEAR' | 'DECLINING_BALANCE' | 'UNITS_OF_PRODUCTION';
  annual_depreciation: number;
  accumulated_depreciation: number;
  book_value: number;
  afa_table_position?: string; // AfA-Tabelle position
  is_low_value_asset: boolean; // GWG (Geringwertige Wirtschaftsgüter)
}

// German VAT rate constants
const GERMAN_VAT_RATES = {
  STANDARD: 19, // Regelsteuersatz
  REDUCED: 7,   // Ermäßigter Steuersatz
  ZERO: 0,      // Steuerfrei/nicht steuerbar
} as const;

// German business expense categories (common ones)
const GERMAN_EXPENSE_CATEGORIES = [
  {
    code: '4400',
    name: 'Wareneingang',
    description: 'Wareneinkauf für den Handelsbetrieb',
    vat_treatment: 'STANDARD_19' as GermanVATType,
    deductible_percentage: 100,
    requires_documentation: true,
  },
  {
    code: '6300',
    name: 'Miete',
    description: 'Miete für Geschäftsräume',
    vat_treatment: 'STANDARD_19' as GermanVATType,
    deductible_percentage: 100,
    requires_documentation: true,
  },
  {
    code: '6540',
    name: 'Telefon/Internet',
    description: 'Telefon- und Internetkosten',
    vat_treatment: 'STANDARD_19' as GermanVATType,
    deductible_percentage: 100,
    requires_documentation: true,
  },
  {
    code: '6670',
    name: 'Bewirtung',
    description: 'Bewirtungskosten (70% abzugsfähig)',
    vat_treatment: 'STANDARD_19' as GermanVATType,
    deductible_percentage: 70,
    requires_documentation: true,
  },
  {
    code: '6680',
    name: 'Fahrtkosten',
    description: 'Fahrtkosten und Reisespesen',
    vat_treatment: 'STANDARD_19' as GermanVATType,
    deductible_percentage: 100,
    requires_documentation: true,
    max_amount_without_receipt: 250, // Kleinbetragsgrenze
  },
];

// Zod schemas
const GermanAccountingPeriodSchema = z.object({
  year: z.number().min(2020).max(2030),
  quarter: z.number().min(1).max(4).optional(),
  month: z.number().min(1).max(12).optional(),
  period_type: z.enum(['MONTHLY', 'QUARTERLY', 'ANNUAL']),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export class GermanAccountingService {

  /**
   * Create German accounting period
   */
  static async createAccountingPeriod(
    year: number,
    periodType: 'MONTHLY' | 'QUARTERLY' | 'ANNUAL',
    periodNumber?: number
  ): Promise<GermanAccountingPeriod> {
    return apiCall(async () => {
      const period = this.calculatePeriodDates(year, periodType, periodNumber);
      
      const periodData = {
        ...period,
        is_closed: false,
        ustva_submitted: false,
      };

      const query = supabase
        .from('german_accounting_periods')
        .insert(periodData)
        .select()
        .single();

      const result = await createQuery<GermanAccountingPeriod>(query).executeSingle();

      // Create audit log
      await auditLogService.createAuditLog({
        entity_type: 'document',
        entity_id: result.year.toString(),
        action: 'CREATE',
        new_values: periodData,
        reason: `Deutsche Buchungsperiode erstellt: ${periodType} ${year}${periodNumber ? `/${periodNumber}` : ''}`,
      });

      return result;
    }, 'Create accounting period');
  }

  /**
   * Generate German VAT return (Umsatzsteuervoranmeldung)
   */
  static async generateVATReturn(period: GermanAccountingPeriod): Promise<GermanVATReturn> {
    return apiCall(async () => {
      const validatedPeriod = validateInput(GermanAccountingPeriodSchema, period);
      const currentUser = await getCurrentUserProfile();

      // Get all transactions for the period
      const transactions = await this.getTransactionsForVATPeriod(validatedPeriod);

      // Calculate UStVA lines
      const vatCalculations = await this.calculateVATReturnLines(transactions);

      const vatReturnData = {
        period: validatedPeriod,
        ...vatCalculations,
        created_by: currentUser.id,
      };

      const query = supabase
        .from('german_vat_returns')
        .insert(vatReturnData)
        .select()
        .single();

      const vatReturn = await createQuery<GermanVATReturn>(query).executeSingle();

      // Create audit log
      await auditLogService.createAuditLog({
        entity_type: 'document',
        entity_id: vatReturn.id,
        action: 'CREATE',
        new_values: vatCalculations,
        reason: `UStVA generiert für Periode ${period.start_date} - ${period.end_date}`,
      });

      // Emit event
      eventBus.emit('VAT_RETURN_GENERATED', {
        vat_return_id: vatReturn.id,
        period: validatedPeriod,
        total_vat: vatCalculations.vat_payable,
        user_id: currentUser.id,
      });

      return vatReturn;
    }, 'Generate VAT return');
  }

  /**
   * Generate business expense report (Betriebsausgaben)
   */
  static async generateBusinessExpenseReport(
    period: GermanAccountingPeriod
  ): Promise<{
    total_expenses: number;
    vat_deductible: number;
    categories: Array<{
      category: string;
      amount: number;
      vat_amount: number;
      deductible_amount: number;
    }>;
  }> {
    return apiCall(async () => {
      // Get expenses for period
      const expenseQuery = supabase
        .from('expenses')
        .select(`
          *,
          expense_categories (name, account_number)
        `)
        .gte('expense_date', period.start_date)
        .lte('expense_date', period.end_date)
        .not('approved_at', 'is', null);

      const expenses = await createQuery(expenseQuery).execute();

      const categories = new Map();
      let totalExpenses = 0;
      let totalVATDeductible = 0;

      for (const expense of expenses) {
        const categoryName = expense.expense_categories?.name || 'Sonstige Kosten';
        const amount = expense.amount || 0;
        const vatAmount = expense.tax_amount || 0;
        
        // Find German category settings
        const germanCategory = GERMAN_EXPENSE_CATEGORIES.find(
          cat => cat.name === categoryName
        );
        
        const deductiblePercentage = germanCategory?.deductible_percentage || 100;
        const deductibleAmount = (amount * deductiblePercentage) / 100;
        const deductibleVAT = (vatAmount * deductiblePercentage) / 100;

        totalExpenses += amount;
        totalVATDeductible += deductibleVAT;

        if (!categories.has(categoryName)) {
          categories.set(categoryName, {
            category: categoryName,
            amount: 0,
            vat_amount: 0,
            deductible_amount: 0,
          });
        }

        const categoryData = categories.get(categoryName);
        categoryData.amount += amount;
        categoryData.vat_amount += vatAmount;
        categoryData.deductible_amount += deductibleAmount;
      }

      return {
        total_expenses: totalExpenses,
        vat_deductible: totalVATDeductible,
        categories: Array.from(categories.values()),
      };
    }, 'Generate business expense report');
  }

  /**
   * Calculate depreciation for assets (Abschreibungen)
   */
  static async calculateDepreciation(
    assetId: string,
    calculationDate: string = new Date().toISOString().split('T')[0]
  ): Promise<GermanDepreciationSchedule> {
    return apiCall(async () => {
      // Get asset data
      const assetQuery = supabase
        .from('assets')
        .select('*')
        .eq('id', assetId)
        .single();

      const asset = await createQuery(assetQuery).executeSingle();

      const purchaseDate = new Date(asset.purchase_date);
      const calcDate = new Date(calculationDate);
      const yearsOwned = (calcDate.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);

      // Check if it's a low-value asset (GWG)
      const isLowValueAsset = asset.purchase_price <= 800; // Current GWG threshold

      let annualDepreciation: number;
      let accumulatedDepreciation: number;

      if (isLowValueAsset) {
        // GWG can be fully depreciated in the year of purchase
        annualDepreciation = asset.purchase_price;
        accumulatedDepreciation = yearsOwned >= 1 ? asset.purchase_price : 0;
      } else {
        // Regular linear depreciation
        const usefulLifeYears = asset.useful_life_years || this.getStandardUsefulLife(asset.asset_type);
        annualDepreciation = asset.purchase_price / usefulLifeYears;
        accumulatedDepreciation = Math.min(
          annualDepreciation * Math.floor(yearsOwned),
          asset.purchase_price
        );
      }

      const bookValue = asset.purchase_price - accumulatedDepreciation;

      const depreciationSchedule: GermanDepreciationSchedule = {
        id: `dep_${assetId}`,
        asset_id: assetId,
        asset_name: asset.name,
        purchase_date: asset.purchase_date,
        purchase_price: asset.purchase_price,
        useful_life_years: asset.useful_life_years,
        depreciation_method: 'LINEAR',
        annual_depreciation: annualDepreciation,
        accumulated_depreciation: accumulatedDepreciation,
        book_value: bookValue,
        is_low_value_asset: isLowValueAsset,
      };

      return depreciationSchedule;
    }, 'Calculate depreciation');
  }

  /**
   * Validate German invoice requirements
   */
  static async validateGermanInvoiceCompliance(invoiceId: string): Promise<{
    is_compliant: boolean;
    missing_requirements: string[];
    warnings: string[];
  }> {
    return apiCall(async () => {
      const invoiceQuery = supabase
        .from('invoices')
        .select(`
          *,
          customers (*),
          companies (*)
        `)
        .eq('id', invoiceId)
        .single();

      const invoice = await createQuery(invoiceQuery).execute();

      const missingRequirements: string[] = [];
      const warnings: string[] = [];

      // Required fields according to § 14 UStG
      if (!invoice.invoice_number) {
        missingRequirements.push('Rechnungsnummer fehlt');
      }

      if (!invoice.invoice_date) {
        missingRequirements.push('Rechnungsdatum fehlt');
      }

      if (!invoice.companies?.name || !invoice.companies?.address) {
        missingRequirements.push('Vollständige Rechnungssteller-Adresse fehlt');
      }

      if (!invoice.companies?.tax_number && !invoice.companies?.vat_id) {
        missingRequirements.push('Steuernummer oder Umsatzsteuer-ID fehlt');
      }

      if (!invoice.customers?.company_name && !invoice.customers?.first_name) {
        missingRequirements.push('Vollständige Empfänger-Adresse fehlt');
      }

      if (!invoice.due_date) {
        warnings.push('Zahlungsziel nicht angegeben');
      }

      // VAT requirements
      if (invoice.tax_amount > 0 && !invoice.tax_rate) {
        missingRequirements.push('Umsatzsteuersatz fehlt');
      }

      if (invoice.amount && invoice.tax_amount) {
        const netAmount = invoice.amount - invoice.tax_amount;
        const calculatedVAT = netAmount * (invoice.tax_rate / 100);
        const vatDifference = Math.abs(calculatedVAT - invoice.tax_amount);
        
        if (vatDifference > 0.01) {
          warnings.push(`Umsatzsteuer-Berechnung prüfen (Differenz: €${vatDifference.toFixed(2)})`);
        }
      }

      // Amount in words for amounts > 1000 EUR (best practice)
      if (invoice.amount > 1000) {
        warnings.push('Betrag in Worten empfohlen bei Rechnungen über 1.000 EUR');
      }

      return {
        is_compliant: missingRequirements.length === 0,
        missing_requirements: missingRequirements,
        warnings,
      };
    }, 'Validate German invoice compliance');
  }

  // ============================================
  // PRIVATE HELPER METHODS
  // ============================================

  private static calculatePeriodDates(
    year: number,
    periodType: 'MONTHLY' | 'QUARTERLY' | 'ANNUAL',
    periodNumber?: number
  ): Omit<GermanAccountingPeriod, 'is_closed' | 'ustva_submitted'> {
    let startDate: string;
    let endDate: string;
    let quarter: 1 | 2 | 3 | 4 | undefined;
    let month: number | undefined;

    switch (periodType) {
      case 'MONTHLY': {
        month = periodNumber || 1;
        startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        endDate = `${year}-${month.toString().padStart(2, '0')}-${lastDay}`;
        break;
      }

      case 'QUARTERLY': {
        quarter = (periodNumber as 1 | 2 | 3 | 4) || 1;
        const quarterStartMonth = (quarter - 1) * 3 + 1;
        const quarterEndMonth = quarter * 3;
        startDate = `${year}-${quarterStartMonth.toString().padStart(2, '0')}-01`;
        const quarterLastDay = new Date(year, quarterEndMonth, 0).getDate();
        endDate = `${year}-${quarterEndMonth.toString().padStart(2, '0')}-${quarterLastDay}`;
        break;
      }

      case 'ANNUAL':
        startDate = `${year}-01-01`;
        endDate = `${year}-12-31`;
        break;
    }

    return {
      year,
      quarter,
      month,
      period_type: periodType,
      start_date: startDate,
      end_date: endDate,
    };
  }

  private static async getTransactionsForVATPeriod(period: GermanAccountingPeriod) {
    // Get invoices
    const invoiceQuery = supabase
      .from('invoices')
      .select(`
        *,
        invoice_items (*),
        customers (*)
      `)
      .gte('invoice_date', period.start_date)
      .lte('invoice_date', period.end_date)
      .neq('status', 'draft');

    const invoices = await createQuery(invoiceQuery).execute();

    // Get expenses with input VAT
    const expenseQuery = supabase
      .from('expenses')
      .select('*')
      .gte('expense_date', period.start_date)
      .lte('expense_date', period.end_date)
      .not('approved_at', 'is', null)
      .gt('tax_amount', 0);

    const expenses = await createQuery(expenseQuery).execute();

    return { invoices, expenses };
  }

  private static async calculateVATReturnLines(transactions: any): Promise<Partial<GermanVATReturn>> {
    const { invoices, expenses } = transactions;

    let line_81 = 0; // 19% VAT sales
    let line_86 = 0; // 7% VAT sales
    let line_35 = 0; // Tax-free sales
    let totalOutputVAT = 0;
    let totalInputVAT = 0;

    // Process invoices (output VAT)
    for (const invoice of invoices) {
      const taxRate = invoice.tax_rate || 19;
      const netAmount = invoice.amount - (invoice.tax_amount || 0);
      const vatAmount = invoice.tax_amount || 0;

      if (taxRate === 19) {
        line_81 += netAmount;
      } else if (taxRate === 7) {
        line_86 += netAmount;
      } else if (taxRate === 0) {
        line_35 += netAmount;
      }

      totalOutputVAT += vatAmount;
    }

    // Process expenses (input VAT)
    for (const expense of expenses) {
      totalInputVAT += expense.tax_amount || 0;
    }

    const vatPayable = Math.max(0, totalOutputVAT - totalInputVAT);
    const vatRefund = Math.max(0, totalInputVAT - totalOutputVAT);

    return {
      line_81: Math.round(line_81 * 100) / 100,
      line_86: Math.round(line_86 * 100) / 100,
      line_35: Math.round(line_35 * 100) / 100,
      line_77: 0, // EU deliveries - would need specific logic
      line_76: 0, // Other tax-free - would need specific logic
      line_80: 0, // Other non-taxable - would need specific logic
      line_66: Math.round(totalInputVAT * 100) / 100,
      line_61: Math.round(totalInputVAT * 100) / 100, // Simplified
      line_62: 0, // EU acquisitions - would need specific logic
      line_67: 0, // Import VAT - would need specific logic
      total_output_vat: Math.round(totalOutputVAT * 100) / 100,
      total_input_vat: Math.round(totalInputVAT * 100) / 100,
      vat_payable: Math.round(vatPayable * 100) / 100,
      vat_refund: Math.round(vatRefund * 100) / 100,
    };
  }

  private static getStandardUsefulLife(assetType: string): number {
    // Simplified AfA-Tabelle (depreciation table) mappings
    const usefulLifeTable: Record<string, number> = {
      'computer': 3,
      'software': 3,
      'office_furniture': 13,
      'machinery': 10,
      'vehicle': 6,
      'building': 50,
      'equipment': 8,
    };

    return usefulLifeTable[assetType] || 10;
  }
}

export const germanAccountingService = new GermanAccountingService();