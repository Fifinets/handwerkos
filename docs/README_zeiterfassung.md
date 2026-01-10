# Zeiterfassung - Dual Time Tracking System

## Überblick

HandwerkOS unterstützt ein **zweigleisiges Zeiterfassungssystem**:

1. **Arbeitszeit (Attendance)** - Anwesenheit des Mitarbeiters
   - Clock-in / Clock-out
   - Pausen
   - Für Lohnabrechnung

2. **Projektzeit (Time Entries)** - Zuordnung zu Projekten/Kostenstellen
   - Projektbuchungen
   - Kostenstellen (Fahrt, Werkstatt, Schulung, etc.)
   - Für Kunden-/Projektabrechnung

Das System prüft automatisch den **Deckungsgrad** zwischen Arbeitszeit und gebuchter Zeit.

---

## Feature-Flag Aktivierung

Das duale System ist **opt-in** über einen Feature-Flag:

```sql
-- Aktivieren für alle Unternehmen (global)
UPDATE feature_flags
SET enabled = true
WHERE flag_name = 'ff_dual_time_tracking'
AND company_id IS NULL;

-- Aktivieren für spezifisches Unternehmen
UPDATE feature_flags
SET enabled = true
WHERE flag_name = 'ff_dual_time_tracking'
AND company_id = '<company_id>';
```

### Prüfen ob aktiviert:

```typescript
import { useDualTimeTracking } from '@/hooks/useFeatureFlag'

const MyComponent = () => {
  const { enabled, isLoading } = useDualTimeTracking()

  if (!enabled) {
    return <OldTimeTrackingView />
  }

  return <DualTimeTrackingView />
}
```

---

## Flows

### 1. Typischer Arbeitstag (mit dualem System)

```
08:00  Employee: Schicht starten (Clock In)
       → Attendance erstellt

08:15  Employee: Projekt A starten
       → Time Entry (type='project')

10:00  Employee: Fahrt zu Baustelle B
       → Time Entry (type='cost_center', code='FAHRT')

10:30  Employee: Projekt B starten
       → Vorheriges Entry beenden, neues starten

12:00  Employee: Pause starten
       → Attendance: Break hinzufügen

12:30  Employee: Pause beenden
       → Break abgeschlossen

13:00  Employee: Projekt B fortsetzen

16:30  Employee: Werkstatt
       → Time Entry (type='cost_center', code='WERKSTATT')

17:00  Employee: Schicht beenden (Clock Out)
       → Attendance abgeschlossen

       System: Deckungsgrad prüfen
       → 🟢 98% Coverage (Grün)
```

### 2. Ohne duales System (Legacy)

```
08:00  Employee: Projekt A starten
       → Nur Time Entry

12:00  Employee: Pause (manuell oder auto)

17:00  Employee: Projekt stoppen
       → Time Entry beendet
```

---

## API Endpoints

### Attendance (NEU)

#### Clock In
```typescript
POST /api/attendance/clock-in
{
  "employeeId": "uuid",
  "location": {
    "lat": 48.1351,
    "lng": 11.5820,
    "accuracy": 10
  }
}
```

#### Clock Out
```typescript
POST /api/attendance/clock-out
{
  "attendanceId": "uuid",
  "location": { ... }
}
```

#### Start Break
```typescript
POST /api/attendance/start-break
{
  "attendanceId": "uuid"
}
```

#### End Break
```typescript
POST /api/attendance/end-break
{
  "attendanceId": "uuid"
}
```

#### Get Week
```typescript
GET /api/attendance/week/:weekStart?employeeId=uuid
```

#### Submit Week
```typescript
POST /api/attendance/submit-week
{
  "employeeId": "uuid",
  "weekStartDate": "2025-10-13"
}
```

### Time Entries (ERWEITERT - Backward Compatible!)

#### Create Entry (Alt - weiter unterstützt)
```typescript
POST /api/time-entries
{
  "employeeId": "uuid",
  "projectId": "uuid",
  "start_time": "2025-10-15T08:00:00Z",
  "description": "..."
}
// → System setzt automatisch type='project'
```

#### Create Entry (Neu - mit Type)
```typescript
POST /api/time-entries
{
  "employeeId": "uuid",
  "type": "cost_center",
  "cost_center_id": "uuid",
  "start_time": "2025-10-15T10:00:00Z",
  "end_time": "2025-10-15T10:30:00Z",
  "description": "Fahrt zur Baustelle"
}
```

