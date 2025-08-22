-- ============================================
-- FIX: Employee RLS Permissions Problem
-- ============================================

-- 1. Prüfe aktuelle RLS Policies für employees
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies 
WHERE tablename = 'employees';

-- 2. Prüfe ob RLS auf employees Tabelle aktiviert ist
SELECT schemaname, tablename, rowsecurity, forcerowsecurity 
FROM pg_tables 
WHERE tablename = 'employees';

-- 3. Deaktiviere RLS temporär für employees (NUR ZUM TESTEN!)
ALTER TABLE employees DISABLE ROW LEVEL SECURITY;

-- 4. Erstelle eine permissive Policy für alle authenticated users
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON employees;
CREATE POLICY "Allow all operations for authenticated users" 
ON employees 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- 5. Reaktiviere RLS
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

-- 6. Prüfe ob die Policy funktioniert
SELECT 
    'Test: Mitarbeiter abrufbar?' as test,
    COUNT(*) as anzahl_mitarbeiter
FROM employees;

-- 7. Erstelle eine bessere Policy basierend auf company_id (später)
-- Kommentiert aus, bis wir sicher sind dass die Grundfunktion läuft
/*
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON employees;
CREATE POLICY "Users can access employees in their company" 
ON employees 
FOR ALL 
TO authenticated 
USING (
    company_id IN (
        SELECT company_id 
        FROM profiles 
        WHERE id = auth.uid()
    )
) 
WITH CHECK (
    company_id IN (
        SELECT company_id 
        FROM profiles 
        WHERE id = auth.uid()
    )
);
*/