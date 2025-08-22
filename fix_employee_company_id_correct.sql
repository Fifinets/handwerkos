-- ============================================
-- FIX: Mitarbeiter der richtigen Firma zuordnen (KORRIGIERTE VERSION)
-- ============================================

-- 1. Prüfe das Schema der profiles Tabelle
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND table_schema = 'public';

-- 2. Zeige deine company_id (mit korrekter Spalte)
SELECT 
    'Deine company_id:' as info,
    user_id,
    company_id,
    email
FROM profiles 
WHERE user_id = auth.uid();

-- 3. Zeige alle Mitarbeiter und deren company_id
SELECT 
    id,
    first_name,
    last_name,
    email,
    company_id,
    status,
    CASE 
        WHEN company_id IS NULL THEN 'KEINE COMPANY_ID!'
        ELSE company_id::text
    END as company_status
FROM employees
LIMIT 20;

-- 4. UPDATE: Weise alle Mitarbeiter ohne company_id DEINER Firma zu
UPDATE employees
SET 
    company_id = (SELECT company_id FROM profiles WHERE user_id = auth.uid()),
    updated_at = NOW()
WHERE company_id IS NULL
   OR company_id NOT IN (SELECT company_id FROM profiles WHERE company_id IS NOT NULL);

-- 5. Falls Mitarbeiter noch keinen Status haben, setze sie auf 'active'
UPDATE employees
SET 
    status = 'active',
    updated_at = NOW()
WHERE status IS NULL OR status = '';

-- 6. Überprüfe das Ergebnis
SELECT 
    'Mitarbeiter in DEINER Firma nach Fix:' as info,
    COUNT(*) as anzahl
FROM employees
WHERE company_id = (SELECT company_id FROM profiles WHERE user_id = auth.uid());

-- 7. Zeige die aktualisierten Mitarbeiter
SELECT 
    id,
    first_name || ' ' || last_name as name,
    email,
    status,
    company_id,
    CASE 
        WHEN company_id = (SELECT company_id FROM profiles WHERE user_id = auth.uid()) 
        THEN '✓ Gehört zu deiner Firma'
        ELSE '✗ Andere Firma'
    END as firma_check
FROM employees
ORDER BY updated_at DESC;