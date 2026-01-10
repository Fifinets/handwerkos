-- Prüfe Datenbank-Schema für Zeiterfassung
-- In Supabase SQL Editor ausführen

-- 1. Prüfe ob timesheets Tabelle existiert
SELECT
  table_name,
  table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('timesheets', 'attendance', 'time_entries', 'employees');

-- 2. Prüfe timesheets Spalten
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'timesheets'
ORDER BY ordinal_position;

-- 3. Prüfe Foreign Key Constraints für timesheets
SELECT
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name = 'timesheets';

-- 4. Prüfe ob employee_id in timesheets existiert und valide ist
SELECT
  COUNT(*) as total_rows,
  COUNT(DISTINCT employee_id) as unique_employees,
  COUNT(*) FILTER (WHERE employee_id IS NULL) as null_employee_ids
FROM timesheets;

-- 5. Teste ob employees Tabelle mit timesheets kompatibel ist
SELECT
  e.id as employee_id,
  e.user_id,
  COUNT(t.id) as timesheet_count
FROM employees e
LEFT JOIN timesheets t ON t.employee_id = e.id
GROUP BY e.id, e.user_id
LIMIT 5;

-- 6. Prüfe attendance Tabelle
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'attendance'
ORDER BY ordinal_position;

-- 7. Prüfe offene attendance Einträge
SELECT
  COUNT(*) as open_attendance_count,
  COUNT(DISTINCT employee_id) as employees_with_open_attendance
FROM attendance
WHERE status = 'open' AND clock_out IS NULL;

-- 8. Teste Insert in timesheets (DRY RUN mit ROLLBACK)
BEGIN;
  -- Hole erste employee_id
  WITH first_employee AS (
    SELECT id FROM employees LIMIT 1
  )
  INSERT INTO timesheets (
    employee_id,
    date,
    start_time,
    end_time,
    hours,
    is_billable,
    task_category
  )
  SELECT
    id,
    CURRENT_DATE,
    '08:00:00'::time,
    '17:00:00'::time,
    8.0,
    true,
    'general'
  FROM first_employee
  RETURNING id, employee_id, date, hours;
ROLLBACK; -- Änderungen rückgängig machen

-- ERGEBNIS:
-- Wenn alle Queries erfolgreich sind, ist das Schema korrekt.
-- Bei Fehlern: Siehe Fehlermeldung für Details.
