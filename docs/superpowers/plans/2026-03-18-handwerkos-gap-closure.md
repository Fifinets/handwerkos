# HandwerkOS Lücken schließen – Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Alle Mock-Module durch echte Supabase-Daten ersetzen und fehlende Features für eine vollständige Handwerker-App implementieren.

**Architecture:** Jedes Modul folgt dem bestehenden Pattern: React Query hooks aus `useApi.ts` wo vorhanden, sonst direkte Supabase-Queries mit `useSupabaseAuth()` für `companyId`. Bestehende UI-Strukturen behalten, nur Datenanbindung ersetzen.

**Tech Stack:** React 18, Supabase (PostgREST), shadcn/ui, Tailwind CSS, date-fns, `useToast` (aus `@/hooks/use-toast`), Lucide icons.

---

## Scope & Priorisierung

| Prio | Modul | Status Jetzt | Aufwand |
|------|-------|-------------|---------|
| 🔥 0 | DB-Migration: vacation_requests + employee vacation columns | Fehlt | Klein |
| 🔥 1 | FinanceModuleV2 | 100% Mock | Mittel |
| 🔥 2 | MaterialModuleV2 | 100% Mock | Mittel |
| 🔥 3 | PlannerModuleV2 | 100% Mock | Groß |
| 🔥 4 | DesktopEmployeePage: Urlaub-Tab | Placeholder | Klein |
| 🔥 5 | DesktopEmployeePage: Rechnungen-Tab | Placeholder | Klein |
| ⚠️ 6 | ExecutiveDashboardV2: Charts | Hardcoded | Klein |

---

## File Structure

### Neue Dateien
- `supabase/migrations/20260318000002_create_vacation_requests.sql` — Neue Tabelle + Employee-Spalten

### Zu ändernde Dateien
| Datei | Änderung |
|-------|----------|
| `src/components/FinanceModuleV2.tsx` | Mock-Fallbacks in bestehenden React-Query-Hooks fixen |
| `src/services/financeService.ts` | Mock-Daten entfernen, echte Queries nutzen |
| `src/components/MaterialModuleV2.tsx` | Mock-Daten durch echte Supabase-Queries ersetzen |
| `src/components/PlannerModuleV2.tsx` | Mock-Daten durch echte Mitarbeiter+Projekte-Queries ersetzen |
| `src/components/employee/DesktopEmployeePage.tsx` | Urlaub-Tab + Rechnungen-Tab implementieren |
| `src/components/ExecutiveDashboardV2.tsx` | Hardcoded Chart-Daten durch echte Queries ersetzen |

---

## Task 0: DB-Migration – vacation_requests Tabelle

**Files:**
- Create: `supabase/migrations/20260318000002_create_vacation_requests.sql`

**Kontext:** Die `VacationRequestDialog` referenziert bereits `vacation_requests`, aber die Tabelle existiert nicht in der DB. Auch `employees.vacation_days_total` und `vacation_days_used` fehlen.

- [ ] **Step 1: Migration schreiben**

```sql
-- Vacation columns on employees
ALTER TABLE employees ADD COLUMN IF NOT EXISTS vacation_days_total INT DEFAULT 30;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS vacation_days_used INT DEFAULT 0;

-- Vacation requests table
CREATE TABLE IF NOT EXISTS vacation_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  employee_id UUID NOT NULL REFERENCES employees(id),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days_requested INT NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_by UUID REFERENCES employees(id),
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_vacation_requests_employee ON vacation_requests(employee_id, start_date DESC);
CREATE INDEX IF NOT EXISTS idx_vacation_requests_company ON vacation_requests(company_id, status);

-- RLS
ALTER TABLE vacation_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vacation_requests_company_access" ON vacation_requests
  FOR ALL USING (
    company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
  );
```

- [ ] **Step 2: Migration pushen + Typen regenerieren**

```bash
npx supabase db push
npx supabase gen types typescript --project-id qgwhkjrhndeoskrxewpb > src/integrations/supabase/types.ts
```

- [ ] **Step 3: Testen**

Run: `npx tsc --noEmit`

- [ ] **Step 4: Committen**

```bash
git add supabase/migrations/20260318000002_create_vacation_requests.sql src/integrations/supabase/types.ts
git commit -m "feat: add vacation_requests table + employee vacation columns"
```

---

## Task 1: FinanceModuleV2 – Echte Daten

**Files:**
- Modify: `src/components/FinanceModuleV2.tsx`
- Modify: `src/services/financeService.ts` (falls Mock-Daten dort liegen)

