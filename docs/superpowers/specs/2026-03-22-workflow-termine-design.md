# Workflow-Termine Design Spec

## Problem

Das Projekt-Workflow-System (Anfrage → Besichtigung → Angebot → Beauftragt → In Arbeit → Fertig) zeigt aktuell nur den Status an. Es gibt keine Möglichkeit, Termine für die einzelnen Phasen zu setzen — z.B. wann die Besichtigung stattfindet oder wann der Baustart ist.

## Entscheidungen

- **Trigger:** Beides — Dialog beim Statuswechsel bietet Termin an + nachträglich im Details-Tab editierbar
- **Darstellung:** Option C — Termine unter dem Workflow-Balken + editierbare Karten im Details-Tab
- **Workflow vereinfacht:** 6 Stufen (Planung und Abnahme entfernt)
- **Google Calendar:** Kommt später (nicht Teil dieser Spec)

## Workflow-Stufen & Termin-Typen

| Stufe | Status-Key | Termin-Typ | Felder |
|-------|-----------|------------|--------|
| Anfrage | `anfrage` | Auto | `created_at` (existiert bereits) |
| Besichtigung | `besichtigung` | Voller Termin | Datum, Uhrzeit von/bis, zuständiger Mitarbeiter |
| Angebot | `angebot` | Kein Datum | Nur Statuswechsel |
| Beauftragt | `beauftragt` | Kein Datum | Nur Statuswechsel |
| In Arbeit | `in_bearbeitung` | Baustart | Start-Datum, geplantes End-Datum |
| Fertig | `abgeschlossen` | Auto | `completed_at` wird beim Statuswechsel gesetzt |

Entfernte Stufen: `in_planung`, `abnahme`, `angebot_versendet`, `storniert` werden aus `PROJECT_STATUS_CONFIG.nextStates` und dem Workflow-Balken entfernt. Die Status-Werte bleiben in der DB-Constraint erhalten (Abwärtskompatibilität), werden aber im UI nicht mehr als Workflow-Schritt angezeigt.

## Datenbank

### Migration: Neue Spalten auf `projects`

```sql
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS besichtigung_date DATE,
  ADD COLUMN IF NOT EXISTS besichtigung_time_start TIME,
  ADD COLUMN IF NOT EXISTS besichtigung_time_end TIME,
  ADD COLUMN IF NOT EXISTS besichtigung_employee_id UUID REFERENCES employees(id),
  ADD COLUMN IF NOT EXISTS work_start_date DATE,
  ADD COLUMN IF NOT EXISTS work_end_date DATE,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
```

Keine separate `workflow_stage_appointments` Tabelle nötig — es gibt maximal einen Termin pro Phase, daher reichen Spalten auf `projects`.

### Calendar-Event Integration

Wenn ein Besichtigungstermin gesetzt wird, wird automatisch ein `calendar_events` Eintrag erstellt/aktualisiert:

```sql
INSERT INTO calendar_events (title, start_date, end_date, start_time, end_time, type, company_id, assigned_employees)
VALUES ('Besichtigung: {project.name}', besichtigung_date, besichtigung_date,
        besichtigung_time_start, besichtigung_time_end, 'besichtigung', company_id,
        ARRAY[besichtigung_employee_id]);
```

Ein neues Feld `project_id UUID REFERENCES projects(id)` wird auf `calendar_events` hinzugefügt, damit Kalender-Einträge mit Projekten verknüpft werden können.

## UI-Komponenten

### 1. Erweiterter Workflow-Balken

**Datei:** `src/components/ProjectDetailView.tsx` (bestehender Workflow-Balken)

Der existierende Workflow-Balken wird erweitert um eine zweite Zeile unter den Stufen, die Termine anzeigt:

```
┌─────────┬─────────────┬─────────┬───────────┬───────────┬────────┐
│ Anfrage │ Besichtigung│ Angebot │ Beauftragt│ In Arbeit │ Fertig │
├─────────┼─────────────┼─────────┼───────────┼───────────┼────────┤
│ 15.03.  │ 18.03. 10:00│  Heute  │     —     │     —     │   —    │
│         │  Max M.     │         │           │           │        │
└─────────┴─────────────┴─────────┴───────────┴───────────┴────────┘
```

- Abgeschlossene Stufen: Grüner Hintergrund, Datum darunter
- Aktive Stufe: Blauer Hintergrund mit Ring
- Zukünftige Stufen: Grauer Hintergrund, "—" oder Termin falls gesetzt
- Klick auf eine Stufe: Öffnet Statuswechsel-Dialog (mit Termin-Feldern falls relevant)

