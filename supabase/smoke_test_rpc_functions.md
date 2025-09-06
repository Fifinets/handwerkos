# Smoke Test für RPC Time Tracking Funktionen

## Test-Setup

```sql
-- Testdaten vorbereiten (als Admin ausführen)
-- Erstelle Test-Company, Employees, Projects, Customers

-- 1. Company
INSERT INTO companies (id, name) 
VALUES ('11111111-1111-1111-1111-111111111111', 'Test GmbH');

-- 2. Employees (Manager und Employee)
INSERT INTO employees (id, company_id, user_id, first_name, last_name, role)
VALUES 
  ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 
   auth.uid(), 'Max', 'Manager', 'manager'),
  ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111',
   auth.uid(), 'Eva', 'Employee', 'employee');

-- 3. Customer
INSERT INTO customers (id, company_id, name)
VALUES ('44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111', 'Kunde AG');

-- 4. Projects
INSERT INTO projects (id, company_id, customer_id, name)
VALUES 
  ('55555555-5555-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111',
   '44444444-4444-4444-4444-444444444444', 'Projekt A'),
  ('66666666-6666-6666-6666-666666666666', '11111111-1111-1111-1111-111111111111',
   '44444444-4444-4444-4444-444444444444', 'Projekt B');
```

## Test 1: Start/Stop/Switch

### Als Employee eingeloggt:

```sql
-- 1. Starte erstes Segment (09:00)
SELECT rpc_start_time_segment(
  '55555555-5555-5555-5555-555555555555'::UUID, 
  'work', 
  'Arbeit an Feature X'
);
-- Erwarte: UUID des neuen Segments

-- 2. Versuche zweites Segment zu starten (sollte fehlschlagen)
SELECT rpc_start_time_segment(
  '55555555-5555-5555-5555-555555555555'::UUID, 
  'work'
);
-- Erwarte: ERROR "Es gibt bereits ein aktives Zeitsegment"

-- 3. Wechsle zu Projekt B (11:00)
SELECT rpc_switch_project(
  [segment_id_von_schritt_1]::UUID,
  '66666666-6666-6666-6666-666666666666'::UUID,
  'work',
  'Bugfix Y'
);
-- Erwarte: JSON mit old_segment (120 Min) und new_segment Info

-- 4. Beende aktuelles Segment (17:00)
SELECT rpc_stop_time_segment([segment_id_von_switch]::UUID);
-- Erwarte: JSON mit duration_minutes = 360
```

### Verifizierung:

```sql
-- Prüfe ob keine Zeitlücken entstanden sind
SELECT 
  id, 
  project_id,
  started_at, 
  ended_at, 
  duration_minutes_computed,
  status
FROM time_segments
WHERE employee_id = '33333333-3333-3333-3333-333333333333'
ORDER BY started_at;
-- Erwarte: Nahtlose Übergänge, ended_at von Segment 1 = started_at von Segment 2
```

## Test 2: Approve mit Rundung (als Manager)

```sql
-- 1. Erstelle ungerundete Zeitsegmente
INSERT INTO time_segments (
  employee_id, project_id, company_id, 
  started_at, ended_at, status, segment_type
) VALUES 
  -- 127 Minuten (wird auf 120 gerundet bei 15-Min "nearest")
  ('33333333-3333-3333-3333-333333333333', 
   '55555555-5555-5555-5555-555555555555',
   '11111111-1111-1111-1111-111111111111',
   '2025-01-06 09:00:00', '2025-01-06 11:07:00', 'completed', 'work'),
  
  -- 6h 10min am Tag (370 Min → Auto-Pause 30 Min)
  ('33333333-3333-3333-3333-333333333333',
   '55555555-5555-5555-5555-555555555555', 
   '11111111-1111-1111-1111-111111111111',
   '2025-01-06 13:00:00', '2025-01-06 17:03:00', 'completed', 'work');

-- 2. Als Manager: Approve mit Regeln
SELECT rpc_approve_time_segments(
  NULL,                    -- alle Segmente
  '2025-01-06'::DATE,     -- von Datum
  '2025-01-06'::DATE,     -- bis Datum  
  '33333333-3333-3333-3333-333333333333'::UUID  -- für Employee
);

-- Erwarte: 
-- {
--   "approved_count": 2,
--   "total_original_minutes": 370,
--   "total_approved_minutes": 345,  -- 375 gerundet - 30 Auto-Pause
--   "time_rules_applied": {...}
-- }

-- 3. Verifiziere Audit-Delta
SELECT 
  duration_minutes_computed as original,
  approved_minutes,
  audit_delta
FROM time_segments
WHERE DATE(started_at) = '2025-01-06';
-- Erwarte: audit_delta enthält rounding details und auto_break info
```

