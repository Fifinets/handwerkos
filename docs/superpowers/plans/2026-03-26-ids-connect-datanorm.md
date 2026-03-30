# IDS-Connect & Datanorm: Artikeldatenbank fuer HandwerkOS

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Elektro-Grosshaendler-Artikelkataloge (Datanorm 4.0 ZIP-Dateien) importieren, durchsuchbar machen und direkt in Angebotspositionen uebernehmen. Spaeter: ETIM-Klassifikation, Kupferzuschlag, IDS-Connect Live-Anbindung.

**Architecture:** Datanorm 4.0 Parser laeuft komplett client-seitig (pure TypeScript, kein Backend). Geparste Artikel werden in Supabase `articles`-Tabelle gespeichert. Volltextsuche ueber PostgreSQL `tsvector`. ArticlePicker-Komponente wird in den Angebotseditor integriert.

**Tech Stack:** Supabase (PostgreSQL + RLS), Zod Validation, TanStack Query, Vitest (TDD), JSZip (ZIP-Entpacken), bestehende apiCall/createQuery-Pattern

---

## Architektur-Uebersicht

```
Grosshaendler liefert Datanorm-ZIP (z.B. Sonepar, Rexel)
  -> Handwerker laedt ZIP in "Artikel > Import" hoch
  -> Client entpackt ZIP (JSZip)
  -> datanormParser.ts parst Festlaengen-Dateien (A/B/P/R Saetze)
  -> Vorschau: Benutzer sieht geparste Artikel, waehlt Lieferant
  -> Bestaetigung: Batch-Insert in articles-Tabelle
  -> Import-Log in datanorm_imports-Tabelle

Handwerker erstellt Angebot
  -> Oeffnet ArticlePicker (Seitenleiste)
  -> Volltextsuche: "NYM-J 3x1.5"
  -> Klick auf Artikel -> wird als Angebotsposition uebernommen
  -> Preis, ME, Artikelnr werden automatisch befuellt

Spaeter (Phase 2+):
  -> ETIM-Filter: "Klasse: Mantelleitungen" -> Merkmale filtern
  -> Kupferzuschlag: Automatische Kabelpreis-Anpassung
  -> IDS-Connect: Live-Preis/Verfuegbarkeit vom Grosshaendler
```

---

## Datei-Struktur

| Datei | Aktion | Verantwortung |
|-------|--------|---------------|
| `supabase/migrations/20260326100000_create_article_catalog.sql` | NEU | DB: articles, article_prices, datanorm_imports, article_categories |
| `src/types/article.ts` | NEU | Zod-Schemas + TypeScript-Typen fuer Artikel |
| `src/services/datanormParser.ts` | NEU | Pure Datanorm 4.0 Parser (kein Supabase) |
| `src/services/datanormParser.test.ts` | NEU | Vitest-Tests fuer Parser |
| `src/services/articleService.ts` | NEU | CRUD + Import + Suche fuer Artikel |
| `src/hooks/useArticles.ts` | NEU | TanStack Query Hooks fuer Artikel |
| `src/components/articles/ArticleModule.tsx` | NEU | Hauptseite: Artikeldatenbank + Suche |
| `src/components/articles/DatanormImport.tsx` | NEU | ZIP-Upload + Vorschau + Import-Dialog |
| `src/components/articles/ArticleSearch.tsx` | NEU | Volltextsuche mit Filtern |
| `src/components/articles/ArticlePicker.tsx` | NEU | Seitenleiste fuer Angebotseditor |
| `src/hooks/useApi.ts` | AENDERN | Article Query Keys + Hooks registrieren |
| `src/types/index.ts` | AENDERN | Article-Typen exportieren |
| `src/App.tsx` | AENDERN | Route fuer Artikelmodul |
| `src/services/eventBus.ts` | AENDERN | Article-Events hinzufuegen |

---

## Phase 1: Datanorm 4.0 Import (P0)

### Task 1: Datenbank — Artikel-Tabellen + Volltextsuche

**Files:**
- Create: `supabase/migrations/20260326100000_create_article_catalog.sql`

- [ ] **Step 1: Migration schreiben**