### 2. Details-Tab — Termine-Sektion

**Datei:** `src/components/ProjectDetailView.tsx` (Details-Tab erweitern)

Neue Sektion im bestehenden Details-Tab, unter den Projektdetails:

```
┌─ Termine ──────────────────────────────────────────────┐
│                                                         │
│  ┌─ Besichtigung ──────┐  ┌─ In Arbeit ───────────┐   │
│  │ 📅 18.03.2026       │  │  ┌──────────────────┐  │   │
│  │ 🕐 10:00 – 11:30    │  │  │  + Baustart      │  │   │
│  │ 👤 Max Müller       │  │  │    festlegen     │  │   │
│  │        [Bearbeiten] │  │  └──────────────────┘  │   │
│  └─────────────────────┘  └────────────────────────┘   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

- 2 Karten nebeneinander (`grid-cols-2`)
- Gefüllte Karte: Datum, Uhrzeit, Mitarbeiter + "Bearbeiten"-Button
- Leere Karte: Dashed Border, Klick öffnet Termin-Dialog
- Nur Besichtigung und In Arbeit werden hier gezeigt (Anfrage/Fertig sind auto, Angebot/Beauftragt haben kein Datum)

### 3. Statuswechsel-Dialog (erweitert)

**Datei:** Neuer Dialog oder Erweiterung des bestehenden Status-Wechsel-Mechanismus

Der Dialog wird kontextabhängig erweitert:

**Wechsel zu "Besichtigung":**
- Datum (Pflichtfeld)
- Uhrzeit von (Pflichtfeld)
- Uhrzeit bis (optional)
- Mitarbeiter (Select, Pflichtfeld)
- "Überspringen" Link falls kein Termin sofort nötig

**Wechsel zu "In Arbeit":**
- Baustart-Datum (Pflichtfeld)
- Geplantes Ende (optional)

**Wechsel zu "Fertig":**
- Setzt `completed_at = now()` automatisch
- Bestätigungs-Dialog: "Projekt als abgeschlossen markieren?"

**Wechsel zu "Angebot" / "Beauftragt":**
- Normaler Status-Wechsel ohne zusätzliche Felder

## Datenfluss

```
User klickt Workflow-Stufe
  → Statuswechsel-Dialog öffnet sich
    → Falls Besichtigung/In Arbeit: Termin-Felder werden angezeigt
      → User füllt aus + bestätigt
        → Supabase UPDATE projects SET status, besichtigung_date, etc.
        → Falls Besichtigung: calendar_events INSERT/UPDATE
        → Toast: "Status geändert + Termin gespeichert"
        → UI refresht

User klickt "Bearbeiten" auf Termin-Karte im Details-Tab
  → Gleicher Dialog öffnet sich (ohne Status-Wechsel)
  → Nur Termin-Felder werden aktualisiert
```

## Typen (TypeScript)

```typescript
// Erweiterte Project-Felder
interface ProjectWorkflowDates {
  besichtigung_date: string | null;
  besichtigung_time_start: string | null;
  besichtigung_time_end: string | null;
  besichtigung_employee_id: string | null;
  work_start_date: string | null;
  work_end_date: string | null;
  completed_at: string | null;
}

// Workflow-Stufen Config (vereinfacht)
const WORKFLOW_STAGES = [
  'anfrage', 'besichtigung', 'angebot', 'beauftragt', 'in_bearbeitung', 'abgeschlossen'
] as const;
```

## Betroffene Dateien

| Datei | Änderung |
|-------|----------|
| Supabase Migration | Neue Spalten + calendar_events.project_id |
| `src/types/project.ts` | `PROJECT_STATUS_CONFIG.nextStates` vereinfachen, `WORKFLOW_STAGES` exportieren |
| `src/components/ProjectDetailView.tsx` | Workflow-Balken erweitern + Termine-Sektion im Details-Tab |
| `src/components/WorkflowStatusDialog.tsx` | Neuer Dialog für Statuswechsel mit Termin-Feldern |
| `src/types/core.ts` | Ggf. Supabase Select-Query erweitern um neue Spalten |

## Nicht im Scope

- Google Calendar Sync (kommt später)
- Push-Benachrichtigungen für anstehende Termine
- Recurring Termine (Besichtigung ist einmalig)
- Drag & Drop im Workflow-Balken
