# 🔍 SO LIEST DU DIE CONSOLE-LOGS

## 📋 SCHNELLANLEITUNG (2 Minuten)

### Schritt 1: Console öffnen

#### **Im Browser (Desktop):**
1. App im Browser öffnen
2. **F12** drücken (oder Rechtsklick → "Untersuchen")
3. Tab **"Console"** anklicken
4. Alles löschen (🚫 Symbol oder Ctrl+L)

#### **Auf Android (mit Chrome):**
1. Chrome auf PC öffnen
2. `chrome://inspect` in Adressleiste
3. Dein Gerät auswählen
4. Bei deiner App auf "inspect" klicken
5. Console-Tab öffnen

#### **Auf iOS (mit Safari):**
1. Safari auf Mac öffnen
2. Entwickler → Dein Gerät → App auswählen
3. Console öffnen

---

### Schritt 2: Zeiterfassung testen

1. **Zeiterfassung STARTEN** (irgendein Projekt)
2. **1 Minute warten**
3. **STOPPEN klicken**
4. **SOFORT in Console schauen!**

---

### Schritt 3: Logs identifizieren

Du siehst jetzt **viele Zeilen**. Suche nach diesen Symbolen:

#### ✅ **ERFOLG** (Alles OK):
```
🛑🛑🛑 stopTracking START
🛑 Loading set to true
🛑 activeEntryStr: {"id":"...","project_id":"..."}
🛑 Parsed active entry: {...}
🛑 Current time: ...
🛑 End time formatted: 14:30:00
🛑 Calculating hours from 14:00:00 to 14:30:00
🛑 Hours calculated: 0.5
🛑 Getting user...
✅ User ID: abc-123
🛑 Getting employee record...
✅ Employee ID: def-456
🛑 Saving to timesheets: {...}
✅ Timesheet saved successfully: {...}
🛑 Save successful, now clearing state...
🧹 Clearing state...
✅ State cleared
🛑 Refreshing time segments...
✅✅✅ stopTracking COMPLETE - SUCCESS
🛑 Setting loading to false
🛑🛑🛑 stopTracking END
```

**→ Wenn du das siehst: ALLES OK!** ✅

---

#### ❌ **FEHLER** (Etwas ist schief gelaufen):

Suche nach **roten Zeilen** mit ❌:

**Beispiel 1: Fehlende Startzeit**
```
❌ Missing start_time in activeEntry
🧹 Clearing state...
```
**→ Problem**: Korrupte Daten in localStorage
**→ Lösung**: LocalStorage löschen (siehe unten)

---

**Beispiel 2: Datenbank-Fehler**
```
❌ Error saving timesheet: {code: "42P01", message: "relation timesheets does not exist"}
🚨🚨🚨 EMERGENCY FALLBACK ACTIVATED
```
**→ Problem**: Tabelle existiert nicht
**→ Lösung**: Support kontaktieren (Migration nötig)

---

**Beispiel 3: Permission-Fehler**
```
❌ Error saving timesheet: {code: "42501", message: "permission denied for table timesheets"}
```
**→ Problem**: Keine Schreibberechtigung
**→ Lösung**: Support kontaktieren (RLS-Policy nötig)

---

**Beispiel 4: Employee nicht gefunden**
```
⚠️ Employee record not found, using user.id
❌ Error saving timesheet: {message: "foreign key violation"}
```
**→ Problem**: Kein Employee-Eintrag
**→ Lösung**: Support kontaktieren (Employee erstellen)

---

## 📸 Screenshot machen

### **WAS KOPIEREN:**

Mache einen Screenshot von der **GESAMTEN Console-Ausgabe** zwischen:
- `🛑🛑🛑 stopTracking START` (oben)
- `🛑🛑🛑 stopTracking END` (unten)

### **WIE:**
- **Windows**: Win + Shift + S
- **Mac**: Cmd + Shift + 4
- **Chrome**: Rechtsklick in Console → "Save as..."

---

## 🔧 Schnelle Selbst-Fixes

### **Fix 1: LocalStorage löschen**

**In Console eingeben:**
```javascript
localStorage.removeItem('activeTimeEntry')
localStorage.removeItem('activeBreak')
localStorage.removeItem('selectedProject')
location.reload()
```

---

### **Fix 2: Alle Daten anschauen**

**In Console eingeben:**
```javascript
console.log('Active Entry:', localStorage.getItem('activeTimeEntry'))
console.log('Active Break:', localStorage.getItem('activeBreak'))
```

Dann kannst du sehen, was gespeichert ist.

---

### **Fix 3: User ID checken**

**In Console eingeben:**
```javascript
import { supabase } from '@/integrations/supabase/client'

const { data: { user } } = await supabase.auth.getUser()
console.log('User:', user)

const { data: emp } = await supabase
  .from('employees')
  .select('*')
  .eq('user_id', user.id)
  .single()

console.log('Employee:', emp)
```

Falls `emp` null ist → Support kontaktieren!

---

## 📋 Checkliste für Support

Wenn du Support kontaktierst, schicke:

- [ ] Screenshot der Console (von START bis END)
- [ ] Browser/Gerät (z.B. "Chrome 120, Android 13")
- [ ] Genaue Fehlermeldung (rot, mit ❌)
- [ ] Was wurde gemacht? (Projekt gestartet, gestoppt, etc.)

---

## 🎯 Häufigste Fehler

### 1. **"relation timesheets does not exist"**
→ Datenbank-Tabelle fehlt
→ **Support kontaktieren**

### 2. **"permission denied for table timesheets"**
→ Keine Berechtigung
→ **Support kontaktieren**

### 3. **"foreign key violation"**
→ Employee-Eintrag fehlt
→ **Support kontaktieren**

### 4. **"Missing start_time in activeEntry"**
→ LocalStorage korrupt
→ **LocalStorage löschen** (siehe oben)

### 5. **"Failed to parse activeEntry"**
→ JSON korrupt
→ **LocalStorage löschen** (siehe oben)

---

## ✅ Nach dem Fix

1. LocalStorage gelöscht? → **App neu laden**
2. Support kontaktiert? → **Warten auf Antwort**
3. Alles OK? → **Nochmal testen!**

---

**Letzte Aktualisierung**: 2025-10-19
**Version**: v2.0 mit detailliertem Logging
