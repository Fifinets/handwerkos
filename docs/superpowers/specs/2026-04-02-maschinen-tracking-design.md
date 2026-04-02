# Maschinen-Tracking & Planner-Integration - Design Spec

## Ziel

Bestehende MachineModule-Stub (Hardcoded-Daten) durch echte Supabase-Anbindung ersetzen. Geräte (Werkzeug, Fahrzeug, Messgerät) verwalten und im Einsatzplaner Projekten zuweisen. InspectionModule (VDE/DGUV) wird als Sub-Funktionalität integriert.

## Architektur

```
inspection_devices (erweitert)
  ├── MachineModule UI (Karten, KPIs, CRUD)
  ├── InspectionModule (VDE-Prüfprotokolle, bleibt eigenständig)
  └── Planner Equipment-Sektion
         └── equipment_assignments (Gerät ↔ Projekt ↔ Zeitraum)
```

## Datenbank

### Tabelle: `inspection_devices` (erweitern)

Bestehende Spalten bleiben. Neue Spalten:

| Spalte | Typ | Beschreibung |
|---|---|---|
| category | text, CHECK ('werkzeug', 'fahrzeug', 'messgeraet'), default 'werkzeug' | Geräte-Kategorie |
| operating_hours | integer, default 0 | Betriebsstunden |
| condition | text, CHECK ('gut', 'maessig', 'schlecht', 'defekt'), default 'gut' | Zustand |
| current_location | text | Aktueller Standort/Baustelle |
| purchase_date | date | Kaufdatum |
| purchase_price | decimal(10,2) | Anschaffungspreis |

### Neue Tabelle: `equipment_assignments`

| Spalte | Typ | Beschreibung |
|---|---|---|
| id | uuid, PK | |
| device_id | uuid, FK → inspection_devices, NOT NULL | |
| project_id | uuid, FK → projects, NOT NULL | |
| start_date | date | Einsatz-Start |
| end_date | date | Einsatz-Ende |
| is_active | boolean, default true | |
| notes | text | Notizen (z.B. "für Kabelzug") |
| created_at | timestamptz, default now() | |
| updated_at | timestamptz, default now() | |

**Unique constraint:** `(device_id, project_id)` — ein Gerät pro Projekt.

**RLS:** Company-Filter über Join auf `inspection_devices.company_id`. SELECT/UPDATE für eigene Company. INSERT für eigene Company. Service-role für Edge Functions.

**Indexes:**
- `equipment_assignments_device_idx` auf `(device_id, is_active)`
- `equipment_assignments_project_idx` auf `(project_id, is_active)`

## MachineModule UI

Ersetzt den bestehenden Stub (`src/components/MachineModule.tsx`) komplett.

### Layout
- **KPI-Zeile:** Gesamt-Geräte | Verfügbar | Im Einsatz | Wartung fällig
- **Filter:** Kategorie (Werkzeug/Fahrzeug/Messgerät), Zustand, Suche nach Name/Seriennummer
- **Geräte-Grid:** Karten mit Name, Kategorie-Icon, Status-Badge, Betriebsstunden, nächste Wartung/DGUV, aktueller Standort
- **"Gerät hinzufügen" Button** → Dialog mit allen Feldern
- **Klick auf Karte** → Detail-Ansicht mit Wartungshistorie + aktuelle Projektzuweisung

### Geräte-Kategorien

| Kategorie | Icon | Beispiele |
|---|---|---|
| werkzeug | Wrench | Bohrmaschine, Flex, Stemmhammer |
| fahrzeug | Truck | Transporter, Anhänger, Pritsche |
| messgeraet | Gauge | Multimeter, Isolationsmessgerät, Duspol |

### Datenfluss
- `useMachineData()` Hook — React Query auf `inspection_devices` mit erweiterten Spalten + `equipment_assignments`
- Bestehender `inspectionService.ts` wird erweitert:
  - `getDevicesWithAssignments()` — Geräte mit aktuellen Projektzuweisungen
  - `updateOperatingHours(deviceId, hours)` — Betriebsstunden aktualisieren
  - `updateCondition(deviceId, condition)` — Zustand ändern
  - `assignToProject(deviceId, projectId, startDate, endDate)` — Gerät zuweisen
  - `unassignFromProject(deviceId, projectId)` — Zuweisung entfernen
- DGUV-Termine kommen weiterhin aus `inspection_schedules` (keine Änderung)

### Bestehende Machine-Subkomponenten

Die 5 Stub-Komponenten in `src/components/machine/` werden an echte Daten angebunden:

| Komponente | Wird zu |
|---|---|
| MachineCard.tsx | Echte Geräte-Karten aus DB |
| MachineStatsDynamic.tsx | Bleibt (berechnet schon dynamisch aus Array) |
| MaintenanceSchedule.tsx | Liest `inspection_schedules` aus DB |
| MachineActions.tsx | Echte Handler (Wartung planen, DGUV, Standort) |
| OverdueMaintenance.tsx | Liest überfällige aus `inspection_devices.next_inspection_date` |

## Planner-Integration

### Neue Sektion im Einsatzplaner

Unterhalb der Mitarbeiter-Zeilen kommt ein Trenn-Header "Geräte & Fahrzeuge" gefolgt von Equipment-Zeilen.

### EntryType Erweiterung

```typescript
export type EntryType = 'project' | 'vacation' | 'sick' | 'equipment';
```

Neues Farbschema für Equipment:
```typescript
export const EQUIPMENT_COLOR = {
  bg: 'bg-slate-100', text: 'text-slate-900',
  border: 'border-slate-500', dot: 'bg-slate-500'
} as const;
```

### EquipmentRow Komponente

Analog zu `EmployeeRow`, aber einfacher:
- Zeigt Geräte-Name + Kategorie-Icon + Zustand
- Gantt-Balken für `equipment_assignments` (Projekt-Zuweisungen)
- Kein Urlaub/Krank — nur Projekte
- Drag & Drop zum Verschieben von Zuweisungen
- Klick auf leere Zelle → Equipment-Assign-Dialog

### Konflikterkennung

Gerät doppelt gebucht (2 Projekte am selben Tag) = roter Warning-Indikator, analog zu Mitarbeiter-Konflikten.

### usePlannerData Erweiterung

Zusätzliche Queries:
- `plannerDevices` — `inspection_devices` mit category, condition, operating_hours
- `plannerEquipmentAssignments` — `equipment_assignments` mit project join

### KPI-Erweiterung

Neue KPI-Karte im Planner: "Geräte im Einsatz" (Anzahl Geräte mit aktiver Zuweisung heute).

### Equipment-Zuweisung im "Neuer Eintrag" Dialog

Der bestehende SingleAssignDialog bekommt einen 4. Tab "Gerät":
- Dropdown: Gerät wählen (aus inspection_devices)
- Dropdown: Projekt wählen
- Datumsbereich: Von/Bis

## Nicht im Scope

- Wartungskosten-Tracking (späterer Ausbau)
- GPS-Tracking von Fahrzeugen
- Barcode/QR-Scanner für Geräte-Identifikation
- Miet-Equipment von externen Anbietern
- Automatische Betriebsstunden-Erfassung
