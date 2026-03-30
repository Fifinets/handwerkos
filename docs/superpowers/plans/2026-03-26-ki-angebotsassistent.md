# KI-Angebotsassistent (AI Offer Assistant)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Electricians describe a project in natural language (e.g. "Badezimmer komplett neu verkabeln, 2 Steckdosen, 1 Lichtschalter, Unterverteilung") and AI generates structured offer positions using the company's own Verrechnungslohn. Positions stream into a preview, user clicks "Uebernehmen" to insert them into the actual offer.

**Architecture:** Supabase Edge Function holds OpenAI key (NOT in browser). Frontend streams via fetch + ReadableStream. AI uses Structured Outputs (response_format with JSON schema) to produce positions matching the existing `OfferItemCreate` Zod schema. Position templates in DB provide few-shot examples. AMGE Verrechnungslohn from company settings sets the hourly rate.

**Tech Stack:** Supabase Edge Function (Deno), OpenAI API (gpt-4o-mini with structured outputs), existing Zod schemas, React streaming UI, TanStack Query for templates cache

---

## Architektur-Uebersicht

```
User types project description in Chat UI (OfferSidebar "chat" tab)
  -> Frontend sends POST to Edge Function /generate-offer-positions
     Body: { prompt, templates (top-10 relevant), hourly_rate, vat_rate }
     Auth: Supabase JWT (user must be logged in)
  -> Edge Function:
     1. Builds system prompt with Elektro-Fachbetrieb context
     2. Injects matching templates as few-shot examples
     3. Calls OpenAI gpt-4o-mini with response_format: json_schema
     4. Streams response back via SSE (text/event-stream)
  -> Frontend reads stream, parses partial JSON, renders positions live
  -> User reviews positions in AIOfferPreview
  -> User clicks "Uebernehmen"
     -> Positions are appended to the OfferItemsEditor via existing onAddItem callback
     -> useSyncOfferItems persists to DB
```

---

## Datei-Struktur

| Datei | Aktion | Verantwortung |
|-------|--------|---------------|
| `supabase/migrations/20260326100000_ai_offer_templates.sql` | NEU | DB: offer_position_templates + company_ai_settings + seed data |
| `supabase/functions/generate-offer-positions/index.ts` | NEU | Edge Function: OpenAI call with streaming |
| `src/types/aiOffer.ts` | NEU | Zod schemas for AI offer generation request/response |
| `src/services/aiOfferService.ts` | NEU | Frontend service: call Edge Function, parse stream |
| `src/components/offers/AIOfferAssistant.tsx` | NEU | Chat UI component (replaces sidebar placeholder) |
| `src/components/offers/AIOfferPreview.tsx` | NEU | Streaming position preview with accept button |
| `src/hooks/useAIOfferAssistant.ts` | NEU | React hook: manages chat state, streaming, templates |
| `src/components/offers/OfferSidebar.tsx` | AENDERN | Replace "in Kuerze verfuegbar" with AIOfferAssistant |
| `src/hooks/useApi.ts` | AENDERN | Add useOfferTemplates hook |
| `.env` | AENDERN | Ensure OPENAI_API_KEY is in Edge Function env |

---

## Task 1: Datenbank -- Position Templates + Company AI Settings

**Files:**
- Create: `supabase/migrations/20260326100000_ai_offer_templates.sql`

### Why
AI needs domain-specific few-shot examples to produce realistic Elektro-Positionen. Templates store standard positions with Zeitwerte (time values). Company AI settings store the Verrechnungslohn so the Edge Function can price positions correctly.

- [ ] **Step 1.1: Create migration file**

