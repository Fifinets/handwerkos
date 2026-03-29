import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock Supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
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
  }),
  ApiError: class ApiError extends Error {
    code: string;
    constructor(message: string, code: string) {
      super(message);
      this.code = code;
    }
  },
  API_ERROR_CODES: {},
}));

vi.mock('./auditLogService', () => ({
  auditLogService: {
    createAuditLog: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock('./eventBus', () => ({
  eventBus: { emit: vi.fn() },
}));

import { DATEVService, type DATEVTransaction, type DATEVVATRate } from './datevService';

describe('DATEVService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =============================================
  // VAT Mappings
  // =============================================

  describe('getVATMappings - USt-Zuordnungen', () => {
    it('gibt alle drei deutschen USt-Saetze zurueck', async () => {
      const mappings = await DATEVService.getVATMappings();

      expect(mappings).toHaveLength(3);
      expect(mappings.map(m => m.vat_rate)).toEqual([19, 7, 0]);
    });

    it('ordnet 19% dem Standardsteuersatz zu', async () => {
      const mappings = await DATEVService.getVATMappings();
      const vat19 = mappings.find(m => m.vat_rate === 19);

      expect(vat19).toBeDefined();
      expect(vat19!.bu_code).toBe('1');
      expect(vat19!.account_revenue).toBe('8400');
      expect(vat19!.account_vat_out).toBe('1776');
      expect(vat19!.account_vat_in).toBe('1576');
    });

    it('ordnet 7% dem ermaessigten Steuersatz zu', async () => {
      const mappings = await DATEVService.getVATMappings();
      const vat7 = mappings.find(m => m.vat_rate === 7);

      expect(vat7).toBeDefined();
      expect(vat7!.bu_code).toBe('2');
      expect(vat7!.account_revenue).toBe('8300');
      expect(vat7!.account_vat_out).toBe('1771');
      expect(vat7!.account_vat_in).toBe('1571');
    });

    it('ordnet 0% steuerfreien Erloesen zu', async () => {
      const mappings = await DATEVService.getVATMappings();
      const vat0 = mappings.find(m => m.vat_rate === 0);

      expect(vat0).toBeDefined();
      expect(vat0!.bu_code).toBe('0');
      expect(vat0!.account_revenue).toBe('8100');
    });
  });

  // =============================================
  // DATEV Compliance Validation
  // =============================================

  describe('validateDATEVCompliance - Format-Validierung', () => {
    const validTransaction: DATEVTransaction = {
      id: 'tx-1',
      transaction_type: 'INVOICE',
      booking_date: '2026-03-15',
      value_date: '2026-03-15',
      document_number: 'RE-2026-000001',
      debit_account: '1400',
      credit_account: '8400',
      amount: 1190,
      vat_rate: 19 as DATEVVATRate,
      vat_amount: 190,
      net_amount: 1000,
      currency: 'EUR',
      booking_text: 'Rechnung RE-2026-000001',
    };

    it('validiert korrekte Transaktion als gueltig', async () => {
      const result = await DATEVService.validateDATEVCompliance([validTransaction]);

      expect(result.is_valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('erkennt ungueltige Kontonummer (zu kurz)', async () => {
      const invalid = { ...validTransaction, debit_account: '14' };

      const result = await DATEVService.validateDATEVCompliance([invalid]);

      expect(result.is_valid).toBe(false);
      expect(result.errors).toContain('Ungültige Sollkonto-Nummer: 14');
    });

    it('erkennt ungueltige Kontonummer (zu lang)', async () => {
      const invalid = { ...validTransaction, credit_account: '123456789' };

      const result = await DATEVService.validateDATEVCompliance([invalid]);

      expect(result.is_valid).toBe(false);
      expect(result.errors).toContain('Ungültige Habenkonto-Nummer: 123456789');
    });

    it('erkennt ungueltige Kontonummer (mit Buchstaben)', async () => {
      const invalid = { ...validTransaction, debit_account: '14AB' };

      const result = await DATEVService.validateDATEVCompliance([invalid]);

      expect(result.is_valid).toBe(false);
      expect(result.errors).toContain('Ungültige Sollkonto-Nummer: 14AB');
    });

    it('akzeptiert 4- bis 8-stellige Kontonummern', async () => {
      const valid4 = { ...validTransaction, debit_account: '1400' };
      const valid8 = { ...validTransaction, debit_account: '14000000' };

      const result4 = await DATEVService.validateDATEVCompliance([valid4]);
      const result8 = await DATEVService.validateDATEVCompliance([valid8]);

      expect(result4.is_valid).toBe(true);
      expect(result8.is_valid).toBe(true);
    });

    it('erkennt Betrag <= 0 als ungueltig', async () => {
      const invalid = { ...validTransaction, amount: 0 };

      const result = await DATEVService.validateDATEVCompliance([invalid]);

      expect(result.is_valid).toBe(false);
      expect(result.errors).toContain('Ungültiger Betrag: 0');
    });

    it('erkennt negativen Betrag als ungueltig', async () => {
      const invalid = { ...validTransaction, amount: -100 };

      const result = await DATEVService.validateDATEVCompliance([invalid]);

      expect(result.is_valid).toBe(false);
      expect(result.errors).toContain('Ungültiger Betrag: -100');
    });

    it('erkennt ungueltigen USt-Satz', async () => {
      const invalid = { ...validTransaction, vat_rate: 16 as DATEVVATRate };

      const result = await DATEVService.validateDATEVCompliance([invalid]);

      expect(result.is_valid).toBe(false);
      expect(result.errors).toContain('Ungültiger USt-Satz: 16%');
    });

    it('akzeptiert alle gueltigen USt-Saetze (0, 7, 19)', async () => {
      const tx0 = { ...validTransaction, vat_rate: 0 as DATEVVATRate };
      const tx7 = { ...validTransaction, vat_rate: 7 as DATEVVATRate };
      const tx19 = { ...validTransaction, vat_rate: 19 as DATEVVATRate };

      const result = await DATEVService.validateDATEVCompliance([tx0, tx7, tx19]);

      expect(result.is_valid).toBe(true);
    });

    it('erkennt ungueltiges Buchungsdatum', async () => {
      const invalid = { ...validTransaction, booking_date: 'nicht-ein-datum' };

      const result = await DATEVService.validateDATEVCompliance([invalid]);

      expect(result.is_valid).toBe(false);
      expect(result.errors.some(e => e.includes('Ungültiges Buchungsdatum'))).toBe(true);
    });

    it('warnt bei zu langem Buchungstext (> 60 Zeichen)', async () => {
      const longText = 'A'.repeat(61);
      const txWithLongText = { ...validTransaction, booking_text: longText };

      const result = await DATEVService.validateDATEVCompliance([txWithLongText]);

      // Text too long is a warning, not an error
      expect(result.is_valid).toBe(true);
      expect(result.warnings.some(w => w.includes('Buchungstext zu lang'))).toBe(true);
    });

    it('akzeptiert Buchungstext mit genau 60 Zeichen', async () => {
      const exactText = 'A'.repeat(60);
      const tx = { ...validTransaction, booking_text: exactText };

      const result = await DATEVService.validateDATEVCompliance([tx]);

      expect(result.warnings).toHaveLength(0);
    });

    it('erkennt leere Belegnummer als ungueltig', async () => {
      const invalid = { ...validTransaction, document_number: '' };

      const result = await DATEVService.validateDATEVCompliance([invalid]);

      expect(result.is_valid).toBe(false);
      expect(result.errors.some(e => e.includes('Ungültige Belegnummer'))).toBe(true);
    });

    it('erkennt zu lange Belegnummer (> 36 Zeichen)', async () => {
      const invalid = { ...validTransaction, document_number: 'A'.repeat(37) };

      const result = await DATEVService.validateDATEVCompliance([invalid]);

      expect(result.is_valid).toBe(false);
      expect(result.errors.some(e => e.includes('Ungültige Belegnummer'))).toBe(true);
    });

    it('validiert mehrere Transaktionen und sammelt alle Fehler', async () => {
      const tx1 = { ...validTransaction, amount: -5 };
      const tx2 = { ...validTransaction, debit_account: 'XX' };

      const result = await DATEVService.validateDATEVCompliance([tx1, tx2]);

      expect(result.is_valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
    });

    it('gibt valid=true fuer leeres Array', async () => {
      const result = await DATEVService.validateDATEVCompliance([]);

      expect(result.is_valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  // =============================================
  // CSV Generation
  // =============================================

  describe('generateCSVContent - CSV-Erzeugung', () => {
    const generateCSVContent = (DATEVService as any).generateCSVContent.bind(DATEVService);

    it('generiert EXTF Header-Zeile', () => {
      const csv = generateCSVContent([], '12345', '99999');

      const lines = csv.split('\r\n');
      expect(lines[0]).toContain('"EXTF"');
      expect(lines[0]).toContain('"700"');
      expect(lines[0]).toContain('"HandwerkOS"');
      expect(lines[0]).toContain('"12345"'); // Consultant number
      expect(lines[0]).toContain('"99999"'); // Client number
    });

    it('generiert Spalten-Header als zweite Zeile', () => {
      const csv = generateCSVContent([]);

      const lines = csv.split('\r\n');
      expect(lines[1]).toContain('"Umsatz (ohne Soll/Haben-Kz)"');
      expect(lines[1]).toContain('"Konto"');
      expect(lines[1]).toContain('"Buchungstext"');
    });

    it('formatiert Betraege mit Komma als Dezimaltrenner', () => {
      const transactions: DATEVTransaction[] = [{
        id: 'tx-1',
        transaction_type: 'INVOICE',
        booking_date: '2026-03-15',
        value_date: '2026-03-15',
        document_number: 'RE-001',
        debit_account: '1400',
        credit_account: '8400',
        amount: 1190.50,
        vat_rate: 19 as DATEVVATRate,
        vat_amount: 190.50,
        net_amount: 1000.00,
        currency: 'EUR',
        booking_text: 'Test Rechnung',
      }];

      const csv = generateCSVContent(transactions);
      const dataLine = csv.split('\r\n')[2]; // Third line is first data row

      // German format uses comma for decimals
      expect(dataLine).toContain('"1190,50"');
      expect(dataLine).toContain('"1000,00"');
    });

    it('verwendet Semikolon als Trennzeichen', () => {
      const csv = generateCSVContent([]);

      const lines = csv.split('\r\n');
      // Each line should use semicolons
      expect(lines[0].includes(';')).toBe(true);
    });

    it('umschliesst Felder mit Anfuehrungszeichen', () => {
      const transactions: DATEVTransaction[] = [{
        id: 'tx-1',
        transaction_type: 'INVOICE',
        booking_date: '2026-03-15',
        value_date: '2026-03-15',
        document_number: 'RE-001',
        debit_account: '1400',
        credit_account: '8400',
        amount: 100,
        vat_rate: 19 as DATEVVATRate,
        vat_amount: 19,
        net_amount: 81,
        currency: 'EUR',
        booking_text: 'Test',
      }];

      const csv = generateCSVContent(transactions);
      const dataLine = csv.split('\r\n')[2];

      // All fields should be quoted
      expect(dataLine).toMatch(/^"[^"]*"(;"[^"]*")*$/);
    });

    it('formatiert Buchungsdatum ohne Bindestriche', () => {
      const transactions: DATEVTransaction[] = [{
        id: 'tx-1',
        transaction_type: 'INVOICE',
        booking_date: '2026-03-15',
        value_date: '2026-03-15',
        document_number: 'RE-001',
        debit_account: '1400',
        credit_account: '8400',
        amount: 100,
        vat_rate: 19 as DATEVVATRate,
        vat_amount: 19,
        net_amount: 81,
        currency: 'EUR',
        booking_text: 'Test',
      }];

      const csv = generateCSVContent(transactions);
      const dataLine = csv.split('\r\n')[2];

      // Date should be YYYYMMDD format
      expect(dataLine).toContain('"20260315"');
    });

    it('verwendet CRLF Zeilenumbrueche', () => {
      const csv = generateCSVContent([]);

      expect(csv).toContain('\r\n');
      expect(csv.split('\r\n').length).toBeGreaterThanOrEqual(2);
    });
  });

  // =============================================
  // Transaction Row Formatting
  // =============================================

  describe('transactionToCSVRow - Zeilen-Formatierung', () => {
    const transactionToCSVRow = (DATEVService as any).transactionToCSVRow.bind(DATEVService);

    it('setzt Soll/Haben-Kennzeichen auf S', () => {
      const tx: DATEVTransaction = {
        id: 'tx-1',
        transaction_type: 'INVOICE',
        booking_date: '2026-01-01',
        value_date: '2026-01-01',
        document_number: 'RE-001',
        debit_account: '1400',
        credit_account: '8400',
        amount: 100,
        vat_rate: 19 as DATEVVATRate,
        vat_amount: 19,
        net_amount: 81,
        currency: 'EUR',
        booking_text: 'Test',
      };

      const row = transactionToCSVRow(tx);

      // Second field should be S (Soll)
      const fields = row.split(';');
      expect(fields[1]).toBe('"S"');
    });

    it('setzt WKZ auf EUR', () => {
      const tx: DATEVTransaction = {
        id: 'tx-1',
        transaction_type: 'INVOICE',
        booking_date: '2026-01-01',
        value_date: '2026-01-01',
        document_number: 'RE-001',
        debit_account: '1400',
        credit_account: '8400',
        amount: 100,
        vat_rate: 0 as DATEVVATRate,
        vat_amount: 0,
        net_amount: 100,
        currency: 'EUR',
        booking_text: 'Test',
      };

      const row = transactionToCSVRow(tx);
      const fields = row.split(';');

      expect(fields[2]).toBe('"EUR"');
    });
  });

  // =============================================
  // File Name Generation
  // =============================================

  describe('generateFileName - Dateiname', () => {
    const generateFileName = (DATEVService as any).generateFileName.bind(DATEVService);

    it('generiert korrekten Dateinamen fuer FULL Export', () => {
      const period = { from_date: '2026-01-01', to_date: '2026-03-31' };

      const fileName = generateFileName(period, 'FULL');

      expect(fileName).toBe('DATEV_FULL_20260101.csv');
    });

    it('generiert korrekten Dateinamen fuer INCREMENTAL Export', () => {
      const period = { from_date: '2026-03-01', to_date: '2026-03-31' };

      const fileName = generateFileName(period, 'INCREMENTAL');

      expect(fileName).toBe('DATEV_INCR_20260301.csv');
    });
  });

  // =============================================
  // Account Number Validation
  // =============================================

  describe('isValidAccountNumber - Kontonummer-Validierung', () => {
    const isValidAccountNumber = (DATEVService as any).isValidAccountNumber.bind(DATEVService);

    it('akzeptiert 4-stellige Kontonummern', () => {
      expect(isValidAccountNumber('1400')).toBe(true);
    });

    it('akzeptiert 8-stellige Kontonummern', () => {
      expect(isValidAccountNumber('14000000')).toBe(true);
    });

    it('lehnt 3-stellige Kontonummern ab', () => {
      expect(isValidAccountNumber('140')).toBe(false);
    });

    it('lehnt 9-stellige Kontonummern ab', () => {
      expect(isValidAccountNumber('140000000')).toBe(false);
    });

    it('lehnt Buchstaben ab', () => {
      expect(isValidAccountNumber('14AB')).toBe(false);
    });

    it('lehnt Sonderzeichen ab', () => {
      expect(isValidAccountNumber('14-0')).toBe(false);
    });

    it('lehnt leere Strings ab', () => {
      expect(isValidAccountNumber('')).toBe(false);
    });
  });

  // =============================================
  // Date Validation
  // =============================================

  describe('isValidDate - Datums-Validierung', () => {
    const isValidDate = (DATEVService as any).isValidDate.bind(DATEVService);

    it('akzeptiert gueltiges ISO-Datum', () => {
      expect(isValidDate('2026-03-15')).toBe(true);
    });

    it('akzeptiert Datum mit Uhrzeit', () => {
      expect(isValidDate('2026-03-15T10:30:00Z')).toBe(true);
    });

    it('lehnt ungueltiges Datum ab', () => {
      expect(isValidDate('not-a-date')).toBe(false);
    });

    it('lehnt leeren String ab', () => {
      expect(isValidDate('')).toBe(false);
    });
  });

  // =============================================
  // Account Mapping
  // =============================================

  describe('getAccountMapping', () => {
    it('gibt null zurueck wenn kein Mapping existiert', async () => {
      mockExecuteSingle.mockRejectedValueOnce(new Error('No rows'));

      const result = await DATEVService.getAccountMapping('customer', 'cust-1');

      expect(result).toBeNull();
    });

    it('gibt Mapping zurueck wenn vorhanden', async () => {
      const mapping = {
        id: 'map-1',
        entity_type: 'customer',
        entity_id: 'cust-1',
        datev_account: '10001',
        account_type: 'ASSET',
        account_name: 'Debitor Müller GmbH',
        is_active: true,
      };

      mockExecuteSingle.mockResolvedValueOnce(mapping);

      const result = await DATEVService.getAccountMapping('customer', 'cust-1');

      expect(result).toEqual(mapping);
      expect(result!.datev_account).toBe('10001');
    });
  });
});
