# Saisonale Trendanalyse - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Auslastung" tab to ReportsModuleV2 showing 12-month team utilization trends with per-employee heatmap.

**Architecture:** Pure frontend calculation from existing Supabase tables (project_team_assignments, vacation_requests, employees). No new DB tables. New useUtilizationTrends hook + UtilizationTrendsTab component.

**Tech Stack:** React 18 + TypeScript, Recharts, @tanstack/react-query, shadcn/ui, date-fns with German locale.

---

## File Structure

### New files:
```
src/hooks/useUtilizationTrends.ts        # Data hook: loads + computes 12-month trends
src/components/reports/UtilizationTrendsTab.tsx  # Tab UI: KPIs, BarChart, Heatmap
```

### Files to modify:
- `src/components/ReportsModuleV2.tsx` — Add "Auslastung" tab

---

## Task 1: Create useUtilizationTrends hook

**Files:**
- Create: `src/hooks/useUtilizationTrends.ts`

- [ ] **Step 1: Create the hook**

```typescript
// src/hooks/useUtilizationTrends.ts
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { format, startOfMonth, endOfMonth, subMonths, eachDayOfInterval, addDays } from 'date-fns';
import { de } from 'date-fns/locale';
import { getGermanHolidays } from '@/components/planner/holidays';

export interface MonthlyUtilization {
  month: string;       // 'yyyy-MM'
  monthLabel: string;  // 'Jan', 'Feb', ...
  teamPercent: number; // 0-100+
  assignedCount: number;
  totalEmployees: number;
}

export interface EmployeeMonthlyData {
  employeeId: string;
  employeeName: string;
  position: string | null;
  months: Record<string, number>; // 'yyyy-MM' → percent
  average: number;
}

export interface TrendSummary {
  averageUtilization: number;
  strongestMonth: { label: string; percent: number } | null;
  weakestMonth: { label: string; percent: number } | null;
  trend: 'up' | 'down' | 'stable';
  trendDelta: number;
}

interface Assignment {
  employee_id: string;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
}

interface Vacation {
  employee_id: string;
  start_date: string;
  end_date: string;
}

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  position: string | null;
}

export function useUtilizationTrends() {
  const { companyId } = useSupabaseAuth();

  const dataQuery = useQuery({
    queryKey: ['utilization-trends', companyId],
    queryFn: async () => {
      const [empRes, assignRes, vacRes] = await Promise.all([
        supabase
          .from('employees')
          .select('id, first_name, last_name, position')
          .eq('company_id', companyId!)
          .not('status', 'in', '("Inaktiv","Gekündigt")'),
        supabase
          .from('project_team_assignments')
          .select('employee_id, start_date, end_date, is_active')
          .eq('is_active', true),
        supabase
          .from('vacation_requests')
          .select('employee_id, start_date, end_date')
          .eq('company_id', companyId!)
          .eq('status', 'approved'),
      ]);
      return {
        employees: (empRes.data || []) as Employee[],
        assignments: (assignRes.data || []) as Assignment[],
        vacations: (vacRes.data || []) as Vacation[],
      };
    },
    enabled: !!companyId,
    staleTime: 60_000,
  });

  const { monthlyData, employeeData, summary } = useMemo(() => {
    if (!dataQuery.data) {
      return {
        monthlyData: [] as MonthlyUtilization[],
        employeeData: [] as EmployeeMonthlyData[],
        summary: { averageUtilization: 0, strongestMonth: null, weakestMonth: null, trend: 'stable' as const, trendDelta: 0 },
      };
    }

    const { employees, assignments, vacations } = dataQuery.data;
    const now = new Date();
    const months: { start: Date; end: Date; key: string; label: string }[] = [];

    for (let i = 11; i >= 0; i--) {
      const monthDate = subMonths(now, i);
      const start = startOfMonth(monthDate);
      const end = endOfMonth(monthDate);
      months.push({
        start,
        end,
        key: format(start, 'yyyy-MM'),
        label: format(start, 'MMM', { locale: de }),
      });
    }

    // Precompute holidays for all relevant years
    const years = new Set(months.map(m => m.start.getFullYear()));
    const allHolidays = new Map<string, string>();
    years.forEach(y => getGermanHolidays(y).forEach((v, k) => allHolidays.set(k, v)));

    // Calculate per-employee per-month utilization
    const empMonthly: EmployeeMonthlyData[] = [];
    const monthlyTotals: Record<string, { totalPercent: number; count: number; assigned: number }> = {};
    months.forEach(m => { monthlyTotals[m.key] = { totalPercent: 0, count: 0, assigned: 0 }; });

    for (const emp of employees) {
      const empMonths: Record<string, number> = {};
      let totalUtil = 0;
      let monthCount = 0;

      for (const month of months) {
        const days = eachDayOfInterval({ start: month.start, end: month.end });
        let workDays = 0;
        let assignedDays = 0;
        let absentDays = 0;

        for (const day of days) {
          if (day.getDay() === 0 || day.getDay() === 6) continue;
          const ds = format(day, 'yyyy-MM-dd');
          if (allHolidays.has(ds)) continue;
          workDays++;

          // Check absence
          const isAbsent = vacations.some(
            v => v.employee_id === emp.id && ds >= v.start_date && ds <= v.end_date
          );
          if (isAbsent) {
            absentDays++;
            continue;
          }

          // Check assignment (any active project)
          const isAssigned = assignments.some(a => {
            if (a.employee_id !== emp.id) return false;
            const start = a.start_date || '2000-01-01';
            const end = a.end_date || '2099-12-31';
            return ds >= start && ds <= end;
          });
          if (isAssigned) assignedDays++;
        }

        const available = workDays - absentDays;
        const util = available > 0 ? Math.round((assignedDays / available) * 100) : 0;
        empMonths[month.key] = util;
        totalUtil += util;
        monthCount++;

        monthlyTotals[month.key].totalPercent += util;
        monthlyTotals[month.key].count++;
        if (util > 0) monthlyTotals[month.key].assigned++;
      }

      empMonthly.push({
        employeeId: emp.id,
        employeeName: `${emp.first_name} ${emp.last_name}`,
        position: emp.position,
        months: empMonths,
        average: monthCount > 0 ? Math.round(totalUtil / monthCount) : 0,
      });
    }

    // Sort by average utilization descending
    empMonthly.sort((a, b) => b.average - a.average);

    // Calculate monthly team averages
    const monthly: MonthlyUtilization[] = months.map(m => ({
      month: m.key,
      monthLabel: m.label,
      teamPercent: monthlyTotals[m.key].count > 0
        ? Math.round(monthlyTotals[m.key].totalPercent / monthlyTotals[m.key].count)
        : 0,
      assignedCount: monthlyTotals[m.key].assigned,
      totalEmployees: monthlyTotals[m.key].count,
    }));

    // Summary
    const validMonths = monthly.filter(m => m.totalEmployees > 0);
    const avg = validMonths.length > 0
      ? Math.round(validMonths.reduce((s, m) => s + m.teamPercent, 0) / validMonths.length)
      : 0;

    const sorted = [...validMonths].sort((a, b) => b.teamPercent - a.teamPercent);
    const strongest = sorted[0] || null;
    const weakest = sorted[sorted.length - 1] || null;

    // Trend: compare last 3 months avg vs previous 3 months avg
    const last3 = validMonths.slice(-3);
    const prev3 = validMonths.slice(-6, -3);
    const last3Avg = last3.length > 0 ? last3.reduce((s, m) => s + m.teamPercent, 0) / last3.length : 0;
    const prev3Avg = prev3.length > 0 ? prev3.reduce((s, m) => s + m.teamPercent, 0) / prev3.length : 0;
    const delta = Math.round(last3Avg - prev3Avg);
    const trend: 'up' | 'down' | 'stable' = delta > 5 ? 'up' : delta < -5 ? 'down' : 'stable';

    return {
      monthlyData: monthly,
      employeeData: empMonthly,
      summary: {
        averageUtilization: avg,
        strongestMonth: strongest ? { label: strongest.monthLabel, percent: strongest.teamPercent } : null,
        weakestMonth: weakest ? { label: weakest.monthLabel, percent: weakest.teamPercent } : null,
        trend,
        trendDelta: delta,
      },
    };
  }, [dataQuery.data]);

  return {
    monthlyData,
    employeeData,
    summary,
    isLoading: dataQuery.isLoading,
  };
}
```

