-- ============================================
-- DEBUG: Warum werden keine Mitarbeiter angezeigt?
-- ============================================

-- 1. Prüfe ob überhaupt Mitarbeiter existieren
SELECT 
    'Anzahl ALLER Mitarbeiter in der Datenbank:' as info,
    COUNT(*) as anzahl
FROM employees;

-- 2. Zeige alle Mitarbeiter mit deren Status
SELECT 
    id,
    first_name,
    last_name,
    email,
    status,
    company_id,
    created_at
FROM employees
ORDER BY created_at DESC;

-- 3. Prüfe deine company_id
SELECT 
    'Deine company_id:' as info,
    company_id
FROM profiles 
WHERE id = auth.uid();

-- 4. Prüfe ob deine Mitarbeiter die gleiche company_id haben
SELECT 
    e.id,
    e.first_name,
    e.last_name,
    e.status,
    e.company_id as employee_company_id,
    p.company_id as your_company_id,
    CASE 
        WHEN e.company_id = p.company_id THEN 'PASST'
        ELSE 'PASST NICHT - PROBLEM!'
    END as company_match
FROM employees e
CROSS JOIN (SELECT company_id FROM profiles WHERE id = auth.uid()) p
ORDER BY e.created_at DESC;

-- 5. Zeige Mitarbeiter die zu deiner Firma gehören
SELECT 
    'Mitarbeiter in DEINER Firma:' as info,
    COUNT(*) as anzahl
FROM employees
WHERE company_id = (SELECT company_id FROM profiles WHERE id = auth.uid());

-- 6. Prüfe project_team_members Tabelle
SELECT 
    'Bereits zugewiesene Mitarbeiter in Projekten:' as info,
    COUNT(*) as anzahl
FROM project_team_members;

-- 7. Zeige welche Mitarbeiter welchen Projekten zugewiesen sind
SELECT 
    p.name as projekt,
    e.first_name || ' ' || e.last_name as mitarbeiter,
    ptm.assigned_at
FROM project_team_members ptm
LEFT JOIN projects p ON p.id = ptm.project_id
LEFT JOIN employees e ON e.id = ptm.employee_id;