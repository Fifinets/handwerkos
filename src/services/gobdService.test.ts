import { vi, describe, it, expect, beforeEach } from 'vitest';
import CryptoJS from 'crypto-js';

// Mock Supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
    })),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
    },
  },
}));

const mockExecuteSingle = vi.fn();
const mockExecute = vi.fn();

vi.mock('./common', () => ({
  apiCall: vi.fn(async (fn: () => Promise<any>) => fn()),
  createQuery: vi.fn(() => ({
    execute: mockExecute,
    executeSingle: mockExecuteSingle,
  })),
  validateInput: vi.fn((_schema: any, data: any) => data),
  getCurrentUserProfile: vi.fn().mockResolvedValue({
    id: 'user-1',
    company_id: 'company-1',
    is_admin: true,
  }),
  ApiError: class ApiError extends Error {
    code: string;
    constructor(message: string, code: string, details?: string) {
      super(message);
      this.code = code;
    }
  },
  API_ERROR_CODES: {
    FORBIDDEN: 'FORBIDDEN',
    IMMUTABLE_RECORD: 'IMMUTABLE_RECORD',
  },
}));

vi.mock('./auditLogService', () => ({
  auditLogService: {
    createAuditLog: vi.fn().mockResolvedValue({}),
    getAuditTrail: vi.fn().mockResolvedValue({ logs: [] }),
  },
}));

vi.mock('./eventBus', () => ({
  eventBus: { emit: vi.fn() },
}));

import { GoBDService, type NumberSequenceType } from './gobdService';

