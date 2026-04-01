# Einsatzplaner Verbesserung - Design Spec

**Datum**: 2026-03-31
**Ziel**: Einsatzplanung vereinfachen und alltagstauglich machen für Handwerksbetriebe (5-50 MA)
**Primärer Nutzer**: Geschäftsführer / Disponent am Desktop
**Ansatz**: Refactoring + schnelle Baustellenplanung (Ansatz 1+3)

---

## Problemstellung

Der aktuelle Einsatzplaner (PlannerModuleV2.tsx, ~1.700 Zeilen) ist funktional solide, aber für den Handwerker-Alltag zu umständlich:

- **Zu viele Klicks**: Jeder Mitarbeiter muss einzeln zugewiesen werden (6 Klicks pro MA)
- **Fehlender Überblick**: Keine schnelle Kapazitätsprüfung für neue Aufträge
- **Keine Bulk-Operationen**: Kein "diese 5 Leute auf Baustelle X"
- **Umplanung mühsam**: Projekt verschieben = jede Zuweisung einzeln anfassen
- **Monolithische Komponente**: Schwer wartbar und erweiterbar

## Alltagsszenarien die gelöst werden

1. **Neues Projekt startet** → Schnell 4 Leute drauf verteilen (Bulk-Zuweisung)
2. **Projekt fertig** → Team auf nächste Baustelle umplanen (Replan-Assistent)
3. **MA fällt aus** → Ersatz finden und umplanen (Ersatzvorschlag)
4. **Neuer Auftrag** → Prüfen ob Kapazität da ist (Kapazitätsprüfung)

---

## Phase 1: Refactoring - Komponente aufteilen

### Ziel
PlannerModuleV2.tsx (1.700 Zeilen) in fokussierte Subkomponenten aufteilen. Bestehende Funktionalität bleibt 1:1 erhalten.

### Neue Komponentenstruktur

```
src/components/planner/
├── PlannerPage.tsx              # Layout-Shell: Header, KPIs, Tabs
├── PlannerCalendarGrid.tsx      # Kalender-Raster (Tag/Woche/Monat)
├── PlannerEmployeeRow.tsx       # Einzelne MA-Zeile mit Auslastung
├── PlannerAssignmentBar.tsx     # Drag-fähiger Zuweisungs-Balken
├── PlannerSidebar.tsx           # Filter, Suche, Legende
├── PlannerKPICards.tsx          # KPI-Dashboard oben
├── dialogs/
│   ├── SingleAssignDialog.tsx   # Bestehender Einzel-Dialog (extrahiert)
│   ├── BulkAssignDialog.tsx     # NEU (Phase 2)
│   ├── ReplanDialog.tsx         # NEU (Phase 3)
│   └── CapacityCheckDialog.tsx  # NEU (Phase 3)
├── hooks/
│   ├── usePlannerData.ts        # Daten laden + cachen (React Query)
│   ├── useDragDrop.ts           # Drag-Drop-Logik
│   ├── useConflicts.ts          # Konflikterkennung
│   └── useUndoStack.ts          # Undo-Logik
└── utils/
    └── capacityUtils.ts         # Auslastungs-Berechnungen
```

### Performance-Verbesserungen
- **Optimistic Updates**: UI sofort aktualisieren, DB im Hintergrund
- **React Query**: Statt manuellem `loadData()` nach jeder Änderung
- **Memoization**: Auslastungsberechnung cachen statt bei jedem Render

### Datenmodell bereinigen
- `project_assignments` (Legacy) deprecaten, nur noch `project_team_assignments` nutzen
- Dokumentation welche Tabelle wofür zuständig ist

---

## Phase 2: Bulk-Zuweisung (Multi-MA auf Projekt)

### BulkAssignDialog

**Auslöser**: Neuer Button "Team zuweisen" im Planer (neben "+ Neuer Eintrag")

**UI-Aufbau**:
1. **Projektauswahl** (Dropdown, nur aktive Projekte mit Status beauftragt/in_bearbeitung)
2. **Zeitraum** vorbelegt aus `work_start_date`/`work_end_date`, überschreibbar
3. **MA-Liste mit Checkboxen**:
   - Sortiert nach Verfügbarkeit im gewählten Zeitraum
   - Pro MA: Name, Position, aktuelles Projekt (falls belegt)
   - Farbcodierung: Grün=frei, Amber=teilweise belegt, Rot=voll
   - Qualifikations-Filter (Position)
4. **"Alle freien auswählen"** Button
5. **Live-Konfliktanzeige**: "MA Schmidt ist in KW 15 auf Baustelle Müller"
6. **Bestätigung**: "4 Mitarbeiter zuweisen?" → Ein Klick

