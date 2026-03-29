import React, { useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Clock,
  Search,
  Calendar,
  Users,
  AlertTriangle,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Trash2,
  Coffee
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";
import { useToast } from "@/hooks/use-toast";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addDays, addWeeks, addMonths, subWeeks, subMonths } from "date-fns";
import { de } from "date-fns/locale";
import EditTimeEntryDialog from './EditTimeEntryDialog';

interface TimeEntryRow {
  id: string;
  employee_id: string;
  employee_name: string;
  project_id: string | null;
  project_name: string | null;
  start_time: string;
  end_time: string | null;
  break_duration: number;
  description: string | null;
  status: string;
  net_hours: number;
}

interface KPIs {
  activeEmployees: number;
  totalEmployees: number;
  hoursToday: number;
  hoursWeek: number;
  overtimeMonth: number;
  entriesWithWarning: number;
}

const TimeTrackingModuleV2 = () => {
  const { companyId } = useSupabaseAuth();
  const { toast } = useToast();

  const [entries, setEntries] = useState<TimeEntryRow[]>([]);
  const [kpis, setKPIs] = useState<KPIs>({ activeEmployees: 0, totalEmployees: 0, hoursToday: 0, hoursWeek: 0, overtimeMonth: 0, entriesWithWarning: 0 });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState<'week' | 'month'>('week');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [employeeFilter, setEmployeeFilter] = useState<string>('all');
  const [employees, setEmployees] = useState<{ id: string; name: string }[]>([]);

  // Edit dialog
  const [editEntry, setEditEntry] = useState<any>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [projects, setProjects] = useState<{ id: string; name: string; color: string; status: string }[]>([]);

  // Date range calculations – use ISO strings as stable dependencies
  const rangeStartStr = dateRange === 'week'
    ? startOfWeek(currentDate, { weekStartsOn: 1 }).toISOString()
    : startOfMonth(currentDate).toISOString();
  const rangeEndStr = dateRange === 'week'
    ? endOfWeek(currentDate, { weekStartsOn: 1 }).toISOString()
    : endOfMonth(currentDate).toISOString();

  const rangeStart = new Date(rangeStartStr);
  const rangeEnd = new Date(rangeEndStr);

  const rangeLabel = dateRange === 'week'
    ? `${format(rangeStart, 'dd.MM.', { locale: de })} – ${format(rangeEnd, 'dd.MM.yyyy', { locale: de })}`
    : format(currentDate, 'MMMM yyyy', { locale: de });

  const navigateBack = () => {
    setCurrentDate(prev => dateRange === 'week' ? subWeeks(prev, 1) : subMonths(prev, 1));
  };
  const navigateForward = () => {
    setCurrentDate(prev => dateRange === 'week' ? addWeeks(prev, 1) : addMonths(prev, 1));
  };

  // Fetch employees + projects list
  useEffect(() => {
    if (!companyId) return;
    const fetchEmployees = async () => {
      const { data } = await supabase
        .from('employees')
        .select('id, first_name, last_name')
        .eq('company_id', companyId)
        .in('status', ['aktiv', 'active']);
      setEmployees((data || []).map(e => ({
        id: e.id,
        name: `${e.first_name || ''} ${e.last_name || ''}`.trim()
      })));
    };
    const fetchProjects = async () => {
      const { data } = await supabase
        .from('projects')
        .select('id, name, status')
        .eq('company_id', companyId);
      setProjects((data || []).map(p => ({ id: p.id, name: p.name, color: '', status: p.status })));
    };
    fetchEmployees();
    fetchProjects();
  }, [companyId]);

  // Fetch time entries + KPIs
  useEffect(() => {
    if (!companyId) return;
    fetchData();
  }, [companyId, rangeStartStr, rangeEndStr, employeeFilter]);

  const fetchData = async () => {
    if (!companyId) return;
    setLoading(true);

    try {
      // Fetch time entries for date range
      let query = supabase
        .from('time_entries')
        .select('id, employee_id, project_id, start_time, end_time, break_duration, description, status')
        .eq('company_id', companyId)
        .gte('start_time', rangeStart.toISOString())
        .lte('start_time', rangeEnd.toISOString())
        .order('start_time', { ascending: false });

      if (employeeFilter !== 'all') {
        query = query.eq('employee_id', employeeFilter);
      }

      const { data: timeData, error: timeError } = await query;

      if (timeError) {
        setLoading(false);
        return;
      }

      // Get employee names
      const empIds = [...new Set((timeData || []).map(e => e.employee_id).filter(Boolean))];
      let empMap: Record<string, string> = {};
      if (empIds.length > 0) {
        const { data: empData } = await supabase
          .from('employees')
          .select('id, first_name, last_name')
          .in('id', empIds);
        (empData || []).forEach(e => {
          empMap[e.id] = `${e.first_name || ''} ${e.last_name || ''}`.trim();
        });
      }

      // Get project names
      const projIds = [...new Set((timeData || []).map(e => e.project_id).filter(Boolean))];
      let projMap: Record<string, string> = {};
      if (projIds.length > 0) {
        const { data: projData } = await supabase
          .from('projects')
          .select('id, name')
          .in('id', projIds);
        (projData || []).forEach(p => {
          projMap[p.id] = p.name;
        });
      }

      // Build enriched entries
      const enriched: TimeEntryRow[] = (timeData || []).map(entry => {
        const start = new Date(entry.start_time).getTime();
        const end = entry.end_time ? new Date(entry.end_time).getTime() : 0;
        const breakMs = (entry.break_duration || 0) * 60 * 1000;
        const netHours = end > 0 ? Math.max(0, (end - start - breakMs) / (1000 * 60 * 60)) : 0;

        return {
          id: entry.id,
          employee_id: entry.employee_id,
          employee_name: empMap[entry.employee_id] || 'Unbekannt',
          project_id: entry.project_id,
          project_name: entry.project_id ? (projMap[entry.project_id] || 'Unbekannt') : null,
          start_time: entry.start_time,
          end_time: entry.end_time,
          break_duration: entry.break_duration || 0,
          description: entry.description,
          status: entry.status,
          net_hours: netHours,
        };
      });

      setEntries(enriched);

      // Calculate KPIs
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayEnd = new Date(today);
      todayEnd.setHours(23, 59, 59, 999);

      // Hours today
      const hoursToday = enriched
        .filter(e => new Date(e.start_time) >= today && new Date(e.start_time) <= todayEnd)
        .reduce((sum, e) => sum + e.net_hours, 0);

      // Hours this week
      const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
      const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
      const hoursWeek = enriched
        .filter(e => new Date(e.start_time) >= weekStart && new Date(e.start_time) <= weekEnd)
        .reduce((sum, e) => sum + e.net_hours, 0);

      // Active employees (have entry today with no end_time or end_time is today)
      const activeEmpIds = new Set(
        enriched
          .filter(e => new Date(e.start_time) >= today && (!e.end_time || new Date(e.start_time) <= todayEnd))
          .map(e => e.employee_id)
      );

      // Entries with ArbZG warnings (>10h net)
      const warnings = enriched.filter(e => e.net_hours > 10).length;

      // Overtime this month: sum of hours > 8h/day per employee per day
      const monthStart = startOfMonth(new Date());
      const monthEnd = endOfMonth(new Date());
      const monthEntries = enriched.filter(e => new Date(e.start_time) >= monthStart && new Date(e.start_time) <= monthEnd);

      // Group by employee + day
      const dayMap: Record<string, number> = {};
      monthEntries.forEach(e => {
        const day = format(new Date(e.start_time), 'yyyy-MM-dd');
        const key = `${e.employee_id}_${day}`;
        dayMap[key] = (dayMap[key] || 0) + e.net_hours;
      });
      const overtimeMonth = Object.values(dayMap).reduce((sum, hours) => {
        return hours > 8 ? sum + (hours - 8) : sum;
      }, 0);

      setKPIs({
        activeEmployees: activeEmpIds.size,
        totalEmployees: employees.length,
        hoursToday,
        hoursWeek,
        overtimeMonth,
        entriesWithWarning: warnings,
      });

    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (entryId: string) => {
    if (!confirm('Zeiteintrag wirklich löschen?')) return;
    const { error } = await supabase.from('time_entries').delete().eq('id', entryId);
    if (error) {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Gelöscht" });
      fetchData();
    }
  };

  const handleEdit = (entry: TimeEntryRow) => {
    setEditEntry({
      id: entry.id,
      start_time: entry.start_time,
      end_time: entry.end_time,
      break_duration: entry.break_duration,
      description: entry.description,
      status: entry.status,
      project_id: entry.project_id,
    });
    setEditDialogOpen(true);
  };

  // Filter entries by search
  const filtered = entries.filter(e => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return e.employee_name.toLowerCase().includes(term)
      || (e.project_name || '').toLowerCase().includes(term)
      || (e.description || '').toLowerCase().includes(term);
  });

  const formatTime = (dt: string | null) => {
    if (!dt) return '–';
    return format(new Date(dt), 'HH:mm');
  };

  const formatDate = (dt: string) => {
    return format(new Date(dt), 'EEE dd.MM.', { locale: de });
  };

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Zeiterfassung</h1>
          <p className="text-sm text-slate-500 mt-1">Arbeitszeiten Ihres Teams überwachen und verwalten.</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-white border-slate-200 shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Heute aktiv</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">
                {kpis.activeEmployees} / {kpis.totalEmployees}
              </h3>
            </div>
            <div className="h-12 w-12 rounded-full bg-slate-50 flex items-center justify-center">
              <Users className="h-6 w-6 text-slate-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200 shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Stunden heute</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">{kpis.hoursToday.toFixed(1)}h</h3>
            </div>
            <div className="h-12 w-12 rounded-full bg-slate-50 flex items-center justify-center">
              <Clock className="h-6 w-6 text-slate-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200 shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Überstunden (Monat)</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">{kpis.overtimeMonth.toFixed(1)}h</h3>
            </div>
            <div className="h-12 w-12 rounded-full bg-rose-50 flex items-center justify-center">
              <TrendingUp className="h-6 w-6 text-rose-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200 shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">ArbZG-Warnungen</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">{kpis.entriesWithWarning}</h3>
            </div>
            <div className="h-12 w-12 rounded-full bg-amber-50 flex items-center justify-center">
              <AlertTriangle className="h-6 w-6 text-amber-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Date Navigation + Filters */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={navigateBack}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium text-slate-700 min-w-[200px] text-center">{rangeLabel}</span>
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={navigateForward}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <div className="flex gap-1 ml-2">
            <Button
              variant={dateRange === 'week' ? 'default' : 'outline'}
              size="sm"
              className="h-9"
              onClick={() => setDateRange('week')}
            >
              Woche
            </Button>
            <Button
              variant={dateRange === 'month' ? 'default' : 'outline'}
              size="sm"
              className="h-9"
              onClick={() => setDateRange('month')}
            >
              Monat
            </Button>
          </div>
        </div>

        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Suchen..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-white border-slate-200 h-9"
            />
          </div>
          <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
            <SelectTrigger className="w-[180px] h-9 bg-white">
              <SelectValue placeholder="Alle Mitarbeiter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Mitarbeiter</SelectItem>
              {employees.map(emp => (
                <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Entries Table */}
      <Card className="bg-white border-slate-200 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-12 text-center text-slate-400">Laden...</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <Clock className="h-10 w-10 text-slate-200 mx-auto mb-3" />
              <p className="text-sm text-slate-400">Keine Zeiteinträge im gewählten Zeitraum</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-100">
                  <tr>
                    <th className="px-5 py-3 font-medium">Mitarbeiter</th>
                    <th className="px-5 py-3 font-medium">Datum</th>
                    <th className="px-5 py-3 font-medium">Projekt</th>
                    <th className="px-5 py-3 font-medium text-right">Zeiten</th>
                    <th className="px-5 py-3 font-medium text-right">Pause</th>
                    <th className="px-5 py-3 font-medium text-right">Netto</th>
                    <th className="px-5 py-3 font-medium">Beschreibung</th>
                    <th className="px-5 py-3 font-medium text-right">Aktionen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((entry) => {
                    const hasWarning = entry.net_hours > 10;
                    return (
                      <tr key={entry.id} className={`hover:bg-slate-50 transition-colors ${hasWarning ? 'bg-amber-50/50' : ''}`}>
                        <td className="px-5 py-4">
                          <div className="font-medium text-slate-900">{entry.employee_name}</div>
                        </td>
                        <td className="px-5 py-4 text-slate-600">{formatDate(entry.start_time)}</td>
                        <td className="px-5 py-4 text-slate-600">{entry.project_name || '–'}</td>
                        <td className="px-5 py-4 text-right">
                          <div className="text-slate-900">{formatTime(entry.start_time)} – {formatTime(entry.end_time)}</div>
                        </td>
                        <td className="px-5 py-4 text-right text-slate-500">
                          {entry.break_duration > 0 ? (
                            <span className="inline-flex items-center gap-1">
                              <Coffee className="h-3 w-3" />
                              {entry.break_duration}m
                            </span>
                          ) : '–'}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <span className={`font-bold ${hasWarning ? 'text-amber-600' : 'text-slate-900'}`}>
                            {entry.net_hours.toFixed(1)}h
                          </span>
                          {hasWarning && <AlertTriangle className="h-3.5 w-3.5 text-amber-500 inline ml-1" />}
                        </td>
                        <td className="px-5 py-4 text-slate-500 max-w-[200px] truncate">
                          {entry.description || '–'}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-900" onClick={() => handleEdit(entry)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-600" onClick={() => handleDelete(entry.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Summenzeile */}
          {filtered.length > 0 && (
            <div className="border-t border-slate-200 bg-slate-50 px-5 py-3 flex justify-between text-sm">
              <span className="text-slate-500">{filtered.length} Einträge</span>
              <span className="font-bold text-slate-900">
                Gesamt: {filtered.reduce((sum, e) => sum + e.net_hours, 0).toFixed(1)}h
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      {editEntry && (
        <EditTimeEntryDialog
          open={editDialogOpen}
          onOpenChange={(open) => {
            setEditDialogOpen(open);
            if (!open) setEditEntry(null);
          }}
          timeEntry={editEntry}
          projects={projects}
          onSave={() => {
            setEditDialogOpen(false);
            setEditEntry(null);
            fetchData();
          }}
        />
      )}
    </div>
  );
};

export default TimeTrackingModuleV2;
