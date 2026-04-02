# Saisonale Trendanalyse - Design Spec

## Ziel

Neuer Tab "Auslastung" im ReportsModuleV2 mit 12-Monats-Auslastungstrend pro Team und pro Mitarbeiter. Zeigt saisonale Muster, hilft bei Personalplanung.

## Architektur

Reine Frontend-Berechnung aus bestehenden Supabase-Tabellen. Keine neuen DB-Tabellen, keine Edge Functions.

```
project_team_assignments (start_date, end_date)
vacation_requests (start_date, end_date, absence_type)
employees (id, first_name, last_name, status, position)
         │
         ▼
  useUtilizationTrends() Hook
  (berechnet 12-Monats-Auslastung)
         │
         ├── BarChart: Team-Auslastung pro Monat
         ├── Heatmap: Pro-MA-Auslastung (Zeile=MA, Spalte=Monat)
         └── KPI-Karten: Durchschnitt, Stärkster/Schwächster Monat, Trend
```

## Datenquellen (bestehend, keine Änderungen)

| Tabelle | Felder | Zweck |
|---|---|---|
| `employees` | id, first_name, last_name, status, position | Aktive MA-Liste |
| `project_team_assignments` | employee_id, start_date, end_date, is_active | Zuweisungszeiträume |
| `vacation_requests` | employee_id, start_date, end_date, status, absence_type | Abwesenheiten |

## Auslastungs-Berechnung

Für jeden Monat und jeden Mitarbeiter:

```
Werktage im Monat = Alle Mo-Fr minus Feiertage (aus holidays.ts)
Zugewiesene Tage = Tage an denen MA mindestens 1 aktive Projektzuweisung hat
Abwesende Tage = Tage mit genehmigtem Urlaub/Krank
Verfügbare Tage = Werktage - Abwesende Tage
Auslastung% = (Zugewiesene Tage / Verfügbare Tage) × 100
```

Sonderfälle:
- MA hat >1 Projekt am selben Tag → zählt als 1 zugewiesener Tag (keine Doppelzählung)
- MA hat Urlaub + Projektzuweisung → Urlaubstag wird abgezogen (nicht als zugewiesen gezählt)
- Verfügbare Tage = 0 → Auslastung = 0% (nicht Division durch 0)

## UI-Komponenten

### 1. Neuer Tab "Auslastung" in ReportsModuleV2

Ergänzt die bestehenden Tabs im ReportsModuleV2. Tab-Label: "Auslastung" mit TrendingUp-Icon.

### 2. KPI-Zeile (4 Karten)

| KPI | Berechnung | Icon |
|---|---|---|
| Ø Auslastung (12 Monate) | Durchschnitt aller Monats-Auslastungen | BarChart3 |
| Stärkster Monat | Monat mit höchster Team-Auslastung + Wert | TrendingUp |
| Schwächster Monat | Monat mit niedrigster Team-Auslastung + Wert | TrendingDown |
| Trend | Vergleich letzte 3 Monate vs. vorherige 3 Monate (steigend/fallend/stabil) | ArrowUpRight/ArrowDownRight |

### 3. Team-Auslastung BarChart (Recharts)

- X-Achse: 12 Monate (Jan, Feb, ..., Dez) mit deutschen Monatsnamen
- Y-Achse: 0-100% (oder höher bei Überlastung)
- Balkenfarbe: <80% grün, 80-100% gelb, >100% rot
- Horizontale Linie bei 80% (Ziel-Auslastung) als Reference Line
- Tooltip: "März 2026: 87% Auslastung (12 von 14 MA zugewiesen)"

### 4. Mitarbeiter-Heatmap

Tabelle mit:
- Zeilen: Mitarbeiter (Name + Position)
- Spalten: 12 Monate
- Zellen: Auslastung% als farbige Badges
  - Grün (<80%): bg-emerald-100 text-emerald-800
  - Gelb (80-100%): bg-amber-100 text-amber-800
  - Rot (>100%): bg-red-100 text-red-800
  - Grau (0% / keine Daten): bg-slate-100 text-slate-400
- Letzte Spalte: Ø Auslastung über alle 12 Monate

### 5. Positions-Filter

Optional: Dropdown um nach Position zu filtern (z.B. nur Gesellen, nur Meister).

## Dateien

### Neue Dateien:
- `src/components/reports/UtilizationTrendsTab.tsx` — Haupt-Tab-Komponente
- `src/hooks/useUtilizationTrends.ts` — Daten-Hook (lädt assignments, vacations, employees, berechnet Trends)

### Zu modifizieren:
- `src/components/ReportsModuleV2.tsx` — Neuen Tab "Auslastung" hinzufügen

### Bestehende genutzte Dateien (keine Änderung):
- `src/components/planner/holidays.ts` — Feiertags-Berechnung
- Recharts (bereits als Dependency installiert)

## Nicht im Scope

- Prognose/Forecasting für zukünftige Monate
- Export als PDF/Excel
- Vergleich mit Vorjahr
- Umsatz-Korrelation
- Automatische Empfehlungen (z.B. "Stellen Sie im Oktober ein")
