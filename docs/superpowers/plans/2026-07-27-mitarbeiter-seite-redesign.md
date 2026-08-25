# Mitarbeiter-Seite — Projekt-zentriertes Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die Mitarbeiter-Seite (`/employee`) von einem 1264-Zeilen-Monolithen in eine projekt-zentrierte, komponentenbasierte Oberfläche umbauen, mit einer Projekt-Detailansicht als Kern und zwei neuen Funktionen: Material verbuchen und Projekt-Notizen.

**Architecture:** Nested Routes unter `/employee`. Eine Shell (`EmployeeLayout`) mit Sidebar/Header und `<Outlet/>`. Bereiche (Dashboard, Projekte, Zeit, Urlaub, Profil, Rechnungen) als Einzelkomponenten. „Meine Projekte" ist ein Hub, der in eine `ProjectDetail`-Ansicht mit Tabs (Überblick, Zeit, Material, Notizen, Fotos, Lieferscheine) führt. Datenlogik lebt in Hooks. Umbau in 6 lauffähigen Phasen; jede Phase endet mit grünem `npm run typecheck` + Build.

**Tech Stack:** React 18 + TypeScript, react-router-dom v6, TanStack Query v5, Supabase, shadcn/ui, Tailwind, Vitest (nur für neue Datenlogik-Hooks), `date-fns`.

---

## Wichtige Grundlagen (vor Beginn lesen)

**Schema-Realität (verifiziert in `src/integrations/supabase/types.ts`):**

- `employee_material_usage` Spalten: `id, created_at, created_by, employee_id, material_id, notes, project_id, quantity_used, usage_date`.
  **Es gibt KEINE** `quantity`, `unit_price`, `used_at`, `location_lat/lng`, `planned_quantity`, `actual_quantity`, `measurement_note`.
  Der bestehende Hook `src/hooks/useMaterials.ts` schreibt falsche Spalten → er schlägt gegen das echte Schema fehl und landet still im Offline-Queue. **Nicht ungeprüft wiederverwenden.**
- `project_comments` Spalten: `id, comment, created_at, created_by, project_id, updated_at`.
- `project_documents` Spalten: `id, name, document_type, file_path, file_url, file_size, mime_type, metadata, is_favorite, project_id, uploaded_by, created_at, updated_at`. Fotos = `document_type = 'photo'`.
- `project_team_assignments` verknüpft `employee_id` → `projects`.
- `materials` (Artikelstamm) hat u.a.: `id, name, sku, unit, unit_price, stock_quantity, min_stock_level, category`.

**Konventionen (aus CLAUDE.md):** UI-Texte deutsch, Code/Statuswerte englisch. Pfad-Alias `@/` → `src/`. Services über `apiCall`. Query-Keys zentral in `src/hooks/useQueryKeys.ts`. `employee_id` immer aus `useEmployeePermissions().employee.id` (NICHT `user.id`). RLS: niemals `USING (true)`; Geschäftsdaten über `company_id` + `public.user_has_company_access(company_id)`.

**Teststrategie (repo-idiomatisch):** Dieses Repo nutzt co-located Vitest-Tests für **Datenlogik/Services**, nicht für UI-Struktur. Daher:
- Neue Datenlogik (Material-Hook, Berechnungen) → TDD mit Vitest.
- Struktur-Refactoring & UI → Verifikation über `npm run typecheck` + `npm run build` + Preview-Check (Browser-Tools). Keine brittligen Snapshot-Tests erfinden.

**Verifikations-Kommandos (nach jeder Phase):**
```bash
npm run typecheck
npm run build
```
Erwartung: typecheck ohne NEUE Fehler (Baseline), Build grün.

---

## Dateistruktur (Zielzustand)

```
src/pages/Employee.tsx                         (Auth-Guard → rendert <EmployeeLayout/>, jetzt mit Nested Routes)
src/components/employee/
├── EmployeeLayout.tsx                          Sidebar + Header + <Outlet/>
├── EmployeeSidebar.tsx                         Nav-Liste (extrahiert)
├── dashboard/EmployeeDashboard.tsx
├── projects/
│   ├── ProjectList.tsx                         Hub „Meine Projekte"
│   ├── ProjectDetail.tsx                       Tab-Container (Route /employee/projekt/:projectId)
│   └── tabs/
│       ├── ProjectOverviewTab.tsx
│       ├── ProjectTimeTab.tsx
│       ├── ProjectMaterialTab.tsx              NEU
│       ├── ProjectNotesTab.tsx                 NEU
│       ├── ProjectPhotosTab.tsx                Anzeige-Galerie
│       └── ProjectDeliveryNotesTab.tsx
├── timesheet/EmployeeTimesheet.tsx
├── vacation/EmployeeVacation.tsx
├── profile/EmployeeProfile.tsx
└── invoices/EmployeeInvoices.tsx
src/hooks/
├── useEmployeeProjects.ts                      NEU (Query: zugewiesene Projekte)
├── useEmployeeMaterialUsage.ts                 NEU (korrektes employee_material_usage)
└── useProjectNotes.ts                          NEU (project_comments)
```

`DesktopEmployeePage.tsx` wird am Ende (Phase 6) gelöscht, sobald alle Inhalte migriert sind.

---

## Phase 1 — Shell + Routing

Ziel: Nested-Route-Gerüst steht, bestehende Seite bleibt über einen Kompatibilitäts-Wrapper erreichbar. Kein Funktionsverlust.

### Task 1.1: EmployeeLayout-Shell anlegen