```sql
-- supabase/migrations/20260326100000_ai_offer_templates.sql

-- ============================================================================
-- 1. OFFER POSITION TEMPLATES
-- ============================================================================
CREATE TABLE IF NOT EXISTS offer_position_templates (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  -- NULL company_id = system-wide template (available to all companies)

  category text NOT NULL DEFAULT 'elektro',
  -- Categories: 'elektro', 'sanitaer', 'heizung', 'allgemein'

  name text NOT NULL,
  -- Short name for search: "Steckdose setzen"

  description text NOT NULL,
  -- Full position text for the offer: "Steckdose (Schuko) inkl. Unterputzdose setzen..."

  item_type text NOT NULL DEFAULT 'labor'
    CHECK (item_type IN ('labor','material','material_lump_sum','lump_sum','travel','small_material','other')),

  unit text NOT NULL DEFAULT 'Stk',
  default_quantity numeric(10,3) NOT NULL DEFAULT 1,
  default_unit_price_net numeric(10,2), -- NULL = use Verrechnungslohn * hours
  default_vat_rate numeric(5,2) NOT NULL DEFAULT 19,

  -- Time values (Zeitwerte)
  planned_hours numeric(6,2),
  -- e.g. 0.75 hours to install one Steckdose

  material_cost_estimate numeric(10,2),
  -- Estimated material cost per unit (for internal calc)

  tags text[] DEFAULT '{}',
  -- Searchable tags: {'steckdose', 'up', 'schuko', 'installation'}

  sort_order int DEFAULT 0,
  is_active boolean DEFAULT true,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Index for fast search
CREATE INDEX idx_templates_category ON offer_position_templates(category, is_active);
CREATE INDEX idx_templates_company ON offer_position_templates(company_id) WHERE company_id IS NOT NULL;
CREATE INDEX idx_templates_tags ON offer_position_templates USING gin(tags);

-- RLS
ALTER TABLE offer_position_templates ENABLE ROW LEVEL SECURITY;

-- System templates (company_id IS NULL) are readable by everyone
CREATE POLICY "templates_read_system" ON offer_position_templates
  FOR SELECT USING (company_id IS NULL AND is_active = true);

-- Company-specific templates are readable by company members
CREATE POLICY "templates_read_company" ON offer_position_templates
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Company members can manage their own templates
CREATE POLICY "templates_manage_company" ON offer_position_templates
  FOR ALL USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );


-- ============================================================================
-- 2. COMPANY AI SETTINGS
-- ============================================================================
CREATE TABLE IF NOT EXISTS company_ai_settings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL UNIQUE REFERENCES companies(id) ON DELETE CASCADE,

  -- Pricing
  default_hourly_rate numeric(10,2) DEFAULT 75.00,
  -- Falls back to active AMGE Verrechnungslohn if NULL

  default_vat_rate numeric(5,2) DEFAULT 19,

  -- AI behavior
  ai_model text DEFAULT 'gpt-4o-mini',
  temperature numeric(3,2) DEFAULT 0.3,
  max_positions int DEFAULT 20,

  -- Custom system prompt additions (optional)
  custom_prompt_additions text,
  -- e.g. "Wir verwenden immer Busch-Jaeger Schalter als Standard"

  -- Limits
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
-- 3. SEED DATA: ~50 Standard Elektro-Positionen
-- ============================================================================
INSERT INTO offer_position_templates
  (company_id, category, name, description, item_type, unit, default_quantity, default_unit_price_net, planned_hours, material_cost_estimate, tags, sort_order)
VALUES
  -- === INSTALLATION / STECKDOSEN / SCHALTER ===
  (NULL, 'elektro', 'Steckdose (Schuko) setzen',
   'Schutzkontaktsteckdose (Schuko) inkl. Unterputzdose und Abdeckrahmen setzen. Ohne Zuleitung.',
   'labor', 'Stk', 1, NULL, 0.75, 12.00,
   '{steckdose,schuko,up,installation}', 10),

  (NULL, 'elektro', 'Doppelsteckdose setzen',
   'Schutzkontakt-Doppelsteckdose inkl. Unterputzdose und Abdeckrahmen setzen. Ohne Zuleitung.',
   'labor', 'Stk', 1, NULL, 0.85, 18.00,
   '{steckdose,doppel,schuko,up,installation}', 11),

  (NULL, 'elektro', 'Lichtschalter (Aus) setzen',
   'Ausschalter inkl. Unterputzdose und Abdeckrahmen setzen. Ohne Zuleitung.',
   'labor', 'Stk', 1, NULL, 0.60, 10.00,
   '{schalter,aus,licht,up,installation}', 20),

  (NULL, 'elektro', 'Wechselschalter setzen',
   'Wechselschalter inkl. Unterputzdose und Abdeckrahmen setzen. Ohne Zuleitung.',
   'labor', 'Stk', 1, NULL, 0.65, 12.00,
   '{schalter,wechsel,licht,up,installation}', 21),

  (NULL, 'elektro', 'Kreuzschalter setzen',
   'Kreuzschalter inkl. Unterputzdose und Abdeckrahmen setzen. Ohne Zuleitung.',
   'labor', 'Stk', 1, NULL, 0.70, 14.00,
   '{schalter,kreuz,licht,up,installation}', 22),

  (NULL, 'elektro', 'Dimmer setzen',
   'Unterputz-Dimmer inkl. Unterputzdose und Abdeckrahmen setzen. Ohne Zuleitung.',
   'labor', 'Stk', 1, NULL, 0.75, 35.00,
   '{dimmer,licht,up,installation}', 23),

  (NULL, 'elektro', 'Bewegungsmelder (AP) montieren',
   'Aufputz-Bewegungsmelder montieren und anschliessen. Ohne Zuleitung.',
   'labor', 'Stk', 1, NULL, 0.80, 28.00,
   '{bewegungsmelder,sensor,aussen,ap}', 24),

  (NULL, 'elektro', 'Taster (Klingel) setzen',
   'Klingeltaster inkl. Unterputzdose und Abdeckrahmen setzen.',
   'labor', 'Stk', 1, NULL, 0.50, 8.00,
   '{taster,klingel,up}', 25),

  (NULL, 'elektro', 'CEE-Steckdose 16A montieren',
   'CEE-Kraftsteckdose 16A/5-polig (Drehstrom) inkl. Wandmontage und Anschluss.',
   'labor', 'Stk', 1, NULL, 1.50, 35.00,
   '{cee,kraftstrom,drehstrom,16a,steckdose}', 30),

  (NULL, 'elektro', 'CEE-Steckdose 32A montieren',
   'CEE-Kraftsteckdose 32A/5-polig (Drehstrom) inkl. Wandmontage und Anschluss.',
   'labor', 'Stk', 1, NULL, 1.75, 55.00,
   '{cee,kraftstrom,drehstrom,32a,steckdose}', 31),

  -- === KABEL / LEITUNGEN ===
  (NULL, 'elektro', 'Kabel NYM-J 3x1,5 verlegen',
   'Kabel NYM-J 3x1,5mm2 in vorbereiteten Schlitzen/Rohren verlegen.',
   'material', 'm', 1, 2.50, 0.10, 1.20,
   '{kabel,nym,leitung,3x1.5,verlegen}', 40),

  (NULL, 'elektro', 'Kabel NYM-J 3x2,5 verlegen',
   'Kabel NYM-J 3x2,5mm2 in vorbereiteten Schlitzen/Rohren verlegen.',
   'material', 'm', 1, 3.20, 0.10, 1.80,
   '{kabel,nym,leitung,3x2.5,verlegen}', 41),

  (NULL, 'elektro', 'Kabel NYM-J 5x2,5 verlegen',
   'Kabel NYM-J 5x2,5mm2 in vorbereiteten Schlitzen/Rohren verlegen.',
   'material', 'm', 1, 5.50, 0.12, 3.50,
   '{kabel,nym,leitung,5x2.5,verlegen,drehstrom}', 42),

  (NULL, 'elektro', 'Kabel NYM-J 5x4 verlegen',
   'Kabel NYM-J 5x4mm2 in vorbereiteten Schlitzen/Rohren verlegen.',
   'material', 'm', 1, 8.00, 0.15, 5.50,
   '{kabel,nym,leitung,5x4,verlegen,drehstrom}', 43),

  (NULL, 'elektro', 'Kabelkanal (AP) montieren',
   'Aufputz-Kabelkanal inkl. Befestigung montieren.',
   'material', 'm', 1, 8.50, 0.15, 4.00,
   '{kabelkanal,ap,aufputz,kanal}', 44),

  (NULL, 'elektro', 'Leerrohr M20 verlegen',
   'Leerrohr M20 in Wand/Decke verlegen (ohne Schlitzarbeiten).',
   'material', 'm', 1, 3.00, 0.08, 1.50,
   '{leerrohr,m20,rohr,installation}', 45),

  -- === SCHLITZARBEITEN ===
  (NULL, 'elektro', 'Schlitz stemmen (Mauerwerk)',
   'Schlitz in Mauerwerk stemmen fuer Kabelverlegung, ca. 3x3cm.',
   'labor', 'm', 1, NULL, 0.25, 0,
   '{schlitz,stemmen,mauerwerk,rohbau}', 50),

  (NULL, 'elektro', 'Schlitz stemmen (Beton)',
   'Schlitz in Betonwand/-decke stemmen fuer Kabelverlegung, ca. 3x3cm.',
   'labor', 'm', 1, NULL, 0.45, 0,
   '{schlitz,stemmen,beton,rohbau}', 51),

  (NULL, 'elektro', 'Schlitz zuputzen',
   'Kabelschlitz fachgerecht mit Putzmoertel verschliessen.',
   'labor', 'm', 1, NULL, 0.15, 2.00,
   '{schlitz,putz,verschliessen}', 52),

  (NULL, 'elektro', 'Durchbruch (Mauerwerk)',
   'Wanddurchbruch fuer Kabeldurchfuehrung in Mauerwerk bis 30cm.',
   'labor', 'Stk', 1, NULL, 0.40, 0,
   '{durchbruch,mauerwerk,bohrung}', 53),

  (NULL, 'elektro', 'Durchbruch (Beton/Stahlbeton)',
   'Wanddurchbruch fuer Kabeldurchfuehrung in Beton/Stahlbeton bis 30cm.',
   'labor', 'Stk', 1, NULL, 0.80, 0,
   '{durchbruch,beton,stahlbeton,kernbohrung}', 54),

  -- === VERTEILER / SICHERUNGEN ===
  (NULL, 'elektro', 'Unterverteiler (UV) setzen',
   'Unterverteiler (Aufputz/Unterputz) inkl. Montage setzen. Ohne Bestückung.',
   'labor', 'Stk', 1, NULL, 2.50, 85.00,
   '{unterverteiler,uv,verteiler,sicherungskasten}', 60),

  (NULL, 'elektro', 'Leitungsschutzschalter (LS) einbauen',
   'Leitungsschutzschalter (Sicherungsautomat) in Verteiler einbauen und anschliessen.',
   'labor', 'Stk', 1, NULL, 0.25, 8.00,
   '{ls,sicherung,automat,leitungsschutzschalter}', 61),

  (NULL, 'elektro', 'FI-Schutzschalter (RCD) einbauen',
   'Fehlerstromschutzschalter (RCD 30mA) in Verteiler einbauen und anschliessen.',
   'labor', 'Stk', 1, NULL, 0.35, 35.00,
   '{fi,rcd,fehlerstrom,schutzschalter,personenschutz}', 62),

  (NULL, 'elektro', 'FI/LS-Kombischalter einbauen',
   'FI/LS-Kombischalter (RCBO) in Verteiler einbauen und anschliessen.',
   'labor', 'Stk', 1, NULL, 0.30, 55.00,
   '{fi,ls,kombi,rcbo,schutzschalter}', 63),

  (NULL, 'elektro', 'Ueberspannungsschutz (Typ 2) einbauen',
   'Ueberspannungsschutz Typ 2 in Verteiler einbauen und anschliessen.',
   'labor', 'Stk', 1, NULL, 0.30, 65.00,
   '{ueberspannungsschutz,blitzschutz,typ2}', 64),

  (NULL, 'elektro', 'Hauptschalter einbauen',
   'Not-Aus / Hauptschalter in Verteiler einbauen.',
   'labor', 'Stk', 1, NULL, 0.30, 25.00,
   '{hauptschalter,not-aus,verteiler}', 65),

  (NULL, 'elektro', 'Verteiler beschriften',
   'Stromkreise im Verteiler fachgerecht beschriften (Aufkleber/Gravur).',
   'labor', 'Stk', 1, NULL, 0.50, 5.00,
   '{beschriftung,verteiler,dokumentation}', 66),

  -- === BELEUCHTUNG ===
  (NULL, 'elektro', 'Deckenleuchte montieren',
   'Deckenleuchte montieren und anschliessen (Leuchte bauseits).',
   'labor', 'Stk', 1, NULL, 0.50, 0,
   '{leuchte,decke,montage,beleuchtung}', 70),

  (NULL, 'elektro', 'Wandleuchte montieren',
   'Wandleuchte montieren und anschliessen (Leuchte bauseits).',
   'labor', 'Stk', 1, NULL, 0.50, 0,
   '{leuchte,wand,montage,beleuchtung}', 71),

  (NULL, 'elektro', 'Einbaustrahler (LED) setzen',
   'LED-Einbaustrahler in abgehaengte Decke setzen und anschliessen.',
   'labor', 'Stk', 1, NULL, 0.40, 18.00,
   '{einbaustrahler,led,spot,decke}', 72),

  (NULL, 'elektro', 'LED-Streifen montieren',
   'LED-Lichtband inkl. Profil und Netzteil montieren.',
   'labor', 'm', 1, NULL, 0.30, 15.00,
   '{led,streifen,band,lichtband,profil}', 73),

  (NULL, 'elektro', 'Aussenleuchte montieren',
   'Aussenleuchte (IP44/IP65) montieren und anschliessen.',
   'labor', 'Stk', 1, NULL, 0.75, 0,
   '{leuchte,aussen,ip44,ip65,garten}', 74),

  (NULL, 'elektro', 'Deckenauslass setzen',
   'Deckenauslass (Baldachin) fuer spaetere Leuchtenmontage setzen.',
   'labor', 'Stk', 1, NULL, 0.40, 8.00,
   '{deckenauslass,baldachin,anschluss}', 75),

  -- === SMART HOME / SONDERTECHNIK ===
  (NULL, 'elektro', 'Netzwerkdose (RJ45) setzen',
   'Netzwerkdose Cat6a (RJ45) inkl. Unterputzdose setzen. Ohne Verkabelung.',
   'labor', 'Stk', 1, NULL, 0.60, 15.00,
   '{netzwerk,rj45,cat6,lan,dose}', 80),

  (NULL, 'elektro', 'Netzwerkkabel Cat6a verlegen',
   'Netzwerkkabel Cat6a S/FTP verlegen und auflegen.',
   'material', 'm', 1, 3.50, 0.08, 2.00,
   '{netzwerk,cat6,kabel,lan,verlegen}', 81),

  (NULL, 'elektro', 'SAT-/Antennendose setzen',
   'SAT-/Antennendose inkl. Unterputzdose setzen.',
   'labor', 'Stk', 1, NULL, 0.50, 12.00,
   '{sat,antenne,dose,tv}', 82),

  (NULL, 'elektro', 'Rauchmelder montieren',
   'Rauchwarnmelder nach DIN 14676 montieren (Geraet bauseits).',
   'labor', 'Stk', 1, NULL, 0.25, 0,
   '{rauchmelder,brandschutz,din14676}', 83),

  (NULL, 'elektro', 'Tuersprechanlage montieren',
   'Tuersprechanlage (2-Draht) inkl. Innen- und Aussenstation montieren.',
   'labor', 'Stk', 1, NULL, 3.00, 150.00,
   '{tuersprechanlage,klingel,gegensprechanlage}', 84),

  (NULL, 'elektro', 'Wallbox (11kW) montieren',
   'E-Auto-Ladestation (Wallbox 11kW) montieren, anschliessen und bei Netzbetreiber anmelden.',
   'labor', 'Stk', 1, NULL, 4.00, 450.00,
   '{wallbox,emobility,laden,elektroauto,11kw}', 85),

  (NULL, 'elektro', 'Wallbox (22kW) montieren',
   'E-Auto-Ladestation (Wallbox 22kW) montieren, anschliessen und Genehmigung beim Netzbetreiber.',
   'labor', 'Stk', 1, NULL, 5.00, 800.00,
   '{wallbox,emobility,laden,elektroauto,22kw}', 86),

  -- === PRUEFUNG / DOKUMENTATION ===
  (NULL, 'elektro', 'E-Check / Erstpruefung',
   'Erstpruefung der Elektroanlage nach DIN VDE 0100-600 inkl. Messprotokoll.',
   'labor', 'Stk', 1, NULL, 2.00, 0,
   '{echeck,pruefung,erstpruefung,vde,messprotokoll}', 90),

  (NULL, 'elektro', 'Isolationsmessung je Stromkreis',
   'Isolationsmessung und Schleifenimpedanzmessung je Stromkreis.',
   'labor', 'Stk', 1, NULL, 0.15, 0,
   '{messung,isolation,schleifenimpedanz,pruefung}', 91),

  (NULL, 'elektro', 'Aufmass / Bestandsaufnahme',
   'Aufmass und Bestandsaufnahme der vorhandenen Elektroinstallation vor Ort.',
   'labor', 'Std', 1, NULL, 1.00, 0,
   '{aufmass,bestandsaufnahme,besichtigung}', 92),

  -- === ALLGEMEIN / PAUSCHAL ===
  (NULL, 'elektro', 'An- und Abfahrt',
   'An- und Abfahrtspauschale.',
   'travel', 'km', 1, 0.42, NULL, 0,
   '{anfahrt,abfahrt,fahrt,fahrtkosten}', 100),

  (NULL, 'elektro', 'Kleinmaterialpauschale',
   'Kleinmaterial (Schrauben, Duebel, Klemmen, Klebeband etc.).',
   'small_material', 'psch', 1, NULL, NULL, 0,
   '{kleinmaterial,pauschal,schrauben,duebel}', 101),

  (NULL, 'elektro', 'Baustromverteiler aufstellen',
   'Baustromverteiler aufstellen, anschliessen und nach Abschluss wieder abbauen.',
   'labor', 'psch', 1, NULL, 2.00, 50.00,
   '{baustrom,verteiler,baustelle}', 102),

  (NULL, 'elektro', 'Altanlage demontieren',
   'Bestehende Elektroinstallation fachgerecht demontieren und entsorgen.',
   'labor', 'psch', 1, NULL, NULL, 0,
   '{demontage,alt,entsorgung,rueckbau}', 103),

  (NULL, 'elektro', 'Brandschottung',
   'Brandschottung (Kabeldurchfuehrung) nach DIN 4102 herstellen.',
   'labor', 'Stk', 1, NULL, 0.75, 25.00,
   '{brandschottung,brandschutz,durchfuehrung,din4102}', 104),

  (NULL, 'elektro', 'Potentialausgleich herstellen',
   'Potentialausgleichsschiene montieren und Verbindungen herstellen.',
   'labor', 'Stk', 1, NULL, 1.50, 35.00,
   '{potentialausgleich,erdung,pa,schiene}', 105),

  (NULL, 'elektro', 'Elektroherd anschliessen',
   'Elektroherd / Kochfeld (Drehstrom) anschliessen.',
   'labor', 'Stk', 1, NULL, 0.75, 0,
   '{herd,kochfeld,drehstrom,anschluss,kueche}', 106),

  (NULL, 'elektro', 'Durchlauferhitzer anschliessen',
   'Elektronischen Durchlauferhitzer (21-27kW) montieren und anschliessen.',
   'labor', 'Stk', 1, NULL, 1.50, 0,
   '{durchlauferhitzer,warmwasser,anschluss}', 107),

  (NULL, 'elektro', 'Abluftventilator montieren',
   'Abluftventilator (Bad/WC) montieren und an Lichtschalter anschliessen.',
   'labor', 'Stk', 1, NULL, 1.00, 45.00,
   '{ventilator,abluft,bad,lueftung}', 108)
;
```

