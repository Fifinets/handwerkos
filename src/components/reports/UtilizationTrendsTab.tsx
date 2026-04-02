// src/components/reports/UtilizationTrendsTab.tsx
import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