**Files:**
- Create: `src/components/employee/EmployeeLayout.tsx`
- Create: `src/components/employee/EmployeeSidebar.tsx`

- [ ] **Step 1: Sidebar-Komponente erstellen**

`EmployeeSidebar.tsx` — extrahiert das Sidebar-Markup aus `DesktopEmployeePage.tsx:490-551`, aber navigiert per `NavLink` statt `setActiveTab`. Die Nav-Items zeigen auf Routen:

```tsx
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Building2, Clock, Plane, UserCircle, Receipt, LogOut, User } from 'lucide-react';
import { useEmployeePermissions } from '@/hooks/useEmployeePermissions';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';

const NAV = [
  { to: '/employee', end: true, icon: LayoutDashboard, label: 'Übersicht' },
  { to: '/employee/projekte', icon: Building2, label: 'Meine Projekte' },
  { to: '/employee/zeiterfassung', icon: Clock, label: 'Zeiterfassung' },
  { to: '/employee/urlaub', icon: Plane, label: 'Urlaub' },
  { to: '/employee/profil', icon: UserCircle, label: 'Mein Profil' },
];

export function EmployeeSidebar() {
  const { employee, isManager, canViewInvoices } = useEmployeePermissions();
  const { signOut } = useSupabaseAuth();
  const navigate = useNavigate();
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-left transition-colors ${
      isActive ? 'bg-slate-800 text-teal-400 font-medium'
               : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
    }`;
  return (
    <aside className="w-64 bg-slate-950 border-r border-slate-800 flex flex-col flex-shrink-0">
      <div className="p-4 border-b border-slate-800/60">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center">
            <User className="h-5 w-5 text-slate-300" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-200">{employee?.first_name} {employee?.last_name}</p>
            <p className="text-xs text-slate-500">{isManager ? 'Manager' : 'Mitarbeiter'}</p>
          </div>
        </div>
      </div>
      <nav className="flex-1 py-4 px-2 space-y-0.5">
        {NAV.map(item => (
          <NavLink key={item.to} to={item.to} end={item.end} className={linkClass}>
            <item.icon className="h-5 w-5" />
            <span className="text-sm">{item.label}</span>
          </NavLink>
        ))}
        {canViewInvoices() && (
          <NavLink to="/employee/rechnungen" className={linkClass}>
            <Receipt className="h-5 w-5" />
            <span className="text-sm">Rechnungen</span>
          </NavLink>
        )}
      </nav>
      <div className="p-2 border-t border-slate-800/60">
        <button onClick={async () => { await signOut(); navigate('/auth'); }}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-left text-red-400 hover:bg-red-950/30 transition-colors">
          <LogOut className="h-5 w-5" />
          <span className="text-sm">Abmelden</span>
        </button>
      </div>
    </aside>
  );
}
export default EmployeeSidebar;
```

- [ ] **Step 2: Layout-Shell erstellen**

`EmployeeLayout.tsx`:

```tsx
import { Outlet } from 'react-router-dom';
import { EmployeeSidebar } from './EmployeeSidebar';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { useEmployeePermissions } from '@/hooks/useEmployeePermissions';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

export function EmployeeLayout() {
  const { employee, isLoading } = useEmployeePermissions();
  const navigate = useNavigate();

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50"><p className="text-gray-500">Wird geladen...</p></div>;
  }
  if (!employee) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Card className="w-96"><CardContent className="pt-6 text-center">
          <p className="text-gray-500">Kein Mitarbeiter-Profil gefunden.</p>
          <Button className="mt-4" onClick={() => navigate('/auth')}>Zur Anmeldung</Button>
        </CardContent></Card>
      </div>
    );
  }
  return (
    <div className="min-h-screen w-full bg-slate-50 flex">
      <EmployeeSidebar />
      <div className="flex-1 flex flex-col min-h-screen">
        <header className="h-16 border-b border-slate-200 bg-white sticky top-0 z-30 shadow-sm flex items-center justify-between px-6">
          <h2 className="text-lg font-semibold text-slate-800">Mitarbeiter Arbeitsbereich</h2>
          <div className="flex items-center space-x-3"><ThemeToggle /></div>
        </header>
        <main className="flex-1 p-6 overflow-auto"><Outlet /></main>
      </div>
    </div>
  );
}
export default EmployeeLayout;
```

- [ ] **Step 3: typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: keine neuen Fehler; Build grün. (Layout wird noch nicht geroutet — reine Kompilierprüfung.)

- [ ] **Step 4: Commit**

```bash
git add src/components/employee/EmployeeLayout.tsx src/components/employee/EmployeeSidebar.tsx
git commit -m "feat(employee): EmployeeLayout-Shell und Sidebar mit NavLink-Routing"
```

### Task 1.2: Nested Routes verdrahten, alte Seite als Übergangs-Platzhalter

**Files:**
- Modify: `src/App.tsx:196`
- Modify: `src/pages/Employee.tsx`

- [ ] **Step 1: Route auf verschachtelte Struktur umstellen**

In `src/App.tsx` die Zeile `<Route path="/employee" element={<Employee />} />` ersetzen durch eine verschachtelte Route. `Employee` wird zur Layout-Route mit Kind-Routen. Vorläufig zeigen alle Kinder noch die bestehende `DesktopEmployeePage` (Wrapper), damit nichts kaputtgeht:

```tsx
// import oben ergänzen:
import EmployeeLayout from "@/components/employee/EmployeeLayout";
import DesktopEmployeePage from "@/components/employee/DesktopEmployeePage";