**Kontext:** Das Modul nutzt bereits React Query hooks `useInvoices()`, `useExpenses()`, `useFinancialKpis()` aus `useApi.ts`. Die Daten werden aber durch Mock-Fallbacks überschrieben. Die DB hat `invoices` (mit `net_amount`, `gross_amount`, `tax_amount`, `status`) und `expenses` (mit `amount`, `category`, `expense_date`, `receipt_url`).

**Wichtig:** Die bestehenden React Query hooks (`useInvoices`, `useExpenses`) beibehalten — nicht durch rohe `useEffect`-Queries ersetzen. Stattdessen die Mock-Fallbacks in der Komponente und/oder im Service entfernen.

- [ ] **Step 1: Mock-Fallbacks identifizieren und entfernen**

In `FinanceModuleV2.tsx`: `mockMonthlyData`, `getMockInvoices()`, `calculateStats()` mit hardcoded Werten entfernen. Ersetze die Stats-Berechnung durch echte Werte aus dem `useInvoices()` Response.

- [ ] **Step 2: KPI-Karten mit echten Werten berechnen**

```tsx
const invoicesList = invoicesResponse?.data || [];
const expensesList = expensesResponse?.data || [];

const totalRevenue = invoicesList.reduce((s, i) => s + (i.gross_amount || 0), 0);
const totalExpenses = expensesList.reduce((s, e) => s + (e.amount || 0), 0);
const openInvoices = invoicesList.filter(i => i.status === 'issued' || i.status === 'overdue');
const overdueCount = invoicesList.filter(i => i.status === 'overdue').length;
```

- [ ] **Step 3: Rechnungstabelle mit echten Daten rendern**

Spalten: Nr. | Datum | Kunde | Betrag (brutto) | Status.
Nutze `snapshot_customer_name` für Kundennamen. Status-Badge: draft=outline, issued=default, paid=grün, overdue=destructive.

- [ ] **Step 4: Ausgaben-Tab implementieren**

Tabelle: Datum | Mitarbeiter | Kategorie | Beschreibung | Betrag.
`receipt_url` als Link-Icon anzeigen falls vorhanden.

- [ ] **Step 5: Monatliche Umsatz-Daten aus Rechnungen berechnen**

```tsx
const monthlyData = invoicesList.reduce((acc, inv) => {
  const month = inv.invoice_date?.substring(0, 7); // YYYY-MM
  if (!acc[month]) acc[month] = 0;
  acc[month] += inv.gross_amount || 0;
  return acc;
}, {} as Record<string, number>);
```

- [ ] **Step 6: Testen und committen**

Run: `npx tsc --noEmit && npx vite build`

```bash
git add src/components/FinanceModuleV2.tsx src/services/financeService.ts
git commit -m "feat: replace finance module mock data with real Supabase queries"
```

---

## Task 2: MaterialModuleV2 – Echte Inventarverwaltung

**Files:**
- Modify: `src/components/MaterialModuleV2.tsx`

**Kontext:** Die DB hat `materials` (id, company_id, name, description, unit, category, current_stock, min_stock, unit_price, supplier_name) und `stock_movements` (material_id, quantity, movement_type, notes, company_id). Das Modul zeigt aktuell 4 hardcoded Mock-Items.

- [ ] **Step 1: Mock entfernen, echte Daten laden**

```tsx
const { companyId } = useSupabaseAuth();
const [materials, setMaterials] = useState<any[]>([]);
const [isLoading, setIsLoading] = useState(true);

useEffect(() => {
  if (!companyId) return;
  supabase.from('materials').select('*')
    .eq('company_id', companyId)
    .order('name')
    .then(({ data, error }) => {
      if (error) console.error('Error loading materials:', error);
      setMaterials(data || []);
      setIsLoading(false);
    });
}, [companyId]);
```

- [ ] **Step 2: KPI-Karten berechnen**

```tsx
const totalItems = materials.length;
const lowStock = materials.filter(m => m.current_stock <= m.min_stock).length;
const totalValue = materials.reduce((s, m) => s + ((m.current_stock || 0) * (m.unit_price || 0)), 0);
```

- [ ] **Step 3: Material-Tabelle mit echten Daten**

Spalten: Name | Kategorie | Bestand | Min. | Einheit | Einzelpreis | Status.
Status-Badge: `current_stock > min_stock` → grün, `<= min_stock` → rot/warning.

- [ ] **Step 4: Material-hinzufügen Dialog**

Felder: Name*, Kategorie, Einheit, Anfangsbestand, Mindestbestand, Einzelpreis, Lieferant.
Insert: `supabase.from('materials').insert({ company_id: companyId, ...formData })`.

**Wichtig:** `company_id` muss beim Insert mitgegeben werden (RLS).

- [ ] **Step 5: Bestand korrigieren**

Button "Bestand +/-" → Dialog mit Menge (+/-) und Notiz.
1. Insert in `stock_movements`: `{ material_id, quantity, movement_type: 'adjustment', notes, company_id }`
2. Update `materials.current_stock`: `current_stock + quantity`