- [ ] **Step 1.2: Apply the migration**

```bash
# Apply via Supabase CLI
npx supabase db push
```

**Verification:** Run query to confirm templates were seeded:
```sql
SELECT count(*), category FROM offer_position_templates GROUP BY category;
-- Expected: ~50 rows, category 'elektro'
```

---

## Task 2: Types -- AI Offer Zod Schemas

**Files:**
- Create: `src/types/aiOffer.ts`

### Why
We need type-safe request/response schemas that are shared between frontend and Edge Function (via copy). The response schema MUST match `OfferItemCreate` so positions can be directly inserted.

- [ ] **Step 2.1: Create the types file**

```typescript
// src/types/aiOffer.ts
// Zod schemas for AI Offer Assistant -- shared types for request/response

import { z } from 'zod';

// ============================================================================
// REQUEST: What the frontend sends to the Edge Function
// ============================================================================

export const AIOfferRequestSchema = z.object({
  prompt: z.string().min(3, 'Beschreibung zu kurz').max(2000),
  // Optional context
  project_name: z.string().optional(),
  customer_name: z.string().optional(),
  // Pricing context
  hourly_rate: z.number().min(1).max(500).default(75),
  vat_rate: z.number().min(0).max(100).default(19),
  // Few-shot templates (injected by frontend from DB cache)
  templates: z.array(z.object({
    name: z.string(),
    description: z.string(),
    item_type: z.string(),
    unit: z.string(),
    planned_hours: z.number().nullable(),
    material_cost_estimate: z.number().nullable(),
  })).max(15).default([]),
  // Custom prompt additions from company settings
  custom_instructions: z.string().optional(),
});

export type AIOfferRequest = z.infer<typeof AIOfferRequestSchema>;

// ============================================================================
// RESPONSE: What the AI generates (matches OfferItemCreate shape)
// ============================================================================

export const AIGeneratedPositionSchema = z.object({
  position_number: z.number().int().min(1),
  description: z.string().min(1),
  quantity: z.number().min(0.001),
  unit: z.string(),
  unit_price_net: z.number().min(0),
  vat_rate: z.number().min(0).max(100),
  item_type: z.enum([
    'labor', 'material', 'material_lump_sum', 'lump_sum',
    'travel', 'small_material', 'other'
  ]),
  planned_hours_item: z.number().min(0).optional(),
  material_purchase_cost: z.number().min(0).optional(),
  internal_notes: z.string().optional(),
  is_optional: z.boolean().default(false),
});

export type AIGeneratedPosition = z.infer<typeof AIGeneratedPositionSchema>;

export const AIOfferResponseSchema = z.object({
  positions: z.array(AIGeneratedPositionSchema),
  summary: z.string().optional(),
  // AI's reasoning / notes (not shown to customer)
  reasoning: z.string().optional(),
  total_estimated_hours: z.number().optional(),
  total_estimated_material_cost: z.number().optional(),
});

export type AIOfferResponse = z.infer<typeof AIOfferResponseSchema>;

// ============================================================================
// CHAT UI STATE
// ============================================================================

export interface AIChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  positions?: AIGeneratedPosition[];
  timestamp: Date;
  isStreaming?: boolean;
}

// ============================================================================
// TEMPLATE (from DB)
// ============================================================================

export const OfferPositionTemplateSchema = z.object({
  id: z.string().uuid(),
  company_id: z.string().uuid().nullable(),
  category: z.string(),
  name: z.string(),
  description: z.string(),
  item_type: z.string(),
  unit: z.string(),
  default_quantity: z.number(),
  default_unit_price_net: z.number().nullable(),
  default_vat_rate: z.number(),
  planned_hours: z.number().nullable(),
  material_cost_estimate: z.number().nullable(),
  tags: z.array(z.string()),
  sort_order: z.number(),
  is_active: z.boolean(),
});

export type OfferPositionTemplate = z.infer<typeof OfferPositionTemplateSchema>;
```