// Route ersetzen:
<Route path="/employee" element={<Employee />}>
  <Route index element={<DesktopEmployeePage />} />
</Route>
```

- [ ] **Step 2: `Employee.tsx` auf Layout umstellen**

`src/pages/Employee.tsx` behält den Auth-Guard und rendert `EmployeeLayout` (das `<Outlet/>` rendert die Kind-Route):

```tsx
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import EmployeeLayout from '@/components/employee/EmployeeLayout';

const Employee = () => {
  const { user, loading } = useSupabaseAuth();
  const navigate = useNavigate();
  useEffect(() => { if (!loading && !user) navigate('/auth'); }, [user, loading, navigate]);
  if (loading) return <div className="min-h-screen flex items-center justify-center"><p className="text-gray-500">Wird geladen...</p></div>;
  if (!user) return <div className="min-h-screen flex items-center justify-center"><p className="text-gray-500">Nicht angemeldet. Weiterleitung...</p></div>;
  return <EmployeeLayout />;
};
export default Employee;
```

> Hinweis: `DesktopEmployeePage` rendert aktuell selbst eine eigene Sidebar+Header+Layout. Als Index-Kind im Outlet erzeugt das doppeltes Chrome. Das ist für diesen einen Übergangsschritt akzeptabel; Phase 2 ersetzt das Index-Kind durch `EmployeeDashboard` und entfernt das doppelte Chrome. Wer das vermeiden will, kann Step 1 und Phase 2 Task 2.1 in einem Zug umsetzen.

- [ ] **Step 3: Preview-Check**

Dev-Server via preview_start `{name: "dev"}` (Port 8080), zu `/employee` navigieren, einloggen. Erwartung: Seite lädt, Sidebar-Links existieren. `read_console_messages` → keine roten Fehler.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx src/pages/Employee.tsx
git commit -m "feat(employee): Nested-Route-Gerüst unter /employee, Layout als Shell"
```

---

## Phase 2 — Bestehende Bereiche als Einzelkomponenten extrahieren

Ziel: Jeder heutige Tab wird eine eigenständige, geroutete Komponente. Reines Verschieben von vorhandenem Code aus `DesktopEmployeePage.tsx` — keine neue Logik. Nach jeder Extraktion typecheck+build.

### Task 2.1: EmployeeDashboard extrahieren

**Files:**
- Create: `src/components/employee/dashboard/EmployeeDashboard.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Dashboard-Inhalt kopieren**

Neue Datei `EmployeeDashboard.tsx`. Inhalt: der `activeTab === 'dashboard'`-Block aus `DesktopEmployeePage.tsx:566-698` (KPI-Cards, abgelehnte Lieferscheine, Schnellaktionen, letzte Lieferscheine). Benötigte Daten holt die Komponente selbst über die vorhandenen Hooks:
- `useEmployeePermissions()` → `employee`, `canEditDeliveryNote`
- `useDeliveryNotes()` → `deliveryNotes`
- Projekte + Zeiteinträge + Urlaub: über die in Phase 3/Task 3.1 entstehende `useEmployeeProjects` bzw. lokale Fetches wie im Original (`fetchProjects`, `fetchTimeEntries`, `fetchVacation`). Für diesen Schritt: die drei Fetch-Funktionen + zugehörigen State (`projects`, `timeEntries`, `vacationDays`, `weekHours`-Berechnung aus `:189-200`) 1:1 in die Komponente übernehmen.
- Schnellaktionen-Buttons: „Zeit erfassen" öffnet den Zeit-Dialog (siehe Task 2.5, bis dahin Button auf `navigate('/employee/zeiterfassung')` zeigen lassen), „Neuer Lieferschein" → `navigate('/employee/projekte')`, „Alle Zeiteinträge" → `navigate('/employee/zeiterfassung')`.

Format-Helfer (`formatDate`) lokal kopieren (klein, DRY-Ausnahme akzeptabel; alternativ nach `src/lib/employeeFormat.ts` auslagern — optional).

- [ ] **Step 2: Route eintragen**

In `App.tsx` das Index-Kind austauschen:
```tsx
import EmployeeDashboard from "@/components/employee/dashboard/EmployeeDashboard";
// ...
<Route path="/employee" element={<Employee />}>
  <Route index element={<EmployeeDashboard />} />
</Route>
```

- [ ] **Step 3: typecheck + build + Preview**

Run: `npm run typecheck && npm run build`. Preview `/employee` → Dashboard rendert ohne doppeltes Chrome, KPIs zeigen Werte.

- [ ] **Step 4: Commit**

```bash
git add src/components/employee/dashboard/EmployeeDashboard.tsx src/App.tsx
git commit -m "feat(employee): Dashboard als eigene geroutete Komponente"
```

### Task 2.2: EmployeeTimesheet extrahieren

**Files:**
- Create: `src/components/employee/timesheet/EmployeeTimesheet.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1:** `activeTab === 'timesheet'`-Block (`DesktopEmployeePage.tsx:863-922`) + `fetchTimeEntries`, State `timeEntries`, Helfer `formatDate/formatTime/calculateHours` in neue Komponente übernehmen. Der „Zeit erfassen"-Button öffnet den Zeit-Dialog (Task 2.5); bis dahin lokalen Dialog-State + `handleSaveTimeEntry` aus `:338-366` mitkopieren.
- [ ] **Step 2:** Route ergänzen: `<Route path="zeiterfassung" element={<EmployeeTimesheet />} />` innerhalb der `/employee`-Route.
- [ ] **Step 3:** `npm run typecheck && npm run build`; Preview `/employee/zeiterfassung` → Tabelle rendert.
- [ ] **Step 4:** Commit `feat(employee): Zeiterfassung als eigene Komponente`.

