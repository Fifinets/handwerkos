// src/components/machine/MachineFormDialog.tsx
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Wrench, Truck, Gauge } from "lucide-react";
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { MachineDevice } from '@/hooks/useMachineData';

const CATEGORIES = [
  { value: 'werkzeug', label: 'Werkzeug', icon: Wrench },
  { value: 'fahrzeug', label: 'Fahrzeug', icon: Truck },
  { value: 'messgeraet', label: 'Messgerät', icon: Gauge },
] as const;

const CONDITIONS = [
  { value: 'gut', label: 'Gut' },
  { value: 'maessig', label: 'Mäßig' },
  { value: 'schlecht', label: 'Schlecht' },
  { value: 'defekt', label: 'Defekt' },
] as const;

interface MachineFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string | null;
  device?: MachineDevice | null;
  onSuccess: () => void;
}

export function MachineFormDialog({ open, onOpenChange, companyId, device, onSuccess }: MachineFormDialogProps) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<string>('werkzeug');
  const [manufacturer, setManufacturer] = useState('');
  const [model, setModel] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [location, setLocation] = useState('');
  const [condition, setCondition] = useState<string>('gut');
  const [operatingHours, setOperatingHours] = useState(0);
  const [inspectionInterval, setInspectionInterval] = useState(12);

  useEffect(() => {
    if (open && device) {
      setName(device.device_name);
      setCategory(device.category || 'werkzeug');
      setManufacturer(device.manufacturer || '');
      setModel(device.model || '');
      setSerialNumber(device.serial_number || '');
      setLocation(device.current_location || device.location || '');
      setCondition(device.condition || 'gut');
      setOperatingHours(device.operating_hours || 0);
      setInspectionInterval(device.inspection_interval_months || 12);
    } else if (open) {
      setName(''); setCategory('werkzeug'); setManufacturer(''); setModel('');
      setSerialNumber(''); setLocation(''); setCondition('gut'); setOperatingHours(0);
      setInspectionInterval(12);
    }
  }, [open, device]);

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ title: 'Fehler', description: 'Bitte Gerätename angeben.', variant: 'destructive' });
      return;
    }
    if (!companyId) return;

    setSaving(true);
    try {
      const payload = {
        device_name: name.trim(),
        category,
        manufacturer: manufacturer || null,
        model: model || null,
        serial_number: serialNumber || null,
        current_location: location || null,
        location: location || null,
        condition,
        operating_hours: operatingHours,
        inspection_interval_months: inspectionInterval,
        device_type: category === 'messgeraet' ? 'geraet' : 'geraet' as const,
        updated_at: new Date().toISOString(),
      };

      if (device) {
        const { error } = await (supabase as any).from('inspection_devices').update(payload).eq('id', device.id);
        if (error) throw error;
        toast({ title: 'Gerät aktualisiert' });
      } else {
        const { error } = await (supabase as any).from('inspection_devices').insert({ ...payload, company_id: companyId, status: 'active' });
        if (error) throw error;
        toast({ title: 'Gerät hinzugefügt' });
      }
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      toast({ title: 'Fehler', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{device ? 'Gerät bearbeiten' : 'Neues Gerät'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Name *</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="z.B. Hilti TE 6-A36" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Kategorie</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Zustand</Label>
              <Select value={condition} onValueChange={setCondition}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CONDITIONS.map(c => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Hersteller</Label>
              <Input value={manufacturer} onChange={e => setManufacturer(e.target.value)} placeholder="z.B. Hilti" />
            </div>
            <div className="space-y-2">
              <Label>Modell</Label>
              <Input value={model} onChange={e => setModel(e.target.value)} placeholder="z.B. TE 6-A36" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Seriennummer</Label>
              <Input value={serialNumber} onChange={e => setSerialNumber(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Standort</Label>
              <Input value={location} onChange={e => setLocation(e.target.value)} placeholder="z.B. Lager" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Betriebsstunden</Label>
              <Input type="number" value={operatingHours} onChange={e => setOperatingHours(Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>Prüfintervall (Monate)</Label>
              <Input type="number" value={inspectionInterval} onChange={e => setInspectionInterval(Number(e.target.value))} />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-slate-900 hover:bg-slate-800">
            {saving ? 'Speichern...' : device ? 'Aktualisieren' : 'Hinzufügen'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
