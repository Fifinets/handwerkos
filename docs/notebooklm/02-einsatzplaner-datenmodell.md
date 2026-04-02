# Einsatzplaner - Datenmodell & Datenbankschema

## Kerntabellen für die Einsatzplanung

### 1. project_team_assignments (Haupttabelle für Zuweisungen)

```sql
CREATE TABLE project_team_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id),
  employee_id UUID REFERENCES employees(id),
  role TEXT DEFAULT 'team_member',
  hourly_rate NUMERIC,
  hours_budgeted NUMERIC,
  hours_actual NUMERIC,
  responsibilities TEXT[],
  start_date DATE,
  end_date DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(project_id, employee_id)
);
```

**Trigger**: Automatische Neuberechnung der Projekt-Arbeitskosten bei Änderung.

### 2. project_assignments (Legacy-Tabelle, kaum genutzt)

```sql
CREATE TABLE project_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id),
  employee_id UUID REFERENCES employees(id),
  role TEXT,
  start_date DATE,
  end_date DATE,
  hours_per_day NUMERIC DEFAULT 8.0,
  notes TEXT,
  UNIQUE(project_id, employee_id, start_date)
);
```

**Hinweis**: Diese Tabelle existiert parallel zu `project_team_assignments`, wird aber im Planer NICHT verwendet. Potenzielle Verwirrungsquelle.

### 3. vacation_requests (Abwesenheiten)

```sql
CREATE TABLE vacation_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES employees(id),
  company_id UUID REFERENCES companies(id),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days_requested INTEGER,
  absence_type TEXT DEFAULT 'vacation', -- 'vacation', 'sick', 'personal'
  status TEXT DEFAULT 'pending',         -- 'pending', 'approved', 'rejected'
  reason TEXT,
  approved_by UUID REFERENCES employees(id),
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### 4. employee_absences (Alternative Abwesenheitstabelle)

```sql
CREATE TABLE employee_absences (
  id UUID PRIMARY KEY,
  employee_id UUID REFERENCES employees(id),
  type TEXT,            -- 'urlaub', 'krank', 'fortbildung', 'elternzeit'
  start_date DATE,
  end_date DATE,
  start_time TIME,
  end_time TIME,
  is_full_day BOOLEAN DEFAULT true,
  status TEXT,          -- 'beantragt', 'genehmigt', 'abgelehnt'
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  company_id UUID
);
```

**Hinweis**: Auch hier Dopplung mit `vacation_requests`.

### 5. calendar_events (Termine & Besichtigungen)

```sql
CREATE TABLE calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  start_time TEXT,
  end_time TEXT,
  is_full_day BOOLEAN DEFAULT true,
  type TEXT,             -- 'termin', 'meeting', 'schulung', 'besichtigung'
  color TEXT,
  created_by UUID REFERENCES employees(id),
  assigned_employees UUID[],
  project_id UUID REFERENCES projects(id),
  company_id UUID REFERENCES companies(id)
);
```

### 6. projects (Projektdaten)

Relevante Felder für Planung:
```sql
-- Planungsrelevante Felder
status TEXT,              -- 'geplant', 'beauftragt', 'in_bearbeitung', 'abgeschlossen'
start_date DATE,
end_date DATE,
work_start_date DATE,     -- Überschreibt start_date für Planung
work_end_date DATE,       -- Überschreibt end_date für Planung
location TEXT,
budget NUMERIC,
labor_costs NUMERIC,      -- Auto-berechnet aus team_assignments
material_costs NUMERIC,   -- Auto-berechnet aus project_materials
progress_percentage INTEGER
```

### 7. employees (Mitarbeiterdaten)

Relevante Felder für Planung:
```sql
first_name TEXT,
last_name TEXT,
position TEXT,            -- Für Filterung im Planer
status TEXT,              -- 'aktiv', 'inaktiv'
hourly_rate NUMERIC,
vacation_days_total INTEGER,
vacation_days_used INTEGER,
company_id UUID
```

## Beziehungen (Entity Relationship)

```
projects 1──N project_team_assignments N──1 employees
                                            │
employees 1──N vacation_requests            │
employees 1──N employee_absences            │
                                            │
calendar_events N──1 projects               │
calendar_events ──── assigned_employees[] ──┘
```

## Multi-Tenancy & Sicherheit

- Alle Tabellen haben `company_id`
- RLS-Policies auf allen Tabellen: `user_has_company_access(company_id)`
- Auto-Trigger: `set_company_id_from_profile()` bei INSERT
- Rollen: `manager`, `employee` (nur Manager sehen den Planer)

## Bekannte Datenmodell-Probleme

1. **Doppelte Zuweisungstabellen**: `project_assignments` und `project_team_assignments` existieren parallel
2. **Doppelte Abwesenheitstabellen**: `vacation_requests` und `employee_absences` mit unterschiedlichen Schemata
3. **Kein Audit-Trail**: Keine Änderungshistorie für Zuweisungen
4. **Keine Teilzeit-Unterstützung**: Kein `hours_per_day` in `project_team_assignments`
5. **Array-FK für Kalender**: `assigned_employees UUID[]` statt Junction-Table → keine referenzielle Integrität
