-- ============================================
-- SCHRITT FÜR SCHRITT DEBUGGING
-- ============================================

-- 1. Teste auth.uid()
SELECT auth.uid() as current_auth_uid;

-- 2. Prüfe dein Profil mit auth.uid()
SELECT * FROM profiles WHERE id = auth.uid();

-- 3. Hole deine company_id
SELECT company_id FROM profiles WHERE id = auth.uid();

-- 4. Zähle alle Mitarbeiter
SELECT COUNT(*) as total_employees FROM employees;

-- 5. Zähle Mitarbeiter OHNE company_id
SELECT COUNT(*) as employees_without_company FROM employees WHERE company_id IS NULL;

-- 6. Zeige die ersten 5 Mitarbeiter
SELECT id, first_name, last_name, company_id, status FROM employees LIMIT 5;

-- 7. Versuche die company_id zu holen und zeige sie
DO $$
DECLARE
    v_company_id UUID;
BEGIN
    SELECT company_id INTO v_company_id FROM profiles WHERE id = auth.uid();
    RAISE NOTICE 'Deine company_id ist: %', v_company_id;
    
    IF v_company_id IS NULL THEN
        RAISE NOTICE 'WARNUNG: Du hast keine company_id!';
    END IF;
END $$;

-- 8. Zeige welche company_ids in der employees Tabelle existieren
SELECT DISTINCT company_id, COUNT(*) as anzahl 
FROM employees 
GROUP BY company_id;