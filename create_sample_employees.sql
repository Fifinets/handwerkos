-- Create sample employees if none exist
-- IMPORTANT: First, get your company_id from the profiles table

-- Step 1: Check your company_id
SELECT id, company_id, email FROM profiles WHERE id = auth.uid();

-- Step 2: Replace 'YOUR_COMPANY_ID' with your actual company_id from Step 1
-- Then run this to create sample employees:

DO $$
DECLARE
    v_company_id UUID;
BEGIN
    -- Get the company_id from the current user's profile
    SELECT company_id INTO v_company_id 
    FROM profiles 
    WHERE id = auth.uid();
    
    IF v_company_id IS NOT NULL THEN
        -- Insert sample employees if they don't exist
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
        )
        ON CONFLICT (email) DO NOTHING;
        
        RAISE NOTICE 'Sample employees created successfully for company_id: %', v_company_id;
    ELSE
        RAISE NOTICE 'No company_id found for current user. Please ensure user profile exists.';
    END IF;
END $$;

-- Verify the employees were created
SELECT 
    id,
    first_name,
    last_name,
    email,
    position,
    status,
    company_id
FROM employees
WHERE company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
ORDER BY created_at DESC;