# Supabase Zugriff für Claude einrichten

## Option 1: Über Umgebungsvariablen (EMPFOHLEN)

1. Gehen Sie zu Ihrem Supabase Dashboard
2. Gehen Sie zu Settings → API
3. Kopieren Sie:
   - Project URL (z.B. https://xxxxx.supabase.co)
   - Anon/Public Key
   - Service Role Key (VORSICHT: Dieser hat vollen Zugriff!)

4. Erstellen Sie eine `.env` Datei im Projekt-Root:

```env
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## Option 2: Read-Only Datenbank-Benutzer

Erstellen Sie einen read-only Benutzer in Supabase:

```sql
-- Erstelle einen read-only Benutzer
CREATE USER readonly_claude WITH PASSWORD 'ein-sicheres-passwort';

-- Gebe Leserechte auf alle Tabellen
GRANT USAGE ON SCHEMA public TO readonly_claude;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO readonly_claude;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO readonly_claude;

-- Für zukünftige Tabellen
ALTER DEFAULT PRIVILEGES IN SCHEMA public 
GRANT SELECT ON TABLES TO readonly_claude;
```

## Option 3: Temporärer API Zugriff

Sie können mir temporär die Supabase URL und Anon Key geben. Diese sind relativ sicher, da sie durch RLS geschützt sind.

## Option 4: Database Connection String (Nur für Struktur-Analyse)

Gehen Sie zu Settings → Database → Connection String und kopieren Sie die Read-Only Verbindung.

---

## Was ich dann machen kann:

- Tabellen-Struktur analysieren
- Policies überprüfen
- Daten-Beziehungen verstehen
- Fehler in RLS-Policies finden
- Migrations schreiben
- Performance-Probleme identifizieren

## Sicherheitshinweise:

⚠️ NIEMALS den Service Role Key öffentlich teilen oder committen!
⚠️ Fügen Sie `.env` zu `.gitignore` hinzu
⚠️ Ändern Sie Passwörter nach der Fehlersuche