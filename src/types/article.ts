// Article (Artikel) DTOs and Zod schemas for HandwerkOS
// Provides type-safe validation for Datanorm imports and article catalog

import { z } from 'zod';

// ============================================================================
// ENUMS
// ============================================================================

export const ArticleSourceEnum = z.enum(['datanorm', 'manual', 'ids_connect']);
export type ArticleSource = z.infer<typeof ArticleSourceEnum>;

export const PriceUnitEnum = z.enum(['C', 'M', 'D']);
// C = pro 1 Stueck, M = pro 1000, D = pro 100
export type PriceUnit = z.infer<typeof PriceUnitEnum>;

export const DatanormImportStatusEnum = z.enum(['pending', 'processing', 'completed', 'failed']);
export type DatanormImportStatus = z.infer<typeof DatanormImportStatusEnum>;

export const DatanormRecordTypeEnum = z.enum(['A', 'B', 'P', 'R']);
export type DatanormRecordType = z.infer<typeof DatanormRecordTypeEnum>;

// ============================================================================
// ARTICLE SCHEMAS
// ============================================================================

export const ArticleCreateSchema = z.object({
  article_number: z.string().min(1, 'Artikelnummer ist erforderlich'),
  ean: z.string().optional(),
  manufacturer_number: z.string().optional(),
  manufacturer: z.string().optional(),
  short_text1: z.string().min(1, 'Kurztext ist erforderlich'),
  short_text2: z.string().optional(),
  long_text: z.string().optional(),
  list_price: z.number().min(0, 'Preis muss positiv sein').default(0),
  price_unit: PriceUnitEnum.default('C'),
  currency: z.string().default('EUR'),
  unit: z.string().default('Stk'),
  packaging_unit: z.number().optional(),
  category_code: z.string().optional(),
  discount_group: z.string().optional(),
  etim_class: z.string().optional(),
  copper_weight: z.number().optional(),
  copper_base_price: z.number().optional(),
  supplier_name: z.string().optional(),
  source: ArticleSourceEnum.default('datanorm'),
});

export const ArticleUpdateSchema = ArticleCreateSchema.partial();

