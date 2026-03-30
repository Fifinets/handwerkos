# KI-Angebotsassistent für Elektrobetriebe — Recherche für HandwerkOS

> Für NotebookLM: Alle URLs unten einzeln als Quellen hinzufügen.

## 1. Wettbewerber KI-Angebotserstellung

| Anbieter | URL | Beschreibung |
|----------|-----|-------------|
| Plancraft | `https://www.plancraft.de` | KI-Kalkulation, generisch (nicht elektro-spezifisch) |
| Craftview | `https://www.craftview.com` | ERP mit KI-Preisvorschlägen |
| openHandwerk | `https://www.openhandwerk.de` | Cloud-Software mit GPT-basiertem LV-Text |
| Streit V.1 | `https://www.streit-datec.de` | Klassisch + neuer KI-Assistent |

**Marktlücke:** Kein Wettbewerber hat elektro-spezifische KI mit DEL/IDS-Connect.

---

## 2. Leistungsverzeichnis (LV) Elektro — GAEB, StLB-Bau

### URLs für NotebookLM
- `https://www.gaeb.de` — GAEB Austauschformate
- `https://www.stlb-bau.de` — StLB-Bau Online (KG 440-450 = Elektro)
- `https://www.gaeb-toolbox.de` — .NET-Bibliothek für GAEB-Import/Export
- `https://www.fdata.de` — StLB-Bau Herausgeber, API-Zugang

---

## 3. Kalkulation Elektroinstallation

### Verrechnungslohn-Kalkulation
```
Produktiver Lohn (Geselle)           ~20-25 EUR/Std
+ Lohnnebenkosten (80-85%)          ~16-20 EUR/Std
= Gesamtlohnkosten                  ~36-45 EUR/Std
+ Gemeinkosten (120-180%)           ~43-81 EUR/Std
+ Gewinn & Wagnis (8-15%)           ~6-19 EUR/Std
= Verrechnungslohn NETTO            ~85-145 EUR/Std
Typisch Geselle: 55-65 EUR/Std, Meister: 70-85 EUR/Std
```

### Richtwerte Zeitaufwand
| Tätigkeit | Zeitwert | Einheit |
|-----------|----------|---------|
| Steckdose setzen (UP) | 0,5-0,8 Std | Stk |
| Lichtschalter (UP) | 0,4-0,6 Std | Stk |
| NYM-J 3x1,5 (UP) | 0,15-0,25 Std | m |
| NYM-J 5x2,5 (UP) | 0,18-0,30 Std | m |
| Unterverteilung 1-reihig | 3-5 Std | Stk |
| Unterverteilung 3-reihig | 6-10 Std | Stk |
| FI/LS einbauen | 0,2-0,3 Std | Stk |
| Wallbox 11kW | 3-5 Std | Stk |
| Wallbox 22kW | 4-6 Std | Stk |
| Rauchmelder | 0,2-0,3 Std | Stk |
| KNX-Aktor | 1-2 Std | Stk |
| Zählerschrank erneuern | 8-16 Std | Stk |

### URLs für NotebookLM
- `https://www.zveh.de/fuer-betriebe/betriebswirtschaft` — BZE Betriebsvergleich
- `https://www.elkonet.de` — Elektro-Kompetenzzentrum, Kalkulations-Lehrgänge

---

## 4. OpenAI API — Function Calling & Structured Output

### Architektur für Angebotsgenerierung
```typescript
const response = await openai.chat.completions.create({
  model: "gpt-4o",
  messages: [
    { role: "system", content: ELEKTRO_SYSTEM_PROMPT },
    { role: "user", content: kundenAnfrage }
  ],
  response_format: {
    type: "json_schema",
    json_schema: {
      name: "elektro_angebot",
      schema: offerGenerationSchema,
      strict: true
    }
  }
});
```

### URLs für NotebookLM
- `https://platform.openai.com/docs/guides/function-calling` — Function Calling Docs
- `https://platform.openai.com/docs/guides/structured-outputs` — Structured Outputs
- `https://cookbook.openai.com/examples/structured_outputs_intro` — Cookbook Beispiele
- `https://docs.anthropic.com/en/docs/build-with-claude/tool-use` — Claude Tool Use

