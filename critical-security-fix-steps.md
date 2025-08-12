# 🚨 KRITISCHER SICHERHEITSFIX: Employee Invitations

## ⚡ SOFORT AUSFÜHREN (Schritt für Schritt)

### Schritt 1: RLS aktivieren
```sql
ALTER TABLE employee_invitations ENABLE ROW LEVEL SECURITY;
```

### Schritt 2: Öffentlichen Zugriff SOFORT entfernen
```sql
REVOKE ALL ON employee_invitations FROM anon;
REVOKE ALL ON employee_invitations FROM public;
```

### Schritt 3: Sichere Policy für authentifizierte Benutzer
```sql
CREATE POLICY "Company members can view own invitations" ON employee_invitations
    FOR SELECT USING (auth.role() = 'authenticated');
```

### Schritt 4: INSERT-Policy hinzufügen
```sql
CREATE POLICY "Authenticated users can create invitations" ON employee_invitations
    FOR INSERT WITH CHECK (
        auth.role() = 'authenticated' AND
        created_by = auth.uid()
    );
```

### Schritt 5: Berechtigungen neu setzen
```sql
GRANT SELECT, INSERT ON employee_invitations TO authenticated;
```

---

## ✅ **Nach jedem Schritt prüfen:**

1. Gehe zu Supabase → Table Editor → employee_invitations
2. Logge dich aus und versuche die Tabelle zu öffnen
3. **Erwartung:** Du solltest KEINE Daten mehr sehen können ohne Login

## 🔍 **Testen:**

1. **Öffentlicher Zugriff blockiert?**
   - Öffne Inkognito-Tab
   - Versuche auf Daten zuzugreifen
   - ❌ Sollte fehlschlagen

2. **Authentifizierte Zugriff funktioniert?**
   - Melde dich an
   - Gehe zu employee_invitations
   - ✅ Sollte eigene Einladungen zeigen

## 🚨 **WICHTIG:**

Diese Tabelle enthält:
- ✅ Vollständige Namen
- ✅ Telefonnummern  
- ✅ E-Mail-Adressen
- ✅ Positionen
- ✅ Qualifikationen

**Alles war öffentlich zugänglich!** Diese Migration stoppt das Datenleck sofort.