**DB-Operation**:
```sql
INSERT INTO project_team_assignments (project_id, employee_id, start_date, end_date, is_active, role)
VALUES
  ($project_id, $emp1, $start, $end, true, 'team_member'),
  ($project_id, $emp2, $start, $end, true, 'team_member'),
  ...
ON CONFLICT (project_id, employee_id) DO UPDATE
SET start_date = EXCLUDED.start_date, end_date = EXCLUDED.end_date, is_active = true;
```

**Keine Schemaänderung nötig.**

---

## Phase 3: Umplanungs-Assistent + Kapazitätsprüfung

### ReplanDialog - "Team umplanen"

**Szenario A: Projekt abgeschlossen**
- Button "Team umplanen" am Projekt
- Zeigt freigewordene MA mit Checkboxen (alle vorausgewählt)
- Dropdown: "Zuweisen auf → [neues Projekt]"
- Zeitraum aus neuem Projekt vorbelegt
- Ein Klick: Alle ausgewählten MA auf neues Projekt

**Szenario B: MA fällt aus**
- Krankmeldung eintragen (wie bisher)
- Automatisches Ersatz-Banner:
  - "Schmidt fällt aus (Projekt Müller, bis 18.04.)"
  - Liste freier MA, sortiert nach gleicher Position zuerst
  - Ein-Klick: "Weber als Ersatz einsetzen"
- DB: Neuer Eintrag in `project_team_assignments` für Ersatz-MA

**Szenario C: Projekt verschiebt sich**
- Kontextmenü am Projekt-Balken: "Projekt verschieben"
- Eingabe: "+X Tage" oder neues Startdatum
- Alle Zuweisungen für dieses Projekt werden verschoben
- Konflikte vorher angezeigt

### CapacityCheckDialog - "Kapazität prüfen"

**Auslöser**: Button "Kapazität prüfen" in KPI-Leiste

**Eingabe**:
- Zeitraum (z.B. KW 16-20)
- Benötigte MA-Anzahl
- Optional: Position/Qualifikation

**Ergebnis**:
- Balkendiagramm: Pro Woche verfügbar vs. benötigt
- Grün=genug, Rot=Engpass
- Liste verfügbarer MA im Zeitraum
- Liste der Engpass-Wochen
- **48h-Warnung** wenn Wochenstunden überschritten würden (ArbZG 2026)
- Direkt-Aktion: "Verfügbare MA zuweisen" → öffnet BulkAssignDialog

**Berechnung** (clientseitig):
- Alle `project_team_assignments` im Zeitraum
- Alle `vacation_requests` (approved) im Zeitraum
- Pro Tag: Gesamt-MA minus belegte minus Urlaub = verfügbar
- Nach Position filtern über `employees.position`

---

## Phase 4 (optional): Erweiterte Features

- **PDF/Excel-Export**: Wochenplan für Poliere
- **Erweiterte Filter**: "Wer ist in KW 15-18 verfügbar?"
- **Drag-Drop in Monatsansicht**
- **Benachrichtigungen**: MA über Planungsänderungen informieren
- **Smart-Vorschläge**: Ersatz-MA basierend auf Qualifikation und Historie

---

## Technische Entscheidungen

### Kein neues Backend
Alle Features nutzen bestehende Supabase-Tabellen. Kein Schema-Änderung in Phase 1-3.

### React Query statt manuelles Laden
Bestehender `loadData()` Pattern wird durch `useQuery` Hooks ersetzt:
- Automatisches Caching
- Optimistic Updates
- Hintergrund-Refetch

### Bestehende UI-Library
Weiterhin shadcn/ui + Tailwind. Keine neuen Dependencies.

### Datenmodell
- `project_team_assignments` = einzige Zuweisungstabelle (active)
- `project_assignments` = deprecated, nicht weiter nutzen
- `vacation_requests` = Abwesenheiten (bestehend)
- `calendar_events` = Termine/Besichtigungen (bestehend)

---

## Rechtliche Compliance

| Anforderung | Status | Maßnahme |
|-------------|--------|----------|
| ArbZG 48h/Woche | Phase 3 | Warnung in Kapazitätsprüfung |
| Elektronische Zeiterfassung | ✅ | Separates Modul |
| BUrlG Genehmigung | ✅ | Workflow vorhanden |
| DSGVO | ✅ | RLS + Rollenmodell |

---

## Nicht im Scope

- Mobile-Optimierung des Planers (Hauptnutzer = Desktop)
- KI-gestützte Vorschläge (Phase 4+ / separates Projekt)
- Zeiterfassungs-Integration (separates Modul)
- Schichtplanung (nicht relevant für typischen Handwerksbetrieb)
