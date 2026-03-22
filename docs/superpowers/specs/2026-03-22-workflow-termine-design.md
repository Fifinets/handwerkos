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

### Status-Migration

**Aktueller `ProjectStatus` Typ** in `src/types/project.ts`:
```
'anfrage' | 'besichtigung' | 'geplant' | 'in_bearbeitung' | 'abgeschlossen'
```

**Neuer `ProjectStatus` Typ:**
```
'anfrage' | 'besichtigung' | 'angebot' | 'beauftragt' | 'in_bearbeitung' | 'abgeschlossen'
```

Änderungen:
- `geplant` wird entfernt und durch `angebot` + `beauftragt` ersetzt
- `in_planung`, `abnahme`, `angebot_versendet` bleiben in der DB-Constraint (Abwärtskompatibilität), werden aber nicht im Workflow-Balken angezeigt
- `angebot_versendet` wird im UI auf `angebot` gemappt (existierendes Mapping in ProjectDetailView Zeile 1117 bleibt erhalten)

**Migration bestehender Daten:**
```sql
UPDATE projects SET status = 'beauftragt' WHERE status = 'geplant';
UPDATE projects SET status = 'in_bearbeitung' WHERE status = 'in_planung';
UPDATE projects SET status = 'abgeschlossen' WHERE status = 'abnahme';
```

### Kleinauftrag-Projekte

Projekte mit `project_type = 'kleinauftrag'` zeigen keinen Workflow-Balken (bestehendes Verhalten). Die Termin-Spalten werden trotzdem auf der `projects` Tabelle hinzugefügt. Kleinaufträge können Termine im Details-Tab über die Termin-Karten verwalten, auch ohne sichtbaren Workflow-Balken.

## Datenbank

### Migration: Neue Spalten auf `projects`

```sql
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS besichtigung_date DATE,
  ADD COLUMN IF NOT EXISTS besichtigung_time_start TIME,
  ADD COLUMN IF NOT EXISTS besichtigung_time_end TIME,
  ADD COLUMN IF NOT EXISTS besichtigung_employee_id UUID REFERENCES employees(id),
  ADD COLUMN IF NOT EXISTS besichtigung_calendar_event_id UUID REFERENCES calendar_events(id),
  ADD COLUMN IF NOT EXISTS work_start_date DATE,
  ADD COLUMN IF NOT EXISTS work_end_date DATE,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- Verknüpfung Kalender → Projekt
ALTER TABLE calendar_events
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id);
```

Nach der Migration: `npx supabase gen types typescript --local > src/integrations/supabase/types.ts` ausführen um die generierten Typen zu aktualisieren.

Keine separate `workflow_stage_appointments` Tabelle nötig — es gibt maximal einen Termin pro Phase, daher reichen Spalten auf `projects`.

### Calendar-Event Integration

**Erstellen:** Wenn ein Besichtigungstermin gesetzt wird:
```sql
INSERT INTO calendar_events (title, start_date, end_date, start_time, end_time, type, company_id, project_id, assigned_employees)
VALUES ('Besichtigung: {project.name}', besichtigung_date, besichtigung_date,
        besichtigung_time_start, besichtigung_time_end, 'besichtigung', company_id, project_id,
        ARRAY[besichtigung_employee_id])
RETURNING id;
-- Dann: UPDATE projects SET besichtigung_calendar_event_id = returned_id
```

**Aktualisieren:** Wenn Besichtigungstermin geändert wird → `UPDATE calendar_events WHERE id = besichtigung_calendar_event_id`.

**Löschen:** Wenn Besichtigungstermin entfernt wird → `DELETE FROM calendar_events WHERE id = besichtigung_calendar_event_id`, dann `UPDATE projects SET besichtigung_calendar_event_id = NULL`.

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
- Klick auf eine Stufe: Öffnet Statuswechsel-Dialog
- Datum-Zeile wird auf Mobile (`< sm`) ausgeblendet (`hidden sm:flex`)

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
- Nur Besichtigung und In Arbeit werden hier gezeigt

### 3. Statuswechsel-Dialog

**Datei:** `src/components/WorkflowStatusDialog.tsx` (neu)

Alle Statuswechsel laufen jetzt über diesen Dialog. Er zeigt kontextabhängig verschiedene Felder:

**Wechsel zu "Besichtigung":**
- Datum (Pflichtfeld)
- Uhrzeit von (Pflichtfeld)
- Uhrzeit bis (optional)
- Mitarbeiter (Select, Pflichtfeld)
- "Ohne Termin fortfahren" Link — Status wird trotzdem gewechselt, Termin kann im Details-Tab nachgetragen werden. Im Workflow-Balken erscheint unter Besichtigung dann "Kein Termin" als Platzhalter.