### Reconciliation (NEU)

#### Get Coverage
```typescript
GET /api/reconciliation/:employeeId/:date
Response:
{
  "date": "2025-10-15",
  "attendance_minutes": 480,
  "project_minutes": 420,
  "cost_center_minutes": 30,
  "break_minutes": 30,
  "coverage_percent": 100,
  "status": "green",
  "has_gaps": false
}
```

#### Get Week Summary
```typescript
GET /api/reconciliation/week/:employeeId/:weekStart
```

#### Detect Gaps
```typescript
GET /api/reconciliation/gaps/:employeeId/:date
Response:
[
  {
    "gap_start": "2025-10-15T11:00:00Z",
    "gap_end": "2025-10-15T12:00:00Z",
    "gap_minutes": 60,
    "suggested_cost_center": "WERKSTATT",
    "reason": "Unaccounted time detected"
  }
]
```

---

## Mobile UI Komponenten

### AttendanceControls

```tsx
import { AttendanceControls } from '@/components/mobile/AttendanceControls'

<AttendanceControls
  employeeId={employeeId}
  onStatusChange={() => console.log('Status changed')}
/>
```

**Features:**
- Clock In/Out Buttons
- Break Start/Stop
- Live Duration Display
- GPS Location Tracking (optional)

### CostCenterQuickPick

```tsx
import { CostCenterQuickPick } from '@/components/mobile/CostCenterQuickPick'

<CostCenterQuickPick
  employeeId={employeeId}
  onCostCenterSelect={(id, cc) => bookTime(id)}
  compact={true}
/>
```

**Features:**
- Quick-Access Buttons (Fahrt, Werkstatt, etc.)
- "Mehr" Sheet für alle Kostenstellen
- Billable Badge
- Compact Mode

### DayCoverageBar

```tsx
import { DayCoverageBar } from '@/components/mobile/DayCoverageBar'

<DayCoverageBar
  employeeId={employeeId}
  date="2025-10-15"
  compact={false}
/>
```

**Features:**
- Visual Layer Display
- Coverage Percentage
- Status Ampel (🟢/🟡/🔴)
- Gap Warning
- Time Breakdown

---

## Services

### FeatureFlagService

```typescript
import { FeatureFlagService, DualTimeTrackingFlag } from '@/services/featureFlagService'

// Check if enabled
const enabled = await FeatureFlagService.isEnabled('ff_dual_time_tracking', companyId)

// Shortcut for dual tracking
const enabled = await DualTimeTrackingFlag.isEnabled(companyId)
```

### AttendanceService

```typescript
import { AttendanceService } from '@/services/attendanceService'

// Clock in
const attendance = await AttendanceService.clockIn({
  employeeId: 'uuid',
  location: { lat, lng }
})

// Get current
const current = await AttendanceService.getCurrentAttendance(employeeId)
```

### RulesEngine

```typescript
import { RulesEngine } from '@/services/rulesEngine'

// Validate entry
const validation = await RulesEngine.validateTimeEntry(
  employeeId,
  startTime,
  endTime,
  breakMinutes,
  companyId
)

if (!validation.isValid) {
  console.error('Errors:', validation.errors)
  console.warn('Warnings:', validation.warnings)
}
```

### ReconciliationService

```typescript
import { ReconciliationService } from '@/services/reconciliationService'

// Get coverage
const coverage = await ReconciliationService.calculateCoverage(employeeId, date)

// Get week
const week = await ReconciliationService.getWeekReconciliation(employeeId, weekStart)

// Detect gaps
const gaps = await ReconciliationService.detectGaps(employeeId, date)
```

---

## Datenbank-Funktionen

### is_feature_enabled(flag_name, company_id)
```sql
SELECT is_feature_enabled('ff_dual_time_tracking', '<company_id>');
-- Returns: true/false
```

### is_week_locked(employee_id, date)
```sql
SELECT is_week_locked('<employee_id>', '2025-10-15');
-- Returns: true/false
```

### check_reconciliation(employee_id, date)
```sql
SELECT * FROM check_reconciliation('<employee_id>', '2025-10-15');
-- Returns: reconciliation result
```

### detect_attendance_gaps(employee_id, date)
```sql
SELECT * FROM detect_attendance_gaps('<employee_id>', '2025-10-15');
-- Returns: array of gaps
```