```sql
-- ============================================================
-- Article Catalog for Datanorm Import
-- ============================================================

-- 1. Article Categories (Warengruppen from Datanorm R-Saetze)
CREATE TABLE IF NOT EXISTS article_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  code VARCHAR(20) NOT NULL,          -- Warengruppen-Code aus Datanorm
  name VARCHAR(255) NOT NULL,         -- Bezeichnung
  discount_percent DECIMAL(5,2),      -- Rabatt fuer diese Gruppe
  parent_code VARCHAR(20),            -- Hierarchie (optional)
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_id, code)
);

-- 2. Articles (Artikelstamm)
CREATE TABLE IF NOT EXISTS articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- Identifikation
  article_number VARCHAR(50) NOT NULL,       -- Artikelnummer Grosshaendler
  ean VARCHAR(20),                           -- EAN/GTIN
  manufacturer_number VARCHAR(50),           -- Hersteller-Artikelnummer
  manufacturer VARCHAR(255),                 -- Herstellername

  -- Texte
  short_text1 VARCHAR(255) NOT NULL,         -- Kurztext 1 (Datanorm Pos 11-35)
  short_text2 VARCHAR(255),                  -- Kurztext 2 (Datanorm Pos 36-60)
  long_text TEXT,                            -- Langtext (Datanorm B-Satz)

  -- Preis
  list_price DECIMAL(12,4) NOT NULL DEFAULT 0,  -- Listenpreis (Datanorm P-Satz)
  price_unit VARCHAR(10) DEFAULT 'C',           -- Preiskennzeichen: C=1, M=1000, D=100
  currency VARCHAR(3) DEFAULT 'EUR',

  -- Einheit + Verpackung
  unit VARCHAR(20) NOT NULL DEFAULT 'Stk',      -- Mengeneinheit (Datanorm Pos 74-76)
  packaging_unit DECIMAL(10,2),                  -- Verpackungseinheit

  -- Klassifikation
  category_code VARCHAR(20),                     -- Warengruppe (Datanorm R-Satz)
  discount_group VARCHAR(20),                    -- Rabattgruppe (Datanorm Pos 77-79)
  etim_class VARCHAR(20),                        -- ETIM-Klasse (Phase 2)

  -- Kupferzuschlag (Phase 3)
  copper_weight DECIMAL(10,4),                   -- Kupfergewicht kg/Einheit
  copper_base_price DECIMAL(10,2),               -- Basis-Kupferpreis bei Listenpreis

  -- Herkunft
  supplier_name VARCHAR(255),                    -- Grosshaendler-Name
  datanorm_import_id UUID,                       -- Referenz zum Import
  source VARCHAR(50) DEFAULT 'datanorm',         -- datanorm | manual | ids_connect

  -- Status
  is_active BOOLEAN DEFAULT true,

  -- Volltextsuche
  search_vector tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('german', coalesce(article_number, '')), 'A') ||
    setweight(to_tsvector('german', coalesce(short_text1, '')), 'A') ||
    setweight(to_tsvector('german', coalesce(short_text2, '')), 'B') ||
    setweight(to_tsvector('german', coalesce(manufacturer, '')), 'B') ||
    setweight(to_tsvector('german', coalesce(long_text, '')), 'C')
  ) STORED,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Constraints
  UNIQUE(company_id, article_number, supplier_name)
);

-- Volltextsuche-Index
CREATE INDEX IF NOT EXISTS idx_articles_search ON articles USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS idx_articles_company ON articles(company_id);
CREATE INDEX IF NOT EXISTS idx_articles_category ON articles(company_id, category_code);
CREATE INDEX IF NOT EXISTS idx_articles_supplier ON articles(company_id, supplier_name);
CREATE INDEX IF NOT EXISTS idx_articles_ean ON articles(ean) WHERE ean IS NOT NULL;

-- 3. Article Prices (Preishistorie)
CREATE TABLE IF NOT EXISTS article_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  list_price DECIMAL(12,4) NOT NULL,
  net_price DECIMAL(12,4),              -- Nach Rabatt
  valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until DATE,
  price_unit VARCHAR(10) DEFAULT 'C',
  source VARCHAR(50) DEFAULT 'datanorm', -- datanorm | ids_connect | manual
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_article_prices_article ON article_prices(article_id, valid_from DESC);

-- 4. Datanorm Imports (Import-Log)
CREATE TABLE IF NOT EXISTS datanorm_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  file_name VARCHAR(255) NOT NULL,
  supplier_name VARCHAR(255) NOT NULL,

  -- Statistiken
  total_records INTEGER DEFAULT 0,
  articles_created INTEGER DEFAULT 0,
  articles_updated INTEGER DEFAULT 0,
  prices_updated INTEGER DEFAULT 0,
  errors INTEGER DEFAULT 0,
  error_log JSONB DEFAULT '[]'::jsonb,

  -- Status
  status VARCHAR(20) DEFAULT 'pending',  -- pending | processing | completed | failed
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  imported_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_datanorm_imports_company ON datanorm_imports(company_id, created_at DESC);

-- 5. Copper Prices (Phase 3, Tabelle schon anlegen)
CREATE TABLE IF NOT EXISTS copper_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  price_date DATE NOT NULL UNIQUE,
  lme_price_usd DECIMAL(10,2),        -- LME Kupferpreis USD/t
  del_notation DECIMAL(10,2),          -- DEL-Notiz EUR/100kg
  source VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_copper_prices_date ON copper_prices(price_date DESC);

-- 6. RLS Policies
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE article_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE article_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE datanorm_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE copper_prices ENABLE ROW LEVEL SECURITY;

-- articles: Nur eigene Company
CREATE POLICY articles_company_isolation ON articles
  FOR ALL USING (
    company_id IN (
      SELECT p.company_id FROM profiles p WHERE p.id = auth.uid()
    )
  );

-- article_prices: Ueber articles-Relation
CREATE POLICY article_prices_company_isolation ON article_prices
  FOR ALL USING (
    article_id IN (
      SELECT a.id FROM articles a
      JOIN profiles p ON p.company_id = a.company_id
      WHERE p.id = auth.uid()
    )
  );

-- article_categories: Nur eigene Company
CREATE POLICY article_categories_company_isolation ON article_categories
  FOR ALL USING (
    company_id IN (
      SELECT p.company_id FROM profiles p WHERE p.id = auth.uid()
    )
  );

-- datanorm_imports: Nur eigene Company
CREATE POLICY datanorm_imports_company_isolation ON datanorm_imports
  FOR ALL USING (
    company_id IN (
      SELECT p.company_id FROM profiles p WHERE p.id = auth.uid()
    )
  );

-- copper_prices: Alle duerfen lesen (globale Preise)
CREATE POLICY copper_prices_read ON copper_prices
  FOR SELECT USING (true);

-- 7. Hilfsfunktion: Volltextsuche
CREATE OR REPLACE FUNCTION search_articles(
  p_company_id UUID,
  p_query TEXT,
  p_category VARCHAR DEFAULT NULL,
  p_supplier VARCHAR DEFAULT NULL,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE(
  id UUID,
  article_number VARCHAR,
  short_text1 VARCHAR,
  short_text2 VARCHAR,
  list_price DECIMAL,
  unit VARCHAR,
  category_code VARCHAR,
  supplier_name VARCHAR,
  manufacturer VARCHAR,
  rank REAL
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id,
    a.article_number,
    a.short_text1,
    a.short_text2,
    a.list_price,
    a.unit,
    a.category_code,
    a.supplier_name,
    a.manufacturer,
    ts_rank(a.search_vector, websearch_to_tsquery('german', p_query)) AS rank
  FROM articles a
  WHERE a.company_id = p_company_id
    AND a.is_active = true
    AND (
      p_query IS NULL
      OR p_query = ''
      OR a.search_vector @@ websearch_to_tsquery('german', p_query)
      OR a.article_number ILIKE '%' || p_query || '%'
      OR a.short_text1 ILIKE '%' || p_query || '%'
    )
    AND (p_category IS NULL OR a.category_code = p_category)
    AND (p_supplier IS NULL OR a.supplier_name = p_supplier)
  ORDER BY rank DESC NULLS LAST, a.short_text1
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION search_articles(UUID, TEXT, VARCHAR, VARCHAR, INTEGER, INTEGER) TO authenticated;

-- 8. Updated_at Trigger
CREATE OR REPLACE FUNCTION update_articles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER articles_updated_at
  BEFORE UPDATE ON articles
  FOR EACH ROW
  EXECUTE FUNCTION update_articles_updated_at();

CREATE TRIGGER article_categories_updated_at
  BEFORE UPDATE ON article_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_articles_updated_at();
```

- [ ] **Step 2: Migration anwenden**

Via Supabase MCP `apply_migration` oder:
```bash
npx supabase db push
```

- [ ] **Step 3: Supabase Typen regenerieren**

```bash
npx supabase gen types typescript --project-id qgwhkjrhndeoskrxewpb > src/integrations/supabase/types.ts
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260326100000_create_article_catalog.sql src/integrations/supabase/types.ts
git commit -m "feat: create article catalog tables with full-text search"
```

---

### Task 2: Zod-Typen + TypeScript-Schemas

**Files:**
- Create: `src/types/article.ts`
- Modify: `src/types/index.ts`

- [ ] **Step 1: Article-Typen erstellen**

```typescript
// src/types/article.ts
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
  priceType: z.string(),       // 1=Listenpreis, 2=Einkaufspreis
  price: z.number(),
  priceUnit: z.string(),       // C/M/D
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
  C: 'pro Stueck',
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
```

- [ ] **Step 2: In types/index.ts exportieren**

Folgende Zeile in `src/types/index.ts` einfuegen (nach `export * from './offer';`):

```typescript
export * from './article';
```

- [ ] **Step 3: Commit**

```bash
git add src/types/article.ts src/types/index.ts
git commit -m "feat: add article & datanorm Zod schemas and types"
```

---

### Task 3: Datanorm 4.0 Parser (TDD)

**Files:**
- Create: `src/services/datanormParser.ts`
- Create: `src/services/datanormParser.test.ts`

Dieser Task ist der Kern des Features. Der Parser ist **pure TypeScript** ohne Supabase-Abhaengigkeit, daher perfekt fuer Unit-Tests.

#### Datanorm 4.0 Format-Referenz

```
Satzart A (Artikelstamm) — Festlaenge, Semikolon-getrennt in manchen Varianten:
  Feld 1:  Satzart "A"
  Feld 2:  Artikelnummer (max 15 Zeichen)
  Feld 3:  Kurztext Zeile 1 (max 40 Zeichen)
  Feld 4:  Kurztext Zeile 2 (max 40 Zeichen)
  Feld 5:  Preiskennzeichen (1 Zeichen: 0-5)
  Feld 6:  Preis in Cent (max 12 Ziffern, ohne Komma)
  Feld 7:  Mengeneinheit (max 3 Zeichen)
  Feld 8:  Rabattgruppe (max 4 Zeichen)

  Hinweis: Datanorm 4.0 nutzt Semikolon (;) als Feldtrenner.

Satzart B (Langtext):
  Feld 1:  Satzart "B"
  Feld 2:  Artikelnummer
  Feld 3:  Textzeilen-Nummer
  Feld 4:  Text

Satzart P (Preissatz):
  Feld 1:  Satzart "P"
  Feld 2:  Artikelnummer
  Feld 3:  Preisart (1=Liste, 2=Einkauf)
  Feld 4:  Preis in Cent
  Feld 5:  Preiseinheit (C/M/D)
  Feld 6:  Gueltig ab (TTMMJJ)
  Feld 7:  Waehrung (EUR)

Satzart R (Rabatt/Warengruppe):
  Feld 1:  Satzart "R"
  Feld 2:  Warengruppen-Code
  Feld 3:  Warengruppen-Bezeichnung
  Feld 4:  Rabattprozent
```