**Wechsel zu "In Arbeit":**
- Baustart-Datum (Pflichtfeld)
- Geplantes Ende (optional)

**Wechsel zu "Fertig":**
- Setzt `completed_at = now()` automatisch
- Bestätigungs-Dialog: "Projekt als abgeschlossen markieren?"

**Wechsel zu "Angebot" / "Beauftragt":**
- Bestätigungs-Dialog: "Status zu {Stufe} ändern?"
- Kein extra Feld, nur Bestätigen/Abbrechen

**Termin bearbeiten (aus Details-Tab):**
- Gleicher Dialog, aber ohne Status-Wechsel
- Titel: "Besichtigungstermin bearbeiten" / "Baustart bearbeiten"
- Nur Termin-Felder, kein Status-Button

## Datenfluss

```
User klickt Workflow-Stufe
  → WorkflowStatusDialog öffnet sich (mit Status + ggf. Termin-Felder)
    → User füllt aus + bestätigt
      → Supabase UPDATE projects SET status, besichtigung_date, etc.
      → Falls Besichtigung mit Termin: calendar_events UPSERT via besichtigung_calendar_event_id
      → Toast: "Status geändert" / "Status geändert + Termin gespeichert"
      → UI refresht (loadProject)

User klickt "Bearbeiten" auf Termin-Karte im Details-Tab
  → WorkflowStatusDialog öffnet sich (editMode=true, kein Status-Wechsel)
  → Nur Termin-Felder werden angezeigt und aktualisiert
  → Calendar-Event wird aktualisiert/erstellt/gelöscht je nach Änderung
```

## Typen (TypeScript)

In `src/types/project.ts`:

```typescript
// ProjectStatus aktualisiert
export type ProjectStatus = 'anfrage' | 'besichtigung' | 'angebot' | 'beauftragt' | 'in_bearbeitung' | 'abgeschlossen';

// Lineare Workflow-Reihenfolge (ersetzt nextStates-Ansatz für den Workflow-Balken)
export const WORKFLOW_STAGES: ProjectStatus[] = [
  'anfrage', 'besichtigung', 'angebot', 'beauftragt', 'in_bearbeitung', 'abgeschlossen'
];

// PROJECT_STATUS_CONFIG wird aktualisiert:
// - `geplant` entfernt
// - `angebot` und `beauftragt` hinzugefügt
// - nextStates werden aus WORKFLOW_STAGES abgeleitet (immer linear: aktuelle + 1)
```

`ProjectWorkflowDates` wird nicht als separates Interface erstellt — die Felder werden direkt in der bestehenden Projekt-Datenstruktur mitgeführt (kommen automatisch aus dem Supabase Select).

## Betroffene Dateien

| Datei | Änderung |
|-------|----------|
| Supabase Migration | Neue Spalten + Daten-Migration (`geplant` → `beauftragt`) + calendar_events.project_id |
| `src/integrations/supabase/types.ts` | Regenerieren nach Migration |
| `src/types/project.ts` | `ProjectStatus` erweitern, `PROJECT_STATUS_CONFIG` aktualisieren, `WORKFLOW_STAGES` hinzufügen, `geplant` entfernen |
| `src/types/core.ts` | `ProjectStatus` Zod-Schema erweitern |
| `src/components/ProjectDetailView.tsx` | Workflow-Balken + Datum-Zeile, Termine-Sektion im Details-Tab, `handleStatusChange` → Dialog öffnen |
| `src/components/WorkflowStatusDialog.tsx` | **Neu** — Statuswechsel-Dialog mit kontextabhängigen Termin-Feldern |
| `src/components/ProjectModuleV2.tsx` | Status-Filter und Status-Farben aktualisieren (geplant → beauftragt) |
| `src/components/projects/StatusList.tsx` | Status-Counts aktualisieren |
| `src/services/WorkflowService.ts` | `createProjectFromOrder`: `geplant` → `beauftragt` |
| `src/components/AddProjectDialog.tsx` | Status-Optionen aktualisieren |

## Nicht im Scope

- Google Calendar Sync (kommt später)
- Push-Benachrichtigungen für anstehende Termine
- Recurring Termine (Besichtigung ist einmalig)
- Drag & Drop im Workflow-Balken
- Änderungen an `EditProjectDialog.tsx` (Status wird nur noch über Workflow-Dialog geändert)
