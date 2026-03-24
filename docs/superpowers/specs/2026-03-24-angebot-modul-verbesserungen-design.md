# Angebots-Modul Verbesserungen

**Datum:** 2026-03-24
**Status:** Draft
**Module:** OfferModuleV2, OfferEditorPage, DashboardStatsWithKpis, WorkflowService

---

## Zusammenfassung

Drei Verbesserungen am Angebots-Modul:
1. Visueller Workflow-Indikator (Status-Tracking + modulübergreifender Flow)
2. Nachfass-System (Badge + Dashboard-KPI für unbeantwortete Angebote)
3. Legacy `quotes`-Tabelle entfernen (~10 Stellen im Code bereinigen)

---

## 1. Workflow-Indikator

### 1.1 Angebots-Status (Mini-Indikator in der Liste)

Zeigt den aktuellen Status des Angebots als horizontale Dot-Stepper-Leiste:

```
● Entwurf  →  ● Versendet  →  ● Angenommen / ✕ Abgelehnt
```

**Darstellung:**
- Abgeschlossene Schritte: grüner Dot mit Häkchen
- Aktueller Schritt: blauer Dot (pulsierend/ausgefüllt)
- Zukünftige Schritte: grauer Dot
- Abgelehnt: roter Dot mit X
- Abgelaufen: oranger Dot mit Uhr-Icon
- Storniert: grauer Dot mit Strich

**Platzierung:** Neue Spalte in der Angebotsliste (OfferModuleV2), zwischen Status-Badge und Aktionen. Ersetzt NICHT den bestehenden Status-Badge, sondern ergänzt ihn visuell.

**Komponente:** `OfferWorkflowDots.tsx` (neue Komponente)
- Props: `status: OfferStatus`
- Rein visuell, keine Daten-Abfragen

### 1.2 Modulübergreifender Flow (Detailansicht)

Nur sichtbar wenn Angebot `accepted` ist. Zeigt den Gesamtfluss:

```
✓ Angebot (12.03.)  →  ● Projekt #P-042 (in Bearbeitung)  →  ○ Rechnung
```

**Darstellung:**
- Horizontale Stepper-Leiste mit Datum und Dokumentname
- Abgeschlossene Schritte: grün mit Häkchen
- Aktiver Schritt: blau
- Zukünftige Schritte: grau gestrichelt
- Klick auf Schritt navigiert zum verknüpften Dokument

**Datenquelle:**
- `offers.project_id` für Projekt-Link (NICHT workflow_target_type - existiert nicht auf offers-Tabelle)
- Projekt laden via `project_id`, dann `projects.workflow_target_type`/`workflow_target_id` für Rechnung-Link
- Maximal 2 Supabase-Queries (Projekt + Rechnung)
- **Edge Case:** Wenn `project_id = null` bei `accepted` Status → "Projekt noch nicht verknüpft" anzeigen

**Platzierung:** OfferEditorPage, oberhalb des Formulars als Banner-Leiste.

**Komponente:** `OfferFlowTimeline.tsx` (neue Komponente)
- Props: `offer: Offer`
- Lädt verknüpfte Dokumente selbst (useQuery)
- Graceful fallback wenn project_id null

---

## 2. Nachfass-System

### 2.1 Badge in der Angebotsliste

**Voraussetzung (Migration):** Neues Feld `sent_at` (timestamp) auf `offers`-Tabelle hinzufügen. Das Feld `updated_at` ist unzuverlässig da es bei jeder Änderung überschrieben wird. Die `sent_at` wird gesetzt wenn `sendOffer()` aufgerufen wird.

**Logik:** Ein Angebot braucht Nachfassen wenn:
- Status = `sent`
- `sent_at` ist >= 7 Tage her
- Kein `valid_until` gesetzt ODER `valid_until` noch nicht abgelaufen
- Angebote mit `valid_until < heute` sind abgelaufen und zeigen KEINEN Nachfass-Badge

**Darstellung:**
- Orange Badge neben dem Kundennamen: "Nachfassen" oder "Seit X Tagen offen"
- Abgestuft: 7-13 Tage = gelb, 14+ Tage = orange/rot

**Platzierung:** In der bestehenden Angebots-Zeile (OfferModuleV2), neben dem Kundennamen.

**Keine neue Komponente nötig** - inline Badge-Logik in OfferModuleV2.

### 2.2 Filter "Nachfassen nötig"

**Neuer Filter-Button** in der Toolbar der Angebotsliste:
- Toggle-Button: "Nachfassen" mit Count-Badge
- Filtert auf: `status = 'sent'` UND `sent_at >= 7 Tage`
- Deaktiviert zeigt alle Angebote

**URL-Parameter:** `?filter=nachfassen` - damit das Dashboard direkt auf die gefilterte Liste verlinken kann. OfferModuleV2 liest beim Mount den URL-Parameter und aktiviert den Filter automatisch.

### 2.3 Dashboard-KPI

**Neue KPI-Karte** in DashboardStatsWithKpis:
- Titel: "Nachfassen"
- Wert: Anzahl Angebote die nachgefasst werden müssen
- Klick navigiert zur Angebotsliste mit `?filter=nachfassen`

