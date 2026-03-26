import React, { useState, useMemo } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, Search, MoreHorizontal, Edit, Trash2, ClipboardList, AlertTriangle, Zap, Monitor, LayoutGrid, List } from "lucide-react";
import { useInspectionDevices, useCreateDevice, useUpdateDevice, useDeleteDevice } from '@/hooks/useInspections';
import type { InspectionDevice, InspectionDeviceCreate } from '@/types/inspection';
import { differenceInDays } from 'date-fns';

const TYPE_ICONS: Record<string, React.ElementType> = { anlage: Zap, geraet: Monitor };
const TYPE_LABELS: Record<string, string> = { anlage: 'Anlage', geraet: 'Geraet' };

function DueBadge({ date }: { date?: string | null }) {
  if (!date) return <Badge variant="secondary">Kein Termin</Badge>;
  const d = differenceInDays(new Date(date), new Date());
  if (d < 0) return <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" />{Math.abs(d)}d ueberfaellig</Badge>;
  if (d <= 7) return <Badge className="bg-red-100 text-red-800">{d}d</Badge>;
  if (d <= 30) return <Badge className="bg-yellow-100 text-yellow-800">{d}d</Badge>;
  return <Badge className="bg-green-100 text-green-800">{d}d</Badge>;
}

interface Props {
  customerId?: string;
  onStartInspection: (d: InspectionDevice) => void;
}

