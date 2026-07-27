# Mitarbeiter-Seite — Projekt-zentriertes Redesign (Design/Spec)

**Datum:** 2026-07-27
**Status:** Entwurf zur Freigabe
**Ansatz:** B — projekt-zentriert, mit Refactoring des bestehenden Monolithen

## Ziel & Kontext

Die Mitarbeiter-Seite (`/employee`) wird desktop-first neu gedacht. Auslöser:

- **Neue Funktionen** gewünscht: Material verbuchen und Projekt-Notizen.
- **Komplett-Redesign** der Struktur gewünscht, ohne funktionierende Substanz wegzuwerfen.

Heute rendert `pages/Employee.tsx` immer `DesktopEmployeePage.tsx` — einen 1264-Zeilen-Monolithen mit Sidebar + Tabs (Übersicht, Projekte, Lieferscheine, Zeiterfassung, Urlaub, Profil, optional Rechnungen). Eine separate `MobileEmployeeApp.tsx` existiert, ist aber nicht eingebunden und hat Bugs (nutzt `user.id` statt `employee.id`, Mock-Akku/-Standort). Die Mobile-App ist **nicht Teil dieses Redesigns** — der Fokus liegt auf der Desktop-Seite.

Leitgedanke: Ein Handwerker denkt in **Aufträgen/Baustellen**, nicht in Tabs. Die neue Struktur macht **„Meine Projekte" zum Hub**; alles zu einem Auftrag läuft in einer Projekt-Detailansicht zusammen.

## Informationsarchitektur

Sidebar (dunkel, wie Manager-Sicht) bleibt, wird aber schlanker:

```
Sidebar
├── Übersicht        Dashboard: KPIs + „was ist zu tun" (abgelehnte Lieferscheine prominent)
├── Meine Projekte   Hub → Projekt-Detailansicht
├── Zeiterfassung    alle eigenen Zeiten, projektübergreifend
├── Urlaub
├── Mein Profil
└── Rechnungen       nur mit invoices.view Grant
```

- **Lieferscheine** fällt als eigener Top-Tab weg und wandert in die Projekt-Detailansicht. Die für den Alltag wichtige Sicht „abgelehnte Lieferscheine, Überarbeitung nötig" bleibt prominent auf dem Dashboard erhalten (wie heute).

### Projekt-Detailansicht (Kern des Redesigns)

Eigene Route `/employee/projekt/:projectId`. Innerhalb des Projekts eine Tab-Leiste:

```
Projekt „<Name>"                         [Status-Badge]
──────────────────────────────────────────────────────
[ Überblick | Zeit | Material | Notizen | Fotos | Lieferscheine ]
```

- **Überblick** — Stammdaten (Kunde, Ort, Zeitraum, Status), Schnellaktionen (Zeit erfassen, Material, Notiz).
- **Zeit** — eigene Zeiteinträge dieses Projekts + „Zeit erfassen"-Dialog (bestehende Logik).
- **Material** — NEU (siehe unten).
- **Notizen** — NEU (siehe unten).
- **Fotos** — reine Anzeige-Galerie. Fotos werden auf dem **Handy** aufgenommen und fließen je nach Kontext ins Projekt bzw. den Auftrag; der Desktop **zeigt** sie nur (aus `project_documents`, `document_type = 'photo'`), kein Aufnehmen am PC.
- **Lieferscheine** — Lieferscheine dieses Projekts (Liste + Anlegen/Bearbeiten via bestehendem `DeliveryNoteForm`).

## Komponenten-Zerlegung

Der Monolith wird in fokussierte Einheiten mit je eigener Datenanbindung zerlegt (analog bestehendem `useMaterials`/`useDeliveryNotes`):

```
src/components/employee/
├── EmployeeLayout.tsx              Sidebar + Header + <Outlet/> (Shell)
├── dashboard/EmployeeDashboard.tsx
├── projects/
│   ├── ProjectList.tsx             Hub-Tabelle „Meine Projekte"
│   ├── ProjectDetail.tsx           Tab-Container für ein Projekt
│   └── tabs/
│       ├── ProjectOverviewTab.tsx
│       ├── ProjectTimeTab.tsx
│       ├── ProjectMaterialTab.tsx  NEU
│       ├── ProjectNotesTab.tsx     NEU
│       ├── ProjectPhotosTab.tsx    Anzeige-Galerie
│       └── ProjectDeliveryNotesTab.tsx
├── timesheet/EmployeeTimesheet.tsx
├── vacation/EmployeeVacation.tsx
├── profile/EmployeeProfile.tsx
└── invoices/EmployeeInvoices.tsx
```