- [ ] **Step 1: Vitest-Konfiguration sicherstellen**

Falls noch keine `vitest.config.ts` existiert, erstellen wir eine minimale in der `vite.config.ts`:

Pruefen ob `"test": "vitest"` in package.json scripts steht (ist bereits der Fall).

Folgende Config ans Ende von `vite.config.ts` (im `defineConfig`-Objekt) hinzufuegen falls nicht vorhanden:

```typescript
// In vite.config.ts innerhalb defineConfig:
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
```

- [ ] **Step 2: Test-Datei mit Fixtures schreiben**

```typescript
// src/services/datanormParser.test.ts
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
      expect(result!.unit).toBe('m');          // MTR -> m
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
      'A;INCOMPLETE',           // zu wenige Felder
      FIXTURE_A_RECORD_2,
    ].join('\n');

    const result = parseDatanormFile(badFile);

    expect(result.articles).toHaveLength(2);  // Die 2 guten werden geparst
    expect(result.errors).toHaveLength(1);     // 1 Fehler
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
// mergeRecordsToArticles (unit unter der Haube)
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
```

- [ ] **Step 3: Parser implementieren**

```typescript
// src/services/datanormParser.ts
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
      // Zeile ist nicht leer und kein Kommentar, aber konnte nicht geparst werden
      const fields = line.split(';');
      const recordType = fields[0]?.trim().toUpperCase();
      if (['A', 'B', 'P', 'R'].includes(recordType)) {
        errors.push({
          line: i + 1,
          content: line.substring(0, 100),
          error: `Ungueltige ${recordType}-Satz: zu wenige Felder (${fields.length})`,
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
```

- [ ] **Step 4: Tests ausfuehren**

```bash
npx vitest run src/services/datanormParser.test.ts
```

Alle 20+ Tests muessen gruen sein.

- [ ] **Step 5: Commit**

```bash
git add src/services/datanormParser.ts src/services/datanormParser.test.ts
git commit -m "feat: implement Datanorm 4.0 parser with full test suite"
```

---

### Task 4: ArticleService (Supabase CRUD + Import)

**Files:**
- Create: `src/services/articleService.ts`
- Modify: `src/services/eventBus.ts`

- [ ] **Step 1: EventBus erweitern**

In `src/services/eventBus.ts` folgende Events zum `EventType` hinzufuegen:

```typescript
  // Article events
  | 'ARTICLE_IMPORTED'
  | 'ARTICLE_CREATED'
  | 'ARTICLE_UPDATED'
  | 'ARTICLE_DELETED'
  | 'DATANORM_IMPORT_STARTED'
  | 'DATANORM_IMPORT_COMPLETED'
  | 'DATANORM_IMPORT_FAILED'
```

- [ ] **Step 2: ArticleService erstellen**