---

## Task 3: Edge Function -- generate-offer-positions

**Files:**
- Create: `supabase/functions/generate-offer-positions/index.ts`

### Why
The OpenAI API key MUST NOT be exposed in the browser. The Edge Function acts as a secure proxy. It builds a domain-specific system prompt with Elektro knowledge, injects template examples, and uses OpenAI's structured output (JSON mode) to produce valid positions.

- [ ] **Step 3.1: Create the Edge Function file**

```typescript
// supabase/functions/generate-offer-positions/index.ts

import { serve } from "https://deno.land/std@0.131.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// JSON Schema for OpenAI Structured Outputs (mirrors AIOfferResponseSchema)
const RESPONSE_JSON_SCHEMA = {
  name: "offer_positions",
  strict: true,
  schema: {
    type: "object",
    properties: {
      positions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            position_number: { type: "integer" },
            description: { type: "string" },
            quantity: { type: "number" },
            unit: { type: "string" },
            unit_price_net: { type: "number" },
            vat_rate: { type: "number" },
            item_type: {
              type: "string",
              enum: ["labor", "material", "material_lump_sum", "lump_sum", "travel", "small_material", "other"]
            },
            planned_hours_item: { type: "number" },
            material_purchase_cost: { type: "number" },
            internal_notes: { type: "string" },
            is_optional: { type: "boolean" }
          },
          required: [
            "position_number", "description", "quantity", "unit",
            "unit_price_net", "vat_rate", "item_type", "planned_hours_item",
            "material_purchase_cost", "internal_notes", "is_optional"
          ],
          additionalProperties: false
        }
      },
      summary: { type: "string" },
      reasoning: { type: "string" },
      total_estimated_hours: { type: "number" },
      total_estimated_material_cost: { type: "number" }
    },
    required: [
      "positions", "summary", "reasoning",
      "total_estimated_hours", "total_estimated_material_cost"
    ],
    additionalProperties: false
  }
}

function buildSystemPrompt(hourlyRate: number, vatRate: number, customInstructions?: string): string {
  return `Du bist ein erfahrener Elektro-Meister und Kalkulationsexperte fuer ein deutsches Elektro-Fachunternehmen.
Du erstellst professionelle Angebotspositionen basierend auf Projektbeschreibungen.

REGELN:
1. Erstelle REALISTISCHE Positionen fuer ein Elektriker-Angebot
2. Jede Position muss eine klare, professionelle Beschreibung haben
3. Verwende den Verrechnungslohn von ${hourlyRate.toFixed(2)} EUR/Std fuer Arbeitspositionen
4. Berechne unit_price_net = planned_hours_item * ${hourlyRate.toFixed(2)} fuer labor-Positionen
5. Fuer Material-Positionen: Setze realistische Marktpreise (Grosshandel + Aufschlag)
6. Fuer material_purchase_cost: Setze den Einkaufspreis (ca. 60-70% des Verkaufspreises)
7. Verwende ${vatRate}% MwSt (vat_rate) -- 0% nur bei Reverse-Charge
8. Positionen nach logischer Reihenfolge nummerieren (position_number ab 1)
9. Gruppiere: Zuerst Titel-/Textpositionen (wenn sinnvoll), dann Arbeit, dann Material, zuletzt Pauschalposten
10. internal_notes: Kurze Kalkulationsnotiz fuer den Handwerker (z.B. "Zeitwert: 0.75h lt. Erfahrung")
11. is_optional auf false setzen, ausser der Nutzer bittet explizit um optionale Positionen
12. Sei NICHT zu konservativ -- ein reales Angebot hat typischerweise 5-20 Positionen
13. VERGISS NICHT: Anfahrt, Kleinmaterial, Pruefung/E-Check wenn passend
14. Alle Beschreibungen auf Deutsch

ITEM TYPES:
- "labor": Arbeitsleistung (Stunden). unit="Std". unit_price_net = planned_hours * hourly_rate
- "material": Einzelmaterial. unit="Stk"/"m"/etc. unit_price_net = Verkaufspreis
- "lump_sum": Pauschalposition. unit="psch"
- "material_lump_sum": Materialpauschale. unit="psch"
- "travel": Fahrtkosten. unit="km". unit_price_net=0.42
- "small_material": Kleinmaterial. unit="psch"
- "other": Sonstige Leistung