Datenlogik wandert aus den Komponenten in Hooks: `useEmployeeProjects`, `useEmployeeTimeEntries` (bzw. Wiederverwendung bestehender Hooks). Jede Datei bleibt fokussiert und für sich testbar.

`pages/Employee.tsx` behält Auth-Guard und rendert `EmployeeLayout`. Routing wird auf **Nested Routes** unter `/employee` umgestellt.

## Neue Features

### Material-Tab (`ProjectMaterialTab.tsx`)

Baut vollständig auf dem bestehenden `useMaterials`-Hook auf:

- Liste der bereits auf dieses Projekt verbuchten Materialien über `getProjectMaterialUsage(projectId)`.
- Aktion „Material verbuchen" → Dialog mit:
  - Material-Suche aus Tabelle `materials` (`searchMaterials`)
  - Menge + Einheit
  - optional **Aufmaß-Modus** (geplant/tatsächlich mit Abweichungs-Ampel) — Logik existiert bereits im `MobileMaterialRecorder` und wird für Desktop als Dialog wiederverwendet/extrahiert.
- Verbuchung → `employee_material_usage` via `recordMaterialUsage`.
- **`employee_id` immer aus `useEmployeePermissions().employee.id`** — nicht `user.id` (das war der Bug der alten Mobile-App).

### Notizen-Tab (`ProjectNotesTab.tsx`)

Auf Tabelle `project_comments`:

- Chronologische Liste der Notizen zu diesem Projekt (Autor, Zeit, Text).
- Textfeld „Notiz hinzufügen" → Insert in `project_comments` (mit `created_by`, `project_id`).

Beide Features sind projektgebunden; **kein neues Schema erforderlich**.

## Sicherheit / Berechtigungen

- Jeder einem Projekt zugewiesene Mitarbeiter darf für **seine** Projekte Material verbuchen und Notizen anlegen.
- RLS von `employee_material_usage` und `project_comments` wird im Implementierungsplan geprüft und — falls nicht vorhanden — mit `company_id` + `public.user_has_company_access(company_id)` abgesichert (gemäß `docs/SECURITY_RULES.md`). Kein `USING (true)`.
- **Preise** im Material-Tab (`unit_price`, berechneter Wert) nur zeigen, wenn `canViewPrices()` — sonst nur Menge/Einheit. Kaufmännische Trennung bleibt gewahrt.
- Keine kaufmännischen Rechte werden implizit vergeben.

## Umsetzungs-Reihenfolge (lauffähig in jedem Schritt)

1. Shell + Routing: `EmployeeLayout` + Nested Routes unter `/employee`, ohne Funktionsverlust.
2. Bestehende Tabs 1:1 in Einzelkomponenten extrahieren (reines Refactoring, verifizierbar).
3. Projekt-Detailansicht + Tabs Überblick / Zeit / Lieferscheine.
4. **Material-Tab** anbinden.
5. **Notizen-Tab** anbinden.
6. Fotos-Tab (Anzeige) + Dashboard aufräumen + optischer Feinschliff.

## Nicht im Umfang (YAGNI)

- Live-Timer/Stempeluhr, Krankmeldung/Abwesenheit als eigene Flows, Foto-Aufnahme am Desktop.
- Überarbeitung der `MobileEmployeeApp.tsx`.
- Neue kaufmännische Berechtigungen.

## Offene Punkte

- Genaue Spalten/Policies von `employee_material_usage` und `project_comments` im Plan verifizieren (RLS + vorhandene Felder wie `location_lat/lng`, `used_at`).
- Bestätigen, dass `MobileMaterialRecorder`-Logik sauber in einen geräteneutralen Dialog extrahierbar ist (oder Desktop-eigener Dialog, gemeinsamer Hook).
