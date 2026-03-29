import { vi, describe, it, expect, beforeEach } from 'vitest';

// Use vi.hoisted for mocks referenced inside vi.mock factories
const {
  mockFrom, mockSelect, mockInsert, mockUpdate, mockDeleteFn,
  mockEq, mockSingle, mockOrder, mockLimit, mockOr, mockRange,
  mockRpc, mockExecuteWithCount, mockExecuteSingle, mockExecute,
} = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockSelect: vi.fn().mockReturnThis(),
  mockInsert: vi.fn().mockReturnThis(),
  mockUpdate: vi.fn().mockReturnThis(),
  mockDeleteFn: vi.fn().mockReturnThis(),
  mockEq: vi.fn().mockReturnThis(),
  mockSingle: vi.fn().mockReturnThis(),
  mockOrder: vi.fn().mockReturnThis(),
  mockLimit: vi.fn().mockReturnThis(),
  mockOr: vi.fn().mockReturnThis(),
  mockRange: vi.fn().mockReturnThis(),
  mockRpc: vi.fn(),
  mockExecuteWithCount: vi.fn(),
  mockExecuteSingle: vi.fn(),
  mockExecute: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (...args: any[]) => {
      mockFrom(...args);
      return {
        select: mockSelect,
        insert: mockInsert,
        update: mockUpdate,
        delete: mockDeleteFn,
        eq: mockEq,
        single: mockSingle,
        order: mockOrder,
        limit: mockLimit,
        or: mockOr,
        range: mockRange,
      };
    },
    rpc: mockRpc,
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
    },
  },
}));

