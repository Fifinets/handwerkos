# Live-Marge im echten Angebots-Editor

**Datum:** 2026-07-24
**Status:** Design freigegeben, bereit für Implementierungsplan
**Vorgänger:** [2026-07-22-soll-kostenbasis-design.md](2026-07-22-soll-kostenbasis-design.md) (PR #84, führte `offer_targets` + `lohn_mit_agk`-Kostenbasis ein)

## Problem

Die in PR #84 gebaute Live-Marge (`OfferSummaryCard`, `OfferTargetsForm`) hängt ausschließlich in `AddOfferDialog` und `EditOfferDialog`. Beide sind **im UI nicht erreichbar**:

- `AddOfferDialog` ist in `OfferModuleV2` eingehängt, aber `setIsAddDialogOpen(true)` wird nie aufgerufen.
- `EditOfferDialog` wird nirgends gerendert.
- Der echte Angebots-Flow läuft über `/offers/wizard` → `/offers/:id/edit` → `OfferEditorPage` (Dokument-Editor). Dieser rendert `OfferItemsEditor`, aber **nicht** `OfferSummaryCard` — es gibt also keine Marge-Anzeige.

Zusätzlich hat `OfferItemsEditor` **kein** manuelles Eingabefeld für `planned_hours_item` / `material_purchase_cost` — diese Werte kommen nur aus KI-akzeptierten Positionen. Das erklärt das beobachtete Symptom „0 von 13 Positionen hatten Kostendaten": es gibt keine erreichbare, niederschwellige Eingabe.

**Wichtig — was NICHT das Problem ist:** Der W+G-Satz (aktuell 52 %) verzerrt die Angebots-Marge nicht. Beide Dialoge lesen als Kostensatz `amge_calculations.lohn_mit_agk` (Vollkosten ohne W+G, 40,39 €). W+G wirkt nur auf den `verrechnungslohn` (Verkaufs-Stundensatz-Vorschlag der KI). Der Satz ist betriebsindividuell, kein Bug.

## Ziel

Eine **interne, sticky Marge-Leiste** am unteren Rand von `OfferEditorPage`. Sie zeigt live Kosten, Umsatz und Marge, während der Handwerker das Angebot baut — damit die Marge **vor dem Senden** sichtbar ist. Rein intern, erscheint nie im gedruckten Dokument/PDF.

## Entscheidungen (mit dem Nutzer abgestimmt)

| Thema | Entscheidung |
|---|---|
| Eingabemodell | Angebotsweit als Standard, pro Position optional aufklappbar (KI füllt pro Position automatisch) |
| Standard-Eingabefelder | **Zwei** Felder: geplante Gesamtstunden + Materialeinkauf gesamt (Material darf nicht ignoriert werden) |
| Kostensatz | Automatisch aus `useActiveAMGE().lohn_mit_agk` — nie manuell eingetippt |
| Platzierung | Sticky-Leiste am unteren Editor-Rand, immer sichtbar |
| Verwaiste Dialoge | Löschen (Teil dieser Arbeit) |
| Gesperrte Angebote | Leiste bleibt, nur lesend, zeigt eingefrorene Marge |

## Architektur

### Datenfluss

```
useActiveAMGE().lohn_mit_agk ─┐
                              ├─→ computeOfferCostBasis() ─→ OfferMarginBar (sticky)
offer_targets (angebotsweit) ─┤
offer_items  (pro Position)  ─┘
```

**Vorrang-Regel:** Liegen Pro-Positions-Kostendaten vor (mind. eine Position mit `planned_hours_item` oder `material_purchase_cost`), zählen diese. Sonst zählen die zwei angebotsweiten Felder. Nie beides mischen.

### Speicherung — kein Schema-Change

`offer_targets` besitzt bereits alle Felder:

- Angebotsweit → `offer_targets.planned_hours_total` + `offer_targets.planned_material_cost_total`
- Pro Position → bestehende `offer_items.planned_hours_item` / `offer_items.material_purchase_cost`
- Eingefrorene Sollwerte (gesperrt) → `offer_targets.snapshot_target_cost` / `snapshot_target_revenue` / `snapshot_target_margin`

`OfferEditorPage` lädt/speichert `offer_targets` bisher **nicht** — das wird ergänzt, über die vorhandenen `offerService`-Methoden, im selben Save-Flow wie die Positionen.

### Komponenten

**Neu: `OfferMarginBar`** (`src/components/offers/OfferMarginBar.tsx`)
- Props: `items`, `costRate` (aus `useActiveAMGE`), `plannedHoursTotal`, `plannedMaterialTotal`, `onChangeTotals`, `revenue`, `isLocked`, `snapshot?`
- Rendert die sticky Leiste: zwei Zahlenfelder (bei `!isLocked` editierbar), Kosten/Umsatz/Marge, Zustandshinweise.
- Enthält keine Rechenlogik — ruft `computeOfferCostBasis`.

**Erweitert: `computeOfferCostBasis`** (`src/lib/offerCostBasis.ts`)
- Nimmt zusätzlich angebotsweite Totale (`plannedHoursTotal`, `plannedMaterialTotal`) entgegen.
- Implementiert die Vorrang-Regel: Positions-Daten schlagen Angebots-Totale.
- Bleibt reine Funktion, voll getestet.

**Geändert: `OfferEditorPage`**
- Rendert `OfferMarginBar` (nur wenn nicht im Print-Modus).
- Lädt `offer_targets` beim Öffnen, hält `plannedHoursTotal`/`plannedMaterialTotal` im State, speichert sie mit.
- Reicht `isLocked` und Snapshot-Werte an die Leiste durch.

### Zustände

| Zustand | Anzeige |
|---|---|
| Kein aktiver AMGE-Satz | „Kein interner Kostensatz hinterlegt — Marge nicht berechenbar" + Link zu Finanzen → Kalkulation |
| Stunden & Material leer | „Marge unvollständig — trage Stunden & Material ein" |
| Vollständig | Kosten · Umsatz · **Marge X %** (grün ≥ 0, rot < 0) |
| Gesperrt (`isLocked`) | Nur lesend; Marge aus `snapshot_target_*`, bei fehlendem Snapshot (Alt-Angebote) Fallback auf normale Berechnung aus gespeicherten `offer_targets`/`offer_items` |

`isLocked` = `offer.is_locked || status ∈ {sent, accepted, rejected}` (bestehende Logik in `OfferEditorPage:162`).

## Cleanup

Löschen (alle nur von den toten Dialogen genutzt):
- `src/components/AddOfferDialog.tsx`
- `src/components/EditOfferDialog.tsx`
- `src/components/offers/OfferSummaryCard.tsx` (+ `OfferSummaryCard.test.tsx`)
- `src/components/offers/OfferTargetsForm.tsx`
- Toter `isAddDialogOpen`-State + `<AddOfferDialog>`-Mount in `OfferModuleV2`
- Exporte in `src/components/offers/index.ts`

Bleiben: `OfferItemsEditor` (vom echten Editor genutzt), `computeOfferCostBasis` (wird erweitert).

## Tests

- `offerCostBasis.test.ts`: neue Fälle für angebotsweite Totale + Vorrang-Regel (Positions-Daten schlagen Totale) + Unvollständigkeits-/Kein-Satz-Fälle.
- Neuer `OfferMarginBar.test.tsx`: rendert die vier Zustände korrekt (kein Satz, unvollständig, vollständig, gesperrt/lesend).
- Wegfallende Tests: `OfferSummaryCard.test.tsx` (Komponente gelöscht).
- Nach Abschluss: `npm run typecheck` + `npm run build` grün.

## Out of Scope

- Nachkalkulation / Ist-Kosten (braucht Zeitmodell-Entscheidung, siehe `kalkulation_konzept_abdeckung`).
- Produktive Stunden (§3.2) — der Satz unterstellt weiter jede Stunde als abrechenbar.
- Zweiter Kostensatz / Preisarten.
- Änderungen am W+G-/Verrechnungslohn-Verhalten.

Dies ist reine **Vorkalkulations-Anzeige** im Angebot.