### Task 2.3: EmployeeVacation extrahieren

**Files:**
- Create: `src/components/employee/vacation/EmployeeVacation.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1:** `activeTab === 'vacation'`-Block (`:925-1001`) + `fetchVacation`, State `vacationRequests`, `vacationDays`, `getVacationStatusBadge`, sowie die `VacationRequestDialog`-Einbindung (`:1254-1258`) übernehmen.
- [ ] **Step 2:** Route: `<Route path="urlaub" element={<EmployeeVacation />} />`.
- [ ] **Step 3:** typecheck+build; Preview `/employee/urlaub`.
- [ ] **Step 4:** Commit `feat(employee): Urlaub als eigene Komponente`.

### Task 2.4: EmployeeProfile + EmployeeInvoices extrahieren

**Files:**
- Create: `src/components/employee/profile/EmployeeProfile.tsx`
- Create: `src/components/employee/invoices/EmployeeInvoices.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1:** Profile-Block (`:1004-1097`) inkl. `fetchProfileData`, `profileData`-State, Passwort-Ändern-Logik übernehmen. Invoices-Block (`:1102-1150`) inkl. `fetchInvoices`, `invoiceList`, `getInvoiceStatusBadge`, `formatCurrency` übernehmen.
- [ ] **Step 2:** Routen: `<Route path="profil" element={<EmployeeProfile />} />` und `<Route path="rechnungen" element={<EmployeeInvoices />} />`. Invoices-Komponente prüft selbst `canViewInvoices()` und zeigt sonst eine „Kein Zugriff"-Meldung.
- [ ] **Step 3:** typecheck+build; Preview beide Routen.
- [ ] **Step 4:** Commit `feat(employee): Profil und Rechnungen als eigene Komponenten`.

### Task 2.5: Gemeinsamen Zeit-Erfassen-Dialog extrahieren

**Files:**
- Create: `src/components/employee/timesheet/TimeEntryDialog.tsx`
- Modify: `src/components/employee/dashboard/EmployeeDashboard.tsx`, `src/components/employee/timesheet/EmployeeTimesheet.tsx`

