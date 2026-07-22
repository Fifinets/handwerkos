# Soll-Kostenbasis für Angebote und Projekte

**Status:** Entwurf · **Datum:** 2026-07-22 · **Kontext:** erster Baustein des Fachkonzepts „Vor- und Nachkalkulation" (HandwerkOS_Vor_und_Nachkalkulation_Konzept.docx)

## Problem

HandwerkOS erfasst heute die **Verkaufsseite** (was der Kunde zahlt), aber nahezu keine **Kostenseite** (was es den Betrieb kostet). Belegt am Produktionsstand (2026-07-22):

- 13 `offer_items`: 11 mit Verkaufspreis, **0 mit `planned_hours_item`, 0 mit `material_purchase_cost`**.
- `offer_targets`: selbst bei akzeptierten Angeboten sind die Plan-Felder leer — das Formular ist optional („internal only", keine Validierung) und wird übersprungen.
- `accept_offer_and_create_project` schreibt Planwerte als **Freitext-Marker in `project.description`** (`planned_hours: X`), nicht strukturiert.

Folge: Es gibt **keine belastbare Soll-Kostenbasis** pro Projekt. Jede spätere Nachkalkulation (Soll-Ist, Margenwarnung, Prognose) hätte kein Budget, gegen das sie vergleichen könnte.

Eine Vor-/Nachkalkulation ist im Kern eine **Kostendisziplin**. Der erste Schritt ist deshalb nicht ein Reporting-Dashboard, sondern verlässliche **Kosten-Eingaben** zu gewinnen.

## Ziel und Abgrenzung

**Ziel:** Pro Angebot entsteht — aus Daten, die der Nutzer ohnehin eingibt — eine strukturierte, eingefrorene Soll-Kostenbasis (Planstunden, Plankosten, Zielmarge), die bei Annahme als Projektbudget übernommen wird.

**In Scope (diese Spec):**
- Kostensatz-Auflösung je Firma aus vorhandener Betriebskalkulation.
- Kostenableitung je Angebotsposition (Stunden × Satz + Material).
- Sichtbare Live-Marge im Angebots-Editor.
- Einfrieren der Soll-Werte in `offer_targets` beim Erstversand/Annahme.
- Strukturierte Budget-Übernahme ins Projekt (Ablösung der Freitext-Marker).

**Ausdrücklich NICHT in Scope (jeweils eigene Folge-Spec):**
- Ist-Lohnkosten-Quelle (Versöhnung `time_entries` ↔ `timesheets`, Kostensatz-Snapshot bei Zeitbuchung).
- Material-Ist an Artikelstamm gebunden.
- Nachkalkulations-Dashboard, Endkostenprognose, automatische Warnungen.
- Lernendes System / KI-Zeitschätzung.
- Leistungspakete / Stücklisten je Position (`calculation_item_components`).

## Bestehendes, das wiederverwendet wird (nicht ersetzt)

| Zweck | Vorhandenes Artefakt |
|---|---|
| Betriebs-/Lohnkalkulation, Vollkostensatz | `amge_calculations` — aktive Zeile liefert `lohn_mit_agk` (Vollkosten/h, Kostenseite) und `verrechnungslohn` (Verkaufsseite). Aktueller Ist-Wert der Testfirma: 40,39 € Kosten vs. 43,22 € Verkauf. |
| Plan je Position | `offer_items.planned_hours_item`, `offer_items.material_purchase_cost` |
| Verkaufswert je Position | `offer_items.quantity`, `offer_items.unit_price_net` |
| Eingefrorene Soll-Werte | `offer_targets.snapshot_target_revenue / snapshot_target_cost / snapshot_target_margin / snapshot_created_at` |
| Angebot↔Projekt-Verknüpfung | `offers.project_id` (bei Annahme gesetzt) |

## Entwurf

### 1. Kostensatz-Auflösung

Eine reine Funktion `resolveLaborCostRate(companyId, atDate)`:

1. aktive `amge_calculations` der Firma, gültig zum `atDate` (`valid_from <= atDate <= valid_until` bzw. offen) → `lohn_mit_agk`.
2. Fallback: `company_ai_settings.default_hourly_rate`.
3. Sonst: definierter Fehler „kein Kostensatz hinterlegt" (die UI verlangt dann Ersteinrichtung der Betriebskalkulation).

Kein neues Schema. `lohn_mit_agk` ist bewusst die **Kostenseite** (vor Wagnis+Gewinn) — die §3.1-Trennung Kosten- vs. Verkaufspreis.

### 2. Kostenableitung je Position

Reine Berechnung, keine Persistenz zusätzlicher Positionsfelder:

- `positionPlannedCost = planned_hours_item × costRate + material_purchase_cost`
- `positionSalesValue  = quantity × unit_price_net`
- Eine Position hat eine **bekannte Kostenbasis**, wenn `planned_hours_item IS NOT NULL` **oder** `material_purchase_cost IS NOT NULL`. NULL bei beiden = **„Kosten fehlen"** (nicht 0 €), damit die Position nicht als 100 % Marge durchschlägt. `0` ist ein gültiger, vom Nutzer gesetzter Wert (z. B. reine Materialposition) und zählt als bekannt.
- **Kostenbasis vollständig** = alle Positionen des Angebots haben eine bekannte Kostenbasis.

### 3. Live-Marge im Angebots-Editor (Teil B)

Im bestehenden Angebots-Editor (`AddOfferDialog` / `OfferSummaryCard`) laufend anzeigen:
- Summe Verkauf, Summe Kosten, **Marge %** (nach §5 als Marge `= (Verkauf − Kosten)/Verkauf`, klar getrennt vom Aufschlag).
- Deutlicher Hinweis, wenn Positionen ohne Kostenansatz enthalten sind („Marge unvollständig — n Positionen ohne Kosten").

Ziel: Das Überspringen der Kostenerfassung wird sichtbar und teuer, statt still möglich.

### 4. Einfrieren beim Versand/Annahme

Beim Erstversand (Übergang draft→sent, dort wo bereits die echte Nummer gezogen wird) **und** bei Annahme werden die Soll-Werte eingefroren:
- `snapshot_target_revenue = Σ positionSalesValue` — **immer** gesetzt (Erlös ist vollständig bekannt).
- `snapshot_target_cost` und `snapshot_target_margin` werden **nur gesetzt, wenn die Kostenbasis vollständig ist** (jede Position hat eine bekannte Kostenbasis). Ist sie unvollständig, bleiben beide `NULL` — es wird **keine irreführende Kostensumme fabriziert** (eine fehlende Position würde die Kosten zu niedrig und die Marge zu hoch erscheinen lassen). Das Projekt hat dann ein Erlös-Budget, aber bewusst kein Kosten-Budget.
- `snapshot_created_at = now()`.
- **Neu:** `offer_targets.cost_rate_snapshot NUMERIC` — der zum Einfrierzeitpunkt verwendete Kostensatz (40,39), nur gesetzt wenn auch der Kosten-Snapshot gesetzt wird. Macht die Basis reproduzierbar (§10). **Einzige Schema-Änderung dieser Spec.**

Der Versand wird **nicht** an vollständigen Kosten gehindert — Senden ist eine Kunden-/Verkaufsaktion und darf nicht an interner Kalkulationsdisziplin scheitern. Die Vollständigkeit wird im Editor (Abschnitt 3) sichtbar gemacht, nicht erzwungen.

Bereits eingefrorene Snapshots werden nicht überschrieben (GoBD/§10): erneutes Senden erzeugt keine stille Änderung der eingefrorenen Basis.

### 5. Budget → Projekt

`accept_offer_and_create_project` wird angepasst:
- **entfällt:** Planwerte als Freitext in `project.description`.
- Das Projektbudget ist ab jetzt der eingefrorene `offer_targets`-Snapshot des akzeptierten Angebots (erreichbar über `offers.project_id`). `project.budget` bleibt der Erlös-Wert für die bestehende Anzeige.
- Bekannte, akzeptierte Grenze: Projekte ohne akzeptiertes Angebot (manuell / aus Auftrag) haben zunächst keine Soll-Basis. Manuelle Budgeterfassung ist Folge-Spec.

### Schema-Änderungen (Minimum)

Eine Migration:
```sql
ALTER TABLE public.offer_targets
  ADD COLUMN IF NOT EXISTS cost_rate_snapshot NUMERIC;
COMMENT ON COLUMN public.offer_targets.cost_rate_snapshot IS
  'Interner Vollkosten-Stundensatz (amge_calculations.lohn_mit_agk) zum Einfrierzeitpunkt. Macht die eingefrorene Soll-Kostenbasis reproduzierbar.';
```
Keine neuen Tabellen. `create_offer_with_targets` bleibt strukturell; die RPC/Service-Schicht befüllt zusätzlich die Snapshot-Felder beim Einfrieren.

## Berechnungs-Definitionen (verbindlich)

- **Marge** `= (Verkauf − Kosten) / Verkauf` (nicht Aufschlag `= (Verkauf − Kosten)/Kosten`). Die UI benennt beide getrennt (§5).
- **Kostensatz** ist die Kostenseite `lohn_mit_agk`, nie `verrechnungslohn`.
- **Fehlende Kosten** propagieren als „unbekannt", nicht als 0 — eine Angebotssumme mit unvollständigen Kosten zeigt keine irreführende Marge.

## Testfälle

1. `resolveLaborCostRate`: aktive AMGE → `lohn_mit_agk`; keine AMGE aber `default_hourly_rate` → Fallback; keins von beidem → definierter Fehler; Gültigkeitsdatum wählt die richtige Zeile.
2. Kostenableitung: `h×Satz + Material` je Position; Position ohne Stunden → „Kosten fehlen", nicht 0.
3. Marge vs. Aufschlag: dieselben Zahlen ergeben unterschiedliche Prozente; die richtige Formel wird angezeigt.
4. Einfrieren: bei vollständiger Kostenbasis werden `snapshot_target_cost/-margin/cost_rate_snapshot` gesetzt; bei unvollständiger Basis bleibt der Erlös-Snapshot gesetzt, Kosten/Marge aber `NULL`; erneutes Senden überschreibt einen bestehenden Snapshot nicht.
5. Budget-Übernahme: akzeptiertes Angebot → Projekt trägt strukturiertes Budget; kein Freitext-Marker mehr in `description`.
6. Grenze: Projekt ohne Angebot → kein Budget, kein Fehler.

## Offene Punkte / Risiken

- **Ein Kostensatz für alle Rollen:** `amge_calculations` liefert einen Mittellohn-Vollkostensatz, keine rollenspezifischen Sätze (Geselle/Azubi/Meister). Für das MVP bewusst ein Satz; rollenspezifische `labor_rate_versions` sind Folge-Spec.
- **Rückwirkung auf bestehende Angebote:** Alt-Angebote ohne Kostenansatz zeigen „Kosten fehlen". Kein Backfill — die Kostenbasis entsteht ab Einführung vorwärts.
- **`accept_offer_and_create_project`** wurde in diesem Repo mehrfach angefasst (zuletzt kanonisches Statusmodell). Änderung dort sorgfältig gegen die bestehenden E2E-/Kettentests prüfen.
