// src/components/planner/dialogs/CapacityCheckDialog.tsx
import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { BarChart3, AlertTriangle, CheckCircle } from "lucide-react";
import { format, addDays, startOfWeek, endOfWeek } from 'date-fns';
import { de } from 'date-fns/locale';
import type { PlannerProject, PlannerEmployee, VacationRequest } from '../types';
import { getAvailableEmployees } from '../utils/capacityUtils';
import { getGermanHolidays } from '../holidays';

interface CapacityCheckDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employees: PlannerEmployee[];
  projects: PlannerProject[];
  vacations: VacationRequest[];
  onOpenBulkAssign: (projectId?: string) => void;
}

interface WeekCapacity {
  weekLabel: string;
  available: number;
  needed: number;
  isBottleneck: boolean;
}

export function CapacityCheckDialog({
  open,
  onOpenChange,
  employees,
  projects,
  vacations,
  onOpenBulkAssign,
}: CapacityCheckDialogProps) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [neededCount, setNeededCount] = useState(1);
  const [positionFilter, setPositionFilter] = useState('all');

  const positions = useMemo(() => {
    const set = new Set<string>();
    employees.forEach(e => { if (e.position) set.add(e.position); });
    return Array.from(set).sort();
  }, [employees]);

  const filteredEmployees = useMemo(() => {
    if (positionFilter === 'all') return employees;
    return employees.filter(e => e.position === positionFilter);
  }, [employees, positionFilter]);

  // Holidays for the range
  const holidays = useMemo(() => {
    if (!startDate) return new Map<string, string>();
    const all = new Map<string, string>();
    const startYear = new Date(startDate).getFullYear();
    getGermanHolidays(startYear).forEach((v, k) => all.set(k, v));
    if (endDate) {
      const endYear = new Date(endDate).getFullYear();
      if (endYear !== startYear) getGermanHolidays(endYear).forEach((v, k) => all.set(k, v));
    }
    return all;
  }, [startDate, endDate]);

  // Week-by-week capacity analysis
  const weeklyCapacity = useMemo((): WeekCapacity[] => {
    if (!startDate || !endDate) return [];
    const weeks: WeekCapacity[] = [];
    let current = startOfWeek(new Date(startDate), { weekStartsOn: 1 });
    const end = new Date(endDate);

    while (current <= end) {
      const wEnd = endOfWeek(current, { weekStartsOn: 1 });
      const wStartStr = format(current, 'yyyy-MM-dd');
      const wEndStr = format(wEnd > end ? end : wEnd, 'yyyy-MM-dd');

      const availability = getAvailableEmployees(filteredEmployees, projects, vacations, wStartStr, wEndStr, holidays);
      const fullyAvailable = availability.filter(a => a.availablePercent === 100).length;

      weeks.push({
        weekLabel: `KW ${format(current, 'ww', { locale: de })}`,
        available: fullyAvailable,
        needed: neededCount,
        isBottleneck: fullyAvailable < neededCount,
      });

      current = addDays(wEnd, 1);
    }
    return weeks;
  }, [startDate, endDate, filteredEmployees, projects, vacations, holidays, neededCount]);

  // Available employees for full range
  const availableForRange = useMemo(() => {
    if (!startDate || !endDate) return [];
    return getAvailableEmployees(filteredEmployees, projects, vacations, startDate, endDate, holidays);
  }, [filteredEmployees, projects, vacations, startDate, endDate, holidays]);

  const hasBottleneck = weeklyCapacity.some(w => w.isBottleneck);
  const fullyAvailableCount = availableForRange.filter(a => a.availablePercent === 100).length;

  // Max bar width for visualization
  const maxCount = Math.max(neededCount, ...weeklyCapacity.map(w => w.available), 1);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-50">
              <BarChart3 className="h-5 w-5 text-indigo-600" />
            </div>
            <DialogTitle>Kapazität prüfen</DialogTitle>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Inputs */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Von *</Label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Bis *</Label>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Benötigte MA</Label>
              <Input type="number" min={1} value={neededCount} onChange={e => setNeededCount(parseInt(e.target.value) || 1)} />
            </div>
            <div className="space-y-2">
              <Label>Position</Label>
              <Select value={positionFilter} onValueChange={setPositionFilter}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Alle" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Positionen</SelectItem>
                  {positions.map(pos => (
                    <SelectItem key={pos} value={pos}>{pos}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Results */}
          {startDate && endDate && (
            <>
              {/* Summary */}
              <div className={`rounded-lg p-3 border ${hasBottleneck ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'}`}>
                <div className="flex items-center gap-2">
                  {hasBottleneck ? (
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                  ) : (
                    <CheckCircle className="h-4 w-4 text-emerald-600" />
                  )}
                  <span className={`text-sm font-medium ${hasBottleneck ? 'text-red-800' : 'text-emerald-800'}`}>
                    {hasBottleneck
                      ? `Engpass: ${weeklyCapacity.filter(w => w.isBottleneck).length} Wochen mit zu wenig Kapazität`
                      : `Kapazität reicht: ${fullyAvailableCount} MA über gesamten Zeitraum verfügbar`}
                  </span>
                </div>
              </div>

              {/* Week bars */}
              <div className="space-y-2">
                <Label className="text-xs text-slate-500">Wochenübersicht</Label>
                <div className="space-y-1.5">
                  {weeklyCapacity.map((week, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-xs text-slate-500 w-12 flex-shrink-0">{week.weekLabel}</span>
                      <div className="flex-1 h-5 bg-slate-100 rounded-full overflow-hidden relative">
                        <div
                          className={`h-full rounded-full ${week.isBottleneck ? 'bg-red-400' : 'bg-emerald-400'}`}
                          style={{ width: `${(week.available / maxCount) * 100}%` }}
                        />
                        {/* Needed line */}
                        <div
                          className="absolute top-0 bottom-0 w-0.5 bg-slate-600"
                          style={{ left: `${(week.needed / maxCount) * 100}%` }}
                        />
                      </div>
                      <span className={`text-xs font-medium w-8 text-right ${week.isBottleneck ? 'text-red-600' : 'text-emerald-600'}`}>
                        {week.available}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-slate-400">Grün = verfügbar | Schwarze Linie = benötigt ({neededCount})</p>
              </div>

              {/* Bottleneck weeks detail */}
              {weeklyCapacity.filter(w => w.isBottleneck).length > 0 && (
                <div>
                  <Label className="text-xs text-red-600">Engpass-Wochen</Label>
                  <div className="border border-red-200 rounded-lg divide-y mt-1">
                    {weeklyCapacity.filter(w => w.isBottleneck).map((week, i) => (
                      <div key={i} className="flex items-center justify-between p-2 text-sm">
                        <span className="font-medium text-red-800">{week.weekLabel}</span>
                        <span className="text-xs text-red-600">
                          {week.available} verfügbar / {week.needed} benötigt (fehlen {week.needed - week.available})
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Available employees list */}
              <div>
                <Label className="text-xs text-slate-500">Verfügbare Mitarbeiter ({fullyAvailableCount})</Label>
                <div className="border rounded-lg divide-y max-h-[150px] overflow-y-auto mt-1">
                  {availableForRange.filter(a => a.availablePercent > 0).slice(0, 20).map(({ employee, availablePercent }) => (
                    <div key={employee.id} className="flex items-center justify-between p-2 text-sm">
                      <span className="font-medium text-slate-800">{employee.first_name} {employee.last_name}</span>
                      <Badge variant="outline" className={`text-xs ${availablePercent === 100 ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {availablePercent}% frei
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>

              {/* 48h ArbZG warning */}
              {neededCount > filteredEmployees.length && (
                <div className="rounded-lg p-3 bg-amber-50 border border-amber-200 text-amber-700 text-sm flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <span>Achtung: Mehr MA benötigt als verfügbar. Beachten Sie die 48h-Wochengrenze (ArbZG 2026).</span>
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Schließen</Button>
          {startDate && endDate && fullyAvailableCount > 0 && (
            <Button onClick={() => { onOpenChange(false); onOpenBulkAssign(); }}
              className="bg-blue-600 hover:bg-blue-700">
              Verfügbare MA zuweisen
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