- [ ] **Step 1:** Den Zeit-Dialog (`DesktopEmployeePage.tsx:1153-1237`, inkl. „Lieferschein erstellen?"-Prompt) in eine wiederverwendbare Komponente mit Props `{ open, onOpenChange, projects, onSaved }` überführen. Insert-Logik (`handleSaveTimeEntry`, `:338-366`) kapseln; `employee_id`/`company_id` aus `useEmployeePermissions().employee`.
- [ ] **Step 2:** In Dashboard und Timesheet den lokal kopierten Dialog durch `<TimeEntryDialog/>` ersetzen (DRY).
- [ ] **Step 3:** typecheck+build; Preview: „Zeit erfassen" in Dashboard und Zeiterfassung öffnet denselben Dialog, Speichern funktioniert.
- [ ] **Step 4:** Commit `feat(employee): wiederverwendbarer TimeEntryDialog`.

---

## Phase 3 — Projekt-Hub + Projekt-Detailansicht

### Task 3.1: useEmployeeProjects-Hook (mit Test)

**Files:**
- Create: `src/hooks/useEmployeeProjects.ts`
- Test: `src/hooks/useEmployeeProjects.test.ts`
- Modify: `src/hooks/useQueryKeys.ts`

- [ ] **Step 1: Query-Key ergänzen**

In `src/hooks/useQueryKeys.ts` unter `QUERY_KEYS` hinzufügen:
```ts
employeeProjects: (employeeId: string) => ['employee-projects', employeeId] as const,
```

- [ ] **Step 2: Failing Test schreiben**

`src/hooks/useEmployeeProjects.test.ts` — testet die reine Mapping-Funktion `mapTeamAssignmentsToProjects`, die aus der `project_team_assignments`-Antwort die `Project[]`-Liste baut:
```ts
import { describe, it, expect } from 'vitest';
import { mapTeamAssignmentsToProjects } from './useEmployeeProjects';

describe('mapTeamAssignmentsToProjects', () => {
  it('mappt verschachtelte Projekt-Daten flach und ignoriert leere', () => {
    const input = [
      { projects: { id: 'p1', name: 'Bad Müller', status: 'active', location: 'MG', start_date: '2026-07-01', end_date: '2026-07-30', customers: { company_name: 'Müller GmbH' } } },
      { projects: null },
    ];
    const result = mapTeamAssignmentsToProjects(input as any);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: 'p1', name: 'Bad Müller', status: 'active', location: 'MG',
      start_date: '2026-07-01', end_date: '2026-07-30', customer_name: 'Müller GmbH',
    });
  });
});
```

- [ ] **Step 3: Test laufen lassen (rot)**

Run: `npx vitest run src/hooks/useEmployeeProjects.test.ts`
Expected: FAIL — Modul/Funktion existiert nicht.

- [ ] **Step 4: Hook implementieren**

`src/hooks/useEmployeeProjects.ts`:
```ts
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { QUERY_KEYS } from '@/hooks/useQueryKeys';

export interface EmployeeProject {
  id: string; name: string; status: string;
  location?: string; start_date?: string; end_date?: string; customer_name?: string;
}

export function mapTeamAssignmentsToProjects(rows: any[]): EmployeeProject[] {
  return (rows || []).filter(r => r.projects).map(r => ({
    id: r.projects.id, name: r.projects.name, status: r.projects.status,
    location: r.projects.location, start_date: r.projects.start_date, end_date: r.projects.end_date,
    customer_name: r.projects.customers?.company_name,
  }));
}

export function useEmployeeProjects(employeeId?: string) {
  return useQuery({
    queryKey: QUERY_KEYS.employeeProjects(employeeId ?? ''),
    enabled: !!employeeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_team_assignments')
        .select(`project_id, projects ( id, name, status, location, start_date, end_date, customers ( company_name ) )`)
        .eq('employee_id', employeeId);
      if (error) throw error;
      return mapTeamAssignmentsToProjects(data as any[]);
    },
  });
}
```

- [ ] **Step 5: Test laufen lassen (grün)**

Run: `npx vitest run src/hooks/useEmployeeProjects.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useEmployeeProjects.ts src/hooks/useEmployeeProjects.test.ts src/hooks/useQueryKeys.ts
git commit -m "feat(employee): useEmployeeProjects-Hook mit Mapping-Test"
```

### Task 3.2: ProjectList (Hub)

**Files:**
- Create: `src/components/employee/projects/ProjectList.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1:** Komponente rendert die Projekt-Tabelle (Basis: `DesktopEmployeePage.tsx:711-761`), Daten aus `useEmployeeProjects(employee.id)`. Statt „LS anlegen" navigiert die Zeilen-Aktion in die Detailansicht: Zeile klickbar → `navigate(\`/employee/projekt/${project.id}\`)`. Status-Badge-Helfer (`getStatusBadge`, `:433-453`) mitkopieren oder nach `src/lib/projectStatus`-Umfeld auslagern (optional).
- [ ] **Step 2:** Route: `<Route path="projekte" element={<ProjectList />} />`.
- [ ] **Step 3:** typecheck+build; Preview `/employee/projekte` → Klick auf Zeile geht zu `/employee/projekt/:id` (zeigt noch nichts → Task 3.3).
- [ ] **Step 4:** Commit `feat(employee): ProjectList als Hub mit Navigation in Detailansicht`.

### Task 3.3: ProjectDetail Tab-Container

**Files:**
- Create: `src/components/employee/projects/ProjectDetail.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1:** `ProjectDetail` liest `useParams().projectId`, lädt die Projekt-Stammdaten (`supabase.from('projects').select('id,name,status,location,start_date,end_date, customers(company_name)').eq('id', projectId).single()`), zeigt Kopf mit Name + Status-Badge + „zurück"-Link zu `/employee/projekte`, und eine shadcn `Tabs`-Leiste mit Werten `ueberblick | zeit | material | notizen | fotos | lieferscheine`. Für diesen Schritt nur der Tab „Überblick" mit Stammdaten gefüllt; die übrigen Tabs zeigen `<div className="text-muted-foreground py-8 text-center">Kommt in Kürze</div>` als Platzhalter (werden in Task 3.4, 4.x, 5.x, 6.x ersetzt).
- [ ] **Step 2:** Route: `<Route path="projekt/:projectId" element={<ProjectDetail />} />`.
- [ ] **Step 3:** typecheck+build; Preview: Detailansicht öffnet, Tabs klickbar, Überblick zeigt Stammdaten.
- [ ] **Step 4:** Commit `feat(employee): ProjectDetail-Tab-Container mit Überblick`.

### Task 3.4: Projekt-Tabs Zeit, Lieferscheine, Fotos

**Files:**
- Create: `src/components/employee/projects/tabs/ProjectTimeTab.tsx`
- Create: `src/components/employee/projects/tabs/ProjectDeliveryNotesTab.tsx`
- Create: `src/components/employee/projects/tabs/ProjectPhotosTab.tsx`
- Create: `src/components/employee/projects/tabs/ProjectOverviewTab.tsx`
- Modify: `src/components/employee/projects/ProjectDetail.tsx`

- [ ] **Step 1 (Überblick):** `ProjectOverviewTab` bekommt `project` als Prop, zeigt Stammdaten-Card + Schnellaktionen (Buttons: „Zeit erfassen" öffnet `TimeEntryDialog` projekt-vorbelegt; „Material verbuchen" wechselt auf Tab `material`; „Notiz" wechselt auf Tab `notizen`).
- [ ] **Step 2 (Zeit):** `ProjectTimeTab` bekommt `projectId`, lädt eigene Zeiteinträge dieses Projekts (`time_entries` gefiltert auf `employee_id` + `project_id`), zeigt Tabelle (Spalten aus `:880-919`) + „Zeit erfassen"-Button (öffnet `TimeEntryDialog` mit vorbelegtem Projekt).
- [ ] **Step 3 (Lieferscheine):** `ProjectDeliveryNotesTab` bekommt `projectId`, nutzt `useDeliveryNotes()` gefiltert auf das Projekt, zeigt Liste (Basis `:783-858`) + „Neuer Lieferschein" via bestehendem `DeliveryNoteForm` (projekt-vorbelegt). `canEditDeliveryNote` respektieren.
- [ ] **Step 4 (Fotos):** `ProjectPhotosTab` bekommt `projectId`, lädt `project_documents` mit `document_type='photo'` und `project_id`, zeigt Grid mit Bild (`file_url` → Storage Public URL via `supabase.storage.from('project-media').getPublicUrl(file_url)` falls kein absoluter URL), Name, Datum. **Nur Anzeige, kein Upload.** Leerzustand: „Fotos werden auf der Baustelle per Handy aufgenommen und erscheinen hier."
- [ ] **Step 5:** In `ProjectDetail` die Platzhalter durch diese Komponenten ersetzen (Material/Notizen bleiben Platzhalter bis Phase 4/5).
- [ ] **Step 6:** typecheck+build; Preview alle vier Tabs.
- [ ] **Step 7:** Commit `feat(employee): Projekt-Tabs Überblick, Zeit, Lieferscheine, Fotos`.

---

## Phase 4 — Material-Tab (NEU)

### Task 4.1: useEmployeeMaterialUsage-Hook (mit Test) — korrektes Schema

**Files:**
- Create: `src/hooks/useEmployeeMaterialUsage.ts`
- Test: `src/hooks/useEmployeeMaterialUsage.test.ts`
- Modify: `src/hooks/useQueryKeys.ts`

- [ ] **Step 1: Query-Key ergänzen**

```ts
projectMaterialUsage: (projectId: string) => ['project-material-usage', projectId] as const,
```

- [ ] **Step 2: Failing Test schreiben**

Test der Insert-Payload-Builder-Funktion `buildMaterialUsageInsert`, die GENAU die existierenden Spalten erzeugt (kein `quantity`, `unit_price`, `used_at`):
```ts
import { describe, it, expect } from 'vitest';
import { buildMaterialUsageInsert } from './useEmployeeMaterialUsage';

describe('buildMaterialUsageInsert', () => {
  it('erzeugt nur existierende Spalten von employee_material_usage', () => {
    const row = buildMaterialUsageInsert({
      projectId: 'p1', materialId: 'm1', employeeId: 'e1', userId: 'u1',
      quantity: 5, notes: 'Keller', usageDate: '2026-07-27',
    });
    expect(row).toEqual({
      project_id: 'p1', material_id: 'm1', employee_id: 'e1', created_by: 'u1',
      quantity_used: 5, notes: 'Keller', usage_date: '2026-07-27',
    });
    expect(row).not.toHaveProperty('quantity');
    expect(row).not.toHaveProperty('unit_price');
    expect(row).not.toHaveProperty('used_at');
  });
});
```

- [ ] **Step 3: Test laufen lassen (rot)**

Run: `npx vitest run src/hooks/useEmployeeMaterialUsage.test.ts` → FAIL.

- [ ] **Step 4: Hook implementieren**

```ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { QUERY_KEYS } from '@/hooks/useQueryKeys';
import { toast } from 'sonner';

export interface MaterialUsageInsert {
  project_id: string; material_id: string; employee_id: string;
  created_by: string; quantity_used: number; notes?: string; usage_date: string;
}

export function buildMaterialUsageInsert(p: {
  projectId: string; materialId: string; employeeId: string; userId: string;
  quantity: number; notes?: string; usageDate: string;
}): MaterialUsageInsert {
  return {
    project_id: p.projectId, material_id: p.materialId, employee_id: p.employeeId,
    created_by: p.userId, quantity_used: p.quantity,
    notes: p.notes || undefined, usage_date: p.usageDate,
  };
}

export function useProjectMaterialUsage(projectId?: string) {
  return useQuery({
    queryKey: QUERY_KEYS.projectMaterialUsage(projectId ?? ''),
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employee_material_usage')
        .select(`id, quantity_used, notes, usage_date, created_at, material:materials ( name, unit, sku, unit_price ), employee:employees ( first_name, last_name )`)
        .eq('project_id', projectId)
        .order('usage_date', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useRecordMaterialUsage(projectId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (insert: MaterialUsageInsert) => {
      const { error } = await supabase.from('employee_material_usage').insert(insert);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Material verbucht');
      if (projectId) qc.invalidateQueries({ queryKey: QUERY_KEYS.projectMaterialUsage(projectId) });
    },
    onError: () => toast.error('Material konnte nicht verbucht werden'),
  });
}
```

- [ ] **Step 5: Test laufen lassen (grün)**

Run: `npx vitest run src/hooks/useEmployeeMaterialUsage.test.ts` → PASS.

- [ ] **Step 6: Commit** `feat(employee): useEmployeeMaterialUsage mit schema-korrektem Insert`.

### Task 4.2: RLS von employee_material_usage prüfen/absichern

**Files:**
- Create (falls nötig): `supabase/migrations/<timestamp>_employee_material_usage_rls.sql`

- [ ] **Step 1:** Bestehende Policies prüfen:
```bash
grep -rn "employee_material_usage" supabase/migrations
```
Falls RLS fehlt oder `USING (true)` für `authenticated` verwendet wird → Migration mit `company_id`-basiertem Zugriff ergänzen. **Achtung:** `employee_material_usage` hat KEINE `company_id`-Spalte. Zugriff daher über das Projekt herleiten:
```sql
alter table public.employee_material_usage enable row level security;

create policy "emu_select_company" on public.employee_material_usage
  for select to authenticated
  using (exists (
    select 1 from public.projects p
    where p.id = employee_material_usage.project_id
      and public.user_has_company_access(p.company_id)
  ));

create policy "emu_insert_company" on public.employee_material_usage
  for insert to authenticated
  with check (exists (
    select 1 from public.projects p
    where p.id = employee_material_usage.project_id
      and public.user_has_company_access(p.company_id)
  ));
```
- [ ] **Step 2:** Falls Migration erstellt: `npm run db:push` (oder lokal `npm run db:start` + testen). Danach Typen neu generieren (`src/integrations/supabase/types.ts`) und `npm run typecheck`.
- [ ] **Step 3:** Commit `fix(employee): RLS für employee_material_usage über Projekt-company_id` (nur falls Migration nötig war).

### Task 4.3: MaterialUsageDialog + ProjectMaterialTab

**Files:**
- Create: `src/components/employee/projects/MaterialUsageDialog.tsx`
- Create: `src/components/employee/projects/tabs/ProjectMaterialTab.tsx`
- Modify: `src/components/employee/projects/ProjectDetail.tsx`

- [ ] **Step 1 (Dialog):** `MaterialUsageDialog` mit Props `{ open, onOpenChange, projectId }`. Material-Suche aus `materials` (eigener kleiner Fetch oder bestehender `useMaterials.materials` NUR für die Liste — NICHT dessen `recordMaterialUsage`). Felder: Material (Select/Suche), Menge (`quantity`, `type=number`), Notiz (optional). Speichern via `useRecordMaterialUsage(projectId)` + `buildMaterialUsageInsert` mit `employeeId = useEmployeePermissions().employee.id`, `userId = user.id`, `usageDate = heute (YYYY-MM-DD)`. Preisanzeige (`materials.unit_price × quantity`) nur wenn `canViewPrices()`. **Aufmaß-Modus (geplant/tatsächlich) wird in v1 weggelassen**, da keine persistierbaren Spalten existieren; optional als Freitext in `notes`.
- [ ] **Step 2 (Tab):** `ProjectMaterialTab` bekommt `projectId`. Liste der verbuchten Materialien via `useProjectMaterialUsage(projectId)` (Spalten: Datum, Material, Menge+Einheit, ggf. Wert wenn `canViewPrices()`, Notiz, Erfasser). Button „Material verbuchen" öffnet `MaterialUsageDialog`. Leerzustand: „Noch kein Material verbucht."
- [ ] **Step 3:** In `ProjectDetail` den `material`-Platzhalter durch `<ProjectMaterialTab projectId={projectId} />` ersetzen. Überblick-Schnellaktion „Material verbuchen" öffnet ebenfalls den Dialog (oder wechselt auf den Tab).
- [ ] **Step 4:** typecheck+build; Preview: Material verbuchen speichert, erscheint in Liste; ohne `prices.view` keine Preise sichtbar.
- [ ] **Step 5:** Commit `feat(employee): Material-Tab mit Verbuchen-Dialog`.

---

## Phase 5 — Notizen-Tab (NEU)

### Task 5.1: useProjectNotes-Hook (mit Test)

**Files:**
- Create: `src/hooks/useProjectNotes.ts`
- Test: `src/hooks/useProjectNotes.test.ts`
- Modify: `src/hooks/useQueryKeys.ts`

- [ ] **Step 1:** Query-Key: `projectNotes: (projectId: string) => ['project-notes', projectId] as const,`
- [ ] **Step 2: Failing Test** für `buildNoteInsert`:
```ts
import { describe, it, expect } from 'vitest';
import { buildNoteInsert } from './useProjectNotes';

describe('buildNoteInsert', () => {
  it('erzeugt project_comments-Insert mit getrimmtem Kommentar', () => {
    expect(buildNoteInsert('p1', 'u1', '  Tür klemmt  ')).toEqual({
      project_id: 'p1', created_by: 'u1', comment: 'Tür klemmt',
    });
  });
});
```
- [ ] **Step 3:** Test rot: `npx vitest run src/hooks/useProjectNotes.test.ts` → FAIL.
- [ ] **Step 4: Implementieren:**
```ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { QUERY_KEYS } from '@/hooks/useQueryKeys';
import { toast } from 'sonner';

export function buildNoteInsert(projectId: string, userId: string, comment: string) {
  return { project_id: projectId, created_by: userId, comment: comment.trim() };
}

export function useProjectNotes(projectId?: string) {
  return useQuery({
    queryKey: QUERY_KEYS.projectNotes(projectId ?? ''),
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_comments')
        .select('id, comment, created_at, created_by')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useAddProjectNote(projectId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { userId: string; comment: string }) => {
      const { error } = await supabase.from('project_comments').insert(buildNoteInsert(projectId!, v.userId, v.comment));
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Notiz gespeichert');
      if (projectId) qc.invalidateQueries({ queryKey: QUERY_KEYS.projectNotes(projectId) });
    },
    onError: () => toast.error('Notiz konnte nicht gespeichert werden'),
  });
}
```
- [ ] **Step 5:** Test grün → PASS.
- [ ] **Step 6:** Commit `feat(employee): useProjectNotes-Hook mit Insert-Test`.

### Task 5.2: RLS von project_comments prüfen/absichern

**Files:**
- Create (falls nötig): `supabase/migrations/<timestamp>_project_comments_rls.sql`

- [ ] **Step 1:** `grep -rn "project_comments" supabase/migrations`. `project_comments` hat ebenfalls keine `company_id` → Zugriff über Projekt herleiten (analog Task 4.2, Tabelle `project_comments`, Spalte `project_id`). Policy für `select` und `insert` mit `with check` auf `user_has_company_access(p.company_id)`.
- [ ] **Step 2:** Falls Migration: `npm run db:push`, Typen neu generieren, `npm run typecheck`.
- [ ] **Step 3:** Commit (nur falls nötig) `fix(employee): RLS für project_comments über Projekt-company_id`.

### Task 5.3: ProjectNotesTab

**Files:**
- Create: `src/components/employee/projects/tabs/ProjectNotesTab.tsx`
- Modify: `src/components/employee/projects/ProjectDetail.tsx`

- [ ] **Step 1:** `ProjectNotesTab` bekommt `projectId`. Oben ein `Textarea` + Button „Notiz hinzufügen" (`useAddProjectNote`, `userId = user.id`, Feld nach Erfolg leeren). Darunter chronologische Liste aus `useProjectNotes(projectId)`: Kommentartext, Datum/Uhrzeit (`formatDate`), ggf. Autor. Leerzustand: „Noch keine Notizen."
- [ ] **Step 2:** In `ProjectDetail` den `notizen`-Platzhalter durch `<ProjectNotesTab projectId={projectId} />` ersetzen.
- [ ] **Step 3:** typecheck+build; Preview: Notiz hinzufügen erscheint sofort in Liste.
- [ ] **Step 4:** Commit `feat(employee): Notizen-Tab auf project_comments`.

---

## Phase 6 — Aufräumen + Feinschliff

### Task 6.1: DesktopEmployeePage entfernen

**Files:**
- Delete: `src/components/employee/DesktopEmployeePage.tsx`
- Delete: `src/components/employee/MobileEmployeeApp.tsx.bak`
- Modify: `src/App.tsx` (Import entfernen), `src/components/employee/index.ts` (Export prüfen)

- [ ] **Step 1:** Prüfen, dass `DesktopEmployeePage` nirgends mehr importiert wird:
```bash
grep -rn "DesktopEmployeePage" src
```
Erwartung: nur noch die Definition + ggf. `index.ts`-Export. Alle Nutzungen wurden in Phase 2/3 ersetzt.
- [ ] **Step 2:** Datei + `.bak` löschen, Import in `App.tsx` und Export in `index.ts` entfernen.
- [ ] **Step 3:** `npm run typecheck && npm run build`. Erwartung: grün (evtl. `typecheck:baseline` nachziehen, falls Altlasten der gelöschten Datei aus der Baseline entfallen — dann `npm run typecheck:baseline` und die Änderung committen).
- [ ] **Step 4:** Commit `chore(employee): DesktopEmployeePage-Monolith entfernt, vollständig migriert`.

### Task 6.2: Dashboard-Schnellaktionen final verdrahten + Feinschliff

**Files:**
- Modify: `src/components/employee/dashboard/EmployeeDashboard.tsx`

- [ ] **Step 1:** „Zeit erfassen" im Dashboard öffnet den `TimeEntryDialog` (statt Navigation). „Neuer Lieferschein" → navigiert auf `/employee/projekte` mit Hinweis „Projekt wählen". Abgelehnte-Lieferscheine-Card: „Bearbeiten" navigiert in das Projekt (`/employee/projekt/:projectId`) und öffnet dort den Lieferschein-Tab (via Query-Param `?tab=lieferscheine`, in `ProjectDetail` initialen Tab aus `useSearchParams()` lesen).
- [ ] **Step 2:** `ProjectDetail` liest optionalen `?tab=`-Param für den Start-Tab.
- [ ] **Step 3:** typecheck+build; Preview: Dashboard-Aktionen führen ans richtige Ziel.
- [ ] **Step 4:** Commit `feat(employee): Dashboard-Schnellaktionen final verdrahtet`.

### Task 6.3: Responsives Verhalten & Dark Mode prüfen

- [ ] **Step 1:** Preview bei `resize_window` mobile/tablet/desktop und `colorScheme: dark`. Sidebar/Tabs dürfen nicht horizontal überlaufen; Tabellen in `overflow-x-auto`-Container. Kleinere Tailwind-Anpassungen bei Bedarf.
- [ ] **Step 2:** `read_console_messages` → keine roten Fehler auf allen Routen (`/employee`, `/projekte`, `/projekt/:id` alle Tabs, `/zeiterfassung`, `/urlaub`, `/profil`, `/rechnungen`).
- [ ] **Step 3:** Commit `style(employee): Responsive- und Dark-Mode-Feinschliff`.

---

## Self-Review (durchgeführt)

**Spec-Abdeckung:**
- IA/Sidebar schlanker, Lieferscheine ins Projekt → Phase 1–3, Task 3.4/6.2. ✓
- Projekt-Detailansicht mit Tabs → Task 3.3/3.4/4.3/5.3. ✓
- Komponenten-Zerlegung des Monolithen → Phase 2 + Task 6.1. ✓
- Material-Feature (korrektes Schema, Preis-Gate) → Phase 4. ✓
- Notizen-Feature → Phase 5. ✓
- Fotos nur Anzeige → Task 3.4 Step 4. ✓
- Sicherheit/RLS + `canViewPrices` → Task 4.2, 5.2, 4.3. ✓
- Reihenfolge lauffähig je Phase → typecheck+build je Task. ✓

**Platzhalter:** Alle „Kommt in Kürze"-Stellen sind bewusste Zwischenstände mit benanntem Ersetzungs-Task; kein offener TODO im Endzustand.

**Typ-Konsistenz:** `EmployeeProject`, `MaterialUsageInsert`, `buildMaterialUsageInsert`, `buildNoteInsert`, Query-Keys `employeeProjects`/`projectMaterialUsage`/`projectNotes` durchgängig gleich benannt.

**Abweichung von der Spec (bewusst):** Aufmaß-Modus beim Material wird in v1 nicht persistiert (keine DB-Spalten). In der Spec als „offener Punkt" markiert; hier entschieden: weglassen bzw. optional als Freitext-Notiz. Bei Bedarf später eigene Migration + Feature.