**Datenquelle:** Supabase-Query in DashboardStatsWithKpis:
```sql
SELECT COUNT(*) FROM offers
WHERE status = 'sent'
  AND company_id = ?
  AND sent_at IS NOT NULL
  AND sent_at < NOW() - INTERVAL '7 days'
  AND (valid_until IS NULL OR valid_until >= CURRENT_DATE)
```

### 2.4 Migration

```sql
ALTER TABLE offers ADD COLUMN sent_at TIMESTAMPTZ;
-- Backfill: bestehende sent-Angebote mit updated_at als Näherungswert
UPDATE offers SET sent_at = updated_at WHERE status = 'sent' AND sent_at IS NULL;
```

`offerService.sendOffer()` wird angepasst um `sent_at: new Date().toISOString()` zu setzen.

---

## 3. Legacy `quotes` entfernen

### Betroffene Dateien (vollständige Liste)

Die `quotes`-Tabelle enthält 0 Einträge. Folgende Code-Stellen werden bereinigt:

1. **`src/services/quoteService.ts`** - Kompletter Service
   - Datei löschen (Funktionalität existiert in offerService)

2. **`src/components/AddQuoteDialog.tsx`** - Altes Angebots-Formular
   - Datei löschen (ersetzt durch OfferCreationWizard)

3. **`src/hooks/useApi.ts`** - Quote-Hooks entfernen
   - `useQuotes`, `useQuote`, `useCreateQuote`, `useUpdateQuote`, `useSendQuote`, `useAcceptQuote`, `useRejectQuote`, `useQuoteStats` entfernen
   - Importiert von quoteService - muss bereinigt werden

4. **`src/services/index.ts`** - Re-Export von quoteService entfernen

5. **`src/components/DocumentModule.tsx`** - Imports/Nutzung von `useQuotes`, `useCreateQuote`, `useUpdateQuote`
   - Auf `offers`/offerService umstellen oder Quotes-Sektion entfernen

6. **`src/components/QuoteActions.tsx`** - Import von `useAcceptQuote`
   - Datei löschen oder auf offerService umstellen

7. **`src/services/WorkflowService.ts`** - Mehrere Methoden
   - `createOrderFromQuote()` entfernen
   - `getPendingQuotes()` entfernen oder auf offers umschreiben
   - `getDashboardCriticalData()` - pendingQuotes Query auf offers umstellen
   - `WorkflowStep` Type: `'quote'` → `'offer'` umbenennen
   - `WorkflowChain` Interface: `currentStep: 'quote'` → `'offer'`

8. **`src/components/DashboardStatsWithKpis.tsx`** - Query auf `quotes` Tabelle
   - Ersetzen durch Query auf `offers` mit `status = 'sent'`

9. **`src/services/customerService.ts`** - Referenz auf `quotes`
   - Query auf `offers` umschreiben

10. **`src/services/eventBus.ts`** - Referenz auf quoteService in Kommentar
    - Kommentar bereinigen

### Keine Datenmigration nötig
Die `quotes`-Tabelle ist leer (0 Einträge, verifiziert via SQL).

---

## Dateien-Übersicht

### Neue Dateien
| Datei | Zweck |
|-------|-------|
| `src/components/offers/OfferWorkflowDots.tsx` | Mini-Indikator für Angebotsliste |
| `src/components/offers/OfferFlowTimeline.tsx` | Volle Timeline in Detailansicht |

### Migration
| Änderung | Zweck |
|----------|-------|
| `ALTER TABLE offers ADD COLUMN sent_at TIMESTAMPTZ` | Zuverlässiger Zeitstempel für Nachfass-Logik |

### Zu ändern
| Datei | Änderung |
|-------|----------|
| `src/components/OfferModuleV2.tsx` | + OfferWorkflowDots Spalte, + Nachfass-Badge, + Nachfassen-Filter, + URL-Param Handling |
| `src/pages/offers/OfferEditorPage.tsx` | + OfferFlowTimeline Banner |
| `src/components/DashboardStatsWithKpis.tsx` | quotes→offers Query, + Nachfassen-KPI |
| `src/services/WorkflowService.ts` | createOrderFromQuote/getPendingQuotes entfernen, Types updaten, getDashboardCriticalData fixen |
| `src/services/customerService.ts` | quotes→offers Referenz |
| `src/hooks/useApi.ts` | Alle useQuote*-Hooks entfernen |
| `src/services/index.ts` | quoteService Re-Export entfernen |
| `src/components/DocumentModule.tsx` | Quote-Imports auf offers umstellen |
| `src/services/offerService.ts` | sendOffer() um `sent_at` Setzung erweitern |
| `src/services/eventBus.ts` | Kommentar bereinigen |

### Zu löschen
| Datei | Grund |
|-------|-------|
| `src/services/quoteService.ts` | Ersetzt durch offerService |
| `src/components/AddQuoteDialog.tsx` | Ersetzt durch OfferCreationWizard |
| `src/components/QuoteActions.tsx` | Ersetzt durch Offer-Workflow |

---

## Nicht im Scope

- Automatische E-Mail-Erinnerungen (spätere Iteration)
- Ablehnungsgründe-Analyse/Muster (spätere Iteration)
- Schnell-Kopie aus abgeschlossenem Projekt (spätere Iteration)
- Drag & Drop Workflow-Übergänge
