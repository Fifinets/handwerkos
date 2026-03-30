import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock Supabase client
const mockExecuteWithCount = vi.fn();
const mockExecuteSingle = vi.fn();
const mockExecute = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockReturnThis(),
    })),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
    },
  },
}));

vi.mock('@/utils/api', () => ({
  apiCall: vi.fn(async (fn: () => Promise<any>) => fn()),
  createQuery: vi.fn((query: any) => ({
    execute: mockExecute,
    executeSingle: mockExecuteSingle,
    executeWithCount: mockExecuteWithCount,
  })),
  validateInput: vi.fn((_schema: any, data: any) => data),
  getCurrentUserProfile: vi.fn().mockResolvedValue({
    id: 'user-1',
    is_admin: true,
    is_project_manager: true,
    company_id: 'company-1',
  }),
  ApiError: class ApiError extends Error {
    code: string;
    constructor(code: string, message: string, details?: any) {
      super(message);
      this.code = code;
    }
  },
  API_ERROR_CODES: {
    IMMUTABLE_RECORD: 'IMMUTABLE_RECORD',
    BUSINESS_RULE_VIOLATION: 'BUSINESS_RULE_VIOLATION',
    UNAUTHORIZED: 'UNAUTHORIZED',
  },
}));

vi.mock('./eventBus', () => ({
  eventBus: { emit: vi.fn() },
}));

import { FinanceService } from './financeService';