${customInstructions ? `\nZUSAETZLICHE FIRMENSPEZIFISCHE ANWEISUNGEN:\n${customInstructions}` : ''}`
}

function buildUserPrompt(
  prompt: string,
  templates: Array<{ name: string; description: string; item_type: string; unit: string; planned_hours: number | null; material_cost_estimate: number | null }>,
  projectName?: string,
  customerName?: string
): string {
  let msg = `Erstelle Angebotspositionen fuer folgendes Projekt:\n\n"${prompt}"`;

  if (projectName) msg += `\n\nProjektname: ${projectName}`;
  if (customerName) msg += `\nKunde: ${customerName}`;

  if (templates.length > 0) {
    msg += `\n\nHier sind Beispiel-Positionen aus unserem Katalog als Referenz:\n`;
    templates.forEach((t, i) => {
      msg += `${i + 1}. ${t.name}: "${t.description}" (${t.item_type}, ${t.unit}`;
      if (t.planned_hours) msg += `, ${t.planned_hours}h`;
      if (t.material_cost_estimate) msg += `, Material ~${t.material_cost_estimate}EUR`;
      msg += `)\n`;
    });
  }

  return msg;
}

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Verify auth
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Nicht authentifiziert' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify JWT via Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Ungültiges Token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 2. Parse request body
    const body = await req.json()
    const {
      prompt,
      project_name,
      customer_name,
      hourly_rate = 75,
      vat_rate = 19,
      templates = [],
      custom_instructions,
    } = body

    if (!prompt || prompt.length < 3) {
      return new Response(
        JSON.stringify({ error: 'Beschreibung zu kurz' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 3. Get OpenAI key
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiApiKey) {
      return new Response(
        JSON.stringify({ error: 'OpenAI API key nicht konfiguriert' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 4. Build prompts
    const systemPrompt = buildSystemPrompt(hourly_rate, vat_rate, custom_instructions)
    const userPrompt = buildUserPrompt(prompt, templates, project_name, customer_name)

    // 5. Call OpenAI with streaming
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: RESPONSE_JSON_SCHEMA,
        },
        temperature: 0.3,
        max_tokens: 4000,
        stream: true,
      }),
    })

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text()
      console.error('OpenAI API error:', errorText)
      return new Response(
        JSON.stringify({ error: `OpenAI Fehler: ${openaiResponse.status}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 6. Stream SSE back to client
    const encoder = new TextEncoder()
    const decoder = new TextDecoder()

    const stream = new ReadableStream({
      async start(controller) {
        const reader = openaiResponse.body!.getReader()
        let buffer = ''

        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) {
              controller.enqueue(encoder.encode('data: [DONE]\n\n'))
              break
            }

            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() || '' // Keep incomplete line

            for (const line of lines) {
              const trimmed = line.trim()
              if (!trimmed || trimmed === 'data: [DONE]') {
                if (trimmed === 'data: [DONE]') {
                  controller.enqueue(encoder.encode('data: [DONE]\n\n'))
                }
                continue
              }

              if (trimmed.startsWith('data: ')) {
                try {
                  const json = JSON.parse(trimmed.slice(6))
                  const content = json.choices?.[0]?.delta?.content
                  if (content) {
                    // Forward the content chunk as SSE
                    controller.enqueue(
                      encoder.encode(`data: ${JSON.stringify({ content })}\n\n`)
                    )
                  }
                } catch {
                  // Skip unparseable lines
                }
              }
            }
          }
        } catch (err) {
          console.error('Stream error:', err)
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: 'Stream abgebrochen' })}\n\n`)
          )
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })

  } catch (error) {
    console.error('Edge function error:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Interner Fehler' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
```

- [ ] **Step 3.2: Add OPENAI_API_KEY to Edge Function environment**

```bash
# Set the secret for the Edge Function (production)
npx supabase secrets set OPENAI_API_KEY=sk-...

# For local dev, add to supabase/functions/.env (NOT committed):
# OPENAI_API_KEY=sk-...
```

- [ ] **Step 3.3: Deploy the Edge Function**

```bash
npx supabase functions deploy generate-offer-positions --no-verify-jwt
# Note: We handle JWT verification manually in the function code
# because we need the user context for company_id lookups.
```

**Verification:** Call via curl:
```bash
curl -X POST \
  "https://<PROJECT_REF>.supabase.co/functions/v1/generate-offer-positions" \
  -H "Authorization: Bearer <USER_JWT>" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"2 Steckdosen und 1 Lichtschalter im Wohnzimmer","hourly_rate":75,"vat_rate":19,"templates":[]}'
```

---

## Task 4: Frontend Service -- AI Offer Stream Parser

**Files:**
- Create: `src/services/aiOfferService.ts`

### Why
The frontend needs to call the Edge Function, consume the SSE stream, accumulate JSON chunks, and parse partial results as they arrive for live preview.

- [ ] **Step 4.1: Create the service file**

```typescript
// src/services/aiOfferService.ts
// Service for calling the generate-offer-positions Edge Function
// and parsing the streaming response.

import { supabase } from '@/integrations/supabase/client';
import { AIOfferRequest, AIOfferResponse, AIOfferResponseSchema } from '@/types/aiOffer';
import type { OfferPositionTemplate } from '@/types/aiOffer';

// ============================================================================
// TEMPLATE FETCHING
// ============================================================================

/**
 * Fetch position templates from DB, optionally filtered by search term.
 * Results are cached by TanStack Query in the hook layer.
 */
export async function fetchOfferTemplates(
  search?: string,
  category: string = 'elektro'
): Promise<OfferPositionTemplate[]> {
  let query = supabase
    .from('offer_position_templates')
    .select('*')
    .eq('is_active', true)
    .eq('category', category)
    .order('sort_order', { ascending: true });

  if (search && search.length >= 2) {
    // Search by name or tags overlap
    query = query.or(
      `name.ilike.%${search}%,description.ilike.%${search}%`
    );
  }

  const { data, error } = await query.limit(100);
  if (error) throw error;
  return data || [];
}

/**
 * Find the best matching templates for a given prompt.
 * Simple keyword matching -- returns top N templates.
 */
export function findRelevantTemplates(
  prompt: string,
  allTemplates: OfferPositionTemplate[],
  limit: number = 10
): OfferPositionTemplate[] {
  const words = prompt.toLowerCase().split(/\s+/).filter(w => w.length > 2);

  const scored = allTemplates.map(t => {
    const searchText = `${t.name} ${t.description} ${t.tags.join(' ')}`.toLowerCase();
    let score = 0;
    for (const word of words) {
      if (searchText.includes(word)) score++;
    }
    return { template: t, score };
  });

  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(s => s.template);
}

// ============================================================================
// COMPANY AI SETTINGS
// ============================================================================

export interface CompanyAISettings {
  default_hourly_rate: number;
  default_vat_rate: number;
  ai_model: string;
  temperature: number;
  max_positions: number;
  custom_prompt_additions: string | null;
}

export async function fetchCompanyAISettings(): Promise<CompanyAISettings | null> {
  const { data, error } = await supabase
    .from('company_ai_settings')
    .select('*')
    .maybeSingle();

  if (error) {
    console.warn('Could not fetch AI settings:', error);
    return null;
  }
  return data;
}

/**
 * Get the effective hourly rate: company_ai_settings > active AMGE > fallback 75
 */
export async function getEffectiveHourlyRate(): Promise<number> {
  // 1. Try company_ai_settings
  const settings = await fetchCompanyAISettings();
  if (settings?.default_hourly_rate) return settings.default_hourly_rate;

  // 2. Try active AMGE calculation
  const { data: amge } = await supabase
    .from('amge_calculations')
    .select('verrechnungslohn')
    .eq('is_active', true)
    .maybeSingle();

  if (amge?.verrechnungslohn) return amge.verrechnungslohn;

  // 3. Fallback
  return 75;
}

// ============================================================================
// STREAMING GENERATION
// ============================================================================

export interface StreamCallbacks {
  onChunk: (partialJson: string) => void;
  onComplete: (response: AIOfferResponse) => void;
  onError: (error: Error) => void;
}

/**
 * Call the Edge Function and stream the response.
 * Returns an AbortController so the caller can cancel.
 */
export function streamOfferPositions(
  request: AIOfferRequest,
  callbacks: StreamCallbacks
): AbortController {
  const controller = new AbortController();

  (async () => {
    try {
      // Get current session token
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) {
        throw new Error('Nicht angemeldet. Bitte neu einloggen.');
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(
        `${supabaseUrl}/functions/v1/generate-offer-positions`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify(request),
          signal: controller.signal,
        }
      );

      if (!response.ok) {
        const errorBody = await response.text();
        let errorMsg = 'KI-Generierung fehlgeschlagen';
        try {
          const parsed = JSON.parse(errorBody);
          errorMsg = parsed.error || errorMsg;
        } catch { /* use default */ }
        throw new Error(errorMsg);
      }

      // Check if streaming response
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('text/event-stream')) {
        // SSE streaming
        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let accumulatedJson = '';
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            if (trimmed === 'data: [DONE]') continue;

            if (trimmed.startsWith('data: ')) {
              try {
                const payload = JSON.parse(trimmed.slice(6));
                if (payload.content) {
                  accumulatedJson += payload.content;
                  callbacks.onChunk(accumulatedJson);
                }
                if (payload.error) {
                  throw new Error(payload.error);
                }
              } catch (e) {
                // Could be partial JSON or parse error from SSE
                if ((e as Error).message && !(e as Error).message.includes('JSON')) {
                  throw e;
                }
              }
            }
          }
        }

        // Parse the complete JSON
        try {
          const parsed = JSON.parse(accumulatedJson);
          const validated = AIOfferResponseSchema.parse(parsed);
          callbacks.onComplete(validated);
        } catch (parseErr) {
          console.error('Failed to parse AI response:', accumulatedJson.slice(0, 200));
          throw new Error('KI-Antwort konnte nicht verarbeitet werden. Bitte erneut versuchen.');
        }
      } else {
        // Non-streaming fallback (JSON response)
        const json = await response.json();
        const validated = AIOfferResponseSchema.parse(json);
        callbacks.onComplete(validated);
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return; // User cancelled
      callbacks.onError(err as Error);
    }
  })();

  return controller;
}
```