---

## 5. RAG für Artikeldaten

### Architektur
```
Indexierung: Datanorm → Embedding → Supabase pgvector
Abfrage:    User-Input → Query Embedding → Similarity Search → LLM + Kontext → Positionen
```

### URLs für NotebookLM
- `https://supabase.com/docs/guides/ai/vector-columns` — Supabase pgvector
- `https://platform.openai.com/docs/guides/embeddings` — OpenAI Embeddings
- `https://supabase.com/docs/guides/ai` — Supabase AI Toolkit
- `https://js.langchain.com/docs/tutorials/rag` — LangChain RAG

---

## 6. DEL (Deutscher Elektro Leistungskatalog)

### Struktur
```
├── 1. Energietechnik
│   ├── 1.1 Kabelverlegung (mit Zeitvorgaben pro m)
│   ├── 1.2 Installationsgeräte (Steckdosen, Schalter)
│   ├── 1.3 Verteilungen
│   └── 1.4 Beleuchtung
├── 2. Informationstechnik (Datennetz, Telefon, SAT)
├── 3. Gebäudesystemtechnik (KNX, Smart Home)
├── 4. Photovoltaik (Module, WR, Speicher, Wallbox)
└── 5. Geräteprüfung (VDE 0100-600, DGUV V3)
```

---

## 7. Vercel AI SDK

### Relevanz für HandwerkOS (Vite + React, kein Next.js)

**Empfohlen: Option C — AI SDK + Supabase Edge Function**
```
Frontend: useChat/useObject Hook → Supabase Edge Function → OpenAI API
```

### Key Features
- `generateObject` — strukturierte Angebotsgenerierung (Batch)
- `streamObject` — Live-Vorschau während Positionen generiert werden
- Zod-Schemas direkt verwendbar

### URLs für NotebookLM
- `https://sdk.vercel.ai/docs` — Hauptdokumentation
- `https://sdk.vercel.ai/docs/ai-sdk-ui` — useChat, useObject Hooks
- `https://sdk.vercel.ai/docs/ai-sdk-core` — Provider-agnostisch
- `https://github.com/vercel/ai/tree/main/examples` — Beispiele

---

## 8. LV-Textbausteine Elektro

### URLs für NotebookLM
- `https://www.ausschreiben.de` — Größte LV-Textdatenbank (kostenlos)
- `https://www.heinze.de/ausschreibungstexte` — Hersteller-Ausschreibungstexte
- `https://www.sirados.de` — Kalkulationsdaten mit Zeitwerten
- `https://www.dbd-online.de` — Dynamische Baudaten

---

## 9. Bestehende Kalkulationssoftware

| Software | URL | Stärken | Schwächen |
|----------|-----|---------|-----------|
| WinWorker | `https://www.winworker.de` | Marktführer, DEL, IDS-Connect | Desktop, teuer |
| TopKontor | `https://www.topkontor.de` | Gutes P/L, GAEB | Kein KI, Desktop |
| Halling | `https://www.halling.de` | DEL, Datanorm | Desktop, altmodisch |
| Plancraft | `https://www.plancraft.de` | Moderne UI, KI, Cloud | Generisch, kein DEL |

**Lücke:** Cloud-SaaS + KI + Elektro-spezifisch + DEL/IDS = HandwerkOS USP

---

## Empfohlene Architektur

```
Frontend: Chat-UI → "Beschreibe das Projekt..."
  → AI SDK useChat/streamObject (Streaming)
  → Live-Vorschau → "Übernehmen" → OfferModuleV2

Backend: Supabase Edge Function POST /ai/generate-offer
  → RAG: pgvector Similarity Search (Artikeldaten + bisherige Angebote)
  → Kalkulation (betriebsspezifisch aus AMGE-Rechner)
  → Output: OfferItemCreate[] (Zod-validiert)

Datenbank:
  - offer_position_templates (100+ Standard-Elektropositionen)
  - article_embeddings (pgvector, Datanorm)
  - company_settings (Verrechnungslohn, Zuschläge)

Kosten pro Angebot: ~0,03-0,08 USD
```
