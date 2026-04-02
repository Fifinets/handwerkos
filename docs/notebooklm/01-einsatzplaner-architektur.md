# Einsatzplaner - Architektur & Komponenten

## Übersicht

Der Einsatzplaner (intern "PlannerModuleV2") ist das zentrale Ressourcenplanungs-Modul von HandwerkOS. Er ermöglicht die Zuordnung von Mitarbeitern zu Projekten, Urlaubs-/Krankheitsverwaltung und Konflikterkennung über eine kalenderbasierte Oberfläche.

## Hauptkomponente

**PlannerModuleV2.tsx** (~1.700 Zeilen) - Monolithische Komponente mit gesamter Logik:
- Pfad: `src/components/PlannerModuleV2.tsx`
- Einstiegspunkt: `src/pages/IndexV2.tsx` → case 'planner'
- Navigation: `AppSidebarV2.tsx` → "Planer" (Calendar-Icon)

## Architektur-Übersicht

```
UI Layer (React + shadcn/ui)
    ↓
PlannerModuleV2 (lokaler State via useState)
    ↓
Supabase Client (supabase.from('table').select/insert/update)
    ↓
PostgreSQL (RLS-geschützt, company_id Filterung)
```

## Beteiligte Dateien

### Frontend-Komponenten
| Datei | Zweck |
|-------|-------|
| `src/components/PlannerModuleV2.tsx` | Hauptkomponente: Kalender, Drag-Drop, Dialoge |
| `src/components/VacationManagement.tsx` | Urlaubsanträge verwalten |
| `src/components/EditProjectDialog.tsx` | Projekt bearbeiten mit Team-Zuweisung |
| `src/components/AddProjectDialog.tsx` | Neues Projekt anlegen |
| `src/components/ProjectModuleV2.tsx` | Projektliste und -verwaltung |
| `src/components/PersonalModuleV2.tsx` | Mitarbeiterverwaltung |
| `src/components/DashboardStats.tsx` | Dashboard-Widget "Einsatzplanung" |
| `src/components/employee/DesktopEmployeePage.tsx` | Mitarbeiter-Ansicht eigener Einsätze |

### Services
| Datei | Zweck |
|-------|-------|
| `src/services/WorkflowService.ts` | `applyScheduleWithApproval()` - Genehmigungsworkflow |
| `src/services/projectService.ts` | Projekt-CRUD und Team-Management |
| `src/services/attendanceService.ts` | Anwesenheitsverfolgung |

### Hooks
| Datei | Zweck |
|-------|-------|
| `src/hooks/useProjectHooks.ts` | `useProjects()`, `useUpdateProject()` |
| `src/hooks/useEmployeeHooks.ts` | Mitarbeiterdaten |
| `src/hooks/useTimeTracking.ts` | Zeiterfassungs-Integration |
| `src/hooks/useSupabaseAuth.tsx` | Auth-Kontext mit `companyId` |

### Utilities
| Datei | Zweck |
|-------|-------|
| `src/utils/addTeamMembersToProject.ts` | Bulk-Teamzuweisung |
| `src/utils/timeUtils.ts` | Zeitberechnungen |

## Datenfluss: Zuweisung erstellen

1. User klickt "+ Neuer Eintrag" → AssignDialog öffnet sich
2. Auswahl: Mitarbeiter, Projekt, Datumsbereich, Typ (Projekt/Urlaub/Krank)
3. Konflikterkennung prüft Überschneidungen
4. DB-Operation: INSERT/UPDATE auf `project_team_assignments` oder `vacation_requests`
5. `loadData()` lädt alle Daten komplett neu
6. UI rendert mit aktualisierten Zuweisungen

## Datenfluss: Drag & Drop

1. DragStart: Erfasst projectId, employeeId, originDate, Offset
2. DragOver: Zeigt Zielzone (blauer Rahmen)
3. Drop: Berechnet Datumsverschiebung, erstellt Undo-Eintrag
4. DB-Update: Gleicher MA → Datum verschieben; Anderer MA → Quelle deaktivieren, Ziel aktivieren
5. Komplett-Reload der Daten

## Kalender-Ansichten

- **Tagesansicht**: Einzelner Tag mit Mitarbeiter-Zeilen
- **Wochenansicht**: Mo-So mit stündlicher Auslastung
- **Monatsansicht**: Vollständiges Monatsgitter

## Integrationen

- **Projekt-Modul**: Projekte mit Status 'beauftragt'/'in_bearbeitung' erscheinen im Planer
- **Personal-Modul**: Aktive Mitarbeiter (nicht 'Inaktiv'/'Gekündigt') erscheinen
- **Zeiterfassung**: `hours_budgeted` vs. `hours_actual` auf Zuweisungen
- **Workflow-Service**: Einbettung in Auftrags-Workflow (Auftrag → Projekt → Rechnung)
- **Dashboard**: "Einsatzplanung"-Widget mit Quick-Navigation
- **Kalender-Events**: Besichtigungen als Overlay-Balken
