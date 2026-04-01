# Auto-Alerts System - Design Spec

## Ziel

Automatische Benachrichtigungen für Handwerksbetriebe bei Kapazitätsengpässen, nahenden Terminen und Team-Ausfällen. Alerts kommen In-App (Notification Bell) und via Browser Push. Nutzer können Alerts pro Kategorie konfigurieren.

## Architektur

```
Edge Function (Cron, alle 15 Min)
  ├── Kapazitäts-Checks
  ├── Termin-Checks
  └── Team-Checks
         │
         ▼
  notifications-Tabelle (Supabase)
         │
         ├── In-App: Notification Bell + Dropdown
         └── Push: Web Push API → Service Worker → Browser-Notification
```

## Datenbank

### Tabelle: `notifications`

| Spalte | Typ | Beschreibung |
|---|---|---|
| id | uuid, PK | |
| company_id | uuid, FK → companies | |
| user_id | uuid, FK → auth.users | Empfänger (null = alle Manager der Firma) |
| type | text | Alert-Typ (siehe unten) |
| category | text | `capacity` / `deadlines` / `team` |
| priority | text | `low` / `medium` / `high` / `urgent` |
| title | text | Kurzer Titel |
| body | text | Beschreibung |
| metadata | jsonb | Kontextdaten: project_id, employee_id, etc. |
| is_read | boolean, default false | |
| is_archived | boolean, default false | |
| created_at | timestamptz | |

**RLS:** User sieht nur Notifications seiner company_id. Insert nur via service_role (Edge Function).

**Deduplizierung:** Unique constraint auf `(company_id, type, metadata->>'entity_id', date_trunc('day', created_at))` — verhindert dass derselbe Alert am selben Tag mehrfach erzeugt wird.

### Tabelle: `notification_preferences`

| Spalte | Typ | Beschreibung |
|---|---|---|
| id | uuid, PK | |
| user_id | uuid, FK → auth.users | |
| category | text | `capacity` / `deadlines` / `team` |
| in_app_enabled | boolean, default true | |
| push_enabled | boolean, default true | |
| created_at | timestamptz | |

**Default:** Alle Kategorien aktiv. Wird beim ersten Zugriff automatisch erstellt.

### Tabelle: `push_subscriptions`

| Spalte | Typ | Beschreibung |
|---|---|---|
| id | uuid, PK | |
| user_id | uuid, FK → auth.users | |
| endpoint | text | Web Push endpoint URL |
| p256dh | text | Public key |
| auth | text | Auth secret |
| created_at | timestamptz | |

**Unique constraint:** `(user_id, endpoint)` — ein Endpoint pro User.

## Edge Function: notification-cron

Läuft alle 15 Minuten via Supabase Cron. Prüft für jede aktive Firma:

### Kategorie: Kapazität (`capacity`)

| Check | Type | Priority | Bedingung |
|---|---|---|---|
| MA überlastet | `capacity_overloaded` | high | MA hat >100% Auslastung diese Woche. 100% = Soll-Arbeitszeit aus company_settings (default_working_hours_start bis _end minus default_break_duration). Doppelbelegung (2+ Projekte am selben Tag) = automatisch >100%. |
| Projekt unterbesetzt | `capacity_understaffed` | medium | Projekt mit status `beauftragt`/`in_bearbeitung` hat 0 aktive team_assignments. |
| Engpass nächste Woche | `capacity_bottleneck` | high | Weniger als 50% der aktiven MA sind nächste Woche verfügbar (basierend auf Zuweisungen + Urlaub). |
| ArbZG-Verstoß | `capacity_arbzg` | urgent | MA hat >48h/Woche geplant. Berechnung: Anzahl zugewiesene Werktage × Soll-Stunden/Tag. |

### Kategorie: Termine (`deadlines`)

| Check | Type | Priority | Bedingung |
|---|---|---|---|
| Deadline naht | `deadline_approaching` | medium | Projekt-`end_date` oder `work_end_date` ist in ≤3 Werktagen. |
| Rechnung überfällig | `invoice_overdue` | high | Rechnung mit status `gesendet` und `due_date` < heute − 7 Tage. |
| Prüftermin fällig | `inspection_due` | medium | `inspection_devices.next_inspection_date` ≤ heute + 14 Tage. |

### Kategorie: Team (`team`)

