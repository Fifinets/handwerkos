-- ============================================
-- ANALYSE: Aktuelle Datenbank-Struktur für Zeitplanung
-- ============================================

-- 1. Prüfe relevante Tabellen für Zeitplanung
SELECT 
    table_name,
    CASE 
        WHEN table_name IN ('projects', 'employees', 'project_team_members', 'time_entries') THEN '✓ Vorhanden'
        ELSE '? Unbekannt'
    END as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
    AND table_name IN (
        'projects', 'employees', 'project_team_members', 
        'time_entries', 'employee_availability', 'vacation_requests',
        'work_schedules', 'employee_capacity'
    )
ORDER BY table_name;

-- 2. Analysiere projects Tabelle - Zeitfelder
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'projects' 
    AND column_name IN ('start_date', 'end_date', 'planned_start_date', 'planned_end_date', 'estimated_hours');

-- 3. Analysiere employees Tabelle - Arbeitszeit-relevante Felder
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'employees' 
    AND (column_name LIKE '%hour%' OR column_name LIKE '%time%' OR column_name LIKE '%capacity%' OR column_name = 'work_schedule');

-- 4. Prüfe project_team_members Tabelle - Zuweisungszeiträume
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'project_team_members'
    AND (column_name LIKE '%date%' OR column_name LIKE '%start%' OR column_name LIKE '%end%' OR column_name LIKE '%hour%');

-- 5. Prüfe time_entries Tabelle
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'time_entries';

-- 6. Beispiel-Daten aus aktuellen Tabellen
SELECT 
    'Projekte mit Datumsangaben:' as info,
    COUNT(*) as anzahl,
    COUNT(start_date) as mit_startdatum,
    COUNT(end_date) as mit_enddatum
FROM projects;

SELECT 
    'Aktuelle Projekt-Zuweisungen:' as info,
    COUNT(*) as total_zuweisungen,
    COUNT(DISTINCT project_id) as projekte_mit_team,
    COUNT(DISTINCT employee_id) as mitarbeiter_zugewiesen
FROM project_team_members;

-- 7. Zeiteinträge Analyse
SELECT 
    'Zeit-Einträge:' as info,
    COUNT(*) as total_entries,
    COUNT(DISTINCT employee_id) as mitarbeiter_mit_zeiten,
    COUNT(DISTINCT project_id) as projekte_mit_zeiten,
    COALESCE(SUM(hours_worked), 0) as gesamtstunden
FROM time_entries;

-- 8. Potentielle Konflikte identifizieren
SELECT 
    'Mitarbeiter mit mehreren Projekt-Zuweisungen:' as info,
    COUNT(*) as anzahl_mitarbeiter
FROM (
    SELECT employee_id
    FROM project_team_members
    GROUP BY employee_id
    HAVING COUNT(DISTINCT project_id) > 1
) multi_assignments;