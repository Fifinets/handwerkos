// Pure Datanorm 4.0 parser — no Supabase dependency, fully testable
// Supports semicolon-separated Datanorm 4.0 format (Satzart A/B/P/R)

import type {
  DatanormRecord,
  DatanormRecordA,
  DatanormRecordB,
  DatanormRecordP,
  DatanormRecordR,
  ParsedArticle,
  DatanormParseResult,
} from '@/types/article';
import { DATANORM_UNIT_MAP } from '@/types/article';

// ============================================================
// Hilfsfunktionen
// ============================================================

/**
 * Parst einen Cent-String zu EUR.
 * Datanorm speichert Preise als Ganzzahl in Cent (z.B. "3250" = 32,50 EUR).
 */
export function parsePriceCents(raw: string): number {
  const trimmed = raw.trim();
  if (!trimmed) return 0;
  const cents = parseInt(trimmed, 10);
  if (isNaN(cents)) return 0;
  return cents / 100;
}

/**
 * Parst ein Datanorm-Datum (TTMMJJ) zu ISO-Format (YYYY-MM-DD).
 */
export function parseDatanormDate(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length !== 6) return '';
  const day = trimmed.substring(0, 2);
  const month = trimmed.substring(2, 4);
  const year = trimmed.substring(4, 6);
  const fullYear = parseInt(year, 10) > 50 ? `19${year}` : `20${year}`;
  return `${fullYear}-${month}-${day}`;
}

/**
 * Normalisiert Datanorm-Mengeneinheiten zu deutschen Kurzformen.
 */
export function normalizeUnit(raw: string): string {
  const upper = raw.trim().toUpperCase();
  return DATANORM_UNIT_MAP[upper] ?? (raw.trim() || 'Stk');
}

// ============================================================
// Zeilen-Parser
// ============================================================

/**
 * Parst eine einzelne Datanorm-Zeile.
 * Gibt null zurueck fuer leere Zeilen, Kommentare und unbekannte Satzarten.
 */
export function parseDatanormLine(line: string): DatanormRecord | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('#') || trimmed.startsWith('//')) return null;

  const fields = trimmed.split(';');
  if (fields.length < 2) return null;

  const recordType = fields[0].trim().toUpperCase();

  try {
    switch (recordType) {
      case 'A':
        return parseARecord(fields);
      case 'B':
        return parseBRecord(fields);
      case 'P':
        return parsePRecord(fields);
      case 'R':
        return parseRRecord(fields);
      default:
        return null;
    }
  } catch {
    return null;
  }
}

function parseARecord(fields: string[]): DatanormRecordA {
  if (fields.length < 8) {
    throw new Error(`A-record needs 8 fields, got ${fields.length}`);
  }
  return {
    recordType: 'A',
    articleNumber: fields[1].trim(),
    shortText1: fields[2].trim(),
    shortText2: fields[3].trim(),
    priceIndicator: fields[4].trim(),
    price: parsePriceCents(fields[5]),
    unit: normalizeUnit(fields[6]),
    discountGroup: fields[7].trim(),
  };
}

function parseBRecord(fields: string[]): DatanormRecordB {
  if (fields.length < 4) {
    throw new Error(`B-record needs 4 fields, got ${fields.length}`);
  }
  return {
    recordType: 'B',
    articleNumber: fields[1].trim(),
    lineNumber: parseInt(fields[2].trim(), 10) || 0,
    text: fields[3].trim(),
  };
}

function parsePRecord(fields: string[]): DatanormRecordP {
  if (fields.length < 7) {
    throw new Error(`P-record needs 7 fields, got ${fields.length}`);
  }
  return {
    recordType: 'P',
    articleNumber: fields[1].trim(),
    priceType: fields[2].trim(),
    price: parsePriceCents(fields[3]),
    priceUnit: fields[4].trim() || 'C',
    validFrom: parseDatanormDate(fields[5]),
    currency: fields[6].trim() || 'EUR',
  };
}

function parseRRecord(fields: string[]): DatanormRecordR {
  if (fields.length < 4) {
    throw new Error(`R-record needs 4 fields, got ${fields.length}`);
  }
  return {
    recordType: 'R',
    groupCode: fields[1].trim(),
    groupName: fields[2].trim(),
    discountPercent: parseFloat(fields[3].trim()) || 0,
  };
}

