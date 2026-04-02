// src/components/machine/MachineModuleV2.tsx
import { useState, useMemo } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Wrench, Truck, Gauge, Plus, Search, AlertTriangle, CheckCircle, Clock, Settings } from "lucide-react";
import { useMachineData } from '@/hooks/useMachineData';
import { MachineFormDialog } from './MachineFormDialog';
import type { MachineDevice } from '@/hooks/useMachineData';

const CATEGORY_ICONS: Record<string, any> = { werkzeug: Wrench, fahrzeug: Truck, messgeraet: Gauge };
const CATEGORY_LABELS: Record<string, string> = { werkzeug: 'Werkzeug', fahrzeug: 'Fahrzeug', messgeraet: 'Messgerät' };
const CONDITION_COLORS: Record<string, string> = {
  gut: 'bg-emerald-100 text-emerald-800',
  maessig: 'bg-amber-100 text-amber-800',
  schlecht: 'bg-orange-100 text-orange-800',
  defekt: 'bg-red-100 text-red-800',
};
const CONDITION_LABELS: Record<string, string> = { gut: 'Gut', maessig: 'Mäßig', schlecht: 'Schlecht', defekt: 'Defekt' };

export function MachineModuleV2() {
  const { devices, isLoading, invalidateAll, companyId } = useMachineData();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterCondition, setFilterCondition] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editDevice, setEditDevice] = useState<MachineDevice | null>(null);

  const filtered = useMemo(() => {
    let result = devices;
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(d =>
        d.device_name.toLowerCase().includes(term) ||
        (d.serial_number || '').toLowerCase().includes(term) ||
        (d.manufacturer || '').toLowerCase().includes(term)
      );
    }
    if (filterCategory !== 'all') result = result.filter(d => d.category === filterCategory);
    if (filterCondition !== 'all') result = result.filter(d => d.condition === filterCondition);
    return result;
  }, [devices, searchTerm, filterCategory, filterCondition]);

  const stats = useMemo(() => {
    const total = devices.length;
    const byCondition = { gut: 0, maessig: 0, schlecht: 0, defekt: 0 };
    const maintenanceDue = devices.filter(d => {
      if (!d.next_inspection_date) return false;
      return new Date(d.next_inspection_date) <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    }).length;
    devices.forEach(d => { if (byCondition[d.condition as keyof typeof byCondition] !== undefined) byCondition[d.condition as keyof typeof byCondition]++; });
    return { total, gut: byCondition.gut, maintenanceDue, defekt: byCondition.defekt + byCondition.schlecht };
  }, [devices]);

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Geräte & Maschinen</h1>
          <p className="text-sm text-slate-500 mt-1">Werkzeuge, Fahrzeuge und Messgeräte verwalten</p>
        </div>
        <Button className="bg-slate-900 hover:bg-slate-800 text-white" onClick={() => { setEditDevice(null); setShowForm(true); }}>
          <Plus className="h-4 w-4 mr-2" /> Gerät hinzufügen
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="bg-white border-slate-200 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center"><Settings className="h-5 w-5 text-blue-600" /></div>
            <div><div className="text-2xl font-semibold text-slate-900">{isLoading ? '—' : stats.total}</div><div className="text-xs text-slate-500">Gesamt</div></div>
          </CardContent>
        </Card>
        <Card className="bg-white border-slate-200 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-emerald-50 flex items-center justify-center"><CheckCircle className="h-5 w-5 text-emerald-600" /></div>
            <div><div className="text-2xl font-semibold text-slate-900">{isLoading ? '—' : stats.gut}</div><div className="text-xs text-slate-500">Einsatzbereit</div></div>
          </CardContent>
        </Card>
        <Card className="bg-white border-slate-200 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-amber-50 flex items-center justify-center"><Clock className="h-5 w-5 text-amber-600" /></div>
            <div><div className="text-2xl font-semibold text-slate-900">{isLoading ? '—' : stats.maintenanceDue}</div><div className="text-xs text-slate-500">Wartung fällig</div></div>
          </CardContent>
        </Card>
        <Card className="bg-white border-slate-200 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-red-50 flex items-center justify-center"><AlertTriangle className="h-5 w-5 text-red-600" /></div>
            <div><div className="text-2xl font-semibold text-slate-900">{isLoading ? '—' : stats.defekt}</div><div className="text-xs text-slate-500">Defekt/Schlecht</div></div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <Input placeholder="Name, Seriennummer, Hersteller..." className="pl-8 bg-white" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-40 bg-white"><SelectValue placeholder="Kategorie" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Kategorien</SelectItem>
            <SelectItem value="werkzeug">Werkzeug</SelectItem>
            <SelectItem value="fahrzeug">Fahrzeug</SelectItem>
            <SelectItem value="messgeraet">Messgerät</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterCondition} onValueChange={setFilterCondition}>
          <SelectTrigger className="w-36 bg-white"><SelectValue placeholder="Zustand" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Zustände</SelectItem>
            <SelectItem value="gut">Gut</SelectItem>
            <SelectItem value="maessig">Mäßig</SelectItem>
            <SelectItem value="schlecht">Schlecht</SelectItem>
            <SelectItem value="defekt">Defekt</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Device Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(device => {
          const Icon = CATEGORY_ICONS[device.category] || Wrench;
          return (
            <Card key={device.id} className="bg-white border-slate-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => { setEditDevice(device); setShowForm(true); }}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center">
                      <Icon className="h-5 w-5 text-slate-600" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">{device.device_name}</h3>
                      <p className="text-xs text-slate-500">{CATEGORY_LABELS[device.category] || device.category}</p>
                    </div>
                  </div>
                  <Badge className={CONDITION_COLORS[device.condition] || 'bg-slate-100 text-slate-800'}>
                    {CONDITION_LABELS[device.condition] || device.condition}
                  </Badge>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-500">
                  <div>Hersteller: {device.manufacturer || '—'}</div>
                  <div>S/N: {device.serial_number || '—'}</div>
                  <div>Stunden: {device.operating_hours}h</div>
                  <div>Standort: {device.current_location || '—'}</div>
                </div>
                {device.next_inspection_date && (
                  <div className="mt-2 text-xs">
                    {new Date(device.next_inspection_date) < new Date() ? (
                      <span className="text-red-600 font-medium">Prüfung überfällig</span>
                    ) : (
                      <span className="text-slate-500">Nächste Prüfung: {new Date(device.next_inspection_date).toLocaleDateString('de-DE')}</span>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
        {!isLoading && filtered.length === 0 && (
          <div className="col-span-full text-center py-12 text-sm text-slate-500">
            {devices.length === 0 ? 'Noch keine Geräte angelegt.' : 'Keine Ergebnisse für diesen Filter.'}
          </div>
        )}
      </div>

      <MachineFormDialog open={showForm} onOpenChange={setShowForm} companyId={companyId} device={editDevice} onSuccess={invalidateAll} />
    </div>
  );
}