---

## Task 5: React Hook -- useAIOfferAssistant

**Files:**
- Create: `src/hooks/useAIOfferAssistant.ts`

### Why
Encapsulates all stateful logic: chat messages, streaming state, template loading, position accumulation. Keeps the component layer thin and testable.

- [ ] **Step 5.1: Create the hook file**

```typescript
// src/hooks/useAIOfferAssistant.ts

import { useState, useCallback, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  fetchOfferTemplates,
  findRelevantTemplates,
  getEffectiveHourlyRate,
  fetchCompanyAISettings,
  streamOfferPositions,
} from '@/services/aiOfferService';
import type {
  AIChatMessage,
  AIGeneratedPosition,
  AIOfferResponse,
  OfferPositionTemplate,
} from '@/types/aiOffer';

interface UseAIOfferAssistantOptions {
  projectName?: string;
  customerName?: string;
}

export function useAIOfferAssistant(options: UseAIOfferAssistantOptions = {}) {
  const [messages, setMessages] = useState<AIChatMessage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamedJson, setStreamedJson] = useState('');
  const [generatedPositions, setGeneratedPositions] = useState<AIGeneratedPosition[]>([]);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Load templates (cached for 10 minutes)
  const { data: templates = [] } = useQuery<OfferPositionTemplate[]>({
    queryKey: ['offer-position-templates'],
    queryFn: () => fetchOfferTemplates(),
    staleTime: 10 * 60 * 1000,
  });

  // Load hourly rate
  const { data: hourlyRate = 75 } = useQuery<number>({
    queryKey: ['effective-hourly-rate'],
    queryFn: () => getEffectiveHourlyRate(),
    staleTime: 5 * 60 * 1000,
  });

  // Load company AI settings
  const { data: aiSettings } = useQuery({
    queryKey: ['company-ai-settings'],
    queryFn: () => fetchCompanyAISettings(),
    staleTime: 5 * 60 * 1000,
  });

  const generate = useCallback(async (prompt: string) => {
    if (!prompt.trim() || isGenerating) return;

    // Cancel any in-progress generation
    if (abortRef.current) {
      abortRef.current.abort();
    }

    setError(null);
    setIsGenerating(true);
    setStreamedJson('');
    setGeneratedPositions([]);

    // Add user message
    const userMsg: AIChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: prompt,
      timestamp: new Date(),
    };

    // Add streaming assistant placeholder
    const assistantMsgId = crypto.randomUUID();
    const assistantMsg: AIChatMessage = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true,
    };

    setMessages(prev => [...prev, userMsg, assistantMsg]);

    // Find relevant templates for few-shot
    const relevantTemplates = findRelevantTemplates(prompt, templates, 10);

    const request = {
      prompt,
      project_name: options.projectName,
      customer_name: options.customerName,
      hourly_rate: hourlyRate,
      vat_rate: aiSettings?.default_vat_rate ?? 19,
      templates: relevantTemplates.map(t => ({
        name: t.name,
        description: t.description,
        item_type: t.item_type,
        unit: t.unit,
        planned_hours: t.planned_hours,
        material_cost_estimate: t.material_cost_estimate,
      })),
      custom_instructions: aiSettings?.custom_prompt_additions || undefined,
    };

    abortRef.current = streamOfferPositions(request, {
      onChunk: (partialJson) => {
        setStreamedJson(partialJson);

        // Try to extract positions from partial JSON for live preview
        try {
          // Attempt to find complete position objects in the partial stream
          const positionsMatch = partialJson.match(/"positions"\s*:\s*\[/);
          if (positionsMatch) {
            // Try to parse what we have so far (may be incomplete)
            const tryParse = partialJson + ']}'; // Close array and object
            const parsed = JSON.parse(tryParse);
            if (parsed.positions?.length > 0) {
              setGeneratedPositions(parsed.positions);
            }
          }
        } catch {
          // Partial JSON not parseable yet -- that's expected
        }
      },
      onComplete: (response: AIOfferResponse) => {
        setIsGenerating(false);
        setGeneratedPositions(response.positions);

        // Update assistant message with final content
        setMessages(prev => prev.map(msg =>
          msg.id === assistantMsgId
            ? {
                ...msg,
                content: response.summary || `${response.positions.length} Positionen generiert`,
                positions: response.positions,
                isStreaming: false,
              }
            : msg
        ));
      },
      onError: (err: Error) => {
        setIsGenerating(false);
        setError(err.message);

        setMessages(prev => prev.map(msg =>
          msg.id === assistantMsgId
            ? {
                ...msg,
                content: `Fehler: ${err.message}`,
                isStreaming: false,
              }
            : msg
        ));
      },
    });
  }, [isGenerating, templates, hourlyRate, aiSettings, options.projectName, options.customerName]);

  const cancel = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setIsGenerating(false);
  }, []);

  const clearChat = useCallback(() => {
    cancel();
    setMessages([]);
    setGeneratedPositions([]);
    setStreamedJson('');
    setError(null);
  }, [cancel]);

  return {
    messages,
    isGenerating,
    streamedJson,
    generatedPositions,
    error,
    hourlyRate,
    templates,
    generate,
    cancel,
    clearChat,
  };
}
```

---

## Task 6: UI Components -- AIOfferAssistant + AIOfferPreview

**Files:**
- Create: `src/components/offers/AIOfferAssistant.tsx`
- Create: `src/components/offers/AIOfferPreview.tsx`

### Why
Two components for separation of concerns: (1) the chat input/messages panel, and (2) the streaming position preview with "Uebernehmen" button.

- [ ] **Step 6.1: Create AIOfferPreview component**

