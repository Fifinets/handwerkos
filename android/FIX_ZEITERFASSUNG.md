# Fix: "Fehler beim Beenden der Zeiterfassung"

## Problem
Die Zeiterfassung kann nicht beendet werden und zeigt den Fehler "Fehler beim Beenden der Zeiterfassung".

## Mögliche Ursachen

### 1. LocalStorage Problem
**Symptom**: Keine aktive Zeiterfassung in localStorage

**Lösung**:
```javascript
// In Browser-Konsole ausführen:
localStorage.getItem('activeTimeEntry')
// Wenn null → Problem gefunden

// Fix: LocalStorage löschen
localStorage.removeItem('activeTimeEntry')
localStorage.removeItem('activeBreak')
```

### 2. Datenbank-Berechtigungen
**Symptom**: Error enthält "permission denied" oder "RLS"

**Lösung**: Prüfe Supabase RLS Policies
```sql
-- Prüfe ob User timesheets schreiben kann
SELECT * FROM timesheets LIMIT 1;

-- Teste INSERT
INSERT INTO timesheets (employee_id, date, start_time, end_time, hours, is_billable)
VALUES ('your-employee-id', CURRENT_DATE, '08:00', '17:00', 8, true);
```

### 3. Fehlende employee_id
**Symptom**: Error enthält "employee" oder "foreign key"

**Lösung**:
```javascript
// Browser-Konsole:
import { supabase } from '@/integrations/supabase/client'

const { data: { user } } = await supabase.auth.getUser()
console.log('User ID:', user.id)

const { data: emp } = await supabase
  .from('employees')
  .select('id')
  .eq('user_id', user.id)
  .single()

console.log('Employee:', emp)

// Falls emp = null → Employee-Eintrag erstellen!
```

### 4. Schema-Problem
**Symptom**: Error enthält "column does not exist" oder "relation"

**Lösung**: Führe `check-database-schema.sql` aus

## Schnelle Diagnose

### Schritt 1: Browser öffnen
1. F12 drücken (Developer Tools)
2. Console-Tab öffnen

### Schritt 2: Debug-Skript ausführen
```javascript
// Kopiere und füge ein:
console.log('activeTimeEntry:', localStorage.getItem('activeTimeEntry'))

const entry = localStorage.getItem('activeTimeEntry')
if (entry) {
  const parsed = JSON.parse(entry)
  console.log('Parsed:', parsed)
  console.log('Start Time:', parsed.start_time)
  console.log('Project ID:', parsed.project_id)
}
```

### Schritt 3: Zeiterfassung stoppen (mit Logs)
1. Öffne Console (F12)
2. Klicke "Stopp"
3. Schaue Konsole an für Fehlermeldungen mit 🛑 oder ❌

**Beispiel-Logs (erfolgreich)**:
```
🛑 stopTracking called with notes: undefined
🛑 Active entry: {id: ..., project_id: ...}
🛑 End time: 17:00:00
🛑 Getting user...
✅ User ID: abc-123
🛑 Getting employee record...
✅ Employee ID: def-456
🛑 Saving to timesheets: {...}
✅ Timesheet saved successfully: {...}
```

**Beispiel-Logs (Fehler)**:
```
🛑 stopTracking called
🛑 Active entry: {...}
🛑 Getting user...
✅ User ID: abc-123
🛑 Getting employee record...
⚠️ Employee record not found, using user.id
🛑 Saving to timesheets: {...}
❌ Error saving timesheet: {code: "42P01", message: "relation timesheets does not exist"}
```

## Häufigste Fixes

### Fix 1: LocalStorage Reset
```javascript
// Browser Console
localStorage.removeItem('activeTimeEntry')
localStorage.removeItem('activeBreak')
localStorage.removeItem('selectedProject')
location.reload()
```

### Fix 2: Employee-Eintrag erstellen
```sql
-- Supabase SQL Editor
-- Ersetze 'YOUR_USER_ID' mit deiner auth.users.id
INSERT INTO employees (user_id, first_name, last_name, email, role)
VALUES (
  'YOUR_USER_ID',
  'Dein',
  'Name',
  'deine@email.com',
  'technician'
);
```

### Fix 3: RLS Policy hinzufügen
```sql
-- Supabase SQL Editor
-- Policy für timesheets INSERT
CREATE POLICY "Users can insert their own timesheets"
ON timesheets
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IN (
    SELECT user_id FROM employees WHERE id = employee_id
  )
);
```

## Verbessertes Logging

Die neue Version von `useTimeTracking.ts` enthält jetzt:
- 🛑 Detaillierte Logs für jeden Schritt
- ✅ Success-Meldungen
- ❌ Error-Details mit Code und Message
- ⚠️ Warnungen bei Fallback-Versuchen

**Wie verwenden:**
1. F12 → Console öffnen
2. "Stopp" klicken
3. Logs lesen
4. Screenshot machen bei Fehler
5. Support kontaktieren mit Screenshot

## Wichtige Dateien

- `/src/hooks/useTimeTracking.ts` - Hauptlogik (jetzt mit Logging)
- `/src/services/attendanceService.ts` - Arbeitstag-Verwaltung
- `/src/components/mobile/TodayScreen.tsx` - Mobile UI

## Support kontaktieren

Bei weiteren Problemen:
1. Screenshot der Console (F12)
2. Browser und Version
3. Zeitpunkt des Fehlers
4. Was wurde geklickt

**Logs exportieren:**
```javascript
// Browser Console
console.save = function(data, filename){
    const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'text/json'})
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename || 'console.json'
    a.click()
}

// Dann:
console.save(localStorage, 'localStorage.json')
```