```typescript
// src/services/articleService.ts
// Article service for HandwerkOS
// Handles CRUD, Datanorm import, and full-text search for articles

import { supabase } from '@/integrations/supabase/client';
import {
  apiCall,
  createQuery,
  validateInput,
  getCurrentUserProfile,
  ApiError,
  API_ERROR_CODES,
} from '@/utils/api';
import type {
  Article,
  ArticleCreate,
  ArticleUpdate,
  ArticleCategory,
  DatanormImport,
  ParsedArticle,
  DatanormParseResult,
  ArticleSearchResult,
  ArticleSearchParams,
  ArticleFilter,
  PaginationQuery,
  PaginationResponse,
} from '@/types';
import { ArticleCreateSchema } from '@/types/article';
import { eventBus } from './eventBus';

const BATCH_SIZE = 500; // Supabase insert limit

export class ArticleService {

  // ================================================================
  // SEARCH (Volltextsuche via RPC)
  // ================================================================

  static async searchArticles(params: ArticleSearchParams): Promise<ArticleSearchResult[]> {
    return apiCall(async () => {
      const profile = await getCurrentUserProfile();

      const { data, error } = await supabase.rpc('search_articles', {
        p_company_id: profile.company_id,
        p_query: params.query || '',
        p_category: params.category || null,
        p_supplier: params.supplier || null,
        p_limit: params.limit || 50,
        p_offset: params.offset || 0,
      });

      if (error) throw error;
      return data || [];
    }, 'Search articles');
  }

  // ================================================================
  // CRUD
  // ================================================================

  static async getArticles(
    pagination?: PaginationQuery,
    filters?: ArticleFilter
  ): Promise<PaginationResponse<Article>> {
    return apiCall(async () => {
      let query = supabase
        .from('articles')
        .select('*', { count: 'exact' });

      if (filters?.category_code) {
        query = query.eq('category_code', filters.category_code);
      }
      if (filters?.supplier_name) {
        query = query.eq('supplier_name', filters.supplier_name);
      }
      if (filters?.source) {
        query = query.eq('source', filters.source);
      }
      if (filters?.is_active !== undefined) {
        query = query.eq('is_active', filters.is_active);
      }
      if (filters?.search) {
        query = query.or(
          `short_text1.ilike.%${filters.search}%,` +
          `article_number.ilike.%${filters.search}%,` +
          `manufacturer.ilike.%${filters.search}%`
        );
      }

      if (pagination) {
        const offset = (pagination.page - 1) * pagination.limit;
        query = query
          .range(offset, offset + pagination.limit - 1)
          .order(pagination.sort_by || 'short_text1', {
            ascending: pagination.sort_order === 'asc',
          });
      } else {
        query = query.order('short_text1', { ascending: true });
      }

      const { data, count } = await createQuery<Article>(query).executeWithCount();

      return {
        items: data,
        pagination: {
          page: pagination?.page || 1,
          limit: pagination?.limit || data.length,
          total_items: count,
          total_pages: Math.ceil(count / (pagination?.limit || 50)),
          has_next: pagination ? (pagination.page * pagination.limit < count) : false,
          has_prev: pagination ? pagination.page > 1 : false,
        },
      };
    }, 'Get articles');
  }

  static async getArticle(id: string): Promise<Article> {
    return apiCall(async () => {
      const query = supabase
        .from('articles')
        .select('*')
        .eq('id', id);
      return createQuery<Article>(query).executeSingle();
    }, `Get article ${id}`);
  }

  static async createArticle(data: ArticleCreate): Promise<Article> {
    return apiCall(async () => {
      const validated = validateInput(ArticleCreateSchema, data);
      const query = supabase
        .from('articles')
        .insert(validated)
        .select()
        .single();
      const article = await createQuery<Article>(query).executeSingle();

      eventBus.emit('ARTICLE_CREATED', {
        article,
        user_id: (await supabase.auth.getUser()).data.user?.id,
      });

      return article;
    }, 'Create article');
  }

  static async updateArticle(id: string, data: ArticleUpdate): Promise<Article> {
    return apiCall(async () => {
      const query = supabase
        .from('articles')
        .update(data)
        .eq('id', id)
        .select()
        .single();
      const article = await createQuery<Article>(query).executeSingle();

      eventBus.emit('ARTICLE_UPDATED', {
        article,
        user_id: (await supabase.auth.getUser()).data.user?.id,
      });

      return article;
    }, `Update article ${id}`);
  }

  // ================================================================
  // DATANORM IMPORT
  // ================================================================

  /**
   * Importiert geparste Datanorm-Artikel in die Datenbank.
   * Erstellt Import-Log, fuehrt Batch-Inserts durch, updated existierende Artikel.
   */
  static async importDatanormArticles(
    parseResult: DatanormParseResult,
    supplierName: string,
    fileName: string
  ): Promise<DatanormImport> {
    return apiCall(async () => {
      const profile = await getCurrentUserProfile();
      const userId = (await supabase.auth.getUser()).data.user?.id;

      // 1. Import-Log erstellen
      const { data: importLog, error: logError } = await supabase
        .from('datanorm_imports')
        .insert({
          company_id: profile.company_id,
          file_name: fileName,
          supplier_name: supplierName,
          total_records: parseResult.articles.length,
          status: 'processing',
          started_at: new Date().toISOString(),
          imported_by: userId,
          error_log: parseResult.errors,
        })
        .select()
        .single();

      if (logError) throw logError;

      eventBus.emit('DATANORM_IMPORT_STARTED', {
        importId: importLog.id,
        supplier: supplierName,
        articleCount: parseResult.articles.length,
      });

      let articlesCreated = 0;
      let articlesUpdated = 0;
      let pricesUpdated = 0;
      const importErrors: any[] = [...parseResult.errors];

      try {
        // 2. Kategorien importieren (upsert)
        if (parseResult.categories.length > 0) {
          const categoryRows = parseResult.categories.map(cat => ({
            company_id: profile.company_id,
            code: cat.groupCode,
            name: cat.groupName,
            discount_percent: cat.discountPercent,
          }));

          await supabase
            .from('article_categories')
            .upsert(categoryRows, { onConflict: 'company_id,code' });
        }

        // 3. Artikel in Batches importieren
        const batches = chunkArray(parseResult.articles, BATCH_SIZE);

        for (const batch of batches) {
          const articleRows = batch.map((art: ParsedArticle) => ({
            company_id: profile.company_id,
            article_number: art.articleNumber,
            short_text1: art.shortText1,
            short_text2: art.shortText2 || null,
            long_text: art.longText || null,
            list_price: art.listPrice,
            price_unit: art.priceUnit || 'C',
            unit: art.unit,
            category_code: art.categoryCode || art.discountGroup || null,
            discount_group: art.discountGroup || null,
            supplier_name: supplierName,
            datanorm_import_id: importLog.id,
            source: 'datanorm' as const,
          }));

          // Upsert: Update wenn gleiche Artikelnummer + Lieferant existiert
          const { data: upserted, error: upsertError } = await supabase
            .from('articles')
            .upsert(articleRows, {
              onConflict: 'company_id,article_number,supplier_name',
              ignoreDuplicates: false,
            })
            .select('id');

          if (upsertError) {
            importErrors.push({
              line: 0,
              content: `Batch insert error`,
              error: upsertError.message,
            });
          } else {
            // Zaehlen: Neue vs. aktualisierte (vereinfacht)
            articlesCreated += upserted?.length || 0;
          }

          // 4. Preishistorie schreiben
          for (const art of batch) {
            if (art.prices && art.prices.length > 0) {
              // Artikel-ID holen
              const { data: existing } = await supabase
                .from('articles')
                .select('id')
                .eq('company_id', profile.company_id)
                .eq('article_number', art.articleNumber)
                .eq('supplier_name', supplierName)
                .single();

              if (existing) {
                const priceRows = art.prices.map(p => ({
                  article_id: existing.id,
                  list_price: p.price,
                  price_unit: p.priceUnit,
                  valid_from: p.validFrom || new Date().toISOString().split('T')[0],
                  source: 'datanorm',
                }));

                const { error: priceError } = await supabase
                  .from('article_prices')
                  .insert(priceRows);

                if (!priceError) {
                  pricesUpdated += priceRows.length;
                }
              }
            }
          }
        }

        // 5. Import-Log abschliessen
        const { data: completedImport } = await supabase
          .from('datanorm_imports')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            articles_created: articlesCreated,
            articles_updated: articlesUpdated,
            prices_updated: pricesUpdated,
            errors: importErrors.length,
            error_log: importErrors,
          })
          .eq('id', importLog.id)
          .select()
          .single();

        eventBus.emit('DATANORM_IMPORT_COMPLETED', {
          importId: importLog.id,
          articlesCreated,
          articlesUpdated,
          pricesUpdated,
        });

        return completedImport || importLog;
      } catch (error) {
        // Import fehlgeschlagen
        await supabase
          .from('datanorm_imports')
          .update({
            status: 'failed',
            completed_at: new Date().toISOString(),
            errors: importErrors.length + 1,
            error_log: [
              ...importErrors,
              { error: error instanceof Error ? error.message : 'Unknown error' },
            ],
          })
          .eq('id', importLog.id);

        eventBus.emit('DATANORM_IMPORT_FAILED', {
          importId: importLog.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });

        throw error;
      }
    }, 'Import Datanorm articles');
  }

  // ================================================================
  // IMPORT HISTORY
  // ================================================================

  static async getImportHistory(): Promise<DatanormImport[]> {
    return apiCall(async () => {
      const query = supabase
        .from('datanorm_imports')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      return createQuery<DatanormImport>(query).execute();
    }, 'Get import history');
  }

  // ================================================================
  // CATEGORIES
  // ================================================================

  static async getCategories(): Promise<ArticleCategory[]> {
    return apiCall(async () => {
      const query = supabase
        .from('article_categories')
        .select('*')
        .order('name');

      return createQuery<ArticleCategory>(query).execute();
    }, 'Get article categories');
  }

  // ================================================================
  // SUPPLIERS (distinct aus articles)
  // ================================================================

  static async getSuppliers(): Promise<string[]> {
    return apiCall(async () => {
      const { data, error } = await supabase
        .from('articles')
        .select('supplier_name')
        .not('supplier_name', 'is', null)
        .order('supplier_name');

      if (error) throw error;

      const unique = [...new Set((data || []).map(d => d.supplier_name).filter(Boolean))];
      return unique as string[];
    }, 'Get article suppliers');
  }

  // ================================================================
  // STATS
  // ================================================================

  static async getArticleStats(): Promise<{
    total_articles: number;
    suppliers: number;
    categories: number;
    last_import: string | null;
  }> {
    return apiCall(async () => {
      const [articles, cats, imports] = await Promise.all([
        supabase.from('articles').select('id, supplier_name', { count: 'exact' }),
        supabase.from('article_categories').select('id', { count: 'exact' }),
        supabase.from('datanorm_imports').select('created_at').order('created_at', { ascending: false }).limit(1),
      ]);

      const supplierSet = new Set(
        (articles.data || []).map((a: any) => a.supplier_name).filter(Boolean)
      );

      return {
        total_articles: articles.count || 0,
        suppliers: supplierSet.size,
        categories: cats.count || 0,
        last_import: imports.data?.[0]?.created_at || null,
      };
    }, 'Get article stats');
  }
}

// Hilfsfunktion: Array in Chunks teilen
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

export const articleService = new ArticleService();
```

- [ ] **Step 3: Commit**

```bash
git add src/services/articleService.ts src/services/eventBus.ts
git commit -m "feat: add article service with Datanorm import and full-text search"
```

---

### Task 5: TanStack Query Hooks

**Files:**
- Create: `src/hooks/useArticles.ts`
- Modify: `src/hooks/useApi.ts` (Query Keys + Re-Export)

- [ ] **Step 1: useArticles Hook-Datei erstellen**