export default function DeviceInventory({ customerId, onStartInspection }: Props) {
  const { data: devices = [] } = useInspectionDevices(customerId);
  const createDev = useCreateDevice();
  const updateDev = useUpdateDevice();
  const deleteDev = useDeleteDevice();

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [view, setView] = useState<'list' | 'grid'>('list');
  const [dlgOpen, setDlgOpen] = useState(false);
  const [editItem, setEditItem] = useState<InspectionDevice | null>(null);
  const [fd, setFd] = useState<Partial<InspectionDeviceCreate>>({});

  const filtered = useMemo(() => {
    let r = devices;
    if (search) {
      const s = search.toLowerCase();
      r = r.filter(d => d.device_name.toLowerCase().includes(s) || d.serial_number?.toLowerCase().includes(s));
    }
    if (typeFilter !== 'all') r = r.filter(d => d.device_type === typeFilter);
    if (statusFilter === 'overdue') r = r.filter(d => d.next_inspection_date && differenceInDays(new Date(d.next_inspection_date), new Date()) < 0);
    if (statusFilter === 'due_soon') r = r.filter(d => {
      if (!d.next_inspection_date) return false;
      const dd = differenceInDays(new Date(d.next_inspection_date), new Date());
      return dd >= 0 && dd <= 30;
    });
    return r;
  }, [devices, search, typeFilter, statusFilter]);

  const handleSave = async () => {
    if (!fd.device_name) return;
    if (editItem) {
      await updateDev.mutateAsync({ id: editItem.id, data: fd });
    } else {
      await createDev.mutateAsync({ device_name: fd.device_name, ...fd } as InspectionDeviceCreate);
    }
    setDlgOpen(false); setEditItem(null); setFd({});
  };

  const openCreate = () => {
    setEditItem(null);
    setFd({ device_type: 'geraet', inspection_interval_months: 12 });
    setDlgOpen(true);
  };

  const openEdit = (d: InspectionDevice) => {
    setEditItem(d);
    setFd({
      device_name: d.device_name, device_type: d.device_type,
      manufacturer: d.manufacturer ?? undefined, serial_number: d.serial_number ?? undefined,
      location: d.location ?? undefined, inspection_interval_months: d.inspection_interval_months ?? 12,
      next_inspection_date: d.next_inspection_date ?? undefined,
    });
    setDlgOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input className="pl-9" placeholder="Suchen..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Typ" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle</SelectItem>
            <SelectItem value="anlage">Anlagen</SelectItem>
            <SelectItem value="geraet">Geraete</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle</SelectItem>
            <SelectItem value="overdue">Ueberfaellig</SelectItem>
            <SelectItem value="due_soon">Bald faellig</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex gap-1 border rounded-md p-0.5">
          <Button variant={view === 'list' ? 'secondary' : 'ghost'} size="sm" onClick={() => setView('list')}><List className="h-4 w-4" /></Button>
          <Button variant={view === 'grid' ? 'secondary' : 'ghost'} size="sm" onClick={() => setView('grid')}><LayoutGrid className="h-4 w-4" /></Button>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-1" />Geraet</Button>
      </div>

      {view === 'list' ? (
        <Card><CardContent className="p-0">
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-slate-50 text-left text-xs text-slate-500">
              <th className="p-3">Geraet</th><th className="p-3">Typ</th><th className="p-3">Standort</th><th className="p-3">Naechste Pruefung</th><th className="p-3"></th>
            </tr></thead>
            <tbody>{filtered.map(d => {
              const Icon = TYPE_ICONS[d.device_type] ?? Zap;
              return (
                <tr key={d.id} className="border-b hover:bg-slate-50">
                  <td className="p-3 font-medium"><div className="flex items-center gap-2"><Icon className="h-4 w-4 text-slate-400" />{d.device_name}</div></td>
                  <td className="p-3 text-slate-600">{TYPE_LABELS[d.device_type] ?? d.device_type}</td>
                  <td className="p-3 text-slate-600">{d.location ?? '-'}</td>
                  <td className="p-3"><DueBadge date={d.next_inspection_date} /></td>
                  <td className="p-3">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="sm"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onStartInspection(d)}><ClipboardList className="h-4 w-4 mr-2" />Neue Pruefung</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openEdit(d)}><Edit className="h-4 w-4 mr-2" />Bearbeiten</DropdownMenuItem>
                        <DropdownMenuItem className="text-red-600" onClick={() => deleteDev.mutate(d.id)}><Trash2 className="h-4 w-4 mr-2" />Loeschen</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              );
            })}</tbody>
          </table>
          {filtered.length === 0 && <p className="text-center text-sm text-slate-400 py-8">Keine Geraete gefunden.</p>}
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(d => {
            const Icon = TYPE_ICONS[d.device_type] ?? Zap;
            return (
              <Card key={d.id} className="hover:shadow-md cursor-pointer" onClick={() => onStartInspection(d)}>
                <CardContent className="pt-4">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2"><Icon className="h-5 w-5 text-blue-500" /><span className="font-medium">{d.device_name}</span></div>
                    <DueBadge date={d.next_inspection_date} />
                  </div>
                  <div className="mt-2 text-xs text-slate-500">{TYPE_LABELS[d.device_type]}{d.location && ` | ${d.location}`}</div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={dlgOpen} onOpenChange={setDlgOpen}><DialogContent>
        <DialogHeader><DialogTitle>{editItem ? 'Geraet bearbeiten' : 'Neues Geraet'}</DialogTitle></DialogHeader>
        <div className="grid gap-4 py-4">
          <div><Label>Name *</Label><Input value={fd.device_name ?? ''} onChange={e => setFd(p => ({ ...p, device_name: e.target.value }))} /></div>
          <div><Label>Typ</Label>
            <Select value={fd.device_type ?? 'geraet'} onValueChange={v => setFd(p => ({ ...p, device_type: v as 'anlage' | 'geraet' }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="anlage">Anlage</SelectItem>
                <SelectItem value="geraet">Geraet</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Hersteller</Label><Input value={fd.manufacturer ?? ''} onChange={e => setFd(p => ({ ...p, manufacturer: e.target.value }))} /></div>
            <div><Label>Seriennr.</Label><Input value={fd.serial_number ?? ''} onChange={e => setFd(p => ({ ...p, serial_number: e.target.value }))} /></div>
          </div>
          <div><Label>Standort</Label><Input value={fd.location ?? ''} onChange={e => setFd(p => ({ ...p, location: e.target.value }))} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Intervall (Monate)</Label><Input type="number" value={fd.inspection_interval_months ?? 12} onChange={e => setFd(p => ({ ...p, inspection_interval_months: Number(e.target.value) }))} /></div>
            <div><Label>Naechste Pruefung</Label><Input type="date" value={fd.next_inspection_date ?? ''} onChange={e => setFd(p => ({ ...p, next_inspection_date: e.target.value }))} /></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setDlgOpen(false)}>Abbrechen</Button>
          <Button onClick={handleSave}>{editItem ? 'Speichern' : 'Anlegen'}</Button>
        </DialogFooter>
      </DialogContent></Dialog>
    </div>
  );
}