- [ ] **Step 2: Verify and commit**

```bash
npx tsc --noEmit --pretty 2>&1 | head -20
git add src/hooks/useUtilizationTrends.ts
git commit -m "feat(reports): add useUtilizationTrends hook for 12-month analysis"
```

---

## Task 2: Create UtilizationTrendsTab component

**Files:**
- Create: `src/components/reports/UtilizationTrendsTab.tsx`

- [ ] **Step 1: Create the component**

```typescript
// src/components/reports/UtilizationTrendsTab.tsx
import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart3, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts';
import { useUtilizationTrends } from '@/hooks/useUtilizationTrends';
import { Skeleton } from '@/components/ui/skeleton';

function KpiCard({ icon: Icon, iconBg, iconColor, value, label, sub }: {
  icon: any; iconBg: string; iconColor: string; value: string; label: string; sub?: string;
}) {
  return (
    <Card className="bg-white border-slate-200 shadow-sm">
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`h-10 w-10 rounded-lg ${iconBg} flex items-center justify-center`}>
          <Icon className={`h-5 w-5 ${iconColor}`} />
        </div>
        <div>
          <div className="text-2xl font-semibold text-slate-900">{value}</div>
          <div className="text-xs text-slate-500">{label}</div>
          {sub && <div className="text-[10px] text-slate-400">{sub}</div>}
        </div>
      </CardContent>
    </Card>
  );
}

const getBarColor = (percent: number) => {
  if (percent > 100) return '#ef4444';
  if (percent >= 80) return '#f59e0b';
  return '#10b981';
};

const getCellColor = (percent: number) => {
  if (percent === 0) return 'bg-slate-100 text-slate-400';
  if (percent > 100) return 'bg-red-100 text-red-800';
  if (percent >= 80) return 'bg-amber-100 text-amber-800';
  return 'bg-emerald-100 text-emerald-800';
};

export function UtilizationTrendsTab() {
  const { monthlyData, employeeData, summary, isLoading } = useUtilizationTrends();
  const [positionFilter, setPositionFilter] = useState('all');

  const positions = useMemo(() => {
    const set = new Set<string>();
    employeeData.forEach(e => { if (e.position) set.add(e.position); });
    return Array.from(set).sort();
  }, [employeeData]);

  const filteredEmployees = useMemo(() => {
    if (positionFilter === 'all') return employeeData;
    return employeeData.filter(e => e.position === positionFilter);
  }, [employeeData, positionFilter]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
        </div>
        <Skeleton className="h-80 rounded-lg" />
        <Skeleton className="h-60 rounded-lg" />
      </div>
    );
  }

  const trendIcon = summary.trend === 'up' ? ArrowUpRight : summary.trend === 'down' ? ArrowDownRight : Minus;
  const trendColor = summary.trend === 'up' ? 'text-emerald-600' : summary.trend === 'down' ? 'text-red-600' : 'text-slate-500';
  const trendBg = summary.trend === 'up' ? 'bg-emerald-50' : summary.trend === 'down' ? 'bg-red-50' : 'bg-slate-50';

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KpiCard icon={BarChart3} iconBg="bg-blue-50" iconColor="text-blue-600"
          value={`${summary.averageUtilization}%`} label="Ø Auslastung" sub="Letzte 12 Monate" />
        <KpiCard icon={TrendingUp} iconBg="bg-emerald-50" iconColor="text-emerald-600"
          value={summary.strongestMonth ? `${summary.strongestMonth.percent}%` : '—'}
          label="Stärkster Monat" sub={summary.strongestMonth?.label || ''} />
        <KpiCard icon={TrendingDown} iconBg="bg-amber-50" iconColor="text-amber-600"
          value={summary.weakestMonth ? `${summary.weakestMonth.percent}%` : '—'}
          label="Schwächster Monat" sub={summary.weakestMonth?.label || ''} />
        <KpiCard icon={trendIcon} iconBg={trendBg} iconColor={trendColor}
          value={`${summary.trendDelta > 0 ? '+' : ''}${summary.trendDelta}%`}
          label="Trend" sub="Letzte 3 vs. vorherige 3 Monate" />
      </div>

      {/* Bar Chart */}
      <Card className="bg-white border-slate-200 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-slate-800">Team-Auslastung (12 Monate)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="monthLabel" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" tickFormatter={v => `${v}%`} domain={[0, 'auto']} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.[0]) return null;
                    const data = payload[0].payload;
                    return (
                      <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3 text-sm">
                        <p className="font-semibold text-slate-900">{label} {data.month?.split('-')[0]}</p>
                        <p className="text-slate-600">{data.teamPercent}% Auslastung</p>
                        <p className="text-slate-400 text-xs">{data.assignedCount} von {data.totalEmployees} MA zugewiesen</p>
                      </div>
                    );
                  }}
                />
                <ReferenceLine y={80} stroke="#94a3b8" strokeDasharray="4 4" label={{ value: '80%', position: 'right', fontSize: 10, fill: '#94a3b8' }} />
                <Bar dataKey="teamPercent" radius={[4, 4, 0, 0]} maxBarSize={40}>
                  {monthlyData.map((entry, i) => (
                    <Cell key={i} fill={getBarColor(entry.teamPercent)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-emerald-500" /> &lt;80%</div>
            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-amber-500" /> 80-100%</div>
            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-red-500" /> &gt;100%</div>
            <div className="flex items-center gap-1 ml-2"><div className="w-4 h-0 border-t border-dashed border-slate-400" /> Ziel (80%)</div>
          </div>
        </CardContent>
      </Card>

      {/* Heatmap */}
      <Card className="bg-white border-slate-200 shadow-sm">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold text-slate-800">Mitarbeiter-Auslastung</CardTitle>
          {positions.length > 0 && (
            <Select value={positionFilter} onValueChange={setPositionFilter}>
              <SelectTrigger className="w-40 h-8 text-xs"><SelectValue placeholder="Position" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Positionen</SelectItem>
                {positions.map(pos => <SelectItem key={pos} value={pos}>{pos}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left p-2 text-xs font-medium text-slate-500 min-w-[160px]">Mitarbeiter</th>
                  {monthlyData.map(m => (
                    <th key={m.month} className="text-center p-1 text-xs font-medium text-slate-500 min-w-[48px]">{m.monthLabel}</th>
                  ))}
                  <th className="text-center p-2 text-xs font-medium text-slate-500 min-w-[48px]">Ø</th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.map(emp => (
                  <tr key={emp.employeeId} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="p-2">
                      <div className="text-sm font-medium text-slate-800">{emp.employeeName}</div>
                      <div className="text-xs text-slate-500">{emp.position || '—'}</div>
                    </td>
                    {monthlyData.map(m => (
                      <td key={m.month} className="p-1 text-center">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-medium ${getCellColor(emp.months[m.month] || 0)}`}>
                          {emp.months[m.month] || 0}%
                        </span>
                      </td>
                    ))}
                    <td className="p-1 text-center">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-bold ${getCellColor(emp.average)}`}>
                        {emp.average}%
                      </span>
                    </td>
                  </tr>
                ))}
                {filteredEmployees.length === 0 && (
                  <tr><td colSpan={monthlyData.length + 2} className="p-4 text-center text-slate-400">Keine Mitarbeiter gefunden.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Verify and commit**

```bash
npx tsc --noEmit --pretty 2>&1 | head -20
git add src/components/reports/UtilizationTrendsTab.tsx
git commit -m "feat(reports): add UtilizationTrendsTab with bar chart and heatmap"
```

---

## Task 3: Wire into ReportsModuleV2

**Files:**
- Modify: `src/components/ReportsModuleV2.tsx`

- [ ] **Step 1: Add import and tab**

Add import at top:
```typescript
import { UtilizationTrendsTab } from './reports/UtilizationTrendsTab';
```

Find the Tabs component and add a new TabsTrigger for "Auslastung" and a new TabsContent rendering `<UtilizationTrendsTab />`.

The existing tabs likely use a pattern like:
```tsx
<TabsTrigger value="auslastung">Auslastung</TabsTrigger>
```
and:
```tsx
<TabsContent value="auslastung">
  <UtilizationTrendsTab />
</TabsContent>
```

- [ ] **Step 2: Verify and commit**

```bash
npx tsc --noEmit --pretty 2>&1 | head -20
git add src/components/ReportsModuleV2.tsx
git commit -m "feat(reports): wire UtilizationTrendsTab into ReportsModule"
```