```tsx
// src/components/offers/AIOfferPreview.tsx

import React from 'react';
import { Check, Loader2, Package, Clock, Truck, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { AIGeneratedPosition } from '@/types/aiOffer';

const ITEM_TYPE_ICONS: Record<string, React.ElementType> = {
  labor: Clock,
  material: Package,
  travel: Truck,
  lump_sum: Wrench,
  material_lump_sum: Package,
  small_material: Package,
  other: Package,
};

const ITEM_TYPE_COLORS: Record<string, string> = {
  labor: 'bg-blue-50 text-blue-700 border-blue-200',
  material: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  travel: 'bg-amber-50 text-amber-700 border-amber-200',
  lump_sum: 'bg-violet-50 text-violet-700 border-violet-200',
  material_lump_sum: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  small_material: 'bg-orange-50 text-orange-700 border-orange-200',
  other: 'bg-gray-50 text-gray-700 border-gray-200',
};

function formatCurrency(val: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(val);
}

interface AIOfferPreviewProps {
  positions: AIGeneratedPosition[];
  isStreaming: boolean;
  onAccept: (positions: AIGeneratedPosition[]) => void;
  onAcceptSingle?: (position: AIGeneratedPosition) => void;
}

export function AIOfferPreview({ positions, isStreaming, onAccept, onAcceptSingle }: AIOfferPreviewProps) {
  if (positions.length === 0 && !isStreaming) return null;

  const totalNet = positions.reduce((sum, p) => sum + p.quantity * p.unit_price_net, 0);
  const totalHours = positions.reduce((sum, p) => sum + (p.planned_hours_item || 0), 0);

  return (
    <div className="border-t bg-gray-50/50">
      {/* Summary bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-white border-b">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          {isStreaming ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
              <span>Generiere Positionen...</span>
            </>
          ) : (
            <>
              <Check className="h-3 w-3 text-green-500" />
              <span>{positions.length} Positionen</span>
              <span className="text-gray-300">|</span>
              <span>{totalHours.toFixed(1)}h</span>
              <span className="text-gray-300">|</span>
              <span className="font-medium text-gray-700">{formatCurrency(totalNet)}</span>
            </>
          )}
        </div>
        {!isStreaming && positions.length > 0 && (
          <Button
            size="sm"
            onClick={() => onAccept(positions)}
            className="h-7 text-xs gap-1"
          >
            <Check className="h-3 w-3" />
            Alle uebernehmen
          </Button>
        )}
      </div>

      {/* Position list */}
      <ScrollArea className="max-h-[280px]">
        <div className="p-2 space-y-1">
          {positions.map((pos, idx) => {
            const Icon = ITEM_TYPE_ICONS[pos.item_type] || Package;
            const colorClass = ITEM_TYPE_COLORS[pos.item_type] || ITEM_TYPE_COLORS.other;
            const lineTotal = pos.quantity * pos.unit_price_net;

            return (
              <div
                key={idx}
                className="group flex items-start gap-2 p-2 rounded-md hover:bg-white hover:shadow-sm transition-all text-xs border border-transparent hover:border-gray-200"
              >
                {/* Position number + icon */}
                <div className={`flex-shrink-0 w-6 h-6 rounded flex items-center justify-center border ${colorClass}`}>
                  <Icon className="h-3 w-3" />
                </div>

                {/* Description */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-800 leading-tight truncate">
                    {pos.description}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5 text-gray-400">
                    <span>{pos.quantity} {pos.unit}</span>
                    <span>x</span>
                    <span>{formatCurrency(pos.unit_price_net)}</span>
                    {pos.planned_hours_item ? (
                      <span className="text-blue-400">({pos.planned_hours_item}h)</span>
                    ) : null}
                  </div>
                </div>

                {/* Total + action */}
                <div className="flex-shrink-0 text-right">
                  <p className="font-mono font-medium text-gray-700">{formatCurrency(lineTotal)}</p>
                  {onAcceptSingle && (
                    <button
                      onClick={() => onAcceptSingle(pos)}
                      className="text-[10px] text-blue-500 hover:text-blue-700 opacity-0 group-hover:opacity-100 transition-opacity mt-0.5"
                    >
                      + Einzeln
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {isStreaming && positions.length === 0 && (
            <div className="flex items-center justify-center py-6 text-gray-400 text-xs gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              KI denkt nach...
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
```

- [ ] **Step 6.2: Create AIOfferAssistant component**

```tsx
// src/components/offers/AIOfferAssistant.tsx

import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Trash2, Sparkles, StopCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAIOfferAssistant } from '@/hooks/useAIOfferAssistant';
import { AIOfferPreview } from './AIOfferPreview';
import type { AIGeneratedPosition } from '@/types/aiOffer';

const EXAMPLE_PROMPTS = [
  'Badezimmer komplett neu verkabeln, 2 Steckdosen, 1 Lichtschalter',
  'Unterverteiler im Keller setzen mit 6 Sicherungen und FI',
  'Wallbox 11kW in Garage montieren inkl. Zuleitung 15m',
  '3 LED-Einbaustrahler in Kueche und 2 Steckdosen',
  'E-Check fuer Wohnung 80qm, 12 Stromkreise',
];

interface AIOfferAssistantProps {
  projectName?: string;
  customerName?: string;
  onAcceptPositions: (positions: AIGeneratedPosition[]) => void;
}

export function AIOfferAssistant({
  projectName,
  customerName,
  onAcceptPositions,
}: AIOfferAssistantProps) {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const {
    messages,
    isGenerating,
    generatedPositions,
    error,
    hourlyRate,
    generate,
    cancel,
    clearChat,
  } = useAIOfferAssistant({ projectName, customerName });

  // Auto-scroll when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, generatedPositions]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isGenerating) return;
    generate(input.trim());
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleAcceptAll = (positions: AIGeneratedPosition[]) => {
    onAcceptPositions(positions);
  };

  const handleAcceptSingle = (position: AIGeneratedPosition) => {
    onAcceptPositions([position]);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b flex items-center justify-between bg-gradient-to-r from-blue-50 to-violet-50">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-md bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center">
            <Sparkles className="h-3.5 w-3.5 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-800">KI-Assistent</h3>
            <p className="text-[10px] text-gray-500">{hourlyRate} EUR/Std Verrechnungslohn</p>
          </div>
        </div>
        {messages.length > 0 && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-gray-400 hover:text-red-500"
            onClick={clearChat}
            title="Chat leeren"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {/* Messages area */}
      <ScrollArea className="flex-1" ref={scrollRef}>
        <div className="p-3 space-y-3">
          {messages.length === 0 ? (
            /* Empty state: Show example prompts */
            <div className="space-y-3 pt-2">
              <p className="text-xs text-gray-500 text-center">
                Beschreibe das Projekt und ich erstelle die Angebotspositionen.
              </p>
              <div className="space-y-1.5">
                {EXAMPLE_PROMPTS.map((prompt, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setInput(prompt);
                      textareaRef.current?.focus();
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg border border-gray-100 hover:border-blue-200 hover:bg-blue-50/50 transition-all text-xs text-gray-600 hover:text-gray-800"
                  >
                    "{prompt}"
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Chat messages */
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[90%] rounded-lg px-3 py-2 text-xs ${
                    msg.role === 'user'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {msg.isStreaming ? (
                    <div className="flex items-center gap-1.5">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span>Generiere...</span>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Position preview (when positions are available) */}
      <AIOfferPreview
        positions={generatedPositions}
        isStreaming={isGenerating}
        onAccept={handleAcceptAll}
        onAcceptSingle={handleAcceptSingle}
      />

      {/* Error display */}
      {error && (
        <div className="px-3 py-2 bg-red-50 text-red-600 text-xs border-t border-red-100">
          {error}
        </div>
      )}

      {/* Input area */}
      <form onSubmit={handleSubmit} className="p-3 border-t bg-white">
        <div className="flex gap-2">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Projekt beschreiben... (z.B. 'Bad komplett neu, 3 Steckdosen, Spiegelschrank-Anschluss')"
            className="min-h-[60px] max-h-[120px] resize-none text-xs"
            disabled={isGenerating}
          />
          <div className="flex flex-col gap-1">
            {isGenerating ? (
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-[60px] w-10 text-red-500 hover:text-red-600 hover:bg-red-50"
                onClick={cancel}
                title="Abbrechen"
              >
                <StopCircle className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                type="submit"
                size="icon"
                className="h-[60px] w-10"
                disabled={!input.trim()}
                title="Positionen generieren"
              >
                <Send className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
```

---

## Task 7: Integration -- Wire Into OfferSidebar + OfferEditorPage

**Files:**
- Modify: `src/components/offers/OfferSidebar.tsx`

### Why
The OfferSidebar already has a "chat" tab with a placeholder. We replace it with the real AIOfferAssistant component and wire the `onAcceptPositions` callback to the editor's item list.

- [ ] **Step 7.1: Update OfferSidebar to accept AIOfferAssistant props**

In `src/components/offers/OfferSidebar.tsx`, change the interface and chat tab:

```typescript
// ADD to imports:
import { AIOfferAssistant } from './AIOfferAssistant';
import type { AIGeneratedPosition } from '@/types/aiOffer';

// UPDATE interface:
interface OfferSidebarProps {
    onAddItem: (type: string, data?: any) => void;
    isOpen: boolean;
    // NEW: AI assistant props
    projectName?: string;
    customerName?: string;
    onAcceptAIPositions?: (positions: AIGeneratedPosition[]) => void;
}

// UPDATE component signature:
export function OfferSidebar({
    onAddItem,
    isOpen,
    projectName,
    customerName,
    onAcceptAIPositions,
}: OfferSidebarProps) {
```