- [ ] **Step 6: Testen und committen**

```bash
git add src/components/MaterialModuleV2.tsx
git commit -m "feat: replace material module mock data with real inventory management"
```

---

## Task 3: PlannerModuleV2 – Echte Ressourcenplanung

**Files:**
- Modify: `src/components/PlannerModuleV2.tsx`

**Kontext:** Komplett UI-only mit 4 Mock-Ressourcen. V1-Ansatz: Mitarbeiter als Zeilen, Wochentage als Spalten, Projekt-Badges in den Zellen basierend auf `project_team_assignments`.

- [ ] **Step 1: Mock-Daten entfernen, Projekte + Mitarbeiter laden**

```tsx
const { companyId } = useSupabaseAuth();
const [projects, setProjects] = useState<any[]>([]);
const [employees, setEmployees] = useState<any[]>([]);

useEffect(() => {
  if (!companyId) return;
  Promise.all([
    supabase.from('projects')
      .select('id, name, status, start_date, end_date, project_team_assignments(employee_id)')
      .eq('company_id', companyId)
      .in('status', ['active', 'in_bearbeitung', 'geplant', 'planned']),
    supabase.from('employees')
      .select('id, first_name, last_name, status')
      .eq('company_id', companyId)
      .eq('status', 'Aktiv'),
  ]).then(([projRes, empRes]) => {
    if (projRes.error) console.error('Projects:', projRes.error);
    if (empRes.error) console.error('Employees:', empRes.error);
    setProjects(projRes.data || []);
    setEmployees(empRes.data || []);
  });
}, [companyId]);
```

- [ ] **Step 2: Wochenansicht als Grid rendern**

Zeilen = Mitarbeiter. Spalten = Mo-Fr der aktuellen Woche.
Für jede Zelle: Finde Projekte wo dieser Mitarbeiter in `project_team_assignments` ist und das Projekt im Datumszeitraum der Woche liegt. Zeige als farbige Badge.

- [ ] **Step 3: Wochennavigation (vor/zurück)**

State: `weekOffset`. Buttons "← Vorherige" / "Nächste →".
```tsx
import { startOfWeek, addWeeks, addDays, format } from 'date-fns';
const weekStart = startOfWeek(addWeeks(new Date(), weekOffset), { weekStartsOn: 1 });
const weekDays = Array.from({ length: 5 }, (_, i) => addDays(weekStart, i));
```

- [ ] **Step 4: KPI-Zeile**

- Aktive Projekte: `projects.length`
- Zugewiesene MA: Anzahl unique employee_ids aus allen project_team_assignments
- Freie MA: `employees.length - assignedCount`

- [ ] **Step 5: Testen und committen**

```bash
git add src/components/PlannerModuleV2.tsx
git commit -m "feat: replace planner mock data with real project-employee grid"
```

---

## Task 4: DesktopEmployeePage – Urlaub-Tab

**Files:**
- Modify: `src/components/employee/DesktopEmployeePage.tsx`

**Voraussetzung:** Task 0 muss zuerst abgeschlossen sein (`vacation_requests` Tabelle muss existieren).

**Kontext:** Der Tab zeigt aktuell nur Placeholder-Text "Urlaubsanträge und Resturlaub werden hier angezeigt." Die `VacationRequestDialog` existiert schon, hat aber einen Prop-Mismatch: DesktopEmployeePage übergibt `isOpen`/`onClose`, Dialog erwartet möglicherweise `open`/`onOpenChange`. Prüfe Props vor dem Wiring.

- [ ] **Step 1: Urlaubsdaten laden**

```tsx
const [vacationRequests, setVacationRequests] = useState<any[]>([]);

const fetchVacation = async () => {
  if (!employee) return;
  const { data, error } = await supabase.from('vacation_requests')
    .select('*')
    .eq('employee_id', employee.id)
    .order('start_date', { ascending: false });
  if (error) console.error('Vacation fetch error:', error);
  setVacationRequests(data || []);
};
```

In `useEffect` neben `fetchProjects()` aufrufen.

- [ ] **Step 2: Urlaubs-KPIs anzeigen**

3-Spalten-Grid: Gesamtanspruch | Genommen | Resturlaub.
Berechne Resturlaub als `(vacation_days_total || 30) - (vacation_days_used || 0)`.
Oder alternativ: Summiere `days_requested` aus approved vacation_requests.

- [ ] **Step 3: Urlaubsanträge-Tabelle**

Spalten: Zeitraum (start_date – end_date) | Tage | Grund | Status.
Status-Badge: pending → gelb "Ausstehend", approved → grün "Genehmigt", rejected → rot "Abgelehnt".