### backfill_attendance_from_time_entries(start_date, end_date, employee_id, dry_run)
```sql
-- Dry run (preview only)
SELECT * FROM backfill_attendance_from_time_entries(
  '2025-01-01',
  '2025-10-15',
  NULL,
  true
);

-- Actual run
SELECT * FROM backfill_attendance_from_time_entries(
  '2025-01-01',
  '2025-10-15',
  NULL,
  false
);
```

---

## Kostenstellen (Standard)

| Code | Name | Billable | Payroll | Farbe |
|------|------|----------|---------|-------|
| FAHRT | Fahrtzeit | ✅ | ✅ | Blau |
| WERKSTATT | Werkstatt | ❌ | ✅ | Grau |
| SCHULUNG | Schulung/Weiterbildung | ❌ | ✅ | Grün |
| URLAUB | Urlaub | ❌ | ✅ | Orange |
| KRANK | Krankheit | ❌ | ❌ | Rot |

---

## Coverage Ampel

| Coverage | Status | Farbe | Bedeutung |
|----------|--------|-------|-----------|
| ≥ 95% | green | 🟢 | Perfekt |
| 90-95% | yellow | 🟡 | OK |
| < 90% | red | 🔴 | Unvollständig |

---

## Reconciliation Toleranz

Standard: **5%** (konfigurierbar in `time_rules`)

```sql
UPDATE time_rules
SET reconciliation_tolerance_percent = 5.00
WHERE company_id = '<company_id>';
```

---

## Beispiel: Vollständiger Tag

```typescript
// 1. Clock In (08:00)
const attendance = await AttendanceService.clockIn({
  employeeId: 'emp-123',
  location: { lat: 48.1351, lng: 11.5820 }
})

// 2. Projekt A starten (08:15)
const projectEntry = await supabase.from('time_entries').insert({
  employee_id: 'emp-123',
  type: 'project',
  project_id: 'proj-A',
  start_time: '2025-10-15T08:15:00Z'
})

// 3. Fahrt buchen (10:00-10:30)
await supabase.from('time_entries').insert({
  employee_id: 'emp-123',
  type: 'cost_center',
  cost_center_id: 'cc-fahrt',
  start_time: '2025-10-15T10:00:00Z',
  end_time: '2025-10-15T10:30:00Z'
})

// 4. Pause (12:00-12:30)
await AttendanceService.startBreak(attendance.id)
// ... 30 Minuten später
await AttendanceService.endBreak(attendance.id)

// 5. Clock Out (17:00)
await AttendanceService.clockOut({
  attendanceId: attendance.id,
  location: { lat: 48.1351, lng: 11.5820 }
})

// 6. Coverage prüfen
const coverage = await ReconciliationService.calculateCoverage(
  'emp-123',
  '2025-10-15'
)

console.log('Coverage:', coverage.coverage_percent + '%')
console.log('Status:', coverage.status) // green/yellow/red
```

---

## Troubleshooting

### Feature-Flag wird nicht erkannt

```sql
-- Prüfen ob Flag existiert
SELECT * FROM feature_flags WHERE flag_name = 'ff_dual_time_tracking';

-- Falls nicht vorhanden, erstellen
INSERT INTO feature_flags (flag_name, description, enabled)
VALUES ('ff_dual_time_tracking', 'Dual time tracking system', true);
```

### Woche kann nicht bearbeitet werden

```sql
-- Prüfen ob Woche gesperrt ist
SELECT * FROM timesheet_locks
WHERE employee_id = '<employee_id>'
AND week_start_date = '<monday_date>';

-- Entsperren (Manager only)
SELECT unlock_week('<employee_id>', '<monday_date>', 'Korrektur erforderlich');
```

### Coverage ist rot trotz vollständiger Buchung

```sql
-- Reconciliation neu berechnen
SELECT * FROM check_reconciliation('<employee_id>', '2025-10-15');

-- Gaps finden
SELECT * FROM detect_attendance_gaps('<employee_id>', '2025-10-15');
```

---

## Best Practices

1. **Immer Clock-In/-Out verwenden** wenn duales System aktiv
2. **Pausen korrekt erfassen** (reduziert Gaps)
3. **Kostenstellen nutzen** für Nicht-Projektzeit
4. **Woche vor Submit prüfen** (Coverage sollte grün sein)
5. **Gaps sofort füllen** mit passenden Kostenstellen

---

## Support

Bei Fragen oder Problemen:
- Dokumentation: `/docs`
- Issues: GitHub Repository
- Migration Guide: `UPGRADE.md`
