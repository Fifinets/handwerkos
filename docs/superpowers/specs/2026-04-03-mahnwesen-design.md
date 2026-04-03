# Zahlungserinnerungen & Mahnwesen - Design Spec

## Ziel

Automatische Mahnstufen-Berechnung für überfällige Rechnungen. Manueller oder automatischer Versand von Zahlungserinnerungen per E-Mail. Konfigurierbar in den Firmeneinstellungen.

## Mahnstufen

| Stufe | Tage nach Fälligkeit | Bezeichnung | Ton |
|---|---|---|---|
| 0 | 0 | Fällig | Neutral |
| 1 | 3+ Tage | Zahlungserinnerung | Freundlich |
| 2 | 14+ Tage | 1. Mahnung | Bestimmt |
| 3 | 28+ Tage | 2. Mahnung | Nachdrücklich |

## Datenbank

### Tabelle `invoices` erweitern

| Neue Spalte | Typ | Beschreibung |
|---|---|---|
| reminder_level | integer, default 0 | Aktuelle Mahnstufe (0-3) |
| last_reminder_sent_at | timestamptz | Wann zuletzt Mahnung gesendet |
| reminder_count | integer, default 0 | Anzahl gesendeter Mahnungen |

### Tabelle `company_settings` erweitern

| Neue Spalte | Typ | Beschreibung |
|---|---|---|
| auto_reminders_enabled | boolean, default false | Automatischer Mahnversand an/aus |
| reminder_days_1 | integer, default 3 | Tage bis Zahlungserinnerung |
| reminder_days_2 | integer, default 14 | Tage bis 1. Mahnung |
| reminder_days_3 | integer, default 28 | Tage bis 2. Mahnung |

## Edge Function: Mahnstufen-Update

Die bestehende `notification-cron/checks/invoices.ts` wird erweitert:
- Berechnet Mahnstufe basierend auf `due_date` + konfigurierte Tage
- Updated `reminder_level` auf der Rechnung
- Wenn `auto_reminders_enabled`: sendet Mahnung automatisch per E-Mail via bestehende `send-document-email` Edge Function

## Frontend

### InvoiceDetailDialog — Mahnung-Badge + Button

- Badge neben Status zeigt Mahnstufe: "Zahlungserinnerung" (gelb), "1. Mahnung" (orange), "2. Mahnung" (rot)
- Button "Mahnung senden" — sendet Mahnungs-E-Mail an Kunden
- Dropdown am Button: Stufe wählen (Erinnerung / 1. Mahnung / 2. Mahnung)

### CompanySettingsSimple — Mahnwesen-Einstellungen

Neue Section nach Benachrichtigungen:
- Toggle "Automatischer Mahnversand"
- 3 Felder: Tage für Erinnerung / 1. Mahnung / 2. Mahnung

### Rechnungsliste — Überfällige hervorheben

Rechnungen mit `reminder_level > 0` bekommen farbigen Badge in der Liste.

## Dateien

### Zu modifizieren:
- `supabase/functions/notification-cron/checks/invoices.ts` — Mahnstufe berechnen + auto-senden
- `src/components/InvoiceDetailDialog.tsx` — Badge + "Mahnung senden" Button
- `src/components/CompanySettingsSimple.tsx` — Mahnwesen-Einstellungen

## Nicht im Scope

- Mahngebühren/Verzugszinsen berechnen
- Inkasso-Übergabe
- Postalischer Mahnversand (Brief)
- Mahnungs-PDF (erstmal nur E-Mail-Text)