- [ ] **Step 7.2: Replace the chat tab placeholder**

Replace the current chat TabsContent:

```tsx
// BEFORE (line ~175-177 in OfferSidebar.tsx):
<TabsContent value="chat" className="flex-1 mt-0">
    <div className="p-8 text-center text-sm text-muted-foreground">KI Assistent in Kürze verfügbar</div>
</TabsContent>

// AFTER:
<TabsContent value="chat" className="flex-1 mt-0 h-full overflow-hidden">
    <AIOfferAssistant
        projectName={projectName}
        customerName={customerName}
        onAcceptPositions={(positions) => {
            if (onAcceptAIPositions) {
                onAcceptAIPositions(positions);
            } else {
                // Fallback: add each position via onAddItem
                positions.forEach((pos) => {
                    onAddItem('position', {
                        description: pos.description,
                        quantity: pos.quantity,
                        unit: pos.unit,
                        unit_price_net: pos.unit_price_net,
                        vat_rate: pos.vat_rate,
                        item_type: pos.item_type,
                        planned_hours_item: pos.planned_hours_item,
                        material_purchase_cost: pos.material_purchase_cost,
                        internal_notes: pos.internal_notes,
                        is_optional: pos.is_optional,
                    });
                });
            }
        }}
    />
</TabsContent>
```

- [ ] **Step 7.3: Update OfferEditorPage to pass new props**

In `src/pages/offers/OfferEditorPage.tsx`, find where `<OfferSidebar>` is rendered and update props:

```tsx
// Find the existing OfferSidebar usage and update:
<OfferSidebar
    onAddItem={handleAddItem}  // existing
    isOpen={isSidebarOpen}     // existing
    projectName={subject}      // NEW
    customerName={selectedCustomer?.company_name}  // NEW
    onAcceptAIPositions={(positions) => {
        // Append AI positions to existing items
        const newItems = positions.map((pos, idx) => ({
            temp_id: crypto.randomUUID(),
            position_number: items.length + idx + 1,
            description: pos.description,
            quantity: pos.quantity,
            unit: pos.unit,
            unit_price_net: pos.unit_price_net,
            vat_rate: pos.vat_rate,
            item_type: pos.item_type,
            is_optional: pos.is_optional ?? false,
            planned_hours_item: pos.planned_hours_item,
            material_purchase_cost: pos.material_purchase_cost,
            internal_notes: pos.internal_notes,
            discount_percent: 0,
        }));
        setItems(prev => [...prev, ...newItems]);
        setHasUnsavedChanges(true);
    }}
/>
```

**Note:** The variable `items` / `setItems` refers to the editor's state for offer items. Find the existing useState that manages `EditorOfferItem[]` and use that setter.

---

## Task 8: Hook Registration in useApi.ts

**Files:**
- Modify: `src/hooks/useApi.ts`

### Why
Add a `useOfferTemplates` hook so other parts of the app can access templates, and add a query key for cache invalidation.

- [ ] **Step 8.1: Add query key**

In the `QUERY_KEYS` object in `src/hooks/useApi.ts`:

```typescript
// Add to QUERY_KEYS:
offerTemplates: ['offer-position-templates'] as const,
companyAISettings: ['company-ai-settings'] as const,
effectiveHourlyRate: ['effective-hourly-rate'] as const,
```

- [ ] **Step 8.2: Add useOfferTemplates hook**

At the end of the offer hooks section (after `useSyncOfferItems`), add:

```typescript
// ============================================================================
// AI OFFER ASSISTANT HOOKS
// ============================================================================

export const useOfferTemplates = (
  search?: string,
  category: string = 'elektro'
) => {
  return useQuery({
    queryKey: [...QUERY_KEYS.offerTemplates, search, category],
    queryFn: () => fetchOfferTemplates(search, category),
    staleTime: 10 * 60 * 1000, // 10 min cache
  });
};
```

Add the import at the top of useApi.ts:

```typescript
import { fetchOfferTemplates } from '@/services/aiOfferService';
```

---

## Task 9: Environment & Deployment Verification

**Files:**
- Modify: `supabase/functions/.env.example`

- [ ] **Step 9.1: Update .env.example**

Add the OpenAI key to the example:

```bash
# AI Services
OPENAI_API_KEY=sk-your-openai-api-key
```

- [ ] **Step 9.2: Verify local dev setup**

Create `supabase/functions/.env` (gitignored) with the real key:

```bash
OPENAI_API_KEY=sk-...
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

- [ ] **Step 9.3: Test end-to-end locally**

```bash
# Terminal 1: Start Supabase functions locally
npx supabase functions serve generate-offer-positions --env-file supabase/functions/.env

# Terminal 2: Start Vite dev server
npm run dev

# Test flow:
# 1. Open http://localhost:8080
# 2. Navigate to an offer in draft status
# 3. Open the sidebar -> Chat tab
# 4. Type: "3 Steckdosen und 2 Lichtschalter im Wohnzimmer"
# 5. Watch positions stream in
# 6. Click "Alle uebernehmen"
# 7. Verify positions appear in the offer editor
```

---

## Task 10: Edge Cases & Error Handling

- [ ] **Step 10.1: Handle no-auth state**

In `AIOfferAssistant.tsx`, disable the input if the user is not logged in. The `streamOfferPositions` function already checks for a session token and throws a clear error message.

- [ ] **Step 10.2: Handle rate limiting**

The `company_ai_settings.monthly_ai_calls` / `monthly_ai_limit` columns exist but are not enforced in MVP. For a future step, add a check in the Edge Function:

```typescript
// FUTURE: Check rate limit
// const { data: settings } = await supabase
//   .from('company_ai_settings')
//   .select('monthly_ai_calls, monthly_ai_limit')
//   .eq('company_id', companyId)
//   .single();
// if (settings.monthly_ai_calls >= settings.monthly_ai_limit) {
//   return error 429;
// }
```

- [ ] **Step 10.3: Handle locked offers**

AI assistant should be disabled when the offer is locked (`is_locked === true`). In `OfferEditorPage`, pass a `disabled` prop:

```tsx
// In OfferSidebar, if offer is locked, don't render AI assistant
// This is already handled by OfferEditorPage disabling the sidebar when locked
```

---

## Post-MVP: Future Improvements (NOT in scope)

These are documented for the roadmap but NOT part of this implementation:

1. **pgvector for article embeddings**: Enable the `vector` extension in Supabase, create `article_embeddings` table, use `text-embedding-3-small` to embed the company's material catalog. The Edge Function would then query for semantically similar articles to set realistic material prices.

2. **Multi-turn conversation**: Currently each prompt generates fresh positions. Future: maintain conversation context so the user can say "mach die Anfahrt teurer" or "fuege noch einen RCD hinzu".

3. **Template learning**: After the user accepts positions, save them as company-specific templates (company_id set) to improve future suggestions.

4. **Cost comparison**: Show a side-by-side comparison of AI-suggested prices vs. the company's historical prices for similar positions.

5. **Voice input**: Use the Web Speech API to allow voice dictation of the project description (especially useful on mobile/tablet on the construction site).

6. **Streaming partial positions**: Instead of waiting for complete JSON, use the Vercel AI SDK's `streamObject` approach with partial Zod parsing. This requires switching from raw `fetch` to the `ai` npm package in the Edge Function (Deno-compatible).

---

## Summary

| Task | Files | Effort |
|------|-------|--------|
| 1. DB Migration + Seed | 1 SQL file | 15 min |
| 2. Types | 1 TS file | 10 min |
| 3. Edge Function | 1 TS file | 30 min |
| 4. Frontend Service | 1 TS file | 25 min |
| 5. React Hook | 1 TS file | 20 min |
| 6. UI Components | 2 TSX files | 35 min |
| 7. Integration | 2 existing files | 15 min |
| 8. Hook Registration | 1 existing file | 5 min |
| 9. Env & Deploy | Config files | 10 min |
| 10. Error Handling | Across files | 10 min |
| **Total** | **8 new + 3 modified** | **~3 hours** |
