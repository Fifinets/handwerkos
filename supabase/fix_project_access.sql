-- Dieses SQL-Script im Supabase Dashboard SQL Editor ausführen
-- Um zu prüfen und zu beheben, warum mobile Benutzer keine Projekte sehen

-- 1. Prüfen Sie zuerst, welche Projekte existieren
SELECT id, name, status, profile_id, company_id, created_at 
FROM projects;

-- 2. Prüfen Sie die aktuellen RLS Policies für projects
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'projects';

-- 3. Prüfen Sie, ob Ihr Benutzer eine Rolle hat
-- Ersetzen Sie 'YOUR_USER_ID' mit Ihrer tatsächlichen User ID
SELECT * FROM user_roles WHERE user_id = 'YOUR_USER_ID';

-- 4. Prüfen Sie Ihr Profil und company_id
-- Ersetzen Sie 'YOUR_USER_ID' mit Ihrer tatsächlichen User ID
SELECT * FROM profiles WHERE id = 'YOUR_USER_ID';

-- 5. OPTIONAL: Temporär eine permissive Policy hinzufügen (NUR FÜR TESTS!)
-- Diese Policy erlaubt allen authentifizierten Benutzern, Projekte zu sehen
-- WICHTIG: Nach dem Testen wieder entfernen!
CREATE POLICY "temp_allow_all_authenticated_users_view_projects"
ON public.projects
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- 6. Um die temporäre Policy wieder zu entfernen:
-- DROP POLICY "temp_allow_all_authenticated_users_view_projects" ON public.projects;

-- 7. Bessere Lösung: Sicherstellen, dass mobile Benutzer die richtige Rolle haben
-- Geben Sie dem mobilen Benutzer eine employee Rolle
-- Ersetzen Sie 'YOUR_USER_ID' mit der tatsächlichen User ID
INSERT INTO user_roles (user_id, role) 
VALUES ('YOUR_USER_ID', 'employee')
ON CONFLICT (user_id, role) DO NOTHING;

-- 8. Sicherstellen, dass Projekte eine company_id haben
-- Wenn Projekte keine company_id haben, setzen Sie eine
UPDATE projects 
SET company_id = (SELECT id FROM companies LIMIT 1)
WHERE company_id IS NULL;

-- 9. Sicherstellen, dass der Benutzer einer Company zugeordnet ist
-- Ersetzen Sie 'YOUR_USER_ID' mit der tatsächlichen User ID
UPDATE profiles 
SET company_id = (SELECT id FROM companies LIMIT 1)
WHERE id = 'YOUR_USER_ID' AND company_id IS NULL;