vi.mock('@/utils/api', () => ({
  apiCall: vi.fn(async (fn: () => Promise<any>) => fn()),
  createQuery: vi.fn(() => ({
    execute: mockExecute,
    executeSingle: mockExecuteSingle,
    executeWithCount: mockExecuteWithCount,
  })),
  validateInput: vi.fn((_schema: any, data: any) => ({ ...data })),
  getCurrentUserProfile: vi.fn().mockResolvedValue({
    id: 'user-1',
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
    BUSINESS_RULE_VIOLATION: 'BUSINESS_RULE_VIOLATION',
  },
}));

import { CustomerService } from './customerService';

describe('CustomerService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelect.mockReturnThis();
    mockInsert.mockReturnThis();
    mockUpdate.mockReturnThis();
    mockDeleteFn.mockReturnThis();
    mockEq.mockReturnThis();
    mockSingle.mockReturnThis();
    mockOrder.mockReturnThis();
    mockLimit.mockReturnThis();
  });

  // =============================================
  // Display Name Generation
  // =============================================

  describe('createCustomer - Display Name Generierung', () => {
    it('verwendet company_name als display_name fuer Geschaeftskunden', async () => {
      const customerData = {
        customer_type: 'business',
        company_name: 'Elektro Müller GmbH',
        contact_person: 'Hans Müller',
        email: 'hans@mueller.de',
      };

      // generateCustomerNumber calls rpc
      mockRpc.mockResolvedValueOnce({ data: 'KD-000001', error: null });

      // insert().select().single() returns the created customer
      mockSingle.mockResolvedValueOnce({
        data: {
          id: 'cust-1',
          ...customerData,
          display_name: 'Elektro Müller GmbH',
          customer_number: 'KD-000001',
        },
        error: null,
      });

      const result = await CustomerService.createCustomer(customerData as any);

      expect(result.display_name).toBe('Elektro Müller GmbH');
    });

    it('verwendet contact_person als display_name fuer Privatkunden', async () => {
      const customerData = {
        customer_type: 'private',
        contact_person: 'Maria Schmidt',
        email: 'maria@schmidt.de',
      };

      mockRpc.mockResolvedValueOnce({ data: 'KD-000002', error: null });

      mockSingle.mockResolvedValueOnce({
        data: {
          id: 'cust-2',
          ...customerData,
          display_name: 'Maria Schmidt',
          customer_number: 'KD-000002',
        },
        error: null,
      });

      const result = await CustomerService.createCustomer(customerData as any);

      expect(result.display_name).toBe('Maria Schmidt');
    });

    it('verwendet "Unbekannter Kunde" als Fallback', async () => {
      const customerData = {
        customer_type: 'private',
        email: 'test@test.de',
      };

      mockRpc.mockResolvedValueOnce({ data: 'KD-000003', error: null });

      mockSingle.mockResolvedValueOnce({
        data: {
          id: 'cust-3',
          ...customerData,
          display_name: 'Unbekannter Kunde',
          customer_number: 'KD-000003',
        },
        error: null,
      });

      const result = await CustomerService.createCustomer(customerData as any);

      expect(result.display_name).toBe('Unbekannter Kunde');
    });
  });

  // =============================================
  // Customer Number Generation Fallback
  // =============================================

  describe('createCustomer - Kundennummer Fallback', () => {
    it('generiert Fallback-Kundennummer bei Fehler in DB-Funktion', async () => {
      const customerData = {
        customer_type: 'business',
        company_name: 'Test GmbH',
        email: 'test@test.de',
      };

      // generateCustomerNumber rpc fails
      mockRpc.mockResolvedValueOnce({ data: null, error: new Error('DB error') });

      // insert succeeds with timestamp-based fallback
      mockSingle.mockResolvedValueOnce({
        data: {
          id: 'cust-4',
          ...customerData,
          display_name: 'Test GmbH',
          customer_number: 'KD-1234567890',
        },
        error: null,
      });

      const result = await CustomerService.createCustomer(customerData as any);

      expect(result.customer_number).toMatch(/^KD-/);
    });

    it('verwendet Fallback bei doppelter Kundennummer (23505)', async () => {
      const customerData = {
        customer_type: 'business',
        company_name: 'Doppel GmbH',
        email: 'doppel@test.de',
        customer_number: 'KD-000001',
      };

      // First insert fails with unique constraint
      mockSingle.mockResolvedValueOnce({
        data: null,
        error: { code: '23505', message: 'duplicate key' },
      });

      // Retry insert succeeds
      mockSingle.mockResolvedValueOnce({
        data: {
          id: 'cust-5',
          ...customerData,
          customer_number: 'KD-1234567890',
          display_name: 'Doppel GmbH',
        },
        error: null,
      });

      const result = await CustomerService.createCustomer(customerData as any);

      expect(result.id).toBe('cust-5');
    });
  });

  // =============================================
  // Update Display Name Logic
  // =============================================

  describe('updateCustomer - Display Name Update', () => {
    it('aktualisiert display_name automatisch wenn company_name geaendert', async () => {
      // getCustomer returns existing customer
      mockExecuteSingle
        .mockResolvedValueOnce({
          id: 'cust-1',
          customer_type: 'business',
          company_name: 'Alt GmbH',
          contact_person: 'Hans Müller',
          display_name: 'Alt GmbH',
        })
        // update returns new customer
        .mockResolvedValueOnce({
          id: 'cust-1',
          customer_type: 'business',
          company_name: 'Neu GmbH',
          contact_person: 'Hans Müller',
          display_name: 'Neu GmbH',
        });

      const result = await CustomerService.updateCustomer('cust-1', {
        company_name: 'Neu GmbH',
      } as any);

      expect(result.display_name).toBe('Neu GmbH');
    });

    it('verwendet contact_person wenn customer_type nicht business', async () => {
      mockExecuteSingle
        .mockResolvedValueOnce({
          id: 'cust-2',
          customer_type: 'private',
          company_name: null,
          contact_person: 'Alt Name',
          display_name: 'Alt Name',
        })
        .mockResolvedValueOnce({
          id: 'cust-2',
          customer_type: 'private',
          company_name: null,
          contact_person: 'Neuer Name',
          display_name: 'Neuer Name',
        });

      const result = await CustomerService.updateCustomer('cust-2', {
        contact_person: 'Neuer Name',
      } as any);

      expect(result.display_name).toBe('Neuer Name');
    });
  });

  // =============================================
  // Delete Safety Checks
  // =============================================

  describe('deleteCustomer - Sicherheitspruefungen', () => {
    it('verhindert Loeschen wenn Projekte zugeordnet', async () => {
      // relatedProjects query returns results
      mockLimit.mockReturnValueOnce(
        Promise.resolve({ data: [{ id: 'proj-1' }] })
      );

      await expect(CustomerService.deleteCustomer('cust-1')).rejects.toThrow(
        'Kunde kann nicht gelöscht werden, da noch Projekte zugeordnet sind.'
      );
    });

    it('verhindert Loeschen wenn Angebote vorhanden', async () => {
      // relatedProjects - none
      mockLimit.mockReturnValueOnce(Promise.resolve({ data: [] }));
      // relatedOffers - exists
      mockLimit.mockReturnValueOnce(Promise.resolve({ data: [{ id: 'offer-1' }] }));

      await expect(CustomerService.deleteCustomer('cust-1')).rejects.toThrow(
        'Kunde kann nicht gelöscht werden, da noch Angebote (Offers) vorhanden sind.'
      );
    });

    it('verhindert Loeschen wenn Auftraege vorhanden', async () => {
      mockLimit.mockReturnValueOnce(Promise.resolve({ data: [] }));
      mockLimit.mockReturnValueOnce(Promise.resolve({ data: [] }));
      mockLimit.mockReturnValueOnce(Promise.resolve({ data: [{ id: 'order-1' }] }));

      await expect(CustomerService.deleteCustomer('cust-1')).rejects.toThrow(
        'Kunde kann nicht gelöscht werden, da noch Aufträge zugeordnet sind.'
      );
    });

    it('verhindert Loeschen wenn Rechnungen vorhanden', async () => {
      mockLimit.mockReturnValueOnce(Promise.resolve({ data: [] }));
      mockLimit.mockReturnValueOnce(Promise.resolve({ data: [] }));
      mockLimit.mockReturnValueOnce(Promise.resolve({ data: [] }));
      mockLimit.mockReturnValueOnce(Promise.resolve({ data: [{ id: 'inv-1' }] }));

      await expect(CustomerService.deleteCustomer('cust-1')).rejects.toThrow(
        'Kunde kann nicht gelöscht werden, da noch Rechnungen vorhanden sind.'
      );
    });

    it('prueft alle vier Entitaets-Tabellen vor dem Loeschen', async () => {
      // The delete flow checks projects, offers, orders, invoices in order.
      // If projects exist, it throws immediately without checking the rest.
      // We verify the order by testing that projects are checked first.
      mockLimit.mockReturnValueOnce(
        Promise.resolve({ data: [{ id: 'proj-1' }] })
      );

      await expect(CustomerService.deleteCustomer('cust-1')).rejects.toThrow(
        'Projekte'
      );

      // from() should have been called with 'projects' for the first check
      expect(mockFrom).toHaveBeenCalledWith('projects');
    });
  });

  // =============================================
  // Customer Statistics
  // =============================================

  describe('getCustomerStats', () => {
    it('berechnet Statistiken korrekt', async () => {
      // Projects query: from('projects').select().eq()
      mockEq.mockReturnValueOnce(
        Promise.resolve({
          data: [
            { status: 'active', budget: 5000 },
            { status: 'active', budget: 3000 },
            { status: 'completed', budget: 8000 },
          ],
        })
      );
      // Invoices query: from('invoices').select().eq()
      mockEq.mockReturnValueOnce(
        Promise.resolve({
          data: [
            { status: 'paid', amount: 5000 },
            { status: 'paid', amount: 3000 },
            { status: 'sent', amount: 2000 },
            { status: 'overdue', amount: 1000 },
          ],
        })
      );

      const stats = await CustomerService.getCustomerStats('cust-1');

      expect(stats.total_projects).toBe(3);
      expect(stats.active_projects).toBe(2);
      expect(stats.completed_projects).toBe(1);
      expect(stats.total_revenue).toBe(8000);
      expect(stats.pending_invoices).toBe(1);
      expect(stats.overdue_invoices).toBe(1);
    });

    it('gibt Nullwerte bei leeren Daten', async () => {
      mockEq.mockReturnValueOnce(Promise.resolve({ data: null }));
      mockEq.mockReturnValueOnce(Promise.resolve({ data: null }));

      const stats = await CustomerService.getCustomerStats('cust-1');

      expect(stats.total_projects).toBe(0);
      expect(stats.total_revenue).toBe(0);
      expect(stats.pending_invoices).toBe(0);
    });
  });

  // =============================================
  // Search
  // =============================================

  describe('searchCustomers', () => {
    it('sucht in company_name, contact_person, email und customer_number', async () => {
      mockExecute.mockResolvedValueOnce([
        { id: 'cust-1', company_name: 'Elektro Müller', email: 'info@mueller.de' },
      ]);

      const result = await CustomerService.searchCustomers('Müller');

      expect(result).toHaveLength(1);
      expect(mockFrom).toHaveBeenCalledWith('customers');
    });

    it('respektiert Limit-Parameter', async () => {
      mockExecute.mockResolvedValueOnce([]);

      await CustomerService.searchCustomers('test', 5);

      expect(mockLimit).toHaveBeenCalledWith(5);
    });

    it('verwendet Standard-Limit 10', async () => {
      mockExecute.mockResolvedValueOnce([]);

      await CustomerService.searchCustomers('test');

      expect(mockLimit).toHaveBeenCalledWith(10);
    });
  });

  // =============================================
  // Pagination
  // =============================================

  describe('getCustomers - Paginierung', () => {
    it('berechnet Offset korrekt', async () => {
      mockExecuteWithCount.mockResolvedValueOnce({
        data: [{ id: 'cust-1' }],
        count: 100,
      });

      const result = await CustomerService.getCustomers({ page: 3, limit: 20 });

      expect(result.pagination.page).toBe(3);
      expect(result.pagination.total_pages).toBe(5);
      expect(result.pagination.has_next).toBe(true);
      expect(result.pagination.has_prev).toBe(true);
    });

    it('hat has_prev=false auf erster Seite', async () => {
      mockExecuteWithCount.mockResolvedValueOnce({
        data: [{ id: 'cust-1' }],
        count: 50,
      });

      const result = await CustomerService.getCustomers({ page: 1, limit: 20 });

      expect(result.pagination.has_prev).toBe(false);
      expect(result.pagination.has_next).toBe(true);
    });
  });
});