// ============================================================
// Datei-Parser
// ============================================================

/**
 * Parst den gesamten Inhalt einer Datanorm-Datei.
 * Handhabt CRLF und LF Zeilenenden.
 * Fehlerhafte Zeilen werden uebersprungen und im errors-Array geloggt.
 */
export function parseDatanormFile(content: string): DatanormParseResult {
  if (!content.trim()) {
    return {
      articles: [],
      categories: [],
      totalLines: 0,
      parsedLines: 0,
      errors: [],
    };
  }

  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const records: DatanormRecord[] = [];
  const categories: DatanormRecordR[] = [];
  const errors: DatanormParseResult['errors'] = [];
  let parsedLines = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    const record = parseDatanormLine(line);
    if (record) {
      records.push(record);
      if (record.recordType === 'R') {
        categories.push(record);
      }
      parsedLines++;
    } else if (line.trim() && !line.trim().startsWith('#') && !line.trim().startsWith('//')) {
      const fields = line.split(';');
      const rt = fields[0]?.trim().toUpperCase();
      if (['A', 'B', 'P', 'R'].includes(rt)) {
        errors.push({
          line: i + 1,
          content: line.substring(0, 100),
          error: `Ungueltige ${rt}-Satz: zu wenige Felder (${fields.length})`,
        });
      }
    }
  }

  const articles = mergeRecordsToArticles(records, categories);

  return {
    articles,
    categories,
    totalLines: lines.filter(l => l.trim()).length,
    parsedLines,
    errors,
  };
}

// ============================================================
// Record-Merger: A + B + P -> ParsedArticle
// ============================================================

/**
 * Fuegt A-Saetze (Stamm), B-Saetze (Langtext) und P-Saetze (Preis)
 * zu vollstaendigen Artikeln zusammen.
 */
export function mergeRecordsToArticles(
  records: DatanormRecord[],
  categories: DatanormRecordR[]
): ParsedArticle[] {
  const articleMap = new Map<string, ParsedArticle>();
  const longTextMap = new Map<string, Map<number, string>>();
  const priceMap = new Map<string, ParsedArticle['prices']>();
  const categoryMap = new Map<string, { code: string; name: string }>();

  // Kategorie-Lookup bauen
  for (const cat of categories) {
    categoryMap.set(cat.groupCode, { code: cat.groupCode, name: cat.groupName });
  }

  // Erster Durchlauf: A-Saetze als Basis
  for (const record of records) {
    if (record.recordType === 'A') {
      const category = categoryMap.get(record.discountGroup);
      articleMap.set(record.articleNumber, {
        articleNumber: record.articleNumber,
        shortText1: record.shortText1,
        shortText2: record.shortText2,
        listPrice: record.price,
        priceUnit: record.priceIndicator || 'C',
        unit: record.unit,
        discountGroup: record.discountGroup,
        categoryCode: category?.code,
        categoryName: category?.name,
      });
    }
  }

  // Zweiter Durchlauf: B-Saetze (Langtext)
  for (const record of records) {
    if (record.recordType === 'B') {
      if (!longTextMap.has(record.articleNumber)) {
        longTextMap.set(record.articleNumber, new Map());
      }
      longTextMap.get(record.articleNumber)!.set(record.lineNumber, record.text);
    }
  }

  // Dritter Durchlauf: P-Saetze (Preise)
  for (const record of records) {
    if (record.recordType === 'P') {
      if (!priceMap.has(record.articleNumber)) {
        priceMap.set(record.articleNumber, []);
      }
      priceMap.get(record.articleNumber)!.push({
        priceType: record.priceType,
        price: record.price,
        priceUnit: record.priceUnit,
        validFrom: record.validFrom,
      });
    }
  }

  // Zusammenfuegen
  for (const [articleNumber, article] of articleMap) {
    // Langtext
    const textLines = longTextMap.get(articleNumber);
    if (textLines && textLines.size > 0) {
      const sortedLines = [...textLines.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([, text]) => text);
      article.longText = sortedLines.join('\n');
    }

    // Preise
    const prices = priceMap.get(articleNumber);
    if (prices && prices.length > 0) {
      article.prices = prices;
    }
  }

  return [...articleMap.values()];
}