| Check | Type | Priority | Bedingung |
|---|---|---|---|
| MA krank auf Projekt | `team_member_sick` | high | Genehmigte `vacation_request` mit `absence_type = 'sick'` für heute, und MA hat aktive Projektzuweisung. |
| Urlaubskonflikt | `team_vacation_conflict` | medium | Genehmigte Urlaubsanfrage überschneidet sich mit aktiver Projektzuweisung. |
| Neue Zuweisung | `team_assignment_created` | low | `project_team_assignments` mit `created_at` in den letzten 15 Minuten. |

### Ablauf pro Check

1. Query: Bedingung prüfen
2. Deduplizierung: Prüfen ob gleicher Alert heute schon existiert
3. User-Preferences: `notification_preferences` für die Kategorie prüfen
4. Insert: In `notifications`-Tabelle schreiben (falls in_app_enabled)
5. Push: Falls push_enabled, `push_subscriptions` des Users laden und Web Push senden

### Push-Versand

Die Edge Function sendet Push direkt via Web Push Protocol:
- VAPID-Keys aus Environment Variables (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`)
- Payload: `{ title, body, icon: '/logo-192.png', tag: type, data: { url: '/dashboard' } }`
- Tag verhindert doppelte Browser-Notifications

## Frontend

### NotificationBell (Header-Komponente)

Position: Rechts im Header neben dem User-Avatar (in `IndexV2.tsx`).

**Aussehen:**
- Bell-Icon (lucide `Bell`)
- Roter Badge mit Zahl wenn ungelesene > 0
- Klick öffnet Dropdown (Popover)

**Dropdown-Inhalt:**
- Header: "Benachrichtigungen" + "Alle gelesen" Button
- 3 Tabs: Alle / Kapazität / Termine / Team
- Scrollbare Liste der letzten 20 Notifications
- Jede Notification: Icon (nach Typ), Titel, Body-Preview, relative Zeit
- Klick auf Notification: markiert als gelesen + navigiert zur relevanten Seite (via metadata.url)
- Leer-State: "Keine neuen Benachrichtigungen"

**Daten:** React Query Hook `useNotifications()` mit Polling alle 60 Sekunden + Realtime-Subscription auf `notifications`-Tabelle.

### NotificationSettings (in CompanySettings)

Neue Section "Benachrichtigungen" in `CompanySettingsSimple.tsx`:

- 3 Zeilen (Kapazität / Termine / Team)
- Pro Zeile: Kategorie-Name + Beschreibung + Toggle In-App + Toggle Push
- Push-Toggle löst Browser-Permission-Request aus wenn erstmalig aktiviert
- "Push-Benachrichtigungen testen" Button

### useNotifications Hook

```typescript
// src/hooks/useNotifications.ts
export function useNotifications() {
  // Queries: unreadCount, notifications (paginated)
  // Mutations: markAsRead, markAllAsRead, archiveNotification
  // Realtime: subscribe to notifications table INSERT for companyId
}
```

### Push-Registration

Bestehender `pushNotificationService.ts` wird erweitert:
- `registerPushSubscription()`: Subscription in `push_subscriptions` speichern
- `unregisterPushSubscription()`: Subscription aus Tabelle löschen
- Service Worker (`sw.js`): `push` Event-Handler zeigt Notification, `notificationclick` öffnet URL aus payload

## Bestehende Infrastruktur die genutzt wird

| Was | Wo | Status |
|---|---|---|
| notificationService.ts | src/services/ | Existiert, Typen + Methoden vorhanden |
| pushNotificationService.ts | src/services/ | Existiert, Service Worker Integration |
| notification-cron Edge Function | supabase/functions/ | Existiert, 3 Check-Module (invoices, inspections, projects) |
| NotificationFilters.tsx | src/components/notifications/ | Existiert, Kategorie-Filter UI |
| eventBus.ts | src/services/ | Existiert, NOTIFICATION_CREATED Event |
| CompanySettingsSimple.tsx | src/components/ | Existiert, Arbeitszeiten-Einstellungen vorhanden |
| Company Settings (DB) | companies Tabelle | default_working_hours_start/end, default_break_duration |

## Nicht im Scope

- E-Mail-Notifications (späterer Ausbau)
- Telegram-Integration (späterer Ausbau)
- SMS-Notifications
- Notification-History/Analytics Dashboard
- Slack-Integration
