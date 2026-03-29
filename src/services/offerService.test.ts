import { vi, describe, it, expect, beforeEach } from 'vitest';

// Use vi.hoisted to declare mocks that can be referenced inside vi.mock factories
const {
  mockFrom, mockRpc, mockSelect, mockInsert, mockUpdate, mockDelete,
  mockEq, mockSingle, mockOrder, mockLimit, mockIn, mockUpsert,
  mockOr, mockRange, mockGte, mockLte, mockExecuteWithCount,
  mockExecuteSingle, mockExecute,
} = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockRpc: vi.fn(),
  mockSelect: vi.fn().mockReturnThis(),
  mockInsert: vi.fn().mockReturnThis(),
  mockUpdate: vi.fn().mockReturnThis(),
  mockDelete: vi.fn().mockReturnThis(),
  mockEq: vi.fn().mockReturnThis(),
  mockSingle: vi.fn().mockReturnThis(),
  mockOrder: vi.fn().mockReturnThis(),
  mockLimit: vi.fn().mockReturnThis(),
  mockIn: vi.fn().mockReturnThis(),
  mockUpsert: vi.fn().mockReturnThis(),
  mockOr: vi.fn().mockReturnThis(),
  mockRange: vi.fn().mockReturnThis(),
  mockGte: vi.fn().mockReturnThis(),
  mockLte: vi.fn().mockReturnThis(),
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
        delete: mockDelete,
        eq: mockEq,
        single: mockSingle,
        order: mockOrder,
        limit: mockLimit,
        in: mockIn,
        upsert: mockUpsert,
        or: mockOr,
        range: mockRange,
        gte: mockGte,
        lte: mockLte,
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
  validateInput: vi.fn((_schema: any, data: any) => data),
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
    FORBIDDEN: 'FORBIDDEN',
  },
}));

vi.mock('./eventBus', () => ({
  eventBus: { emit: vi.fn() },
}));

import { OfferService } from './offerService';

