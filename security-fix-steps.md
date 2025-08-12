# 🔒 Sicherheitsfixes - Schritt für Schritt

## Schritt 1: Kritischster Fix (SOFORT)
```sql
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
```

## Schritt 2: Employees Zugriff beschränken
```sql
CREATE POLICY "Users can view own employee data" ON employees
    FOR SELECT USING (user_id = auth.uid());
```

## Schritt 3: Anon-Zugriff entfernen
```sql
REVOKE ALL ON employees FROM anon;
```

## Schritt 4: Company Settings sichern
```sql
ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view company settings" ON company_settings
    FOR SELECT USING (auth.role() = 'authenticated');
```

## Schritt 5: Vacation Requests sichern
```sql
-- Alte unsichere Policy löschen
DROP POLICY IF EXISTS "All users can view vacation requests" ON vacation_requests;

-- Neue sichere Policy
CREATE POLICY "Users can view own vacation requests" ON vacation_requests
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM employees 
            WHERE employees.id = vacation_requests.employee_id 
            AND employees.user_id = auth.uid()
        )
    );
```

---

## 🚨 **Führe diese Schritte EINZELN aus:**

1. Gehe zu: https://supabase.com/dashboard/project/qgwhkjrhndeoskrxewpb/sql
2. Kopiere **EINEN** SQL-Block nach dem anderen
3. Führe jeden einzeln aus
4. Prüfe auf Fehler bevor du zum nächsten gehst

## ✅ **Nach jedem Schritt prüfen:**
- Gehe zu "Table Editor" → "employees" 
- Siehst du nur deine eigenen Daten? ✅
- Keine fremden Mitarbeiterdaten? ✅