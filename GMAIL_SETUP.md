# Gmail Integration Setup

## 1. Google Cloud Console Setup

1. Gehe zu [Google Cloud Console](https://console.cloud.google.com/)
2. Wähle dein Projekt oder erstelle ein neues
3. Aktiviere die Gmail API:
   - Gehe zu "APIs & Services" > "Library"
   - Suche nach "Gmail API"
   - Klicke "Enable"

## 2. OAuth Credentials erstellen

1. Gehe zu "APIs & Services" > "Credentials"
2. Klicke "Create Credentials" > "OAuth 2.0 Client IDs"
3. Wähle "Web application"
4. Füge diese Redirect URIs hinzu:
   ```
   https://qgwhkjrhndeoskrxewpb.supabase.co/functions/v1/complete-gmail-oauth
   ```
5. Notiere dir:
   - Client ID
   - Client Secret

## 3. Supabase Environment Variables setzen

Gehe zu deinem Supabase Dashboard > Settings > Edge Functions und füge hinzu:

```
GOOGLE_CLIENT_ID=deine_client_id_hier
GOOGLE_CLIENT_SECRET=dein_client_secret_hier
```

## 4. Datenbank-Tabellen

Die folgenden Tabellen sollten bereits existieren:
- `user_email_connections` - Gmail OAuth tokens
- `emails` - Gespeicherte E-Mails
- `email_categories` - E-Mail Kategorien
- `email_sync_settings` - Sync Einstellungen

## 5. Testen

Nach der Konfiguration:
1. Klicke auf "Gmail verbinden" 
2. Autorisiere den Zugriff
3. Klicke auf "Synchronisieren"

## Troubleshooting

- **403 Fehler**: Gmail API nicht aktiviert
- **400 Invalid Grant**: OAuth Credentials falsch
- **Redirect URI Mismatch**: URIs in Google Console überprüfen