- [ ] **Step 4: VacationRequestDialog Props + Callback prüfen und fixen**

Prüfe ob Props `isOpen`/`onClose` korrekt sind oder ob `open`/`onOpenChange` erwartet wird. Füge `onSuccess` Callback hinzu → `fetchVacation()` aufrufen.

- [ ] **Step 5: Testen und committen**

```bash
git add src/components/employee/DesktopEmployeePage.tsx
git commit -m "feat: implement vacation tab with real data in employee page"
```

---

## Task 5: DesktopEmployeePage – Rechnungen-Tab

**Files:**
- Modify: `src/components/employee/DesktopEmployeePage.tsx`

**Kontext:** Nur für Mitarbeiter mit `canViewInvoices()` Grant sichtbar. Zeigt Rechnungen der Firma (read-only).

- [ ] **Step 1: Rechnungsdaten laden (nur bei Grant)**

```tsx
const [invoiceList, setInvoiceList] = useState<any[]>([]);

const fetchInvoices = async () => {
  if (!employee || !canViewInvoices()) return;
  const { data, error } = await supabase.from('invoices')
    .select('*')
    .eq('company_id', employee.company_id)
    .order('invoice_date', { ascending: false })
    .limit(50);
  if (error) console.error('Invoice fetch error:', error);
  setInvoiceList(data || []);
};
```

In `useEffect` aufrufen (nach Grant-Check).

- [ ] **Step 2: Rechnungstabelle rendern**

Spalten: Nr. (`invoice_number`) | Datum (`invoice_date`) | Kunde (`snapshot_customer_name`) | Betrag (`gross_amount`) | Fällig (`due_date`) | Status.

- [ ] **Step 3: Status-Badges**

```tsx
const invoiceStatusMap: Record<string, { label: string; variant: string }> = {
  draft: { label: 'Entwurf', variant: 'outline' },
  issued: { label: 'Gestellt', variant: 'default' },
  paid: { label: 'Bezahlt', variant: 'default' },
  overdue: { label: 'Überfällig', variant: 'destructive' },
  cancelled: { label: 'Storniert', variant: 'secondary' },
};
```

- [ ] **Step 4: Testen und committen**

```bash
git add src/components/employee/DesktopEmployeePage.tsx
git commit -m "feat: implement invoices tab in employee page"
```

---

## Task 6: ExecutiveDashboardV2 – Echte Chart-Daten

**Files:**
- Modify: `src/components/ExecutiveDashboardV2.tsx`

**Kontext:** `revenueData` (Zeile ~71) ist hardcoded. Ersetze durch echte Monatswerte aus `invoices.gross_amount`. Nutze bestehende `loadDashboardData()` Funktion.

- [ ] **Step 1: Chart-Daten aus Rechnungen berechnen**

```tsx
// In loadDashboardData():
const { data: invData } = await supabase.from('invoices')
  .select('invoice_date, gross_amount, status')
  .eq('company_id', companyId)
  .in('status', ['issued', 'paid']);

const monthlyRevenue: Record<string, number> = {};
(invData || []).forEach(inv => {
  const month = inv.invoice_date?.substring(0, 7);
  if (month) monthlyRevenue[month] = (monthlyRevenue[month] || 0) + (inv.gross_amount || 0);
});

// Letzte 6 Monate
const months = Array.from({ length: 6 }, (_, i) => {
  const d = new Date();
  d.setMonth(d.getMonth() - 5 + i);
  return format(d, 'yyyy-MM');
});
const chartData = months.map(m => ({
  month: format(new Date(m + '-01'), 'MMM', { locale: de }),
  revenue: monthlyRevenue[m] || 0,
}));
```

- [ ] **Step 2: Hardcoded revenueData ersetzen**

State `revenueData` dynamisch aus `chartData` setzen.

- [ ] **Step 3: Testen und committen**

```bash
git add src/components/ExecutiveDashboardV2.tsx
git commit -m "feat: replace dashboard hardcoded chart data with real invoice revenue"
```

---

## Verifikation

Nach Abschluss aller Tasks:

1. `npx tsc --noEmit` → 0 Fehler
2. `npx vite build` → Build erfolgreich
3. Manager-Ansicht: Finanzen → echte Rechnungen + Ausgaben sichtbar
4. Manager-Ansicht: Material → echte Bestände + CRUD funktional
5. Manager-Ansicht: Planer → Mitarbeiter-Projekt-Wochengrid sichtbar
6. Employee-Ansicht: Urlaub-Tab → KPIs + Anträge + Dialog funktional
7. Employee-Ansicht: Rechnungen-Tab → Rechnungsliste (nur mit Grant)
8. Dashboard: Umsatz-Chart → echte Monatswerte aus Rechnungen
