-- AMGE-Kalkulator: Berechnung des Verrechnungslohns
-- Direktlohn → LZK → BGK → W+G → Verrechnungslohn

CREATE TABLE IF NOT EXISTS amge_calculations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,

  -- Bezeichnung & Metadaten
  name TEXT NOT NULL DEFAULT 'Standard-Kalkulation',
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  valid_from DATE DEFAULT CURRENT_DATE,
  valid_until DATE,

  -- 1. Direktlohn (Mittellohn der Produktivkräfte)
  direktlohn NUMERIC(10,2) NOT NULL DEFAULT 0,

  -- 2. Lohnzusatzkosten (LZK)
  lzk_sozialversicherung NUMERIC(5,2) DEFAULT 20.6,    -- AG-Anteil Sozialversicherung %
  lzk_urlaubsgeld NUMERIC(5,2) DEFAULT 11.4,           -- Urlaubsgeld %
  lzk_lohnfortzahlung NUMERIC(5,2) DEFAULT 5.2,        -- Lohnfortzahlung Krankheit %
  lzk_berufsgenossenschaft NUMERIC(5,2) DEFAULT 5.0,   -- BG-Beitrag %
  lzk_winterbau NUMERIC(5,2) DEFAULT 2.0,              -- Winterbauumlage %
  lzk_sonstige NUMERIC(5,2) DEFAULT 1.5,               -- Sonstige LZK %
  lzk_gesamt_prozent NUMERIC(6,2) GENERATED ALWAYS AS (
    lzk_sozialversicherung + lzk_urlaubsgeld + lzk_lohnfortzahlung +
    lzk_berufsgenossenschaft + lzk_winterbau + lzk_sonstige
  ) STORED,

  -- 3. Baustellengemeinkosten (BGK)
  bgk_bauleitung NUMERIC(5,2) DEFAULT 5.0,             -- Bauleitung %
  bgk_hilfsstoffe NUMERIC(5,2) DEFAULT 2.0,            -- Hilfsstoffe %
  bgk_geraete NUMERIC(5,2) DEFAULT 3.0,                -- Gerätekosten %
  bgk_transport NUMERIC(5,2) DEFAULT 1.5,              -- Transport %
  bgk_sonstige NUMERIC(5,2) DEFAULT 1.0,               -- Sonstige BGK %
  bgk_gesamt_prozent NUMERIC(6,2) GENERATED ALWAYS AS (
    bgk_bauleitung + bgk_hilfsstoffe + bgk_geraete + bgk_transport + bgk_sonstige
  ) STORED,

  -- 4. Allgemeine Geschäftskosten (AGK)
  agk_prozent NUMERIC(5,2) DEFAULT 12.0,               -- AGK %

  -- 5. Wagnis und Gewinn (W+G)
  wagnis_prozent NUMERIC(5,2) DEFAULT 2.0,             -- Wagnis %
  gewinn_prozent NUMERIC(5,2) DEFAULT 5.0,             -- Gewinn %

  -- Berechnete Ergebniswerte (werden per Trigger aktualisiert)
  lzk_betrag NUMERIC(10,2) DEFAULT 0,
  lohn_mit_lzk NUMERIC(10,2) DEFAULT 0,
  bgk_betrag NUMERIC(10,2) DEFAULT 0,
  lohn_mit_bgk NUMERIC(10,2) DEFAULT 0,
  agk_betrag NUMERIC(10,2) DEFAULT 0,
  lohn_mit_agk NUMERIC(10,2) DEFAULT 0,
  wagnis_betrag NUMERIC(10,2) DEFAULT 0,
  gewinn_betrag NUMERIC(10,2) DEFAULT 0,
  verrechnungslohn NUMERIC(10,2) DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Trigger-Funktion zur Berechnung aller Zwischenwerte
CREATE OR REPLACE FUNCTION calculate_amge_values()
RETURNS TRIGGER AS $$
BEGIN
  -- LZK-Betrag
  NEW.lzk_betrag := ROUND(NEW.direktlohn * (
    NEW.lzk_sozialversicherung + NEW.lzk_urlaubsgeld + NEW.lzk_lohnfortzahlung +
    NEW.lzk_berufsgenossenschaft + NEW.lzk_winterbau + NEW.lzk_sonstige
  ) / 100, 2);

  -- Lohn + LZK
  NEW.lohn_mit_lzk := NEW.direktlohn + NEW.lzk_betrag;

  -- BGK-Betrag (basiert auf Lohn + LZK)
  NEW.bgk_betrag := ROUND(NEW.lohn_mit_lzk * (
    NEW.bgk_bauleitung + NEW.bgk_hilfsstoffe + NEW.bgk_geraete +
    NEW.bgk_transport + NEW.bgk_sonstige
  ) / 100, 2);

  -- Lohn + BGK
  NEW.lohn_mit_bgk := NEW.lohn_mit_lzk + NEW.bgk_betrag;

  -- AGK-Betrag (basiert auf Lohn + BGK)
  NEW.agk_betrag := ROUND(NEW.lohn_mit_bgk * NEW.agk_prozent / 100, 2);

  -- Lohn + AGK
  NEW.lohn_mit_agk := NEW.lohn_mit_bgk + NEW.agk_betrag;

  -- Wagnis-Betrag (basiert auf Lohn + AGK)
  NEW.wagnis_betrag := ROUND(NEW.lohn_mit_agk * NEW.wagnis_prozent / 100, 2);

  -- Gewinn-Betrag (basiert auf Lohn + AGK)
  NEW.gewinn_betrag := ROUND(NEW.lohn_mit_agk * NEW.gewinn_prozent / 100, 2);

  -- Verrechnungslohn (Endergebnis)
  NEW.verrechnungslohn := NEW.lohn_mit_agk + NEW.wagnis_betrag + NEW.gewinn_betrag;

  -- Updated timestamp
  NEW.updated_at := now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_calculate_amge
  BEFORE INSERT OR UPDATE ON amge_calculations
  FOR EACH ROW
  EXECUTE FUNCTION calculate_amge_values();

-- Index für aktive Kalkulationen pro Firma
CREATE INDEX idx_amge_company_active ON amge_calculations(company_id, is_active);

-- RLS aktivieren
ALTER TABLE amge_calculations ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Benutzer sehen nur Kalkulationen ihrer Firma
CREATE POLICY "Users can view own company AMGE calculations"
  ON amge_calculations FOR SELECT
  USING (company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Users can insert own company AMGE calculations"
  ON amge_calculations FOR INSERT
  WITH CHECK (company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Users can update own company AMGE calculations"
  ON amge_calculations FOR UPDATE
  USING (company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Users can delete own company AMGE calculations"
  ON amge_calculations FOR DELETE
  USING (company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  ));
