-- ============================================
-- SCHRITT 1: Erstelle Beispiel-Mitarbeiter
-- ============================================

DO $$
DECLARE
    v_company_id UUID;
BEGIN
    -- Hole die company_id vom aktuellen Benutzer
    SELECT company_id INTO v_company_id 
    FROM profiles 
    WHERE id = auth.uid();
    
    IF v_company_id IS NOT NULL THEN
        -- Füge Beispiel-Mitarbeiter ein (falls sie noch nicht existieren)
        INSERT INTO employees (
            id,
            company_id,
            first_name,
            last_name,
            email,
            phone,
            position,
            department,
            status,
            hire_date,
            created_at,
            updated_at
        ) VALUES 
        (
            gen_random_uuid(),
            v_company_id,
            'Max',
            'Mustermann',
            'max.mustermann@example.com',
            '+49 123 456789',
            'Projektleiter',
            'Projektmanagement',
            'active',
            CURRENT_DATE - INTERVAL '2 years',
            NOW(),
            NOW()
        ),
        (
            gen_random_uuid(),
            v_company_id,
            'Anna',
            'Schmidt',
            'anna.schmidt@example.com',
            '+49 123 456790',
            'Bauingenieurin',
            'Planung',
            'active',
            CURRENT_DATE - INTERVAL '1 year',
            NOW(),
            NOW()
        ),
        (
            gen_random_uuid(),
            v_company_id,
            'Thomas',
            'Weber',
            'thomas.weber@example.com',
            '+49 123 456791',
            'Elektriker',
            'Technik',
            'active',
            CURRENT_DATE - INTERVAL '3 years',
            NOW(),
            NOW()
        ),
        (
            gen_random_uuid(),
            v_company_id,
            'Julia',
            'Meyer',
            'julia.meyer@example.com',
            '+49 123 456792',
            'Architektin',
            'Planung',
            'active',
            CURRENT_DATE - INTERVAL '6 months',
            NOW(),
            NOW()
        ),
        (
            gen_random_uuid(),
            v_company_id,
            'Michael',
            'Wagner',
            'michael.wagner@example.com',
            '+49 123 456793',
            'Maurer',
            'Ausführung',
            'active',
            CURRENT_DATE - INTERVAL '5 years',
            NOW(),
            NOW()
        ),
        (
            gen_random_uuid(),
            v_company_id,
            'Lisa',
            'Becker',
            'lisa.becker@example.com',
            '+49 123 456794',
            'Sachbearbeiterin',
            'Verwaltung',
            'active',
            CURRENT_DATE - INTERVAL '1 year',
            NOW(),
            NOW()
        ),
        (
            gen_random_uuid(),
            v_company_id,
            'Peter',
            'Schulz',
            'peter.schulz@example.com',
            '+49 123 456795',
            'Installateur',
            'Technik',
            'active',
            CURRENT_DATE - INTERVAL '4 years',
            NOW(),
            NOW()
        ),
        (
            gen_random_uuid(),
            v_company_id,
            'Sarah',
            'Koch',
            'sarah.koch@example.com',
            '+49 123 456796',
            'Planerin',
            'Planung',
            'active',
            CURRENT_DATE - INTERVAL '2 years',
            NOW(),
            NOW()
        )
        ON CONFLICT (email) DO NOTHING;
        
        RAISE NOTICE 'Mitarbeiter erfolgreich erstellt für company_id: %', v_company_id;
    ELSE
        RAISE NOTICE 'Keine company_id gefunden. Bitte stellen Sie sicher, dass Ihr Benutzerprofil existiert.';
    END IF;
END $$;

-- ============================================
-- SCHRITT 2: Überprüfe die erstellten Mitarbeiter
-- ============================================

SELECT 
    id,
    first_name || ' ' || last_name as name,
    email,
    position,
    status,
    company_id
FROM employees
WHERE company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
ORDER BY created_at DESC;

-- ============================================
-- SCHRITT 3: Zeige Statistiken
-- ============================================

SELECT 
    'Gesamt Mitarbeiter' as info,
    COUNT(*) as anzahl
FROM employees
WHERE company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
UNION ALL
SELECT 
    'Aktive Mitarbeiter' as info,
    COUNT(*) as anzahl
FROM employees
WHERE company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
    AND (status = 'active' OR status = 'Active' OR status IS NULL)
UNION ALL
SELECT 
    'Bereits zugewiesene Mitarbeiter' as info,
    COUNT(DISTINCT ptm.employee_id) as anzahl
FROM project_team_members ptm
JOIN employees e ON e.id = ptm.employee_id
WHERE e.company_id = (SELECT company_id FROM profiles WHERE id = auth.uid());