```typescript
// src/hooks/useArticles.ts
// TanStack Query hooks for article catalog

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { ArticleService } from '@/services/articleService';
import type {
  Article,
  ArticleCreate,
  ArticleUpdate,
  ArticleFilter,
  ArticleSearchParams,
  ArticleSearchResult,
  ArticleCategory,
  DatanormImport,
  DatanormParseResult,
  PaginationQuery,
  PaginationResponse,
} from '@/types';
import { ApiError } from '@/utils/api';

// Query Keys
export const ARTICLE_QUERY_KEYS = {
  articles: ['articles'] as const,
  article: (id: string) => ['articles', id] as const,
  articleSearch: (params: ArticleSearchParams) => ['articles', 'search', params] as const,
  articleStats: ['articles', 'stats'] as const,
  articleCategories: ['articles', 'categories'] as const,
  articleSuppliers: ['articles', 'suppliers'] as const,
  datanormImports: ['datanorm-imports'] as const,
};

// ==========================================
// ARTICLE SEARCH (Volltextsuche)
// ==========================================

export const useArticleSearch = (params: ArticleSearchParams) => {
  return useQuery<ArticleSearchResult[], ApiError>({
    queryKey: ARTICLE_QUERY_KEYS.articleSearch(params),
    queryFn: () => ArticleService.searchArticles(params),
    enabled: !!(params.query && params.query.length >= 2),
    staleTime: 30_000, // 30s Cache fuer Suche
  });
};

// ==========================================
// ARTICLE LIST (mit Pagination + Filter)
// ==========================================

export const useArticles = (
  pagination?: PaginationQuery,
  filters?: ArticleFilter
) => {
  return useQuery<PaginationResponse<Article>, ApiError>({
    queryKey: [...ARTICLE_QUERY_KEYS.articles, pagination, filters],
    queryFn: () => ArticleService.getArticles(pagination, filters),
  });
};

export const useArticle = (id: string) => {
  return useQuery<Article, ApiError>({
    queryKey: ARTICLE_QUERY_KEYS.article(id),
    queryFn: () => ArticleService.getArticle(id),
    enabled: !!id,
  });
};

// ==========================================
// ARTICLE MUTATIONS
// ==========================================

export const useCreateArticle = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation<Article, ApiError, ArticleCreate>({
    mutationFn: (data) => ArticleService.createArticle(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ARTICLE_QUERY_KEYS.articles });
      queryClient.invalidateQueries({ queryKey: ARTICLE_QUERY_KEYS.articleStats });
      toast({ title: 'Artikel erstellt', description: 'Neuer Artikel wurde angelegt.' });
    },
    onError: (error) => {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
    },
  });
};

export const useUpdateArticle = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation<Article, ApiError, { id: string; data: ArticleUpdate }>({
    mutationFn: ({ id, data }) => ArticleService.updateArticle(id, data),
    onSuccess: (article) => {
      queryClient.invalidateQueries({ queryKey: ARTICLE_QUERY_KEYS.articles });
      queryClient.invalidateQueries({ queryKey: ARTICLE_QUERY_KEYS.article(article.id) });
      toast({ title: 'Artikel aktualisiert' });
    },
    onError: (error) => {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
    },
  });
};

// ==========================================
// DATANORM IMPORT
// ==========================================

export const useImportDatanorm = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation<
    DatanormImport,
    ApiError,
    { parseResult: DatanormParseResult; supplierName: string; fileName: string }
  >({
    mutationFn: ({ parseResult, supplierName, fileName }) =>
      ArticleService.importDatanormArticles(parseResult, supplierName, fileName),
    onSuccess: (importLog) => {
      queryClient.invalidateQueries({ queryKey: ARTICLE_QUERY_KEYS.articles });
      queryClient.invalidateQueries({ queryKey: ARTICLE_QUERY_KEYS.articleStats });
      queryClient.invalidateQueries({ queryKey: ARTICLE_QUERY_KEYS.articleCategories });
      queryClient.invalidateQueries({ queryKey: ARTICLE_QUERY_KEYS.datanormImports });
      toast({
        title: 'Import abgeschlossen',
        description: `${importLog.articles_created} Artikel importiert.`,
      });
    },
    onError: (error) => {
      toast({ title: 'Import fehlgeschlagen', description: error.message, variant: 'destructive' });
    },
  });
};

export const useImportHistory = () => {
  return useQuery<DatanormImport[], ApiError>({
    queryKey: ARTICLE_QUERY_KEYS.datanormImports,
    queryFn: () => ArticleService.getImportHistory(),
  });
};

// ==========================================
// CATEGORIES + SUPPLIERS + STATS
// ==========================================

export const useArticleCategories = () => {
  return useQuery<ArticleCategory[], ApiError>({
    queryKey: ARTICLE_QUERY_KEYS.articleCategories,
    queryFn: () => ArticleService.getCategories(),
    staleTime: 5 * 60_000, // 5 min Cache
  });
};

export const useArticleSuppliers = () => {
  return useQuery<string[], ApiError>({
    queryKey: ARTICLE_QUERY_KEYS.articleSuppliers,
    queryFn: () => ArticleService.getSuppliers(),
    staleTime: 5 * 60_000,
  });
};

export const useArticleStats = () => {
  return useQuery({
    queryKey: ARTICLE_QUERY_KEYS.articleStats,
    queryFn: () => ArticleService.getArticleStats(),
  });
};
```

- [ ] **Step 2: Query Keys in useApi.ts registrieren**

In `src/hooks/useApi.ts`, im `QUERY_KEYS`-Objekt (nach den Material-Keys) einfuegen:

