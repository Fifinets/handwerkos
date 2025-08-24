# Schritt 2: Design - Zeitliche Verfügbarkeitsprüfung

## 🎯 Ziel
Bevor ein Mitarbeiter einem Projekt zugewiesen wird, prüfen ob er zeitlich verfügbar ist.

## 📊 Verfügbare Daten (aus Debug-Analyse)
- ✅ projects Tabelle (mit start_date, end_date)
- ✅ employees Tabelle (2 Mitarbeiter: Maxi, Flo)
- ✅ project_team_members Tabelle (Zuweisungen)
- ✅ time_entries Tabelle (Arbeitsstunden)

## 🔍 Verfügbarkeitsprüfungen

### 1. Projekt-Überschneidungsprüfung
```sql
-- Prüfe ob Mitarbeiter bereits in überschneidenden Projekten arbeitet
SELECT COUNT(*) as conflicts
FROM project_team_members ptm
JOIN projects p ON p.id = ptm.project_id
WHERE ptm.employee_id = :employee_id
  AND p.id != :new_project_id
  AND (
    (p.start_date BETWEEN :new_start_date AND :new_end_date) OR
    (p.end_date BETWEEN :new_start_date AND :new_end_date) OR
    (p.start_date <= :new_start_date AND p.end_date >= :new_end_date)
  );
```

### 2. Stunden-Kapazitätsprüfung  
```sql
-- Prüfe wöchentliche Arbeitsbelastung
SELECT 
    employee_id,
    COUNT(DISTINCT ptm.project_id) as active_projects,
    COALESCE(SUM(weekly_hours.hours), 0) as weekly_hours
FROM project_team_members ptm
LEFT JOIN (
    SELECT 
        employee_id, 
        project_id,
        SUM(hours_worked) as hours
    FROM time_entries 
    WHERE entry_date >= CURRENT_DATE - INTERVAL '7 days'
    GROUP BY employee_id, project_id
) weekly_hours ON weekly_hours.employee_id = ptm.employee_id
WHERE ptm.employee_id = :employee_id
GROUP BY ptm.employee_id;
```

### 3. Einfache Verfügbarkeitsstufen
- 🟢 **VERFÜGBAR**: Keine Konflikte, < 40h/Woche
- 🟡 **BESCHÄFTIGT**: 1-2 Projekte, 30-40h/Woche  
- 🔴 **ÜBERLASTET**: 3+ Projekte oder 40+ h/Woche
- ⚫ **BLOCKIERT**: Überschneidende Projektlaufzeiten

## 🚀 Implementation Plan

### Phase 1: Backend Service
```typescript
interface EmployeeAvailability {
  employee_id: string;
  status: 'available' | 'busy' | 'overloaded' | 'blocked';
  current_projects: number;
  weekly_hours: number;
  conflicts: ProjectConflict[];
  recommendations: string[];
}

interface ProjectConflict {
  project_id: string;
  project_name: string;
  overlap_days: number;
  conflict_type: 'date_overlap' | 'capacity_exceeded';
}
```

### Phase 2: Frontend Integration
- Verfügbarkeitsstatus im Mitarbeiter-Dialog anzeigen
- Warnungen bei Konflikten
- Empfehlungen zur Lösung

### Phase 3: Erweiterte Features
- Urlaubsplanung
- Arbeitszeit-Templates (Teilzeit, Vollzeit)
- Skill-basierte Zuweisung

## 📋 Nächste Schritte
1. ✅ Simple availability service implementieren
2. ✅ In ProjectDetailView integrieren  
3. ✅ UI für Verfügbarkeitsstatus
4. ✅ Tests mit Maxi & Flo

## 🎨 UI Mockup
```
┌─────────────────────────────────────┐
│ Team-Mitglied hinzufügen            │
├─────────────────────────────────────┤
│ 🟢 Maxi Bub                        │
│    Projektleiter                    │
│    📊 Verfügbar (1 Projekt, 25h/W) │
│    [Hinzufügen]                     │
├─────────────────────────────────────┤  
│ 🟡 Flo Bub                         │
│    Bauingenieur                     │
│    ⚠️  Beschäftigt (2 Projekte, 35h)│
│    [Trotzdem hinzufügen]            │
└─────────────────────────────────────┘
```