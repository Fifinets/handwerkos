import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, CheckCircle, Clock, Calendar, Search } from "lucide-react";
import { useInspectionDevices } from '@/hooks/useInspections';
import type { InspectionDevice } from '@/types/inspection';
import { differenceInDays, format } from 'date-fns';
import { de } from 'date-fns/locale';

interface Props {
  customers: { id: string; name: string }[];
  onDeviceClick: (d: InspectionDevice) => void;
}

export default function DGUVScheduleDashboard({ customers, onDeviceClick }: Props) {
  const { data: allDevices = [] } = useInspectionDevices();
  const [custFilter, setCustFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    let r = allDevices;
    if (custFilter !== 'all') r = r.filter(d => d.customer_id === custFilter);
    if (typeFilter !== 'all') r = r.filter(d => d.device_type === typeFilter);
    if (search) { const s = search.toLowerCase(); r = r.filter(d => d.device_name.toLowerCase().includes(s)); }
    return r;
  }, [allDevices, custFilter, typeFilter, search]);

  const stats = useMemo(() => {
    let overdue = 0, soon = 0, ok = 0;
    for (const d of filtered) {
      if (!d.next_inspection_date) continue;
      const days = differenceInDays(new Date(d.next_inspection_date), new Date());
      if (days < 0) overdue++; else if (days <= 30) soon++; else ok++;
    }
    return { total: filtered.length, overdue, soon, ok };
  }, [filtered]);

  const timeline = useMemo(() => {
    const groups: Record<string, InspectionDevice[]> = {};
    const overdue: InspectionDevice[] = [];
    for (const d of filtered) {
      if (!d.next_inspection_date) continue;
      if (differenceInDays(new Date(d.next_inspection_date), new Date()) < 0) { overdue.push(d); continue; }
      const key = format(new Date(d.next_inspection_date), 'yyyy-MM');
      (groups[key] ??= []).push(d);
    }
    return { overdue, months: Object.entries(groups).sort(([a], [b]) => a.localeCompare(b)) };
  }, [filtered]);

  const cc = (date?: string | null) => {
    if (!date) return 'bg-slate-50';
    const d = differenceInDays(new Date(date), new Date());
    if (d < 0) return 'bg-red-50 border-red-200 text-red-800';
    if (d <= 30) return 'bg-yellow-50 border-yellow-200 text-yellow-800';
    return 'bg-green-50 border-green-200 text-green-800';
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-4 text-center"><div className="text-2xl font-bold">{stats.total}</div><div className="text-xs text-slate-500">Gesamt</div></CardContent></Card>
        <Card className="border-red-200"><CardContent className="pt-4 text-center"><div className="text-2xl font-bold text-red-600">{stats.overdue}</div><div className="text-xs text-red-500 flex items-center justify-center gap-1"><AlertTriangle className="h-3 w-3" />Ueberfaellig</div></CardContent></Card>
        <Card className="border-yellow-200"><CardContent className="pt-4 text-center"><div className="text-2xl font-bold text-yellow-600">{stats.soon}</div><div className="text-xs text-yellow-600 flex items-center justify-center gap-1"><Clock className="h-3 w-3" />Bald faellig</div></CardContent></Card>
        <Card className="border-green-200"><CardContent className="pt-4 text-center"><div className="text-2xl font-bold text-green-600">{stats.ok}</div><div className="text-xs text-green-600 flex items-center justify-center gap-1"><CheckCircle className="h-3 w-3" />OK</div></CardContent></Card>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative max-w-xs"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" /><Input className="pl-9" placeholder="Suchen..." value={search} onChange={e => setSearch(e.target.value)} /></div>
        <Select value={custFilter} onValueChange={setCustFilter}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Kunde" /></SelectTrigger>
          <SelectContent><SelectItem value="all">Alle Kunden</SelectItem>{customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Typ" /></SelectTrigger>
          <SelectContent><SelectItem value="all">Alle</SelectItem><SelectItem value="anlage">Anlagen</SelectItem><SelectItem value="geraet">Geraete</SelectItem></SelectContent>
        </Select>
      </div>

      {timeline.overdue.length > 0 && (
        <Card className="border-red-200">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-red-700 flex items-center gap-2"><AlertTriangle className="h-4 w-4" />Ueberfaellig ({timeline.overdue.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2">{timeline.overdue.map(d => (
            <div key={d.id} onClick={() => onDeviceClick(d)} className="flex items-center justify-between p-2 rounded-lg bg-red-50 border border-red-100 cursor-pointer hover:bg-red-100">
              <span className="font-medium text-sm">{d.device_name}</span>
              <Badge variant="destructive">{Math.abs(differenceInDays(new Date(d.next_inspection_date!), new Date()))}d</Badge>
            </div>
          ))}</CardContent>
        </Card>
      )}

      {timeline.months.map(([month, devs]) => (
        <Card key={month}>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2">
            <Calendar className="h-4 w-4 text-slate-400" />
            {format(new Date(month + '-01'), 'MMMM yyyy', { locale: de })}
            <Badge variant="secondary">{devs.length}</Badge>
          </CardTitle></CardHeader>
          <CardContent className="space-y-2">{devs.sort((a, b) => a.next_inspection_date!.localeCompare(b.next_inspection_date!)).map(d => (
            <div key={d.id} onClick={() => onDeviceClick(d)} className={`flex items-center justify-between p-2 rounded-lg border cursor-pointer hover:shadow-sm ${cc(d.next_inspection_date)}`}>
              <div><span className="font-medium text-sm">{d.device_name}</span><span className="text-xs text-slate-500 ml-2">{d.location}</span></div>
              <span className="text-xs font-medium">{format(new Date(d.next_inspection_date!), 'dd.MM.yyyy')}</span>
            </div>
          ))}</CardContent>
        </Card>
      ))}

      {filtered.length === 0 && <Card><CardContent className="py-12 text-center text-slate-400">Keine Geraete gefunden.</CardContent></Card>}
    </div>
  );
}
