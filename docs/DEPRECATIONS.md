# Deprecations - Dual Time Tracking

## Zusammenfassung

✅ **KEINE Breaking Changes!**

Das duale Zeiterfassungssystem wurde **vollständig rückwärtskompatibel** implementiert.

Alle bestehenden API-Endpoints, Funktionen und UI-Komponenten funktionieren **unverändert weiter**.

---

## Was NICHT deprecated ist

### API Endpoints (Alle bleiben bestehen!)

✅ `POST /api/time-entries` - Funktioniert weiter wie bisher
✅ `GET /api/time-entries` - Funktioniert weiter wie bisher
✅ `PUT /api/time-entries/:id` - Funktioniert weiter wie bisher
✅ `DELETE /api/time-entries/:id` - Funktioniert weiter wie bisher

### Datenbank-Tabellen

✅ `time_entries` - Bleibt vollständig kompatibel
✅ `time_segments` - Unverändert
✅ `timesheets` - Unverändert
✅ `time_rules` - Erweitert (nicht geändert!)

### Hooks

✅ `useTimeTracking` - Funktioniert weiter wie bisher (nur erweitert)

### Komponenten

✅ `TodayScreen` - Funktioniert weiter wie bisher (nur erweitert)
✅ `QuickProjectSwitch` - Unverändert
✅ `TodayTimeline` - Unverändert

---

## Kompatibilitäts-Garantien

### 1. Alte Clients funktionieren weiter

```typescript
// Alt (ohne type-Feld)
POST /api/time-entries
{
  "employee_id": "uuid",
  "project_id": "uuid",
  "start_time": "2025-10-15T08:00:00Z"
}

// → System setzt automatisch type='project'
// → Funktioniert 100% wie vorher!
```

### 2. Bestehende time_entries bleiben gültig

```sql
-- Alle alten Einträge haben jetzt type='project'
SELECT type, COUNT(*)
FROM time_entries
GROUP BY type;

-- Ergebnis:
-- project | 12345
```

### 3. Feature-Flag kontrolliert neue Features

Wenn `ff_dual_time_tracking = false`:
- Keine Attendance-UI sichtbar
- Keine Kostenstellen-Buttons
- Keine Coverage-Anzeige
- System verhält sich **exakt wie vorher**!

---

## Neue Funktionen (Opt-In!)

Diese Features sind **zusätzlich** verfügbar (nur bei aktivem Flag):

### Datenbank-Tabellen (NEU)

- ✨ `attendance` - Arbeitszeit-Tracking
- ✨ `cost_centers` - Kostenstellen
- ✨ `timesheet_locks` - Wochensperren
- ✨ `time_audit_log` - Audit-Trail
- ✨ `feature_flags` - Feature-Management

### API Endpoints (NEU)

- ✨ `POST /api/attendance/clock-in`
- ✨ `POST /api/attendance/clock-out`
- ✨ `GET /api/reconciliation/:employeeId/:date`
- ✨ `GET /api/reports/coverage`

### UI Komponenten (NEU)

- ✨ `AttendanceControls`
- ✨ `CostCenterQuickPick`
- ✨ `DayCoverageBar`

### Services (NEU)

- ✨ `AttendanceService`
- ✨ `RulesEngine`
- ✨ `ReconciliationService`
- ✨ `FeatureFlagService`

### Hooks (NEU)

- ✨ `useFeatureFlag`
- ✨ `useDualTimeTracking`

---

## Erweiterte Felder (Backward Compatible!)

### time_entries - Neue Spalten

Alle neuen Spalten haben **Defaults**, daher keine Breaking Changes:

| Spalte | Typ | Default | Beschreibung |
|--------|-----|---------|--------------|
| `type` | TEXT | `'project'` | project / cost_center |
| `cost_center_id` | UUID | `NULL` | Referenz zu cost_centers |
| `billable` | BOOLEAN | `true` | Abrechenbar? |
| `gps_location` | JSONB | `NULL` | GPS-Koordinaten |
| `status_approval` | TEXT | `'draft'` | Approval-Status |
| `attendance_id` | UUID | `NULL` | Link zu attendance |

