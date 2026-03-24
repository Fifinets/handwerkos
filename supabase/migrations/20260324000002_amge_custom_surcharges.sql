-- Eigene Zuschläge als JSONB-Array
-- Format: [{"name": "Werkzeugzuschlag", "prozent": 3.0}, ...]
ALTER TABLE amge_calculations
  ADD COLUMN IF NOT EXISTS custom_surcharges JSONB DEFAULT '[]'::jsonb;

-- Berechnete Felder für eigene Zuschläge
ALTER TABLE amge_calculations
  ADD COLUMN IF NOT EXISTS custom_surcharges_betrag NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lohn_mit_custom NUMERIC(10,2) DEFAULT 0;

-- Trigger aktualisieren: eigene Zuschläge nach AGK, vor W+G
CREATE OR REPLACE FUNCTION calculate_amge_values()
RETURNS TRIGGER AS $$
DECLARE
  surcharge JSONB;
  custom_total NUMERIC(10,2) := 0;
BEGIN
  -- LZK-Betrag
  NEW.lzk_betrag := ROUND(NEW.direktlohn * (
    NEW.lzk_sozialversicherung + NEW.lzk_urlaubsgeld + NEW.lzk_lohnfortzahlung +
    NEW.lzk_berufsgenossenschaft + NEW.lzk_winterbau + NEW.lzk_sonstige
  ) / 100, 2);
  NEW.lohn_mit_lzk := NEW.direktlohn + NEW.lzk_betrag;

  -- BGK-Betrag
  NEW.bgk_betrag := ROUND(NEW.lohn_mit_lzk * (
    NEW.bgk_bauleitung + NEW.bgk_hilfsstoffe + NEW.bgk_geraete +
    NEW.bgk_transport + NEW.bgk_sonstige
  ) / 100, 2);
  NEW.lohn_mit_bgk := NEW.lohn_mit_lzk + NEW.bgk_betrag;

  -- AGK-Betrag
  NEW.agk_betrag := ROUND(NEW.lohn_mit_bgk * NEW.agk_prozent / 100, 2);
  NEW.lohn_mit_agk := NEW.lohn_mit_bgk + NEW.agk_betrag;

  -- Eigene Zuschläge (nach AGK, vor W+G)
  custom_total := 0;
  IF NEW.custom_surcharges IS NOT NULL AND jsonb_array_length(NEW.custom_surcharges) > 0 THEN
    FOR surcharge IN SELECT * FROM jsonb_array_elements(NEW.custom_surcharges)
    LOOP
      custom_total := custom_total + ROUND(NEW.lohn_mit_agk * COALESCE((surcharge->>'prozent')::NUMERIC, 0) / 100, 2);
    END LOOP;
  END IF;
  NEW.custom_surcharges_betrag := custom_total;
  NEW.lohn_mit_custom := NEW.lohn_mit_agk + custom_total;

  -- W+G auf Basis nach eigenen Zuschlägen
  NEW.wagnis_betrag := ROUND(NEW.lohn_mit_custom * NEW.wagnis_prozent / 100, 2);
  NEW.gewinn_betrag := ROUND(NEW.lohn_mit_custom * NEW.gewinn_prozent / 100, 2);

  -- Verrechnungslohn
  NEW.verrechnungslohn := NEW.lohn_mit_custom + NEW.wagnis_betrag + NEW.gewinn_betrag;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
