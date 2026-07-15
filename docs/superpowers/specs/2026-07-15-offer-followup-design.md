# Design-Spec: Nachfass-Flow für Angebote

**Datum:** 2026-07-15
**Status:** Entwurf, Ablauf vom Nutzer bestätigt
**Voraussetzung:** Visual-Hierarchy-Redesign ist gemerged (`main` @ 1413a85); der Nachfassen-Filter, die amber Zeilen und `getNachfassInfo` als Single Source existieren bereits.

## Problem

„Nachfassen" ist heute nur ein Filter: Er zeigt Angebote ohne Antwort seit ≥ 7 Tagen, aber es gibt keine Aktion, die das Nachfassen abbildet. Die App weiß nicht, dass nachgefasst wurde — Angebote bleiben dauerhaft amber („Seit 111 Tagen keine Antwort"), der Zähler sinkt nie, und es gibt keinen Unterschied zwischen „nie nachgefasst" und „dreimal erinnert".

## Ablauf (vom Nutzer bestätigt)

1. Amber Zeilen (Nachfass-Kandidaten) zeigen einen **„Nachfassen"-Button**; zusätzlich gibt es die Aktion im ⋯-Menü jeder gesendeten Angebots-Zeile.
2. Klick öffnet den bestehenden `OfferEmailDialog` im **Erinnerungs-Modus**: Betreff `Erinnerung: Angebot {offer_number}: {project_name}`, Nachricht = freundliche Erinnerungs-Vorlage (Bezug auf Angebotsnummer und -datum), Empfänger/PDF-Anhang wie beim Erstversand. Der Nutzer passt an und sendet selbst (Human-in-the-loop, kein KI-Autoversand).
3. Nach erfolgreichem Versand speichert das System **`last_followup_at` = jetzt** und erhöht **`followup_count`**. Die Zeile wird neutral; erst 7 Tage später (weiter ohne Antwort) wird sie wieder amber — dann mit Hinweis „2. Nachfassen" (bzw. N+1).
4. **„Als nachgefasst markieren (ohne E-Mail)"** im ⋯-Menü: setzt nur den Merker (für Telefon-Nachfasser). Bestätigungs-Dialog nicht nötig — die Aktion ist harmlos und im Audit sichtbar (`followup_count`).
5. **„Als verloren markieren"**: existierende „Abgelehnt"-Aktion im ⋯-Menü bleibt der Weg für tote Fälle; keine neue Mechanik.

## Datenmodell

Migration auf `offers` (kein neues Objekt, RLS unverändert — Tabelle ist bereits company-scoped):

| Spalte | Typ | Default |
|---|---|---|
| `last_followup_at` | `timestamptz` | `NULL` |
| `followup_count` | `integer NOT NULL` | `0` |

Kein Eingriff in GoBD-relevante Belegfelder: Nachfass-Metadaten ändern nicht den Angebotsinhalt; `sent_at` bleibt „erstmals versendet" und wird beim Erinnerungsversand NICHT überschrieben.

Nach der Migration: Supabase-Typen neu generieren (`src/integrations/supabase/types.ts` / `src/types/database.ts`), `Offer`-Typ (`src/types/offer.ts`) um beide Felder erweitern, `npm run typecheck` + Build (Pflicht laut CLAUDE.md).

## Logik-Änderungen

### `getNachfassInfo` (src/components/offers/offerModuleUtils.ts)
Referenzzeitpunkt wird `max(sent_at, last_followup_at)`; Rückgabe zusätzlich `followupNumber = followup_count + 1`:

- Status ≠ `sent`, kein `sent_at`, oder per Datum abgelaufen → weiterhin `null`
- `daysSinceContact < 7` → `null` (Schwelle unverändert)
- sonst `{ days: daysSinceContact, severity, followupNumber }`

Dadurch bleiben Filter, Zähler-Badge, amber Zeilen und Hinweistext automatisch konsistent (alle nutzen diese eine Funktion). Der Zeilen-Hinweis wird zu: „Seit N Tagen keine Antwort — nachfassen?" bzw. ab dem zweiten Mal „Seit N Tagen keine Antwort — 2. Nachfassen?".

### Versand & Merker
- `OfferEmailDialog` bekommt ein optionales Prop `mode: 'initial' | 'reminder'` (Default `'initial'`): steuert Titel, Betreff- und Nachrichten-Vorlage. Sonst identisch (Empfänger, CC, PDF-Toggle, gleiche Edge Function).
- Edge Function `send-offer-email` bekommt ein Flag `isReminder: boolean`: bei `true` wird `sent_at`/Status NICHT angefasst, stattdessen serverseitig `last_followup_at = now()`, `followup_count = followup_count + 1` (atomar mit dem Versand; kein separater Client-Roundtrip). Bestehendes Verhalten bei `false`/fehlend unverändert. (Falls die Funktion `sent_at` heute bei jedem Versand überschreibt, wird das für den Reminder-Pfad explizit verhindert.)
- „Als nachgefasst markieren (ohne E-Mail)": Service-Methode `offerService.recordFollowup(offerId)` — Update der beiden Spalten, emittiert das bestehende Offer-Update-Event über den EventBus (Cache-Invalidierung wie üblich über App.tsx).

### UI (src/components/OfferModuleV2.tsx)
- Amber Zeile: primärer kleiner Button „Nachfassen" im action-Slot (vor dem ⋯-Menü), Amber-Ton passend zur Zeile; öffnet den Dialog im Reminder-Modus. stopPropagation wie etabliert.
- ⋯-Menü bei Status `sent`: Einträge „Nachfassen (E-Mail)" und „Als nachgefasst markieren". 
- Design-Sprache wie gehabt (Palette, keine farbigen Ränder, tabular-nums).

## Nicht-Ziele

- Kein automatischer Versand, keine KI-Formulierung (späterer Ausbau, Human-in-the-loop-Gate bleibt).
- Keine Nachfass-Historie als eigene Tabelle (nur letzter Zeitpunkt + Zähler; Historie ggf. später).
- Keine Erinnerungs-Automatik/Benachrichtigungen (Auto-Alerts-System bleibt unangetastet).
- Kleinaufträge/Rechnungen: nicht Teil dieses Features.

## Tests

- `offerModuleUtils`: bestehende Tests erweitern — Referenzzeitpunkt-Logik (nur sent_at; mit jüngerem last_followup_at; followupNumber), Grenzfälle (genau 7 Tage, abgelaufen).
- `OfferEmailDialog`: bestehender Test + Reminder-Modus (Titel/Vorlage, isReminder im Invoke-Payload).
- Service: `recordFollowup` Happy Path (Mock).
- Bestehende Suite bleibt grün (Baseline: 1 bekannter PlannerPage-Fehler).

## Erfolgskriterium

Nach einem Nachfassen (E-Mail oder manuell) verschwindet das Angebot sofort aus dem Nachfassen-Filter und der amber Markierung, der Zähler-Badge sinkt, und nach 7 weiteren Tagen ohne Antwort taucht es als „2. Nachfassen" wieder auf. `sent_at` bleibt unverändert.
