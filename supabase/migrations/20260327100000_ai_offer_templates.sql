-- AI Offer Templates & Company AI Settings
-- Provides system-level and company-level position templates for the KI-Angebotsassistent

-- ============================================================================
-- TABLE 1: offer_position_templates
-- ============================================================================

CREATE TABLE IF NOT EXISTS offer_position_templates (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  category text NOT NULL DEFAULT 'elektro',
  name text NOT NULL,
  description text NOT NULL,
  item_type text NOT NULL DEFAULT 'labor'
    CHECK (item_type IN ('labor','material','material_lump_sum','lump_sum','travel','small_material','other')),
  unit text NOT NULL DEFAULT 'Stk',
  default_quantity numeric(10,3) NOT NULL DEFAULT 1,
  default_unit_price_net numeric(10,2),
  default_vat_rate numeric(5,2) NOT NULL DEFAULT 19,
  planned_hours numeric(6,2),
  material_cost_estimate numeric(10,2),
  tags text[] DEFAULT '{}',
  sort_order int DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_templates_category ON offer_position_templates(category, is_active);
CREATE INDEX idx_templates_company ON offer_position_templates(company_id) WHERE company_id IS NOT NULL;
CREATE INDEX idx_templates_tags ON offer_position_templates USING gin(tags);

ALTER TABLE offer_position_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "templates_read_system" ON offer_position_templates
  FOR SELECT USING (company_id IS NULL AND is_active = true);

CREATE POLICY "templates_read_company" ON offer_position_templates
  FOR SELECT USING (
    company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "templates_manage_company" ON offer_position_templates
  FOR ALL USING (
    company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
  );

-- ============================================================================
-- TABLE 2: company_ai_settings
-- ============================================================================

CREATE TABLE IF NOT EXISTS company_ai_settings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL UNIQUE REFERENCES companies(id) ON DELETE CASCADE,
  default_hourly_rate numeric(10,2) DEFAULT 75.00,
  default_vat_rate numeric(5,2) DEFAULT 19,
  ai_model text DEFAULT 'gpt-4o-mini',
  temperature numeric(3,2) DEFAULT 0.3,
  max_positions int DEFAULT 20,
  custom_prompt_additions text,
  monthly_ai_calls int DEFAULT 0,
  monthly_ai_limit int DEFAULT 500,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE company_ai_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_settings_read" ON company_ai_settings
  FOR SELECT USING (
    company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "ai_settings_manage" ON company_ai_settings
  FOR ALL USING (
    company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
  );

-- ============================================================================
-- SEED DATA: ~50 Standard Elektro-Positionen (system templates, company_id = NULL)
-- ============================================================================

INSERT INTO offer_position_templates
  (company_id, category, name, description, item_type, unit, default_quantity, default_unit_price_net, planned_hours, material_cost_estimate, tags, sort_order)
VALUES
  -- INSTALLATION / STECKDOSEN / SCHALTER
  (NULL, 'elektro', 'Steckdose (Schuko) setzen', 'Steckdose (Schuko) setzen', 'labor', 'Stk', 1, NULL, 0.75, 12.00, '{steckdose,schuko,up,installation}', 10),
  (NULL, 'elektro', 'Doppelsteckdose setzen', 'Doppelsteckdose setzen', 'labor', 'Stk', 1, NULL, 0.85, 18.00, '{steckdose,doppel,schuko,up,installation}', 11),
  (NULL, 'elektro', 'Lichtschalter (Aus) setzen', 'Lichtschalter (Aus) setzen', 'labor', 'Stk', 1, NULL, 0.60, 10.00, '{schalter,aus,licht,up,installation}', 20),
  (NULL, 'elektro', 'Wechselschalter setzen', 'Wechselschalter setzen', 'labor', 'Stk', 1, NULL, 0.65, 12.00, '{schalter,wechsel,licht,up,installation}', 21),
  (NULL, 'elektro', 'Kreuzschalter setzen', 'Kreuzschalter setzen', 'labor', 'Stk', 1, NULL, 0.70, 14.00, '{schalter,kreuz,licht,up,installation}', 22),
  (NULL, 'elektro', 'Dimmer setzen', 'Dimmer setzen', 'labor', 'Stk', 1, NULL, 0.75, 35.00, '{dimmer,licht,up,installation}', 23),
  (NULL, 'elektro', 'Bewegungsmelder (AP) montieren', 'Bewegungsmelder (AP) montieren', 'labor', 'Stk', 1, NULL, 0.80, 28.00, '{bewegungsmelder,sensor,aussen,ap}', 24),
  (NULL, 'elektro', 'Taster (Klingel) setzen', 'Taster (Klingel) setzen', 'labor', 'Stk', 1, NULL, 0.50, 8.00, '{taster,klingel,up}', 25),
  (NULL, 'elektro', 'CEE-Steckdose 16A montieren', 'CEE-Steckdose 16A montieren', 'labor', 'Stk', 1, NULL, 1.50, 35.00, '{cee,kraftstrom,drehstrom,16a,steckdose}', 30),
  (NULL, 'elektro', 'CEE-Steckdose 32A montieren', 'CEE-Steckdose 32A montieren', 'labor', 'Stk', 1, NULL, 1.75, 55.00, '{cee,kraftstrom,drehstrom,32a,steckdose}', 31),

  -- KABEL / LEITUNGEN
  (NULL, 'elektro', 'Kabel NYM-J 3x1,5 verlegen', 'Kabel NYM-J 3x1,5 verlegen', 'material', 'm', 1, 2.50, 0.10, 1.20, '{kabel,nym,leitung,3x1.5,verlegen}', 40),
  (NULL, 'elektro', 'Kabel NYM-J 3x2,5 verlegen', 'Kabel NYM-J 3x2,5 verlegen', 'material', 'm', 1, 3.20, 0.10, 1.80, '{kabel,nym,leitung,3x2.5,verlegen}', 41),
  (NULL, 'elektro', 'Kabel NYM-J 5x2,5 verlegen', 'Kabel NYM-J 5x2,5 verlegen', 'material', 'm', 1, 5.50, 0.12, 3.50, '{kabel,nym,leitung,5x2.5,verlegen,drehstrom}', 42),
  (NULL, 'elektro', 'Kabel NYM-J 5x4 verlegen', 'Kabel NYM-J 5x4 verlegen', 'material', 'm', 1, 8.00, 0.15, 5.50, '{kabel,nym,leitung,5x4,verlegen,drehstrom}', 43),
  (NULL, 'elektro', 'Kabelkanal (AP) montieren', 'Kabelkanal (AP) montieren', 'material', 'm', 1, 8.50, 0.15, 4.00, '{kabelkanal,ap,aufputz,kanal}', 44),
  (NULL, 'elektro', 'Leerrohr M20 verlegen', 'Leerrohr M20 verlegen', 'material', 'm', 1, 3.00, 0.08, 1.50, '{leerrohr,m20,rohr,installation}', 45),

  -- SCHLITZARBEITEN
  (NULL, 'elektro', 'Schlitz stemmen (Mauerwerk)', 'Schlitz stemmen (Mauerwerk)', 'labor', 'm', 1, NULL, 0.25, 0, '{schlitz,stemmen,mauerwerk,rohbau}', 50),
  (NULL, 'elektro', 'Schlitz stemmen (Beton)', 'Schlitz stemmen (Beton)', 'labor', 'm', 1, NULL, 0.45, 0, '{schlitz,stemmen,beton,rohbau}', 51),
  (NULL, 'elektro', 'Schlitz zuputzen', 'Schlitz zuputzen', 'labor', 'm', 1, NULL, 0.15, 2.00, '{schlitz,putz,verschliessen}', 52),
  (NULL, 'elektro', 'Durchbruch (Mauerwerk)', 'Durchbruch (Mauerwerk)', 'labor', 'Stk', 1, NULL, 0.40, 0, '{durchbruch,mauerwerk,bohrung}', 53),
  (NULL, 'elektro', 'Durchbruch (Beton/Stahlbeton)', 'Durchbruch (Beton/Stahlbeton)', 'labor', 'Stk', 1, NULL, 0.80, 0, '{durchbruch,beton,stahlbeton,kernbohrung}', 54),

  -- VERTEILER / SICHERUNGEN
  (NULL, 'elektro', 'Unterverteiler (UV) setzen', 'Unterverteiler (UV) setzen', 'labor', 'Stk', 1, NULL, 2.50, 85.00, '{unterverteiler,uv,verteiler,sicherungskasten}', 60),
  (NULL, 'elektro', 'Leitungsschutzschalter (LS) einbauen', 'Leitungsschutzschalter (LS) einbauen', 'labor', 'Stk', 1, NULL, 0.25, 8.00, '{ls,sicherung,automat,leitungsschutzschalter}', 61),
  (NULL, 'elektro', 'FI-Schutzschalter (RCD) einbauen', 'FI-Schutzschalter (RCD) einbauen', 'labor', 'Stk', 1, NULL, 0.35, 35.00, '{fi,rcd,fehlerstrom,schutzschalter,personenschutz}', 62),
  (NULL, 'elektro', 'FI/LS-Kombischalter einbauen', 'FI/LS-Kombischalter einbauen', 'labor', 'Stk', 1, NULL, 0.30, 55.00, '{fi,ls,kombi,rcbo,schutzschalter}', 63),
  (NULL, 'elektro', 'Ueberspannungsschutz (Typ 2) einbauen', 'Ueberspannungsschutz (Typ 2) einbauen', 'labor', 'Stk', 1, NULL, 0.30, 65.00, '{ueberspannungsschutz,blitzschutz,typ2}', 64),
  (NULL, 'elektro', 'Hauptschalter einbauen', 'Hauptschalter einbauen', 'labor', 'Stk', 1, NULL, 0.30, 25.00, '{hauptschalter,not-aus,verteiler}', 65),
  (NULL, 'elektro', 'Verteiler beschriften', 'Verteiler beschriften', 'labor', 'Stk', 1, NULL, 0.50, 5.00, '{beschriftung,verteiler,dokumentation}', 66),

  -- BELEUCHTUNG
  (NULL, 'elektro', 'Deckenleuchte montieren', 'Deckenleuchte montieren', 'labor', 'Stk', 1, NULL, 0.50, 0, '{leuchte,decke,montage,beleuchtung}', 70),
  (NULL, 'elektro', 'Wandleuchte montieren', 'Wandleuchte montieren', 'labor', 'Stk', 1, NULL, 0.50, 0, '{leuchte,wand,montage,beleuchtung}', 71),
  (NULL, 'elektro', 'Einbaustrahler (LED) setzen', 'Einbaustrahler (LED) setzen', 'labor', 'Stk', 1, NULL, 0.40, 18.00, '{einbaustrahler,led,spot,decke}', 72),
  (NULL, 'elektro', 'LED-Streifen montieren', 'LED-Streifen montieren', 'labor', 'm', 1, NULL, 0.30, 15.00, '{led,streifen,band,lichtband,profil}', 73),
  (NULL, 'elektro', 'Aussenleuchte montieren', 'Aussenleuchte montieren', 'labor', 'Stk', 1, NULL, 0.75, 0, '{leuchte,aussen,ip44,ip65,garten}', 74),
  (NULL, 'elektro', 'Deckenauslass setzen', 'Deckenauslass setzen', 'labor', 'Stk', 1, NULL, 0.40, 8.00, '{deckenauslass,baldachin,anschluss}', 75),

  -- SMART HOME / SONDERTECHNIK
  (NULL, 'elektro', 'Netzwerkdose (RJ45) setzen', 'Netzwerkdose (RJ45) setzen', 'labor', 'Stk', 1, NULL, 0.60, 15.00, '{netzwerk,rj45,cat6,lan,dose}', 80),
  (NULL, 'elektro', 'Netzwerkkabel Cat6a verlegen', 'Netzwerkkabel Cat6a verlegen', 'material', 'm', 1, 3.50, 0.08, 2.00, '{netzwerk,cat6,kabel,lan,verlegen}', 81),
  (NULL, 'elektro', 'SAT-/Antennendose setzen', 'SAT-/Antennendose setzen', 'labor', 'Stk', 1, NULL, 0.50, 12.00, '{sat,antenne,dose,tv}', 82),
  (NULL, 'elektro', 'Rauchmelder montieren', 'Rauchmelder montieren', 'labor', 'Stk', 1, NULL, 0.25, 0, '{rauchmelder,brandschutz,din14676}', 83),
  (NULL, 'elektro', 'Tuersprechanlage montieren', 'Tuersprechanlage montieren', 'labor', 'Stk', 1, NULL, 3.00, 150.00, '{tuersprechanlage,klingel,gegensprechanlage}', 84),
  (NULL, 'elektro', 'Wallbox (11kW) montieren', 'Wallbox (11kW) montieren', 'labor', 'Stk', 1, NULL, 4.00, 450.00, '{wallbox,emobility,laden,elektroauto,11kw}', 85),
  (NULL, 'elektro', 'Wallbox (22kW) montieren', 'Wallbox (22kW) montieren', 'labor', 'Stk', 1, NULL, 5.00, 800.00, '{wallbox,emobility,laden,elektroauto,22kw}', 86),

  -- PRUEFUNG / DOKUMENTATION
  (NULL, 'elektro', 'E-Check / Erstpruefung', 'E-Check / Erstpruefung', 'labor', 'Stk', 1, NULL, 2.00, 0, '{echeck,pruefung,erstpruefung,vde,messprotokoll}', 90),
  (NULL, 'elektro', 'Isolationsmessung je Stromkreis', 'Isolationsmessung je Stromkreis', 'labor', 'Stk', 1, NULL, 0.15, 0, '{messung,isolation,schleifenimpedanz,pruefung}', 91),
  (NULL, 'elektro', 'Aufmass / Bestandsaufnahme', 'Aufmass / Bestandsaufnahme', 'labor', 'Std', 1, NULL, 1.00, 0, '{aufmass,bestandsaufnahme,besichtigung}', 92),

  -- ALLGEMEIN / PAUSCHAL
  (NULL, 'elektro', 'An- und Abfahrt', 'An- und Abfahrt', 'travel', 'km', 1, 0.42, NULL, 0, '{anfahrt,abfahrt,fahrt,fahrtkosten}', 100),
  (NULL, 'elektro', 'Kleinmaterialpauschale', 'Kleinmaterialpauschale', 'small_material', 'psch', 1, NULL, NULL, 0, '{kleinmaterial,pauschal,schrauben,duebel}', 101),
  (NULL, 'elektro', 'Baustromverteiler aufstellen', 'Baustromverteiler aufstellen', 'labor', 'psch', 1, NULL, 2.00, 50.00, '{baustrom,verteiler,baustelle}', 102),
  (NULL, 'elektro', 'Altanlage demontieren', 'Altanlage demontieren', 'labor', 'psch', 1, NULL, NULL, 0, '{demontage,alt,entsorgung,rueckbau}', 103),
  (NULL, 'elektro', 'Brandschottung', 'Brandschottung', 'labor', 'Stk', 1, NULL, 0.75, 25.00, '{brandschottung,brandschutz,durchfuehrung,din4102}', 104),
  (NULL, 'elektro', 'Potentialausgleich herstellen', 'Potentialausgleich herstellen', 'labor', 'Stk', 1, NULL, 1.50, 35.00, '{potentialausgleich,erdung,pa,schiene}', 105),
  (NULL, 'elektro', 'Elektroherd anschliessen', 'Elektroherd anschliessen', 'labor', 'Stk', 1, NULL, 0.75, 0, '{herd,kochfeld,drehstrom,anschluss,kueche}', 106),
  (NULL, 'elektro', 'Durchlauferhitzer anschliessen', 'Durchlauferhitzer anschliessen', 'labor', 'Stk', 1, NULL, 1.50, 0, '{durchlauferhitzer,warmwasser,anschluss}', 107),
  (NULL, 'elektro', 'Abluftventilator montieren', 'Abluftventilator montieren', 'labor', 'Stk', 1, NULL, 1.00, 45.00, '{ventilator,abluft,bad,lueftung}', 108);