export const ArticleSchema = z.object({
  id: z.string().uuid(),
  company_id: z.string().uuid(),
  article_number: z.string(),
  ean: z.string().nullable(),
  manufacturer_number: z.string().nullable(),
  manufacturer: z.string().nullable(),
  short_text1: z.string(),
  short_text2: z.string().nullable(),
  long_text: z.string().nullable(),
  list_price: z.number(),
  price_unit: z.string(),
  currency: z.string(),
  unit: z.string(),
  packaging_unit: z.number().nullable(),
  category_code: z.string().nullable(),
  discount_group: z.string().nullable(),
  etim_class: z.string().nullable(),
  copper_weight: z.number().nullable(),
  copper_base_price: z.number().nullable(),
  supplier_name: z.string().nullable(),
  datanorm_import_id: z.string().uuid().nullable(),
  source: z.string(),
  is_active: z.boolean(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

// ============================================================================
// ARTICLE PRICE SCHEMAS
// ============================================================================

export const ArticlePriceSchema = z.object({
  id: z.string().uuid(),
  article_id: z.string().uuid(),
  list_price: z.number(),
  net_price: z.number().nullable(),
  valid_from: z.string(),
  valid_until: z.string().nullable(),
  price_unit: z.string(),
  source: z.string(),
  created_at: z.string().datetime(),
});

// ============================================================================
// ARTICLE CATEGORY SCHEMAS
// ============================================================================

export const ArticleCategorySchema = z.object({
  id: z.string().uuid(),
  company_id: z.string().uuid(),
  code: z.string(),
  name: z.string(),
  discount_percent: z.number().nullable(),
  parent_code: z.string().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

// ============================================================================
// DATANORM IMPORT SCHEMAS
// ============================================================================

export const DatanormImportSchema = z.object({
  id: z.string().uuid(),
  company_id: z.string().uuid(),
  file_name: z.string(),
  supplier_name: z.string(),
  total_records: z.number(),
  articles_created: z.number(),
  articles_updated: z.number(),
  prices_updated: z.number(),
  errors: z.number(),
  error_log: z.any(),
  status: DatanormImportStatusEnum,
  started_at: z.string().datetime().nullable(),
  completed_at: z.string().datetime().nullable(),
  imported_by: z.string().uuid().nullable(),
  created_at: z.string().datetime(),
});

// ============================================================================
// DATANORM PARSER TYPES (nicht in DB, nur fuer Parsing)
// ============================================================================

/** Geparster Datanorm A-Satz (Artikelstamm) */
export const DatanormRecordASchema = z.object({
  recordType: z.literal('A'),
  articleNumber: z.string(),
  shortText1: z.string(),
  shortText2: z.string(),
  priceIndicator: z.string(),
  price: z.number(),
  unit: z.string(),
  discountGroup: z.string(),
});

/** Geparster Datanorm B-Satz (Langtext) */
export const DatanormRecordBSchema = z.object({
  recordType: z.literal('B'),
  articleNumber: z.string(),
  lineNumber: z.number(),
  text: z.string(),
});

/** Geparster Datanorm P-Satz (Preis) */
export const DatanormRecordPSchema = z.object({
  recordType: z.literal('P'),
  articleNumber: z.string(),
  priceType: z.string(),
  price: z.number(),
  priceUnit: z.string(),
  validFrom: z.string(),
  currency: z.string(),
});

/** Geparster Datanorm R-Satz (Rabattgruppe/Warengruppe) */
export const DatanormRecordRSchema = z.object({
  recordType: z.literal('R'),
  groupCode: z.string(),
  groupName: z.string(),
  discountPercent: z.number(),
});

export const DatanormRecordSchema = z.discriminatedUnion('recordType', [
  DatanormRecordASchema,
  DatanormRecordBSchema,
  DatanormRecordPSchema,
  DatanormRecordRSchema,
]);

/** Zusammengefuegter Artikel nach Parsing aller Satzarten */
export const ParsedArticleSchema = z.object({
  articleNumber: z.string(),
  shortText1: z.string(),
  shortText2: z.string(),
  longText: z.string().optional(),
  listPrice: z.number(),
  priceUnit: z.string(),
  unit: z.string(),
  discountGroup: z.string(),
  categoryCode: z.string().optional(),
  categoryName: z.string().optional(),
  prices: z.array(z.object({
    priceType: z.string(),
    price: z.number(),
    priceUnit: z.string(),
    validFrom: z.string().optional(),
  })).optional(),
});

/** Ergebnis eines kompletten Datanorm-Parsings */
export const DatanormParseResultSchema = z.object({
  articles: z.array(ParsedArticleSchema),
  categories: z.array(DatanormRecordRSchema),
  totalLines: z.number(),
  parsedLines: z.number(),
  errors: z.array(z.object({
    line: z.number(),
    content: z.string(),
    error: z.string(),
  })),
});

// ============================================================================
// TYPESCRIPT TYPES
// ============================================================================

export type Article = z.infer<typeof ArticleSchema>;
export type ArticleCreate = z.infer<typeof ArticleCreateSchema>;
export type ArticleUpdate = z.infer<typeof ArticleUpdateSchema>;
export type ArticlePrice = z.infer<typeof ArticlePriceSchema>;
export type ArticleCategory = z.infer<typeof ArticleCategorySchema>;
export type DatanormImport = z.infer<typeof DatanormImportSchema>;

export type DatanormRecordA = z.infer<typeof DatanormRecordASchema>;
export type DatanormRecordB = z.infer<typeof DatanormRecordBSchema>;
export type DatanormRecordP = z.infer<typeof DatanormRecordPSchema>;
export type DatanormRecordR = z.infer<typeof DatanormRecordRSchema>;
export type DatanormRecord = z.infer<typeof DatanormRecordSchema>;
export type ParsedArticle = z.infer<typeof ParsedArticleSchema>;
export type DatanormParseResult = z.infer<typeof DatanormParseResultSchema>;

// ============================================================================
// SEARCH TYPES
// ============================================================================

export type ArticleSearchParams = {
  query?: string;
  category?: string;
  supplier?: string;
  limit?: number;
  offset?: number;
};

export type ArticleSearchResult = {
  id: string;
  article_number: string;
  short_text1: string;
  short_text2: string | null;
  list_price: number;
  unit: string;
  category_code: string | null;
  supplier_name: string | null;
  manufacturer: string | null;
  rank: number;
};

export type ArticleFilter = {
  category_code?: string;
  supplier_name?: string;
  source?: ArticleSource;
  search?: string;
  is_active?: boolean;
};

// ============================================================================
// CONSTANTS
// ============================================================================

export const PRICE_UNIT_LABELS: Record<string, string> = {
  C: 'pro Stück',
  M: 'pro 1000',
  D: 'pro 100',
};

export const DATANORM_IMPORT_STATUS_LABELS: Record<DatanormImportStatus, string> = {
  pending: 'Wartend',
  processing: 'Wird verarbeitet',
  completed: 'Abgeschlossen',
  failed: 'Fehlgeschlagen',
};

export const DATANORM_UNIT_MAP: Record<string, string> = {
  STK: 'Stk',
  ST:  'Stk',
  MTR: 'm',
  M:   'm',
  KG:  'kg',
  KGM: 'kg',
  LTR: 'l',
  L:   'l',
  PAK: 'Pak',
  PCE: 'Stk',
  SET: 'Set',
  ROL: 'Rolle',
  BND: 'Bund',
  KRT: 'Karton',
  '':  'Stk',
};
