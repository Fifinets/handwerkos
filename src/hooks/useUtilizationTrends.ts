// src/hooks/useUtilizationTrends.ts
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { format, startOfMonth, endOfMonth, subMonths, eachDayOfInterval } from 'date-fns';
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

interface TimeEntry {
  employee_id: string;
  start_time: string;
  end_time: string | null;
  break_duration: number | null;
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
      // Load 12 months of time entries (actual hours worked)
      const twelveMonthsAgo = subMonths(new Date(), 12).toISOString();
      const [empRes, timeRes, vacRes] = await Promise.all([
        supabase
          .from('employees')
          .select('id, first_name, last_name, position')
          .eq('company_id', companyId!)
          .not('status', 'in', '("Inaktiv","Gekündigt")'),
        supabase
          .from('time_entries')
          .select('employee_id, start_time, end_time, break_duration')
          .eq('company_id', companyId!)
          .not('end_time', 'is', null)
          .gte('start_time', twelveMonthsAgo),
        supabase
          .from('vacation_requests')
          .select('employee_id, start_date, end_date')
          .eq('company_id', companyId!)
          .eq('status', 'approved'),
      ]);
      return {
        employees: (empRes.data || []) as Employee[],
        timeEntries: (timeRes.data || []) as TimeEntry[],
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

    const { employees, timeEntries, vacations } = dataQuery.data;

    // Pre-index time entries by employee+date for fast lookup
    const timeByEmpDate = new Map<string, number>(); // 'empId:yyyy-MM-dd' → hours worked
    for (const entry of timeEntries) {
      if (!entry.end_time) continue;
      const start = new Date(entry.start_time);
      const end = new Date(entry.end_time);
      const breakMin = entry.break_duration || 0;
      const hoursWorked = Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60 * 60) - breakMin / 60);
      const dateKey = format(start, 'yyyy-MM-dd');
      const key = `${entry.employee_id}:${dateKey}`;
      timeByEmpDate.set(key, (timeByEmpDate.get(key) || 0) + hoursWorked);
    }
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

          // Check actual hours worked (from time_entries)
          const hoursWorked = timeByEmpDate.get(`${emp.id}:${ds}`) || 0;
          if (hoursWorked > 0) assignedDays++;
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