**Wichtig:** Alte Queries funktionieren weiter!

```sql
-- Alt (funktioniert weiter!)
SELECT employee_id, project_id, start_time, end_time
FROM time_entries
WHERE employee_id = 'uuid';

-- Neu (optional)
SELECT employee_id, type, project_id, cost_center_id
FROM time_entries
WHERE employee_id = 'uuid';
```

### time_rules - Neue Spalten

Alle Erweiterungen mit Defaults:

| Spalte | Default | Beschreibung |
|--------|---------|--------------|
| `reconciliation_tolerance_percent` | `5.00` | Toleranz für Abweichungen |
| `require_reconciliation` | `true` | Reconciliation erforderlich? |
| `min_breaks_minutes` | `30` | Mindestpause |
| `overtime_daily_minutes` | `600` | Tageslimit (10h) |
| `overtime_weekly_minutes` | `2880` | Wochenlimit (48h) |
| `coverage_green_min` | `95.00` | Grün ab 95% |
| `coverage_yellow_min` | `90.00` | Gelb ab 90% |

---

## Migrations-Strategie

### Phase 1: Schema erweitern (✅ DONE)
- Neue Tabellen erstellen
- Bestehende Tabellen erweitern (ADD COLUMN)
- **Keine Änderungen an bestehenden Daten!**

### Phase 2: Feature-Flag aktivieren (✅ READY)
- Flag per Default `false`
- Admins können per Firma aktivieren
- UI zeigt neue Features nur bei aktivem Flag

### Phase 3: Alte Daten migrieren (Optional)
- `backfill_attendance_from_time_entries()` Funktion
- Idempotent (kann mehrfach laufen)
- Dry-Run Modus verfügbar

---

## Sunset-Plan

**Es gibt KEINEN Sunset-Plan!**

Die alten Endpunkte und Funktionen bleiben **dauerhaft** verfügbar.

Gründe:
1. **Backward Compatibility** ist kritisch für Produktivsysteme
2. **Feature-Flag** ermöglicht opt-in ohne Zwang
3. **Keine technische Notwendigkeit** alte API zu entfernen

---

## Empfohlener Migrationspfad

Für neue Implementierungen empfehlen wir:

### 1. Neue Projekte
→ Duales System von Anfang an nutzen

### 2. Bestehende Projekte
→ Schrittweise Migration:
1. Feature-Flag aktivieren (Test-Unternehmen)
2. User schulen
3. 1-2 Wochen parallel testen
4. Bei Erfolg: Vollständige Aktivierung

### 3. Legacy-Systeme
→ Können **dauerhaft** altes System nutzen

---

## Changelog

### v1.0.0-dual-time-tracking (2025-10-15)

**Added:**
- ✨ Dual time tracking system
- ✨ Attendance table
- ✨ Cost centers
- ✨ Reconciliation engine
- ✨ Week locks
- ✨ Audit log

**Changed:**
- 🔧 Extended `time_entries` (backward compatible)
- 🔧 Extended `time_rules` (backward compatible)
- 🔧 Mobile UI: Added new components (only visible with flag)

**Deprecated:**
- (None - full backward compatibility!)

**Removed:**
- (None - no removals!)

**Fixed:**
- 🐛 Auto-break calculation now considers manual breaks

**Security:**
- 🔒 RLS policies for all new tables
- 🔒 Audit log for GoBD compliance

---

## Fazit

✅ **Keine Breaking Changes**
✅ **Keine Deprecations**
✅ **100% Backward Compatible**
✅ **Feature-Flag gesteuert**
✅ **Opt-In System**

→ **Sicheres Upgrade ohne Risiko!**

---

## Support

Bei Fragen zur Kompatibilität:
- Docs: `README_zeiterfassung.md`
- Upgrade: `UPGRADE.md`
- Migration Plan: `DUAL_TIME_TRACKING_PLAN.md`