## Test 3: Lieferschein erstellen

```sql
-- 1. Erstelle Lieferschein mit den genehmigten Zeiten
SELECT rpc_create_delivery_note(
  '55555555-5555-5555-5555-555555555555'::UUID,  -- project_id
  '44444444-4444-4444-4444-444444444444'::UUID,  -- customer_id
  '2025-01-06'::DATE,                            -- delivery_date
  NULL,                                           -- segment_ids (nimmt alle vom Projekt)
  '2025-01-06'::DATE,                            -- date_from
  '2025-01-06'::DATE,                            -- date_to
  false,                                          -- include_materials
  '{"street": "Hauptstr. 1", "city": "Berlin"}'::JSONB
);

-- Erwarte:
-- {
--   "delivery_note_id": "...",
--   "delivery_note_number": "LS-2025-000001",
--   "item_count": 2,
--   "total_work_minutes": 345,
--   "total_break_minutes": 0,
--   "status": "draft"
-- }

-- 2. Verifiziere Items
SELECT 
  dni.description,
  dni.quantity,
  dni.unit
FROM delivery_note_items dni
JOIN delivery_notes dn ON dn.id = dni.delivery_note_id
WHERE dn.number = 'LS-2025-000001';
-- Erwarte: 2 Items mit approved_minutes als quantity

-- 3. Teste Nummernkreis (nächster Lieferschein)
SELECT rpc_create_delivery_note(...);
-- Erwarte: "LS-2025-000002"
```

## Test 4: RLS Policies

### Als Employee:
```sql
-- Kann nur eigene Segmente sehen
SELECT * FROM time_segments;
-- Erwarte: Nur Segmente mit eigener employee_id

-- Kann Lieferscheine der Company sehen
SELECT * FROM delivery_notes;
-- Erwarte: Alle Lieferscheine der Company (read-only)

-- Kann keine fremden Segmente stoppen
SELECT rpc_stop_time_segment([fremde_segment_id]::UUID);
-- Erwarte: ERROR "Kein aktives Segment gefunden"
```

### Als Manager:
```sql
-- Kann alle Segmente der Company sehen und bearbeiten
SELECT * FROM time_segments WHERE company_id = [company_id];
-- Erwarte: Alle Segmente sichtbar

-- Kann Zeiten genehmigen
SELECT rpc_approve_time_segments(...);
-- Erwarte: Erfolgreich

-- Kann Lieferscheine erstellen und bearbeiten
UPDATE delivery_notes SET status = 'sent' WHERE id = [note_id];
-- Erwarte: Erfolgreich
```

## Test 5: Idempotenz

```sql
-- 1. Mehrfaches Stoppen des gleichen Segments
SELECT rpc_stop_time_segment([already_stopped_id]::UUID);
-- Erwarte: ERROR "Kein aktives Segment gefunden" (kein Duplikat)

-- 2. Mehrfaches Approven
SELECT rpc_approve_time_segments([already_approved_ids]);
-- Erwarte: Keine Änderung bei bereits genehmigten (idempotent)

-- 3. Switch mit bereits beendetem Segment
SELECT rpc_switch_project([completed_segment_id]::UUID, ...);
-- Erwarte: ERROR "Kein aktives Segment gefunden"
```

## Erwartete DB-Zustände nach Tests

1. **time_segments**: 
   - Alle Segmente haben ended_at (keine offenen)
   - approved_minutes bei genehmigten Segmenten gesetzt
   - audit_delta enthält Rundungsdetails

2. **delivery_notes**:
   - Fortlaufende Nummerierung (LS-2025-000001, -000002, ...)
   - total_work_minutes entspricht Summe der approved_minutes

3. **delivery_note_items**:
   - Jedes inkludierte Segment hat einen Eintrag
   - quantity = approved_minutes oder duration_minutes_computed

## Cleanup

```sql
-- Testdaten entfernen
DELETE FROM delivery_notes WHERE company_id = '11111111-1111-1111-1111-111111111111';
DELETE FROM time_segments WHERE company_id = '11111111-1111-1111-1111-111111111111';
DELETE FROM projects WHERE company_id = '11111111-1111-1111-1111-111111111111';
DELETE FROM customers WHERE company_id = '11111111-1111-1111-1111-111111111111';
DELETE FROM employees WHERE company_id = '11111111-1111-1111-1111-111111111111';
DELETE FROM companies WHERE id = '11111111-1111-1111-1111-111111111111';
```