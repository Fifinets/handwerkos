-- ============================================================
-- Article Catalog for Datanorm Import
-- ============================================================

-- 1. Article Categories (Warengruppen from Datanorm R-Saetze)
CREATE TABLE IF NOT EXISTS article_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  code VARCHAR(20) NOT NULL,
  name VARCHAR(255) NOT NULL,
  discount_percent DECIMAL(5,2),
  parent_code VARCHAR(20),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_id, code)
);

-- 2. Articles (Artikelstamm)
CREATE TABLE IF NOT EXISTS articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- Identifikation
  article_number VARCHAR(50) NOT NULL,
  ean VARCHAR(20),
  manufacturer_number VARCHAR(50),
  manufacturer VARCHAR(255),

  -- Texte
  short_text1 VARCHAR(255) NOT NULL,
  short_text2 VARCHAR(255),
  long_text TEXT,

  -- Preis
  list_price DECIMAL(12,4) NOT NULL DEFAULT 0,
  price_unit VARCHAR(10) DEFAULT 'C',
  currency VARCHAR(3) DEFAULT 'EUR',

  -- Einheit + Verpackung
  unit VARCHAR(20) NOT NULL DEFAULT 'Stk',
  packaging_unit DECIMAL(10,2),

  -- Klassifikation
  category_code VARCHAR(20),
  discount_group VARCHAR(20),
  etim_class VARCHAR(20),

  -- Kupferzuschlag (Phase 3)
  copper_weight DECIMAL(10,4),
  copper_base_price DECIMAL(10,2),

  -- Herkunft
  supplier_name VARCHAR(255),
  datanorm_import_id UUID,
  source VARCHAR(50) DEFAULT 'datanorm',

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
  net_price DECIMAL(12,4),
  valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until DATE,
  price_unit VARCHAR(10) DEFAULT 'C',
  source VARCHAR(50) DEFAULT 'datanorm',
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
  status VARCHAR(20) DEFAULT 'pending',
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
  lme_price_usd DECIMAL(10,2),
  del_notation DECIMAL(10,2),
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
