# Fix: Employee ID wird nicht gefunden

## Problem
Die Zeiterfassung schlägt fehl mit:
```
❌ NO EMPLOYEE RECORD FOUND!
❌ This user does not have an employee record in the database
```

## Ursache
Der Employee-Eintrag existiert in der Datenbank, aber die `user_id`-Verknüpfung fehlt (ist NULL).

## Lösung (5 Minuten)

### Schritt 1: Supabase öffnen
1. Gehe zu https://supabase.com/dashboard
2. Öffne dein Projekt: `handwerkos`
3. Klicke auf "SQL Editor" (links in der Navigation)

### Schritt 2: Debug-Skript ausführen
1. **Klicke "New Query"**
2. **Kopiere diesen Code ein:**

```sql
-- ============================================================================
-- DEBUG: Employee ID Problem
-- ============================================================================

-- 1. Zeige aktuellen User
SELECT
  'Current User' as check_type,
  id as user_id,
  email,
  created_at
FROM auth.users
WHERE id = auth.uid();

-- 2. Suche Employee nach Email
SELECT
  'Employee by Email' as check_type,
  e.id as employee_id,
  e.user_id,
  e.email as employee_email,
  e.company_id,
  CASE
    WHEN e.user_id IS NULL THEN '❌ user_id ist NULL - MUSS GEFIXT WERDEN!'
    WHEN e.user_id = auth.uid() THEN '✅ Korrekt verknüpft'
    ELSE '⚠️ Verknüpft mit anderem User'
  END as status
FROM employees e
CROSS JOIN auth.users u
WHERE u.id = auth.uid()
  AND LOWER(e.email) = LOWER(u.email);

-- 3. Alle Employees anzeigen (falls obiges leer ist)
SELECT
  'All Employees' as check_type,
  id as employee_id,
  user_id,
  email,
  first_name,
  last_name,
  company_id
FROM employees
ORDER BY created_at DESC
LIMIT 10;
```

3. **Klicke "Run" oder drücke Strg+Enter**

### Schritt 3: Ergebnis analysieren

Du siehst jetzt eine Tabelle mit Ergebnissen.

#### Fall A: Employee existiert, aber user_id ist NULL ❌

Wenn du siehst:
```
employee_id: xyz-123
user_id: NULL
status: ❌ user_id ist NULL - MUSS GEFIXT WERDEN!
```

**→ Dann führe diesen FIX aus:**

```sql
-- FIX: Verknüpfe Employee mit User
UPDATE employees
SET user_id = auth.uid()
WHERE LOWER(email) = LOWER((
  SELECT email FROM auth.users WHERE id = auth.uid()
))
AND user_id IS NULL;

-- Prüfe ob es funktioniert hat:
SELECT
  id as employee_id,
  user_id,
  email,
  '✅ GEFIXT!' as status
FROM employees
WHERE user_id = auth.uid();
```

#### Fall B: Kein Employee gefunden ❌

Wenn **alle Queries leer** sind (keine Ergebnisse), dann:

**→ Employee-Eintrag erstellen:**

```sql
-- Hole deine User-Daten
SELECT
  id as user_id,
  email,
  raw_user_meta_data
FROM auth.users
WHERE id = auth.uid();

-- Erstelle Employee-Eintrag
-- WICHTIG: Ersetze die Werte mit deinen echten Daten!
INSERT INTO employees (
  user_id,
  company_id,
  first_name,
  last_name,
  email,
  role,
  hourly_rate,
  vacation_days_total
)
VALUES (
  auth.uid(),                    -- Deine User-ID
  'DEINE_COMPANY_ID_HIER',       -- ⚠️ ANPASSEN! Hole von profiles Tabelle
  'Dein',                        -- Vorname
  'Name',                        -- Nachname
  (SELECT email FROM auth.users WHERE id = auth.uid()),  -- Email
  'technician',                  -- Rolle (oder 'manager', 'admin')
  25.00,                         -- Stundenlohn
  25                             -- Urlaubstage
);

-- Prüfe ob es funktioniert hat:
SELECT
  id as employee_id,
  user_id,
  email,
  company_id,
  '✅ ERSTELLT!' as status
FROM employees
WHERE user_id = auth.uid();
```

**Um deine company_id zu finden:**
```sql
SELECT
  id as user_id,
  company_id,
  role
FROM profiles
WHERE id = auth.uid();
```

### Schritt 4: App testen

1. **Schließe die App komplett** (nicht nur minimieren!)
2. **Öffne die App neu**
3. **Gehe zu Zeiterfassung**
4. **Starte ein Projekt**
5. **Stoppe nach 1 Minute**
6. **Prüfe die Console (F12)** - sollte jetzt sagen:
   ```
   ✅ Employee ID: xyz-123
   ✅ Company ID: abc-456
   ✅ Timesheet saved successfully
   ```

## Häufige Fehler

### "company_id ist NULL"
→ Du musst eine gültige company_id angeben beim Erstellen des Employees
→ Hole sie mit: `SELECT company_id FROM profiles WHERE id = auth.uid()`

### "foreign key violation"
→ Die angegebene company_id existiert nicht
→ Entweder eine Company erstellen oder eine existierende ID verwenden

### "duplicate key value"
→ Employee existiert bereits, aber mit anderer user_id
→ Nutze UPDATE statt INSERT

## Erfolgstest

Nach dem Fix sollte dieses Query ein Ergebnis zurückgeben:

```sql
SELECT
  e.id as employee_id,
  e.user_id,
  e.company_id,
  e.email,
  u.email as user_email,
  '✅ PERFEKT!' as status
FROM employees e
INNER JOIN auth.users u ON u.id = auth.uid()
WHERE e.user_id = auth.uid()
  AND LOWER(e.email) = LOWER(u.email);
```

Wenn du hier ein Ergebnis siehst, funktioniert die Zeiterfassung! 🎉

## Support

Falls weiterhin Probleme auftreten:
1. Screenshot vom SQL-Ergebnis machen
2. Console-Logs kopieren (F12)
3. Issue erstellen mit Details
