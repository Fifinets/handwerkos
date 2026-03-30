import { describe, it, expect } from 'vitest';
import {
  parseDatanormLine,
  parseDatanormFile,
  mergeRecordsToArticles,
  parsePriceCents,
  parseDatanormDate,
  normalizeUnit,
} from './datanormParser';

// ============================================================
// Test Fixtures — Echte Datanorm 4.0 Zeilen (anonymisiert)
// ============================================================
const FIXTURE_A_RECORD = 'A;2049784;NYM-J 3x1,5 mm2 gr;Ring 100m;0;3250;MTR;EL01';
const FIXTURE_A_RECORD_2 = 'A;1234567;Schuko-Steckdose UP;reinweiss;0;890;STK;EL02';
const FIXTURE_B_RECORD = 'B;2049784;1;Mantelleitung NYM-J 3x1,5mm2 grau, 100m Ring';
const FIXTURE_B_RECORD_2 = 'B;2049784;2;nach VDE 0250, halogenfrei';
const FIXTURE_P_RECORD = 'P;2049784;1;3250;C;010126;EUR';
const FIXTURE_P_RECORD_EK = 'P;2049784;2;2100;C;010126;EUR';
const FIXTURE_R_RECORD = 'R;EL01;Leitungen und Kabel;35';
const FIXTURE_R_RECORD_2 = 'R;EL02;Schalter und Steckdosen;42';

// Komplettes Testfile
const FIXTURE_FULL_FILE = [
  FIXTURE_R_RECORD,
  FIXTURE_R_RECORD_2,
  FIXTURE_A_RECORD,
  FIXTURE_A_RECORD_2,
  FIXTURE_B_RECORD,
  FIXTURE_B_RECORD_2,
  FIXTURE_P_RECORD,
  FIXTURE_P_RECORD_EK,
].join('\n');

// ============================================================
// Hilfsfunktionen
// ============================================================
describe('parsePriceCents', () => {
  it('should parse integer cent string to EUR', () => {
    expect(parsePriceCents('3250')).toBe(32.50);
  });

  it('should parse zero', () => {
    expect(parsePriceCents('0')).toBe(0);
  });

  it('should parse large prices', () => {
    expect(parsePriceCents('1234567')).toBe(12345.67);
  });

  it('should handle empty string', () => {
    expect(parsePriceCents('')).toBe(0);
  });

  it('should handle whitespace-padded strings', () => {
    expect(parsePriceCents('  3250  ')).toBe(32.50);
  });
});

describe('parseDatanormDate', () => {
  it('should parse TTMMJJ to ISO date', () => {
    expect(parseDatanormDate('010126')).toBe('2026-01-01');
  });

  it('should parse another date', () => {
    expect(parseDatanormDate('150325')).toBe('2025-03-15');
  });

  it('should return empty string for empty input', () => {
    expect(parseDatanormDate('')).toBe('');
  });
});

describe('normalizeUnit', () => {
  it('should map MTR to m', () => {
    expect(normalizeUnit('MTR')).toBe('m');
  });

  it('should map STK to Stk', () => {
    expect(normalizeUnit('STK')).toBe('Stk');
  });

  it('should map empty to Stk', () => {
    expect(normalizeUnit('')).toBe('Stk');
  });

  it('should preserve unknown units', () => {
    expect(normalizeUnit('XYZ')).toBe('XYZ');
  });
});

// ============================================================
// Einzelzeilen-Parser
// ============================================================
describe('parseDatanormLine', () => {
  it('should parse an A-record (Artikelstamm)', () => {
    const result = parseDatanormLine(FIXTURE_A_RECORD);
    expect(result).not.toBeNull();
    expect(result!.recordType).toBe('A');
    if (result!.recordType === 'A') {
      expect(result!.articleNumber).toBe('2049784');
      expect(result!.shortText1).toBe('NYM-J 3x1,5 mm2 gr');
      expect(result!.shortText2).toBe('Ring 100m');
      expect(result!.price).toBe(32.50);
      expect(result!.unit).toBe('m');
      expect(result!.discountGroup).toBe('EL01');
    }
  });

  it('should parse a B-record (Langtext)', () => {
    const result = parseDatanormLine(FIXTURE_B_RECORD);
    expect(result).not.toBeNull();
    expect(result!.recordType).toBe('B');
    if (result!.recordType === 'B') {
      expect(result!.articleNumber).toBe('2049784');
      expect(result!.lineNumber).toBe(1);
      expect(result!.text).toBe('Mantelleitung NYM-J 3x1,5mm2 grau, 100m Ring');
    }
  });

  it('should parse a P-record (Preis)', () => {
    const result = parseDatanormLine(FIXTURE_P_RECORD);
    expect(result).not.toBeNull();
    expect(result!.recordType).toBe('P');
    if (result!.recordType === 'P') {
      expect(result!.articleNumber).toBe('2049784');
      expect(result!.priceType).toBe('1');
      expect(result!.price).toBe(32.50);
      expect(result!.priceUnit).toBe('C');
      expect(result!.validFrom).toBe('2026-01-01');
      expect(result!.currency).toBe('EUR');
    }
  });

  it('should parse an R-record (Rabattgruppe)', () => {
    const result = parseDatanormLine(FIXTURE_R_RECORD);
    expect(result).not.toBeNull();
    expect(result!.recordType).toBe('R');
    if (result!.recordType === 'R') {
      expect(result!.groupCode).toBe('EL01');
      expect(result!.groupName).toBe('Leitungen und Kabel');
      expect(result!.discountPercent).toBe(35);
    }
  });

  it('should return null for empty lines', () => {
    expect(parseDatanormLine('')).toBeNull();
    expect(parseDatanormLine('   ')).toBeNull();
  });

  it('should return null for comment lines', () => {
    expect(parseDatanormLine('# Kommentar')).toBeNull();
    expect(parseDatanormLine('// Header')).toBeNull();
  });

  it('should return null for unknown record types', () => {
    expect(parseDatanormLine('X;unknown;data')).toBeNull();
  });
});