describe('OfferService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset chainable mocks to return `this`
    mockSelect.mockReturnThis();
    mockInsert.mockReturnThis();
    mockUpdate.mockReturnThis();
    mockDelete.mockReturnThis();
    mockEq.mockReturnThis();
    mockSingle.mockReturnThis();
    mockOrder.mockReturnThis();
    mockLimit.mockReturnThis();
  });

  // =============================================
  // Status Transitions: draft -> sent
  // =============================================

  describe('sendOffer - Versand-Workflow', () => {
    it('verhindert Versand von bereits versendeten Angeboten', async () => {
      // getOffer mocked via supabase.from().select().eq().single()
      mockSingle.mockResolvedValueOnce({
        data: {
          id: 'offer-1',
          status: 'sent',
          items: [{ id: 'item-1' }],
        },
        error: null,
      });
      // offer_targets
      mockSingle.mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } });
      // offer_items
      mockOrder.mockReturnValueOnce(Promise.resolve({ data: [{ id: 'item-1' }], error: null }));

      await expect(OfferService.sendOffer('offer-1')).rejects.toThrow(
        'Nur Entwürfe können versendet werden.'
      );
    });

    it('verhindert Versand ohne Positionen', async () => {
      mockSingle.mockResolvedValueOnce({
        data: {
          id: 'offer-1',
          status: 'draft',
          items: [],
        },
        error: null,
      });
      mockSingle.mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } });
      mockOrder.mockReturnValueOnce(Promise.resolve({ data: [], error: null }));

      await expect(OfferService.sendOffer('offer-1')).rejects.toThrow(
        'Angebot muss mindestens eine Position enthalten.'
      );
    });

    it('verhindert Versand wenn items null', async () => {
      mockSingle.mockResolvedValueOnce({
        data: {
          id: 'offer-1',
          status: 'draft',
          items: null,
        },
        error: null,
      });
      mockSingle.mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } });
      mockOrder.mockReturnValueOnce(Promise.resolve({ data: null, error: null }));

      await expect(OfferService.sendOffer('offer-1')).rejects.toThrow(
        'Angebot muss mindestens eine Position enthalten.'
      );
    });
  });

  // =============================================
  // Status Transitions: sent -> rejected
  // =============================================

  describe('rejectOffer - Ablehnungs-Workflow', () => {
    it('erlaubt nur Ablehnung von versendeten Angeboten', async () => {
      mockSingle.mockResolvedValueOnce({
        data: { id: 'offer-1', status: 'draft' },
        error: null,
      });
      mockSingle.mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } });
      mockOrder.mockReturnValueOnce(Promise.resolve({ data: [], error: null }));

      await expect(OfferService.rejectOffer('offer-1')).rejects.toThrow(
        'Nur versendete Angebote können abgelehnt werden.'
      );
    });

    it('verhindert Ablehnung eines bereits angenommenen Angebots', async () => {
      mockSingle.mockResolvedValueOnce({
        data: { id: 'offer-1', status: 'accepted' },
        error: null,
      });
      mockSingle.mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } });
      mockOrder.mockReturnValueOnce(Promise.resolve({ data: [], error: null }));

      await expect(OfferService.rejectOffer('offer-1')).rejects.toThrow(
        'Nur versendete Angebote können abgelehnt werden.'
      );
    });
  });

  // =============================================
  // Status Transitions: draft/sent -> accepted
  // =============================================

  describe('acceptOffer - Annahme-Workflow', () => {
    it('verhindert Annahme eines abgelehnten Angebots', async () => {
      mockSingle.mockResolvedValueOnce({
        data: {
          id: 'offer-1',
          status: 'rejected',
          targets: { planned_hours_total: 10, target_end_date: '2026-12-31' },
          items: [{ id: 'item-1' }],
        },
        error: null,
      });
      mockSingle.mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } });
      mockOrder.mockReturnValueOnce(Promise.resolve({ data: [], error: null }));

      await expect(OfferService.acceptOffer('offer-1')).rejects.toThrow(
        'Nur Entwürfe oder versendete Angebote können angenommen werden.'
      );
    });

    it('erfordert geplante Stunden > 0', async () => {
      mockSingle.mockResolvedValueOnce({
        data: {
          id: 'offer-1',
          status: 'sent',
          targets: { planned_hours_total: 0, target_end_date: '2026-12-31' },
          items: [{ id: 'item-1' }],
        },
        error: null,
      });
      mockSingle.mockResolvedValueOnce({
        data: { planned_hours_total: 0, target_end_date: '2026-12-31' },
        error: null,
      });
      mockOrder.mockReturnValueOnce(Promise.resolve({ data: [{ id: 'item-1' }], error: null }));

      await expect(OfferService.acceptOffer('offer-1')).rejects.toThrow(
        'Geplante Stunden müssen größer als 0 sein.'
      );
    });

    it('erfordert Ziel-Enddatum', async () => {
      mockSingle.mockResolvedValueOnce({
        data: {
          id: 'offer-1',
          status: 'sent',
          targets: { planned_hours_total: 40, target_end_date: null },
          items: [{ id: 'item-1' }],
        },
        error: null,
      });
      mockSingle.mockResolvedValueOnce({
        data: { planned_hours_total: 40, target_end_date: null },
        error: null,
      });
      mockOrder.mockReturnValueOnce(Promise.resolve({ data: [{ id: 'item-1' }], error: null }));

      await expect(OfferService.acceptOffer('offer-1')).rejects.toThrow(
        'Ziel-Enddatum ist erforderlich.'
      );
    });
  });

  // =============================================
  // Locked Offer Protection
  // =============================================

  describe('updateOffer - Sperr-Schutz', () => {
    it('verhindert Bearbeitung gesperrter Angebote', async () => {
      mockSingle.mockResolvedValueOnce({
        data: { id: 'offer-1', status: 'sent', is_locked: true },
        error: null,
      });
      mockSingle.mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } });
      mockOrder.mockReturnValueOnce(Promise.resolve({ data: [], error: null }));

      await expect(
        OfferService.updateOffer('offer-1', { project_name: 'Neuer Name' } as any)
      ).rejects.toThrow('Dieses Angebot ist gesperrt und kann nicht bearbeitet werden.');
    });
  });

  describe('addOfferItem - Sperr-Schutz', () => {
    it('verhindert neue Positionen bei gesperrtem Angebot', async () => {
      mockSingle.mockResolvedValueOnce({
        data: { id: 'offer-1', status: 'sent', is_locked: true },
        error: null,
      });
      mockSingle.mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } });
      mockOrder.mockReturnValueOnce(Promise.resolve({ data: [], error: null }));

      await expect(
        OfferService.addOfferItem('offer-1', {
          description: 'Test',
          quantity: 1,
          unit: 'Stk',
          unit_price_net: 100,
        } as any)
      ).rejects.toThrow('Positionen eines gesperrten Angebots können nicht geändert werden.');
    });
  });

  // =============================================
  // Delete Restrictions
  // =============================================

  describe('deleteOffer - Loeschregeln', () => {
    it('erlaubt nur Loeschen von Entwuerfen', async () => {
      mockSingle.mockResolvedValueOnce({
        data: { id: 'offer-1', status: 'sent' },
        error: null,
      });
      mockSingle.mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } });
      mockOrder.mockReturnValueOnce(Promise.resolve({ data: [], error: null }));

      await expect(OfferService.deleteOffer('offer-1')).rejects.toThrow(
        'Nur Entwürfe können gelöscht werden.'
      );
    });
  });

  // =============================================
  // Offer Statistics
  // =============================================

  describe('getOfferStats - Statistik-Berechnung', () => {
    it('berechnet Conversion Rate korrekt', async () => {
      mockSelect.mockReturnValueOnce(
        Promise.resolve({
          data: [
            { status: 'sent', snapshot_gross_total: 1000 },
            { status: 'accepted', snapshot_gross_total: 2000 },
            { status: 'accepted', snapshot_gross_total: 1500 },
            { status: 'rejected', snapshot_gross_total: 800 },
            { status: 'draft', snapshot_gross_total: 500 },
          ],
          error: null,
        })
      );

      const stats = await OfferService.getOfferStats();

      expect(stats.total).toBe(5);
      expect(stats.by_status.accepted).toBe(2);
      expect(stats.by_status.sent).toBe(1);
      expect(stats.by_status.rejected).toBe(1);
      expect(stats.by_status.draft).toBe(1);
      // conversion = accepted / (sent + accepted + rejected) = 2 / (1+2+1) = 50%
      expect(stats.conversion_rate).toBe(50);
    });

    it('gibt Conversion Rate 0 wenn keine versendeten Angebote', async () => {
      mockSelect.mockReturnValueOnce(
        Promise.resolve({
          data: [
            { status: 'draft', snapshot_gross_total: 500 },
          ],
          error: null,
        })
      );

      const stats = await OfferService.getOfferStats();

      expect(stats.conversion_rate).toBe(0);
    });

    it('summiert Werte nach Status korrekt', async () => {
      mockSelect.mockReturnValueOnce(
        Promise.resolve({
          data: [
            { status: 'accepted', snapshot_gross_total: 1000 },
            { status: 'accepted', snapshot_gross_total: 2000 },
            { status: 'sent', snapshot_gross_total: null },
          ],
          error: null,
        })
      );

      const stats = await OfferService.getOfferStats();

      expect(stats.total_value.accepted).toBe(3000);
      // null snapshot_gross_total should be treated as 0
      expect(stats.total_value.sent).toBe(0);
    });

    it('gibt leere Statistik bei keinen Angeboten', async () => {
      mockSelect.mockReturnValueOnce(
        Promise.resolve({ data: [], error: null })
      );

      const stats = await OfferService.getOfferStats();

      expect(stats.total).toBe(0);
      expect(stats.conversion_rate).toBe(0);
    });
  });

  // =============================================
  // Pagination
  // =============================================

  describe('getOffers - Paginierung', () => {
    it('berechnet Pagination-Metadaten korrekt', async () => {
      mockExecuteWithCount.mockResolvedValueOnce({
        data: [{ id: 'offer-1' }],
        count: 25,
      });

      const result = await OfferService.getOffers({ page: 2, limit: 10 });

      expect(result.pagination.page).toBe(2);
      expect(result.pagination.total_items).toBe(25);
      expect(result.pagination.total_pages).toBe(3);
      expect(result.pagination.has_next).toBe(true);
      expect(result.pagination.has_prev).toBe(true);
    });

    it('hat has_next=false auf letzter Seite', async () => {
      mockExecuteWithCount.mockResolvedValueOnce({
        data: [{ id: 'offer-1' }],
        count: 5,
      });

      const result = await OfferService.getOffers({ page: 1, limit: 10 });

      expect(result.pagination.has_next).toBe(false);
    });
  });
});