```typescript
  // Article keys
  articles: ['articles'] as const,
  article: (id: string) => ['articles', id] as const,
  articleSearch: (params: any) => ['articles', 'search', params] as const,
  articleStats: ['articles', 'stats'] as const,
  articleCategories: ['articles', 'categories'] as const,
  articleSuppliers: ['articles', 'suppliers'] as const,
  datanormImports: ['datanorm-imports'] as const,
```

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useArticles.ts src/hooks/useApi.ts
git commit -m "feat: add TanStack Query hooks for article catalog"
```

---

### Task 6: JSZip Dependency + DatanormImport UI

**Files:**
- `package.json` (neue Dependency)
- Create: `src/components/articles/DatanormImport.tsx`

- [ ] **Step 1: JSZip installieren**

```bash
npm install jszip
npm install --save-dev @types/jszip
```

Falls `@types/jszip` nicht existiert (JSZip bringt eigene Typen mit), diesen Schritt ueberspringen.

- [ ] **Step 2: DatanormImport-Komponente erstellen**

```tsx
// src/components/articles/DatanormImport.tsx
import React, { useState, useCallback } from 'react';
import JSZip from 'jszip';
import { Upload, FileArchive, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { parseDatanormFile } from '@/services/datanormParser';
import { useImportDatanorm } from '@/hooks/useArticles';
import type { DatanormParseResult } from '@/types/article';

interface DatanormImportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ImportStep = 'upload' | 'preview' | 'importing' | 'done';

export function DatanormImport({ open, onOpenChange }: DatanormImportProps) {
  const [step, setStep] = useState<ImportStep>('upload');
  const [supplierName, setSupplierName] = useState('');
  const [fileName, setFileName] = useState('');
  const [parseResult, setParseResult] = useState<DatanormParseResult | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const { toast } = useToast();
  const importMutation = useImportDatanorm();

  const reset = () => {
    setStep('upload');
    setSupplierName('');
    setFileName('');
    setParseResult(null);
    setParseError(null);
  };

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setParseError(null);
    setFileName(file.name);

    try {
      let content = '';

      if (file.name.toLowerCase().endsWith('.zip')) {
        // ZIP entpacken
        const zip = await JSZip.loadAsync(file);
        const datanormFiles = Object.keys(zip.files).filter(
          name => /\.(dat|dnr|datanorm|txt)$/i.test(name) && !name.startsWith('__MACOSX')
        );

        if (datanormFiles.length === 0) {
          setParseError('Keine Datanorm-Dateien (.dat, .dnr) im ZIP gefunden.');
          return;
        }

        // Alle Datanorm-Dateien zusammenfuegen
        const contents: string[] = [];
        for (const name of datanormFiles) {
          const text = await zip.files[name].async('string');
          contents.push(text);
        }
        content = contents.join('\n');
      } else {
        // Einzelne Datei direkt lesen
        content = await file.text();
      }

      const result = parseDatanormFile(content);

      if (result.articles.length === 0) {
        setParseError(
          `Keine Artikel gefunden. ${result.errors.length} Fehler beim Parsen.` +
          (result.totalLines === 0 ? ' Die Datei scheint leer zu sein.' : '')
        );
        return;
      }

      setParseResult(result);
      setStep('preview');
    } catch (err) {
      setParseError(
        err instanceof Error ? err.message : 'Fehler beim Lesen der Datei'
      );
    }
  }, []);

  const handleImport = async () => {
    if (!parseResult || !supplierName.trim()) return;

    setStep('importing');

    try {
      await importMutation.mutateAsync({
        parseResult,
        supplierName: supplierName.trim(),
        fileName,
      });
      setStep('done');
    } catch {
      setStep('preview'); // Zurueck zur Vorschau bei Fehler
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileArchive className="h-5 w-5" />
            Datanorm Import
          </DialogTitle>
          <DialogDescription>
            Artikelkatalog aus Datanorm 4.0 Dateien importieren (ZIP oder .dat)
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Upload */}
        {step === 'upload' && (
          <div className="space-y-4 py-4">
            <div>
              <Label>Lieferant / Grosshaendler</Label>
              <Input
                placeholder="z.B. Sonepar, Rexel, Alexander Buerkle..."
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label>Datanorm-Datei</Label>
              <div className="mt-1 border-2 border-dashed rounded-lg p-8 text-center hover:border-emerald-500 transition-colors">
                <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground mb-2">
                  ZIP-Datei oder .dat/.dnr Datei hierher ziehen
                </p>
                <Input
                  type="file"
                  accept=".zip,.dat,.dnr,.datanorm,.txt"
                  onChange={handleFileUpload}
                  className="max-w-xs mx-auto"
                />
              </div>
            </div>

            {parseError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{parseError}</AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {/* Step 2: Preview */}
        {step === 'preview' && parseResult && (
          <div className="space-y-4 py-4">
            {!supplierName.trim() && (
              <div>
                <Label>Lieferant benennen</Label>
                <Input
                  placeholder="z.B. Sonepar"
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  className="mt-1"
                  autoFocus
                />
              </div>
            )}

            <div className="grid grid-cols-3 gap-3">
              <div className="bg-emerald-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-emerald-700">
                  {parseResult.articles.length}
                </div>
                <div className="text-xs text-emerald-600">Artikel</div>
              </div>
              <div className="bg-blue-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-blue-700">
                  {parseResult.categories.length}
                </div>
                <div className="text-xs text-blue-600">Warengruppen</div>
              </div>
              <div className="bg-amber-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-amber-700">
                  {parseResult.errors.length}
                </div>
                <div className="text-xs text-amber-600">Fehler</div>
              </div>
            </div>

            <ScrollArea className="h-64 border rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="text-left p-2">Art.Nr.</th>
                    <th className="text-left p-2">Bezeichnung</th>
                    <th className="text-right p-2">Preis</th>
                    <th className="text-left p-2">ME</th>
                  </tr>
                </thead>
                <tbody>
                  {parseResult.articles.slice(0, 100).map((art, i) => (
                    <tr key={i} className="border-t hover:bg-gray-50">
                      <td className="p-2 font-mono text-xs">{art.articleNumber}</td>
                      <td className="p-2">
                        <div className="font-medium">{art.shortText1}</div>
                        {art.shortText2 && (
                          <div className="text-muted-foreground text-xs">{art.shortText2}</div>
                        )}
                      </td>
                      <td className="p-2 text-right font-mono">
                        {art.listPrice.toFixed(2)} EUR
                      </td>
                      <td className="p-2">{art.unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {parseResult.articles.length > 100 && (
                <div className="p-3 text-center text-sm text-muted-foreground">
                  ... und {parseResult.articles.length - 100} weitere Artikel
                </div>
              )}
            </ScrollArea>

            {parseResult.errors.length > 0 && (
              <details className="text-sm">
                <summary className="cursor-pointer text-amber-600">
                  {parseResult.errors.length} Parse-Fehler anzeigen
                </summary>
                <ScrollArea className="h-32 mt-2 border rounded p-2">
                  {parseResult.errors.map((err, i) => (
                    <div key={i} className="text-xs text-red-600 mb-1">
                      Zeile {err.line}: {err.error}
                    </div>
                  ))}
                </ScrollArea>
              </details>
            )}
          </div>
        )}

        {/* Step 3: Importing */}
        {step === 'importing' && (
          <div className="py-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-emerald-600 mb-4" />
            <p className="text-sm text-muted-foreground">
              Importiere {parseResult?.articles.length} Artikel...
            </p>
          </div>
        )}

        {/* Step 4: Done */}
        {step === 'done' && (
          <div className="py-12 text-center">
            <CheckCircle2 className="h-12 w-12 mx-auto text-emerald-600 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Import abgeschlossen!</h3>
            <p className="text-sm text-muted-foreground">
              {parseResult?.articles.length} Artikel von{' '}
              <span className="font-medium">{supplierName}</span> importiert.
            </p>
          </div>
        )}

        <DialogFooter>
          {step === 'preview' && (
            <>
              <Button variant="outline" onClick={reset}>Zurueck</Button>
              <Button
                onClick={handleImport}
                disabled={!supplierName.trim() || importMutation.isPending}
              >
                {parseResult?.articles.length} Artikel importieren
              </Button>
            </>
          )}
          {step === 'done' && (
            <Button onClick={() => { reset(); onOpenChange(false); }}>
              Schliessen
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: Commit**

```bash
npm install jszip && git add src/components/articles/DatanormImport.tsx package.json package-lock.json
git commit -m "feat: add Datanorm ZIP import UI with preview"
```

---

### Task 7: ArticleSearch + ArticlePicker

**Files:**
- Create: `src/components/articles/ArticleSearch.tsx`
- Create: `src/components/articles/ArticlePicker.tsx`

- [ ] **Step 1: ArticleSearch erstellen**

```tsx
// src/components/articles/ArticleSearch.tsx
import React, { useState } from 'react';
import { Search, Filter, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useArticleSearch, useArticleCategories, useArticleSuppliers } from '@/hooks/useArticles';
import type { ArticleSearchResult } from '@/types/article';

interface ArticleSearchProps {
  onSelect?: (article: ArticleSearchResult) => void;
  showFilters?: boolean;
}

export function ArticleSearch({ onSelect, showFilters = true }: ArticleSearchProps) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string | undefined>();
  const [supplier, setSupplier] = useState<string | undefined>();

  const { data: results, isLoading } = useArticleSearch({
    query,
    category: category || undefined,
    supplier: supplier || undefined,
    limit: 50,
  });

  const { data: categories } = useArticleCategories();
  const { data: suppliers } = useArticleSuppliers();

  return (
    <div className="flex flex-col h-full">
      {/* Suchleiste */}
      <div className="p-3 border-b space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Artikel suchen... (z.B. NYM-J 3x1.5)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
          {query && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
              onClick={() => setQuery('')}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>

        {showFilters && (
          <div className="flex gap-2">
            <Select value={category || 'all'} onValueChange={(v) => setCategory(v === 'all' ? undefined : v)}>
              <SelectTrigger className="h-8 text-xs flex-1">
                <SelectValue placeholder="Warengruppe" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Warengruppen</SelectItem>
                {categories?.map((cat) => (
                  <SelectItem key={cat.code} value={cat.code}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={supplier || 'all'} onValueChange={(v) => setSupplier(v === 'all' ? undefined : v)}>
              <SelectTrigger className="h-8 text-xs flex-1">
                <SelectValue placeholder="Lieferant" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Lieferanten</SelectItem>
                {suppliers?.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Ergebnisse */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {isLoading && query.length >= 2 && (
            <div className="text-sm text-center text-muted-foreground p-4">Suche...</div>
          )}

          {!isLoading && query.length >= 2 && results?.length === 0 && (
            <div className="text-sm text-center text-muted-foreground p-4">
              Keine Artikel gefunden.
            </div>
          )}

          {query.length < 2 && (
            <div className="text-sm text-center text-muted-foreground p-4">
              Mindestens 2 Zeichen eingeben...
            </div>
          )}

          {results?.map((article) => (
            <div
              key={article.id}
              className="border rounded-lg p-2.5 hover:border-emerald-500 hover:bg-emerald-50/50 cursor-pointer transition-all"
              onClick={() => onSelect?.(article)}
            >
              <div className="flex justify-between items-start gap-2">
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm truncate">{article.short_text1}</div>
                  {article.short_text2 && (
                    <div className="text-xs text-muted-foreground truncate">{article.short_text2}</div>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    <span className="font-mono text-xs text-muted-foreground">
                      {article.article_number}
                    </span>
                    {article.supplier_name && (
                      <Badge variant="outline" className="text-[10px] h-4">
                        {article.supplier_name}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-semibold text-sm">
                    {article.list_price.toFixed(2)} EUR
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    pro {article.unit}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
```

- [ ] **Step 2: ArticlePicker fuer Angebotseditor erstellen**

```tsx
// src/components/articles/ArticlePicker.tsx
// Seitenleiste fuer den Angebotseditor — Artikel aus Katalog in Positionen uebernehmen

import React from 'react';
import { Package, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ArticleSearch } from './ArticleSearch';
import type { ArticleSearchResult } from '@/types/article';

interface ArticlePickerProps {
  open: boolean;
  onClose: () => void;
  onSelectArticle: (article: {
    description: string;
    unit: string;
    unit_price_net: number;
    article_number: string;
    supplier_name: string | null;
  }) => void;
}

export function ArticlePicker({ open, onClose, onSelectArticle }: ArticlePickerProps) {
  if (!open) return null;

  const handleSelect = (article: ArticleSearchResult) => {
    // Beschreibung zusammensetzen
    const description = [
      article.short_text1,
      article.short_text2,
    ].filter(Boolean).join(' — ');

    onSelectArticle({
      description,
      unit: article.unit,
      unit_price_net: article.list_price,
      article_number: article.article_number,
      supplier_name: article.supplier_name,
    });
  };

  return (
    <div className="w-80 border-l bg-white flex flex-col h-full animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b bg-gray-50">
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-emerald-600" />
          <span className="font-medium text-sm">Artikelkatalog</span>
        </div>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Suche */}
      <ArticleSearch onSelect={handleSelect} showFilters={true} />
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/articles/ArticleSearch.tsx src/components/articles/ArticlePicker.tsx
git commit -m "feat: add article search and picker components"
```

---

### Task 8: ArticleModule Hauptseite

**Files:**
- Create: `src/components/articles/ArticleModule.tsx`
- Modify: `src/App.tsx` (Route)

- [ ] **Step 1: ArticleModule erstellen**

```tsx
// src/components/articles/ArticleModule.tsx
import React, { useState } from 'react';
import {
  Package,
  Upload,
  Search,
  BarChart3,
  History,
  Plus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  useArticles,
  useArticleStats,
  useImportHistory,
  useArticleCategories,
} from '@/hooks/useArticles';
import { DatanormImport } from './DatanormImport';
import { ArticleSearch } from './ArticleSearch';
import type { ArticleFilter } from '@/types/article';
import { DATANORM_IMPORT_STATUS_LABELS } from '@/types/article';

export function ArticleModule() {
  const [importOpen, setImportOpen] = useState(false);
  const [filters, setFilters] = useState<ArticleFilter>({ is_active: true });
  const [page, setPage] = useState(1);

  const { data: stats } = useArticleStats();
  const { data: articlesResponse, isLoading } = useArticles(
    { page, limit: 50, sort_by: 'short_text1', sort_order: 'asc' },
    filters
  );
  const { data: imports } = useImportHistory();
  const { data: categories } = useArticleCategories();

  const articles = articlesResponse?.items || [];
  const pagination = articlesResponse?.pagination;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Package className="h-6 w-6 text-emerald-600" />
            Artikeldatenbank
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Artikelkataloge aus Datanorm-Dateien importieren und durchsuchen
          </p>
        </div>
        <Button onClick={() => setImportOpen(true)} className="gap-2">
          <Upload className="h-4 w-4" />
          Datanorm Import
        </Button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold">{stats.total_articles.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">Artikel</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold">{stats.suppliers}</div>
              <div className="text-xs text-muted-foreground">Lieferanten</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold">{stats.categories}</div>
              <div className="text-xs text-muted-foreground">Warengruppen</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-sm font-medium">
                {stats.last_import
                  ? new Date(stats.last_import).toLocaleDateString('de-DE')
                  : 'Noch kein Import'}
              </div>
              <div className="text-xs text-muted-foreground">Letzter Import</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="search">
        <TabsList>
          <TabsTrigger value="search" className="gap-1">
            <Search className="h-3.5 w-3.5" /> Suche
          </TabsTrigger>
          <TabsTrigger value="catalog" className="gap-1">
            <Package className="h-3.5 w-3.5" /> Katalog
          </TabsTrigger>
          <TabsTrigger value="imports" className="gap-1">
            <History className="h-3.5 w-3.5" /> Import-Historie
          </TabsTrigger>
        </TabsList>

        {/* Volltextsuche */}
        <TabsContent value="search">
          <Card>
            <CardContent className="p-0 h-[500px]">
              <ArticleSearch showFilters={true} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Katalog-Ansicht */}
        <TabsContent value="catalog">
          <Card>
            <CardContent className="p-4">
              {/* Filter-Leiste */}
              <div className="flex gap-2 mb-4">
                <Input
                  placeholder="Filtern..."
                  value={filters.search || ''}
                  onChange={(e) => setFilters(f => ({ ...f, search: e.target.value }))}
                  className="max-w-xs"
                />
                {categories && categories.length > 0 && (
                  <select
                    className="border rounded px-2 text-sm"
                    value={filters.category_code || ''}
                    onChange={(e) =>
                      setFilters(f => ({ ...f, category_code: e.target.value || undefined }))
                    }
                  >
                    <option value="">Alle Warengruppen</option>
                    {categories.map(c => (
                      <option key={c.code} value={c.code}>{c.name}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Tabelle */}
              <ScrollArea className="h-[400px]">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="text-left p-2">Art.Nr.</th>
                      <th className="text-left p-2">Bezeichnung</th>
                      <th className="text-left p-2">Lieferant</th>
                      <th className="text-right p-2">Preis</th>
                      <th className="text-left p-2">ME</th>
                      <th className="text-left p-2">Warengruppe</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? (
                      <tr><td colSpan={6} className="text-center p-8">Lade Artikel...</td></tr>
                    ) : articles.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center p-8 text-muted-foreground">
                          Noch keine Artikel importiert.
                          <br />
                          <Button
                            variant="link"
                            onClick={() => setImportOpen(true)}
                            className="mt-2"
                          >
                            Jetzt Datanorm-Datei importieren
                          </Button>
                        </td>
                      </tr>
                    ) : (
                      articles.map(art => (
                        <tr key={art.id} className="border-t hover:bg-gray-50">
                          <td className="p-2 font-mono text-xs">{art.article_number}</td>
                          <td className="p-2">
                            <div className="font-medium">{art.short_text1}</div>
                            {art.short_text2 && (
                              <div className="text-xs text-muted-foreground">{art.short_text2}</div>
                            )}
                          </td>
                          <td className="p-2 text-xs">{art.supplier_name || '-'}</td>
                          <td className="p-2 text-right font-mono">
                            {art.list_price.toFixed(2)}
                          </td>
                          <td className="p-2">{art.unit}</td>
                          <td className="p-2">
                            {art.category_code && (
                              <Badge variant="outline" className="text-xs">{art.category_code}</Badge>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </ScrollArea>

              {/* Pagination */}
              {pagination && pagination.total_pages > 1 && (
                <div className="flex items-center justify-between pt-3 border-t mt-3">
                  <span className="text-xs text-muted-foreground">
                    {pagination.total_items} Artikel
                  </span>
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!pagination.has_prev}
                      onClick={() => setPage(p => p - 1)}
                    >
                      Zurueck
                    </Button>
                    <span className="text-sm px-2 py-1">
                      {pagination.page} / {pagination.total_pages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!pagination.has_next}
                      onClick={() => setPage(p => p + 1)}
                    >
                      Weiter
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Import-Historie */}
        <TabsContent value="imports">
          <Card>
            <CardContent className="p-4">
              {!imports || imports.length === 0 ? (
                <div className="text-center text-muted-foreground p-8">
                  Noch keine Imports durchgefuehrt.
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left p-2">Datum</th>
                      <th className="text-left p-2">Datei</th>
                      <th className="text-left p-2">Lieferant</th>
                      <th className="text-right p-2">Artikel</th>
                      <th className="text-right p-2">Fehler</th>
                      <th className="text-left p-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {imports.map(imp => (
                      <tr key={imp.id} className="border-t">
                        <td className="p-2">
                          {new Date(imp.created_at).toLocaleDateString('de-DE')}
                        </td>
                        <td className="p-2 font-mono text-xs">{imp.file_name}</td>
                        <td className="p-2">{imp.supplier_name}</td>
                        <td className="p-2 text-right">{imp.articles_created}</td>
                        <td className="p-2 text-right">
                          {imp.errors > 0 ? (
                            <span className="text-red-600">{imp.errors}</span>
                          ) : (
                            <span className="text-green-600">0</span>
                          )}
                        </td>
                        <td className="p-2">
                          <Badge
                            variant={imp.status === 'completed' ? 'default' : 'destructive'}
                            className="text-xs"
                          >
                            {DATANORM_IMPORT_STATUS_LABELS[imp.status] || imp.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Import Dialog */}
      <DatanormImport open={importOpen} onOpenChange={setImportOpen} />
    </div>
  );
}
```

- [ ] **Step 2: Route in App.tsx hinzufuegen**

Import hinzufuegen:
```typescript
import { ArticleModule } from '@/components/articles/ArticleModule';
```

Route hinzufuegen (neben den anderen Routen, z.B. nach der `/offers` Route):
```tsx
<Route path="/articles" element={<ArticleModule />} />
```

- [ ] **Step 3: Navigation erweitern**

In der Sidebar/Navigation (Datei variiert je nach Layout) einen neuen Eintrag hinzufuegen:

```tsx
{ label: 'Artikeldatenbank', href: '/articles', icon: Package }
```

Genaue Position haengt vom Navigations-Layout ab. Suchen nach existierenden nav items in `IndexV2` oder `AppSidebar` und den Eintrag dort einfuegen.

- [ ] **Step 4: Commit**

```bash
git add src/components/articles/ArticleModule.tsx src/App.tsx
git commit -m "feat: add article catalog module with Datanorm import, search, and browse"
```

---

### Task 9: Vitest Konfiguration finalisieren

**Files:**
- Modify: `vite.config.ts`

- [ ] **Step 1: Test-Config hinzufuegen**

In `vite.config.ts` die `test`-Property im defineConfig-Objekt hinzufuegen:

```typescript
// Am Ende des defineConfig-Objekts (nach resolve):
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
```

- [ ] **Step 2: Tests ausfuehren**

```bash
npx vitest run
```

- [ ] **Step 3: Commit**

```bash
git add vite.config.ts
git commit -m "chore: configure vitest for unit testing"
```

---

## Phase 2: ETIM-Klassifikation (P1) — Spaeter

### Task 10 (Zukunft): ETIM Klassen + Filter

**Files (Vorschau, noch nicht umsetzen):**
- `supabase/migrations/YYYYMMDD_add_etim_classification.sql`
- `src/types/article.ts` (erweitern)
- `src/components/articles/EtimFilter.tsx`

Kurzplan:
- [ ] Tabelle `etim_classes` (class_id, name, group_name)
- [ ] Tabelle `etim_features` (class_id, feature_code, feature_name, value_type, unit)
- [ ] Tabelle `article_etim_features` (article_id, feature_code, value)
- [ ] ETIM-Daten aus Datanorm 5.0 oder separatem Import laden
- [ ] Filter-UI: Klasse waehlen -> Merkmale filtern -> Artikel anzeigen

---

## Phase 3: Kupferzuschlag (P1) — Spaeter

### Task 11 (Zukunft): Kupferpreis-Tracking

**Files (Vorschau, noch nicht umsetzen):**
- `supabase/functions/fetch-copper-price/index.ts` (Edge Function)
- `src/services/copperService.ts`
- `src/components/articles/CopperSurcharge.tsx`

Kurzplan:
- [ ] Edge Function: Taeglich Kupferpreis von Westmetall/LME abrufen
- [ ] In `copper_prices` Tabelle speichern (bereits angelegt in Task 1)
- [ ] Formel: `Zuschlag = (Aktueller DEL-Preis - Basis-DEL-Preis) * Kupfergewicht`
- [ ] `copper_weight` und `copper_base_price` in articles-Tabelle nutzen
- [ ] Badge an Kabelartikeln: "Kupferzuschlag: +X,XX EUR"
- [ ] In Angebotsposition: Listenpreis + Kupferzuschlag automatisch

---

## Phase 4: IDS-Connect Vorbereitung (P2) — Spaeter

### Task 12 (Zukunft): IDS-Connect Interface

**Files (Vorschau, noch nicht umsetzen):**
- `src/services/idsConnectService.ts`
- `src/types/idsConnect.ts`

Kurzplan:
- [ ] OAuth 2.0 Client Credentials Flow
- [ ] Interface: `IDSConnectProvider` mit Methoden:
  - `searchArticles(query): Promise<Article[]>`
  - `getPrice(articleNumber): Promise<PriceInfo>`
  - `checkAvailability(articleNumber): Promise<AvailabilityInfo>`
  - `placeOrder(items): Promise<OrderConfirmation>`
- [ ] Grosshaendler-Konfiguration in `company_settings`
- [ ] IDS-Zertifizierung beantragen (manueller Prozess)

---

## Zusammenfassung: Umsetzungsreihenfolge

| # | Task | Geschaetzter Aufwand | Abhaengigkeiten |
|---|------|---------------------|-----------------|
| 1 | DB Migration | 15 min | - |
| 2 | Zod Types | 10 min | - |
| 3 | Datanorm Parser (TDD) | 45 min | Task 2 |
| 4 | ArticleService | 30 min | Task 1, 2, 3 |
| 5 | TanStack Hooks | 15 min | Task 4 |
| 6 | DatanormImport UI | 30 min | Task 3, 5 |
| 7 | ArticleSearch + Picker | 25 min | Task 5 |
| 8 | ArticleModule + Route | 20 min | Task 6, 7 |
| 9 | Vitest Config | 5 min | Task 3 |

**Gesamt Phase 1: ~3.5 Stunden**

Tasks 1, 2, 9 koennen parallel ausgefuehrt werden. Tasks 3-8 sind sequentiell.