describe('FinanceService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =============================================
  // Invoice Total Calculations (VAT)
  // =============================================

  describe('createInvoice - Berechnung der Gesamtbetraege', () => {
    it('berechnet Netto, USt und Brutto korrekt bei 19% USt', async () => {
      const invoiceData = {
        customer_id: 'cust-1',
        tax_rate: 19,
        body: {
          items: [
            { description: 'Pos 1', quantity: 1, unit_price: 100, total_price: 100 },
            { description: 'Pos 2', quantity: 2, unit_price: 50, total_price: 100 },
          ],
        },
      };

      const expectedInvoice = {
        id: 'inv-1',
        net_amount: 200,
        tax_amount: 38,
        gross_amount: 238,
        amount: 238,
        status: 'draft',
      };

      mockExecuteSingle.mockResolvedValueOnce(expectedInvoice);

      const result = await FinanceService.createInvoice(invoiceData as any);

      expect(result.net_amount).toBe(200);
      expect(result.tax_amount).toBe(38);
      expect(result.gross_amount).toBe(238);
    });

    it('berechnet korrekt mit 0% USt (steuerfreie Leistung)', async () => {
      const invoiceData = {
        customer_id: 'cust-1',
        tax_rate: 0,
        body: {
          items: [
            { description: 'Steuerfreie Leistung', quantity: 1, unit_price: 500, total_price: 500 },
          ],
        },
      };

      // With 0% tax: net = 500, tax = 0, gross = 500
      mockExecuteSingle.mockResolvedValueOnce({
        id: 'inv-2',
        net_amount: 500,
        tax_amount: 0,
        gross_amount: 500,
        amount: 500,
        status: 'draft',
      });

      const result = await FinanceService.createInvoice(invoiceData as any);
      expect(result.gross_amount).toBe(500);
      expect(result.tax_amount).toBe(0);
    });

    it('verwendet 19% als Standard-USt wenn kein tax_rate angegeben', async () => {
      const invoiceData = {
        customer_id: 'cust-1',
        body: {
          items: [
            { description: 'Pos 1', quantity: 1, unit_price: 100, total_price: 100 },
          ],
        },
      };

      mockExecuteSingle.mockResolvedValueOnce({
        id: 'inv-3',
        net_amount: 100,
        tax_amount: 19,
        gross_amount: 119,
        amount: 119,
        status: 'draft',
      });

      const result = await FinanceService.createInvoice(invoiceData as any);
      // Default tax_rate is 19, so 100 * 1.19 = 119
      expect(result.gross_amount).toBe(119);
    });

    it('setzt Betrag auf 0 wenn keine Positionen vorhanden', async () => {
      const invoiceData = {
        customer_id: 'cust-1',
        tax_rate: 19,
        body: { items: [] },
      };

      mockExecuteSingle.mockResolvedValueOnce({
        id: 'inv-4',
        net_amount: 0,
        tax_amount: 0,
        gross_amount: 0,
        amount: 0,
        status: 'draft',
      });

      const result = await FinanceService.createInvoice(invoiceData as any);
      expect(result.net_amount).toBe(0);
      expect(result.gross_amount).toBe(0);
    });
  });

  // =============================================
  // Invoice Status Transitions
  // =============================================

  describe('updateInvoice - Statusregeln', () => {
    it('verhindert Bearbeitung bezahlter Rechnungen', async () => {
      // getInvoice is called inside updateInvoice
      mockExecuteSingle.mockResolvedValueOnce({
        id: 'inv-1',
        status: 'paid',
        invoice_number: 'RE-2026-000001',
      });

      await expect(
        FinanceService.updateInvoice('inv-1', { notes: 'test' } as any)
      ).rejects.toThrow('Bezahlte Rechnungen können nicht mehr bearbeitet werden.');
    });

    it('verhindert Aenderung der Rechnungsnummer nach Versand', async () => {
      mockExecuteSingle.mockResolvedValueOnce({
        id: 'inv-1',
        status: 'sent',
        invoice_number: 'RE-2026-000001',
      });

      await expect(
        FinanceService.updateInvoice('inv-1', { invoice_number: 'RE-NEW' } as any)
      ).rejects.toThrow('Rechnungsnummer kann nach dem Versand nicht mehr geändert werden.');
    });
  });

  describe('sendInvoice - Versand-Validierung', () => {
    it('erlaubt nur den Versand von Entwuerfen', async () => {
      mockExecuteSingle.mockResolvedValueOnce({
        id: 'inv-1',
        status: 'sent',
      });

      await expect(
        FinanceService.sendInvoice('inv-1')
      ).rejects.toThrow('Nur Entwürfe können versendet werden.');
    });

    it('verlangt mindestens eine Position', async () => {
      mockExecuteSingle.mockResolvedValueOnce({
        id: 'inv-1',
        status: 'draft',
        body: { items: [] },
      });

      await expect(
        FinanceService.sendInvoice('inv-1')
      ).rejects.toThrow('Rechnung muss mindestens eine Position enthalten.');
    });

    it('verlangt Position-Body (null items)', async () => {
      mockExecuteSingle.mockResolvedValueOnce({
        id: 'inv-1',
        status: 'draft',
        body: null,
      });

      await expect(
        FinanceService.sendInvoice('inv-1')
      ).rejects.toThrow('Rechnung muss mindestens eine Position enthalten.');
    });
  });

  describe('markInvoicePaid - Bezahl-Validierung', () => {
    it('erlaubt nur bezahlen von versendeten Rechnungen', async () => {
      mockExecuteSingle.mockResolvedValueOnce({
        id: 'inv-1',
        status: 'draft',
      });

      await expect(
        FinanceService.markInvoicePaid('inv-1')
      ).rejects.toThrow('Nur versendete Rechnungen können als bezahlt markiert werden.');
    });
  });

  // =============================================
  // Financial KPI Calculations
  // =============================================

  describe('getFinancialKPIs', () => {
    it('berechnet Umsatz nur aus bezahlten Rechnungen', async () => {
      mockExecute
        // First call: revenues (invoices)
        .mockResolvedValueOnce([
          { amount: 1000, status: 'paid', paid_at: '2026-03-15', invoice_date: '2026-03-01' },
          { amount: 500, status: 'sent', invoice_date: '2026-03-05', due_date: '2026-04-05' },
          { amount: 200, status: 'draft', invoice_date: '2026-03-10' },
        ])
        // Second call: expenses
        .mockResolvedValueOnce([
          { amount: 300, expense_date: '2026-03-10', approved_at: '2026-03-11' },
          { amount: 150, expense_date: '2026-03-15', approved_at: null }, // not approved
        ]);

      const kpis = await FinanceService.getFinancialKPIs();

      // Only paid invoices count toward total revenue
      expect(kpis.revenue.total).toBe(1000);
      // Only approved expenses count
      expect(kpis.expenses.total).toBe(300);
      // Profit = revenue - expenses
      expect(kpis.profit.total).toBe(700);
    });

    it('berechnet ausstehende und ueberfaellige Rechnungen', async () => {
      const pastDate = '2026-01-01';
      const futureDate = '2026-12-31';

      mockExecute
        .mockResolvedValueOnce([
          { amount: 1000, status: 'sent', due_date: pastDate, invoice_date: '2026-01-01' },
          { amount: 500, status: 'sent', due_date: futureDate, invoice_date: '2026-03-01' },
          { amount: 300, status: 'paid', paid_at: '2026-03-01', invoice_date: '2026-02-01' },
        ])
        .mockResolvedValueOnce([]);

      const kpis = await FinanceService.getFinancialKPIs();

      // 2 sent invoices are outstanding
      expect(kpis.outstanding.count).toBe(2);
      expect(kpis.outstanding.total).toBe(1500);
    });

    it('berechnet Wachstumsrate korrekt', async () => {
      const now = new Date();
      const thisMonth = now.toISOString().split('T')[0].substring(0, 7);
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 15).toISOString().split('T')[0];

      mockExecute
        .mockResolvedValueOnce([
          { amount: 2000, status: 'paid', paid_at: now.toISOString(), invoice_date: thisMonth + '-01' },
          { amount: 1000, status: 'paid', paid_at: lastMonth, invoice_date: lastMonth },
        ])
        .mockResolvedValueOnce([]);

      const kpis = await FinanceService.getFinancialKPIs();

      // growth = ((this - last) / last) * 100
      // With 2000 this month and 1000 last month: ((2000-1000)/1000)*100 = 100%
      expect(kpis.revenue.growth_rate).toBe(100);
    });

    it('gibt Wachstumsrate 0 wenn letzter Monat 0 Umsatz', async () => {
      mockExecute
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const kpis = await FinanceService.getFinancialKPIs();

      expect(kpis.revenue.growth_rate).toBe(0);
    });

    it('berechnet Gewinnmarge korrekt', async () => {
      const now = new Date();
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];

      mockExecute
        .mockResolvedValueOnce([
          { amount: 1000, status: 'paid', paid_at: now.toISOString(), invoice_date: thisMonthStart },
        ])
        .mockResolvedValueOnce([
          { amount: 400, expense_date: thisMonthStart, approved_at: thisMonthStart },
        ]);

      const kpis = await FinanceService.getFinancialKPIs();

      // margin = (profit / revenue) * 100 = (600 / 1000) * 100 = 60
      expect(kpis.profit.margin).toBe(60);
    });

    it('gibt Marge 0 wenn kein Umsatz in diesem Monat', async () => {
      mockExecute
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const kpis = await FinanceService.getFinancialKPIs();

      expect(kpis.profit.margin).toBe(0);
    });

    it('behandelt null-Betraege korrekt (amount: null)', async () => {
      mockExecute
        .mockResolvedValueOnce([
          { amount: null, status: 'paid', paid_at: '2026-03-15', invoice_date: '2026-03-01' },
          { amount: 500, status: 'paid', paid_at: '2026-03-15', invoice_date: '2026-03-01' },
        ])
        .mockResolvedValueOnce([]);

      const kpis = await FinanceService.getFinancialKPIs();

      // null amount should be treated as 0
      expect(kpis.revenue.total).toBe(500);
    });
  });

  // =============================================
  // Revenue by Month Aggregation
  // =============================================

  describe('getRevenueByMonth', () => {
    it('gruppiert Umsaetze nach Monat und sortiert chronologisch', async () => {
      mockExecute.mockResolvedValueOnce([
        { amount: 1000, status: 'paid', paid_at: '2026-01-15T00:00:00Z' },
        { amount: 500, status: 'paid', paid_at: '2026-01-20T00:00:00Z' },
        { amount: 2000, status: 'paid', paid_at: '2026-02-10T00:00:00Z' },
      ]);

      const result = await FinanceService.getRevenueByMonth(12);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ month: '2026-01', revenue: 1500, invoices: 2 });
      expect(result[1]).toEqual({ month: '2026-02', revenue: 2000, invoices: 1 });
    });

    it('gibt leeres Array wenn keine bezahlten Rechnungen', async () => {
      mockExecute.mockResolvedValueOnce([]);

      const result = await FinanceService.getRevenueByMonth(12);

      expect(result).toEqual([]);
    });
  });

  // =============================================
  // Expense Category Breakdown
  // =============================================

  describe('getExpensesByCategory', () => {
    it('gruppiert Ausgaben nach Kategorie und sortiert nach Betrag', async () => {
      mockExecute.mockResolvedValueOnce([
        { category: 'Material', amount: 500 },
        { category: 'Material', amount: 300 },
        { category: 'Werkzeug', amount: 1000 },
      ]);

      const result = await FinanceService.getExpensesByCategory();

      expect(result[0]).toEqual({ category: 'Werkzeug', amount: 1000, count: 1 });
      expect(result[1]).toEqual({ category: 'Material', amount: 800, count: 2 });
    });

    it('verwendet "Sonstige" fuer Ausgaben ohne Kategorie', async () => {
      mockExecute.mockResolvedValueOnce([
        { category: null, amount: 200 },
        { category: undefined, amount: 100 },
      ]);

      const result = await FinanceService.getExpensesByCategory();

      expect(result[0].category).toBe('Sonstige');
      expect(result[0].amount).toBe(300);
    });
  });

  // =============================================
  // Profit/Loss Report
  // =============================================

  describe('getProfitLossReport', () => {
    it('unterscheidet Material/Equipment/Subcontractor als Herstellkosten', async () => {
      mockExecute
        // Revenue
        .mockResolvedValueOnce([
          { amount: 5000 },
          { amount: 3000 },
        ])
        // Expenses
        .mockResolvedValueOnce([
          { amount: 1000, category: 'Material' },
          { amount: 500, category: 'Equipment' },
          { amount: 200, category: 'Subcontractor' },
          { amount: 300, category: 'Büro' },
          { amount: 150, category: 'Versicherung' },
        ]);

      const report = await FinanceService.getProfitLossReport({
        from: '2026-01-01',
        to: '2026-03-31',
      });

      expect(report.revenue).toBe(8000);
      expect(report.cost_of_goods).toBe(1700); // Material + Equipment + Subcontractor
      expect(report.gross_profit).toBe(6300); // 8000 - 1700
      expect(report.operating_expenses).toBe(450); // Büro + Versicherung
      expect(report.net_profit).toBe(5850); // 6300 - 450
      expect(report.margin).toBeCloseTo(73.125); // (5850/8000)*100
    });

    it('gibt Marge 0 bei keinem Umsatz', async () => {
      mockExecute
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const report = await FinanceService.getProfitLossReport({
        from: '2026-01-01',
        to: '2026-03-31',
      });

      expect(report.margin).toBe(0);
      expect(report.revenue).toBe(0);
      expect(report.net_profit).toBe(0);
    });
  });

  // =============================================
  // Pagination
  // =============================================

  describe('getInvoices - Paginierung', () => {
    it('berechnet Pagination-Metadaten korrekt', async () => {
      mockExecuteWithCount.mockResolvedValueOnce({
        data: [{ id: 'inv-1' }, { id: 'inv-2' }],
        count: 50,
      });

      const result = await FinanceService.getInvoices({ page: 2, limit: 10 });

      expect(result.pagination.page).toBe(2);
      expect(result.pagination.limit).toBe(10);
      expect(result.pagination.total_items).toBe(50);
      expect(result.pagination.total_pages).toBe(5);
      expect(result.pagination.has_next).toBe(true);
      expect(result.pagination.has_prev).toBe(true);
    });

    it('hat has_next=false auf letzter Seite', async () => {
      mockExecuteWithCount.mockResolvedValueOnce({
        data: [{ id: 'inv-1' }],
        count: 10,
      });

      const result = await FinanceService.getInvoices({ page: 1, limit: 10 });

      expect(result.pagination.has_next).toBe(false);
      expect(result.pagination.has_prev).toBe(false);
    });

    it('verwendet Standard-Sortierung wenn keine Paginierung', async () => {
      mockExecuteWithCount.mockResolvedValueOnce({
        data: [],
        count: 0,
      });

      const result = await FinanceService.getInvoices();

      expect(result.pagination.page).toBe(1);
      expect(result.pagination.has_next).toBe(false);
    });
  });
});