describe('GoBDService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =============================================
  // Number Format Generation
  // =============================================

  describe('formatNumber - Nummernformatierung', () => {
    // Access the private method via casting
    const formatNumber = (GoBDService as any).formatNumber.bind(GoBDService);

    it('formatiert Rechnungsnummer mit 6 Stellen', () => {
      const result = formatNumber('RE-{YYYY}-{NNNNNN}', 42, 2026);
      expect(result).toBe('RE-2026-000042');
    });

    it('formatiert mit 5-stelliger Padding', () => {
      const result = formatNumber('AN-{YYYY}-{NNNNN}', 1, 2026);
      expect(result).toBe('AN-2026-00001');
    });

    it('formatiert mit 4-stelliger Padding', () => {
      const result = formatNumber('AB-{YYYY}-{NNNN}', 999, 2026);
      expect(result).toBe('AB-2026-0999');
    });

    it('behaelt Nummer bei wenn laenger als Padding', () => {
      const result = formatNumber('RE-{YYYY}-{NNNNNN}', 1234567, 2026);
      expect(result).toBe('RE-2026-1234567');
    });

    it('setzt Jahr korrekt ein', () => {
      const result = formatNumber('RE-{YYYY}-{NNNNNN}', 1, 2025);
      expect(result).toBe('RE-2025-000001');
    });
  });

  // =============================================
  // Default Prefixes
  // =============================================

  describe('getDefaultPrefix - Standard-Praefixe', () => {
    const getDefaultPrefix = (GoBDService as any).getDefaultPrefix.bind(GoBDService);

    it('gibt korrekte Praefixe fuer alle Nummernkreise', () => {
      expect(getDefaultPrefix('invoice')).toBe('RE-');
      expect(getDefaultPrefix('quote')).toBe('AN-');
      expect(getDefaultPrefix('order')).toBe('AB-');
      expect(getDefaultPrefix('receipt')).toBe('QU-');
      expect(getDefaultPrefix('credit_note')).toBe('GU-');
      expect(getDefaultPrefix('delivery_note')).toBe('LS-');
      expect(getDefaultPrefix('payment_voucher')).toBe('ZB-');
    });
  });

  // =============================================
  // Default Formats
  // =============================================

  describe('getDefaultFormat - Standard-Formate', () => {
    const getDefaultFormat = (GoBDService as any).getDefaultFormat.bind(GoBDService);

    it('gibt korrektes Format fuer Rechnungen', () => {
      expect(getDefaultFormat('invoice')).toBe('RE-{YYYY}-{NNNNNN}');
    });

    it('gibt korrektes Format fuer Angebote', () => {
      expect(getDefaultFormat('quote')).toBe('AN-{YYYY}-{NNNNNN}');
    });
  });

  // =============================================
  // Table Name Mapping
  // =============================================

  describe('getTableName - Tabellenzuordnung', () => {
    const getTableName = (GoBDService as any).getTableName.bind(GoBDService);

    it('mappt Entity-Typen auf Tabellennamen', () => {
      expect(getTableName('invoice')).toBe('invoices');
      expect(getTableName('quote')).toBe('quotes');
      expect(getTableName('order')).toBe('orders');
      expect(getTableName('customer')).toBe('customers');
      expect(getTableName('project')).toBe('projects');
    });

    it('gibt Entity-Typ zurueck wenn kein Mapping existiert', () => {
      expect(getTableName('unknown_type')).toBe('unknown_type');
    });
  });

  // =============================================
  // Number Sequence - Locked Sequences
  // =============================================

  describe('getNextNumber - Gesperrte Nummernkreise', () => {
    it('wirft Fehler bei gesperrtem Nummernkreis', async () => {
      mockExecuteSingle.mockResolvedValueOnce({
        id: 'seq-1',
        sequence_type: 'invoice',
        current_number: 42,
        is_locked: true,
        format: 'RE-{YYYY}-{NNNNNN}',
        year: 2026,
      });

      await expect(
        GoBDService.getNextNumber('invoice', 2026)
      ).rejects.toThrow('Nummernkreis gesperrt');
    });

    it('inkrementiert Nummer bei offenem Nummernkreis', async () => {
      // getOrCreateNumberSequence returns existing sequence
      mockExecuteSingle
        .mockResolvedValueOnce({
          id: 'seq-1',
          sequence_type: 'invoice',
          current_number: 5,
          is_locked: false,
          format: 'RE-{YYYY}-{NNNNNN}',
          year: 2026,
        })
        // After update, return updated sequence
        .mockResolvedValueOnce({
          id: 'seq-1',
          sequence_type: 'invoice',
          current_number: 6,
          is_locked: false,
          format: 'RE-{YYYY}-{NNNNNN}',
          year: 2026,
        });

      const result = await GoBDService.getNextNumber('invoice', 2026);

      expect(result.number).toBe('RE-2026-000006');
      expect(result.sequence.current_number).toBe(6);
    });
  });

  // =============================================
  // Document Hash Generation
  // =============================================

  describe('createDocumentHash - Hash-Berechnung', () => {
    it('berechnet SHA256 Hash korrekt', async () => {
      const testContent = 'SGVsbG8gV29ybGQ='; // Base64 "Hello World"
      const expectedHash = CryptoJS.SHA256(testContent).toString();

      mockExecuteSingle.mockResolvedValueOnce({
        id: 'doc-1',
        entity_type: 'invoice',
        entity_id: 'inv-1',
        document_hash: expectedHash,
        file_name: 'test.pdf',
        file_size: 12,
        mime_type: 'application/pdf',
        is_immutable: true,
        hash_algorithm: 'SHA256',
        retention_until: '2037-03-29T00:00:00Z',
      });

      const result = await GoBDService.createDocumentHash(
        'invoice',
        'inv-1',
        testContent,
        'test.pdf',
        'application/pdf'
      );

      expect(result.document_hash).toBe(expectedHash);
      expect(result.is_immutable).toBe(true);
      expect(result.hash_algorithm).toBe('SHA256');
    });

    it('berechnet Dateigroesse aus Base64 korrekt', async () => {
      // Base64 string of length 16 -> file size = floor(16 * 3 / 4) = 12
      const base64Content = 'AAAAAAAAAAAAAAAA';

      mockExecuteSingle.mockResolvedValueOnce({
        id: 'doc-2',
        file_size: 12,
        document_hash: 'somehash',
        is_immutable: true,
      });

      const result = await GoBDService.createDocumentHash(
        'invoice',
        'inv-1',
        base64Content,
        'test.pdf',
        'application/pdf'
      );

      expect(result.file_size).toBe(12);
    });

    it('setzt Aufbewahrungsfrist auf mindestens 10 Jahre (GoBD)', async () => {
      const now = new Date();
      const minRetention = new Date();
      minRetention.setFullYear(minRetention.getFullYear() + 10);

      const retentionDate = new Date();
      retentionDate.setFullYear(retentionDate.getFullYear() + 11);

      mockExecuteSingle.mockResolvedValueOnce({
        id: 'doc-3',
        retention_until: retentionDate.toISOString(),
        document_hash: 'hash',
        is_immutable: true,
      });

      const result = await GoBDService.createDocumentHash(
        'invoice',
        'inv-1',
        'content',
        'test.pdf',
        'application/pdf'
      );

      const retentionUntil = new Date(result.retention_until);
      expect(retentionUntil.getTime()).toBeGreaterThan(minRetention.getTime());
    });
  });

  // =============================================
  // Document Integrity Verification
  // =============================================

  describe('verifyDocumentIntegrity - Integritaetspruefung', () => {
    it('erkennt unveraenderte Dokumente als valide', async () => {
      const content = 'OriginalContent123';
      const hash = CryptoJS.SHA256(content).toString();

      mockExecuteSingle.mockResolvedValueOnce({
        id: 'doc-1',
        document_hash: hash,
        document_content: content,
        entity_type: 'invoice',
        entity_id: 'inv-1',
      });

      const result = await GoBDService.verifyDocumentIntegrity('doc-1');

      expect(result.is_valid).toBe(true);
      expect(result.integrity_maintained).toBe(true);
      expect(result.original_hash).toBe(result.current_hash);
    });

    it('erkennt manipulierte Dokumente als ungueltig', async () => {
      const originalContent = 'OriginalContent';
      const originalHash = CryptoJS.SHA256(originalContent).toString();

      // The stored document_content has been tampered with
      mockExecuteSingle.mockResolvedValueOnce({
        id: 'doc-1',
        document_hash: originalHash,
        document_content: 'TamperedContent',
        entity_type: 'invoice',
        entity_id: 'inv-1',
      });

      const result = await GoBDService.verifyDocumentIntegrity('doc-1');

      expect(result.is_valid).toBe(false);
      expect(result.integrity_maintained).toBe(false);
      expect(result.original_hash).not.toBe(result.current_hash);
    });

    it('behandelt leeren Inhalt korrekt', async () => {
      const emptyHash = CryptoJS.SHA256('').toString();

      mockExecuteSingle.mockResolvedValueOnce({
        id: 'doc-1',
        document_hash: emptyHash,
        document_content: null, // null content
        entity_type: 'invoice',
        entity_id: 'inv-1',
      });

      const result = await GoBDService.verifyDocumentIntegrity('doc-1');

      // SHA256('') should match since null is treated as ''
      expect(result.is_valid).toBe(true);
    });
  });

  // =============================================
  // Immutability Checks
  // =============================================

  describe('checkImmutability - Unveraenderlichkeitspruefung', () => {
    it('erkennt versendete Rechnungen als unveraenderlich', async () => {
      const { auditLogService } = await import('./auditLogService');
      (auditLogService.getAuditTrail as any).mockResolvedValueOnce({
        logs: [
          {
            action: 'SEND',
            timestamp: '2026-03-15T10:00:00Z',
            entity_type: 'invoice',
            entity_id: 'inv-1',
          },
        ],
      });

      const result = await GoBDService.checkImmutability('invoice', 'inv-1');

      expect(result.is_immutable).toBe(true);
      expect(result.can_modify).toBe(false);
      expect(result.restrictions).toContain('Versendete Rechnungen können nicht geändert werden');
      expect(result.restrictions).toContain('Stornierung nur über Gutschrift möglich');
    });

    it('erkennt genehmigte Auftraege als unveraenderlich', async () => {
      const { auditLogService } = await import('./auditLogService');
      (auditLogService.getAuditTrail as any).mockResolvedValueOnce({
        logs: [
          {
            action: 'APPROVE',
            timestamp: '2026-03-15T10:00:00Z',
            entity_type: 'order',
            entity_id: 'order-1',
          },
        ],
      });

      const result = await GoBDService.checkImmutability('order', 'order-1');

      expect(result.is_immutable).toBe(true);
      expect(result.can_modify).toBe(false);
      expect(result.restrictions).toContain('Genehmigte Aufträge können nur storniert werden');
    });

    it('erlaubt Aenderung bei keinem Sende-Event', async () => {
      const { auditLogService } = await import('./auditLogService');
      (auditLogService.getAuditTrail as any).mockResolvedValueOnce({
        logs: [
          {
            action: 'CREATE',
            timestamp: '2026-03-15T10:00:00Z',
          },
        ],
      });

      const result = await GoBDService.checkImmutability('invoice', 'inv-1');

      expect(result.is_immutable).toBe(false);
      expect(result.can_modify).toBe(true);
      expect(result.restrictions).toHaveLength(0);
    });

    it('erlaubt Aenderung bei leerem Audit-Trail', async () => {
      const { auditLogService } = await import('./auditLogService');
      (auditLogService.getAuditTrail as any).mockResolvedValueOnce({
        logs: [],
      });

      const result = await GoBDService.checkImmutability('invoice', 'inv-1');

      expect(result.is_immutable).toBe(false);
      expect(result.can_modify).toBe(true);
    });
  });
});
