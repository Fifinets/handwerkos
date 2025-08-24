-- ============================================
-- PRÜFE UND KORRIGIERE COMPANY_ID PROBLEM
-- ============================================

-- 1. Zeige deine User ID und company_id
SELECT 
    'Dein Profil:' as info,
    user_id,
    company_id,
    email
FROM profiles 
WHERE user_id = auth.uid();

-- 2. Falls du keine company_id hast, erstelle eine
DO $$
DECLARE
    v_company_id UUID;
BEGIN
    -- Prüfe ob der User eine company_id hat
    SELECT company_id INTO v_company_id
    FROM profiles
    WHERE user_id = auth.uid();
    
    IF v_company_id IS NULL THEN
        -- Erstelle eine neue company_id
        v_company_id := gen_random_uuid();
        
        -- Update das Profil mit der neuen company_id
        UPDATE profiles
        SET company_id = v_company_id
        WHERE user_id = auth.uid();
        
        RAISE NOTICE 'Neue company_id erstellt: %', v_company_id;
    ELSE
        RAISE NOTICE 'Company_id existiert bereits: %', v_company_id;
    END IF;
END $$;

-- 3. Zeige nochmal dein Profil
SELECT 
    'Dein Profil NACH Update:' as info,
    user_id,
    company_id,
    email
FROM profiles 
WHERE user_id = auth.uid();

-- 4. Weise ALLE Mitarbeiter deiner Firma zu
UPDATE employees
SET 
    company_id = (SELECT company_id FROM profiles WHERE user_id = auth.uid()),
    status = COALESCE(status, 'active'),
    updated_at = NOW()
WHERE company_id IS NULL 
   OR company_id != (SELECT company_id FROM profiles WHERE user_id = auth.uid());

-- 5. Zeige die Mitarbeiter deiner Firma
SELECT 
    'Anzahl Mitarbeiter in deiner Firma:' as info,
    COUNT(*) as anzahl
FROM employees
WHERE company_id = (SELECT company_id FROM profiles WHERE user_id = auth.uid());

-- 6. Liste die Mitarbeiter auf
SELECT 
    id,
    first_name,
    last_name,
    email,
    status,
    position
FROM employees
WHERE company_id = (SELECT company_id FROM profiles WHERE user_id = auth.uid())
ORDER BY created_at DESC;