// ============================================================
// Datei-Parser
// ============================================================
describe('parseDatanormFile', () => {
  it('should parse a complete file with all record types', () => {
    const result = parseDatanormFile(FIXTURE_FULL_FILE);

    expect(result.parsedLines).toBe(8);
    expect(result.errors).toHaveLength(0);
  });

  it('should collect categories from R-records', () => {
    const result = parseDatanormFile(FIXTURE_FULL_FILE);

    expect(result.categories).toHaveLength(2);
    expect(result.categories[0].groupCode).toBe('EL01');
    expect(result.categories[1].groupCode).toBe('EL02');
  });

  it('should merge A + B + P records into articles', () => {
    const result = parseDatanormFile(FIXTURE_FULL_FILE);

    expect(result.articles).toHaveLength(2);

    const cable = result.articles.find(a => a.articleNumber === '2049784');
    expect(cable).toBeDefined();
    expect(cable!.shortText1).toBe('NYM-J 3x1,5 mm2 gr');
    expect(cable!.longText).toBe(
      'Mantelleitung NYM-J 3x1,5mm2 grau, 100m Ring\nnach VDE 0250, halogenfrei'
    );
    expect(cable!.listPrice).toBe(32.50);
    expect(cable!.unit).toBe('m');
    expect(cable!.prices).toHaveLength(2);
  });

  it('should handle files with only A-records', () => {
    const result = parseDatanormFile(FIXTURE_A_RECORD);

    expect(result.articles).toHaveLength(1);
    expect(result.categories).toHaveLength(0);
    expect(result.articles[0].articleNumber).toBe('2049784');
  });

  it('should track parsing errors without crashing', () => {
    const badFile = [
      FIXTURE_A_RECORD,
      'A;INCOMPLETE',
      FIXTURE_A_RECORD_2,
    ].join('\n');

    const result = parseDatanormFile(badFile);

    expect(result.articles).toHaveLength(2);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].line).toBe(2);
  });

  it('should handle empty file', () => {
    const result = parseDatanormFile('');
    expect(result.articles).toHaveLength(0);
    expect(result.totalLines).toBe(0);
  });

  it('should handle Windows line endings (CRLF)', () => {
    const crlfFile = FIXTURE_FULL_FILE.replace(/\n/g, '\r\n');
    const result = parseDatanormFile(crlfFile);
    expect(result.articles).toHaveLength(2);
  });

  it('should map discount group to category via R-records', () => {
    const result = parseDatanormFile(FIXTURE_FULL_FILE);
    const cable = result.articles.find(a => a.articleNumber === '2049784');

    expect(cable!.categoryCode).toBe('EL01');
    expect(cable!.categoryName).toBe('Leitungen und Kabel');
  });
});

// ============================================================
// mergeRecordsToArticles
// ============================================================
describe('mergeRecordsToArticles', () => {
  it('should merge B-record longtext into article', () => {
    const records = [
      parseDatanormLine(FIXTURE_A_RECORD)!,
      parseDatanormLine(FIXTURE_B_RECORD)!,
      parseDatanormLine(FIXTURE_B_RECORD_2)!,
    ];
    const categories = [parseDatanormLine(FIXTURE_R_RECORD)!] as any[];
    const articles = mergeRecordsToArticles(records, categories);

    expect(articles).toHaveLength(1);
    expect(articles[0].longText).toContain('Mantelleitung');
    expect(articles[0].longText).toContain('halogenfrei');
  });

  it('should attach multiple prices to one article', () => {
    const records = [
      parseDatanormLine(FIXTURE_A_RECORD)!,
      parseDatanormLine(FIXTURE_P_RECORD)!,
      parseDatanormLine(FIXTURE_P_RECORD_EK)!,
    ];
    const articles = mergeRecordsToArticles(records, []);

    expect(articles[0].prices).toHaveLength(2);
    expect(articles[0].prices![0].priceType).toBe('1');
    expect(articles[0].prices![1].priceType).toBe('2');
  });
});
