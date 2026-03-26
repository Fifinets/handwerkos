import React, { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Trash2, Lock, Camera, CheckCircle, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { evaluateMeasurement } from '@/lib/vde-evaluation';
import type { EvaluationInput } from '@/lib/vde-evaluation';
import {
  useCreateProtocol, useUpdateProtocol, useFinalizeProtocol,
} from '@/hooks/useInspections';
import type {
  ProtocolWithRelations,
  MeasurementType, ProtocolType, MeasurementResult,
} from '@/types/inspection';

// ---------------------------------------------------------------------------
// Visual-check defaults (Sichtpruefung for VDE 0100/0105 Anlagen)
// ---------------------------------------------------------------------------
const DEFAULT_VISUAL_CHECKS = [
  'Schutzmassnahmen vorhanden und korrekt',
  'Leitungsverlegung ordnungsgemaess',
  'Kennzeichnung der Stromkreise',
  'Ueberspannungsschutz vorhanden',
  'Fehlerstromschutzeinrichtung vorhanden',
  'Isolierung unbeschaedigt',
  'Klemmen und Verbindungen fest',
  'Gehaeuse und Abdeckungen intakt',
  'Warnhinweise und Schilder vorhanden',
  'Zugaenglichkeit der Betriebsmittel',
];

// ---------------------------------------------------------------------------
// Form-level Zod schema (just the protocol header fields)
// ---------------------------------------------------------------------------
const formSchema = z.object({
  protocol_type: z.enum(['vde_0100_600', 'vde_0105_100', 'vde_0701_0702']),
  inspection_date: z.string().min(1),
  notes: z.string().optional(),
});
type FormData = z.infer<typeof formSchema>;

// ---------------------------------------------------------------------------
// Local row types (client-side, not persisted directly)
// ---------------------------------------------------------------------------
interface LocalMeasurement {
  measurement_type: MeasurementType;
  circuit_label: string;
  measured_value: number;
  unit: string;
  test_voltage?: number;
  fuse_type?: string;
  result: MeasurementResult | 'pending';
  limit_value?: number;
  limit_type?: 'min' | 'max';
}

interface LocalDefect {
  id: string;
  description: string;
  severity: 'minor' | 'major' | 'critical';
  location: string;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
export interface InspectionFormProps {
  /** Existing protocol (edit mode) or undefined (create mode) */
  protocol?: ProtocolWithRelations;
  deviceId?: string;
  customerId?: string;
  projectId?: string;
  defaultType?: ProtocolType;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function InspectionForm({
  protocol, deviceId, customerId, projectId, defaultType, onClose,
}: InspectionFormProps) {
  const { toast } = useToast();
  const isLocked = protocol?.is_finalized === true;
  const isNew = !protocol;

  // Mutations
  const createProtocol = useCreateProtocol();
  const updateProtocol = useUpdateProtocol();
  const finalizeProtocol = useFinalizeProtocol();

  // UI state
  const [showFinalizeDialog, setShowFinalizeDialog] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Photo URLs (from existing protocol or newly uploaded)
  const [photos, setPhotos] = useState<string[]>(
    protocol?.photos?.map(p => p.storage_path) ?? []
  );

  // Visual checks (stored in notes as JSON for VDE 0100/0105)
  const [visualChecks, setVisualChecks] = useState(
    DEFAULT_VISUAL_CHECKS.map(label => ({ label, checked: false, note: '' }))
  );

  // Measurements (local rows)
  const [measurements, setMeasurements] = useState<LocalMeasurement[]>(
    (protocol?.measurements ?? []).map(m => ({
      measurement_type: m.measurement_type,
      circuit_label: m.circuit_label ?? '',
      measured_value: m.measured_value,
      unit: m.unit,
      test_voltage: m.test_voltage ?? undefined,
      fuse_type: undefined,
      result: m.result,
      limit_value: m.limit_value ?? undefined,
      limit_type: m.limit_type ?? undefined,
    }))
  );

  // Defects (local rows)
  const [defects, setDefects] = useState<LocalDefect[]>(
    (protocol?.defects ?? []).map(d => ({
      id: d.id,
      description: d.description,
      severity: d.severity,
      location: d.location ?? '',
    }))
  );

  // React Hook Form
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      protocol_type: protocol?.protocol_type ?? defaultType ?? 'vde_0100_600',
      inspection_date: protocol?.inspection_date ?? new Date().toISOString().split('T')[0],
      notes: protocol?.notes ?? '',
    },
  });

  const pType = form.watch('protocol_type');
  const isDevice = pType === 'vde_0701_0702';

  // -------------------------------------------------------------------------
  // Measurement sections based on protocol type
  // -------------------------------------------------------------------------
  const MEAS_SECTIONS: { type: MeasurementType; label: string; unit: string }[] = isDevice
    ? [
        { type: 'protective_conductor', label: 'PE-Widerstand', unit: 'Ohm' },
        { type: 'insulation_resistance', label: 'Isolation', unit: 'MOhm' },
        { type: 'leakage_current', label: 'Ableitstrom', unit: 'mA' },
      ]
    : [
        { type: 'insulation_resistance', label: 'Isolation', unit: 'MOhm' },
        { type: 'loop_impedance', label: 'Schleifenimpedanz', unit: 'Ohm' },
        { type: 'rcd_trip_time', label: 'RCD Ausloesezeit', unit: 'ms' },
        { type: 'protective_conductor', label: 'PE-Widerstand', unit: 'Ohm' },
        { type: 'earth_resistance', label: 'Erdung', unit: 'Ohm' },
      ];

  // -------------------------------------------------------------------------
  // Measurement helpers
  // -------------------------------------------------------------------------
  const addMeasRow = (type: MeasurementType) => {
    setMeasurements(prev => [...prev, {
      measurement_type: type,
      circuit_label: '',
      test_voltage: type === 'insulation_resistance' ? 500 : undefined,
      fuse_type: type === 'loop_impedance' ? 'B16' : undefined,
      measured_value: 0,
      unit: MEAS_SECTIONS.find(s => s.type === type)?.unit ?? '',
      result: 'pending' as const,
    }]);
  };

  const updateMeasRow = (idx: number, field: string, value: string | number) => {
    setMeasurements(prev => {
      const next = [...prev];
      const row = { ...next[idx], [field]: value };

      // Auto-evaluate when value-related fields change
      if (field === 'measured_value' || field === 'test_voltage' || field === 'fuse_type') {
        const evalInput: EvaluationInput = {
          measurement_type: row.measurement_type,
          measured_value: Number(row.measured_value),
          test_voltage: row.test_voltage,
          fuse_type: row.fuse_type,
          device_type: isDevice ? 'geraet' : 'anlage',
        };
        const ev = evaluateMeasurement(evalInput);
        row.result = ev.result;
        row.limit_value = ev.limit_value;
        row.limit_type = ev.limit_type;
      }

      next[idx] = row;
      return next;
    });
  };

  // -------------------------------------------------------------------------
  // Photo upload via Supabase Storage
  // -------------------------------------------------------------------------
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const path = `inspections/${protocol?.id ?? 'draft'}/${Date.now()}_${file.name}`;
      const { error } = await supabase.storage.from('inspection-photos').upload(path, file);
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('inspection-photos').getPublicUrl(path);
      setPhotos(prev => [...prev, publicUrl]);
    } catch {
      toast({ title: 'Upload fehlgeschlagen', variant: 'destructive' });
    } finally {
      setUploadingPhoto(false);
    }
  };

  // -------------------------------------------------------------------------
  // Submit (create or update protocol)
  // -------------------------------------------------------------------------
  const onSubmit = async (data: FormData) => {
    try {
      // For Anlagen protocols, pack visual checks into notes JSON
      const notesWithVisual = !isDevice
        ? JSON.stringify({ text: data.notes ?? '', visualChecks })
        : data.notes;

      if (isNew) {
        await createProtocol.mutateAsync({
          ...data,
          notes: notesWithVisual,
          device_id: deviceId,
          customer_id: customerId,
          project_id: projectId,
        });
      } else {
        await updateProtocol.mutateAsync({
          id: protocol!.id,
          data: { ...data, notes: notesWithVisual },
        });
      }
      onClose();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unbekannter Fehler';
      toast({ title: 'Fehler', description: msg, variant: 'destructive' });
    }
  };

  // -------------------------------------------------------------------------
  // Finalize
  // -------------------------------------------------------------------------
  const handleFinalize = async () => {
    if (!protocol?.id) return;
    try {
      await finalizeProtocol.mutateAsync(protocol.id);
      setShowFinalizeDialog(false);
      onClose();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unbekannter Fehler';
      toast({ title: 'Fehler', description: msg, variant: 'destructive' });
    }
  };

  // -------------------------------------------------------------------------
  // Tiny helper for pass/fail badge
  // -------------------------------------------------------------------------
  const PassBadge = ({ result }: { result?: string }) => {
    if (result === 'pass') return <Badge className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />OK</Badge>;
    if (result === 'fail') return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Fail</Badge>;
    return <Badge variant="secondary">-</Badge>;
  };

  // =========================================================================
  // RENDER
  // =========================================================================
  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      {/* Locked banner */}
      {isLocked && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
          <Lock className="h-4 w-4" /> Protokoll ist abgeschlossen und gesperrt.
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Header fields                                                     */}
      {/* ----------------------------------------------------------------- */}
      <Card>
        <CardHeader><CardTitle className="text-base">Allgemeine Angaben</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label>Protokolltyp</Label>
            <Controller control={form.control} name="protocol_type" render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange} disabled={isLocked || !isNew}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="vde_0100_600">VDE 0100-600 Erstpruefung</SelectItem>
                  <SelectItem value="vde_0105_100">VDE 0105-100 Wiederholung</SelectItem>
                  <SelectItem value="vde_0701_0702">VDE 0701/0702 Geraete</SelectItem>
                </SelectContent>
              </Select>
            )} />
          </div>
          <div>
            <Label>Pruefdatum</Label>
            <Input type="date" {...form.register('inspection_date')} disabled={isLocked} />
          </div>
          <div className="md:col-span-1">
            <Label>Bemerkungen</Label>
            <Textarea {...form.register('notes')} rows={2} disabled={isLocked} placeholder="Optionale Bemerkungen..." />
          </div>
        </CardContent>
      </Card>

      {/* ----------------------------------------------------------------- */}
      {/* Sichtpruefung (VDE 0100/0105 only)                                */}
      {/* ----------------------------------------------------------------- */}
      {!isDevice && (
        <Card>
          <CardHeader><CardTitle className="text-base">Sichtpruefung</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {visualChecks.map((item, idx) => (
              <div key={idx} className="flex items-center gap-3 py-1 border-b border-slate-100 last:border-0">
                <Checkbox
                  checked={item.checked}
                  disabled={isLocked}
                  onCheckedChange={(v) => {
                    const n = [...visualChecks];
                    n[idx] = { ...n[idx], checked: !!v };
                    setVisualChecks(n);
                  }}
                />
                <span className="text-sm flex-1">{item.label}</span>
                <Input
                  value={item.note}
                  placeholder="Bemerkung"
                  className="w-48 h-7 text-xs"
                  disabled={isLocked}
                  onChange={(e) => {
                    const n = [...visualChecks];
                    n[idx] = { ...n[idx], note: e.target.value };
                    setVisualChecks(n);
                  }}
                />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Measurement tabs                                                  */}
      {/* ----------------------------------------------------------------- */}
      <Tabs defaultValue={MEAS_SECTIONS[0]?.type}>
        <TabsList>
          {MEAS_SECTIONS.map(s => (
            <TabsTrigger key={s.type} value={s.type}>{s.label}</TabsTrigger>
          ))}
        </TabsList>

        {MEAS_SECTIONS.map(sec => {
          const rows = measurements.filter(m => m.measurement_type === sec.type);
          return (
            <TabsContent key={sec.type} value={sec.type}>
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">{sec.label}</CardTitle>
                    {!isLocked && (
                      <Button variant="outline" size="sm" type="button" onClick={() => addMeasRow(sec.type)}>
                        <Plus className="h-3 w-3 mr-1" />Zeile
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Column headers */}
                  <div className="grid grid-cols-12 gap-2 text-xs font-medium text-slate-500 px-1 mb-2">
                    <div className="col-span-3">Stromkreis</div>
                    <div className="col-span-2">
                      {sec.type === 'insulation_resistance' ? 'Pruefspannung' : sec.type === 'loop_impedance' ? 'Sicherung' : ''}
                    </div>
                    <div className="col-span-2">Messwert ({sec.unit})</div>
                    <div className="col-span-2">Grenzwert</div>
                    <div className="col-span-2">Ergebnis</div>
                    <div className="col-span-1"></div>
                  </div>

                  {/* Measurement rows */}
                  {rows.map((row) => {
                    const gi = measurements.indexOf(row);
                    return (
                      <div key={gi} className="grid grid-cols-12 gap-2 items-center mb-2">
                        {/* Circuit label */}
                        <div className="col-span-3">
                          <Input
                            value={row.circuit_label}
                            placeholder="z.B. SK1"
                            disabled={isLocked}
                            className="h-8 text-sm"
                            onChange={e => updateMeasRow(gi, 'circuit_label', e.target.value)}
                          />
                        </div>

                        {/* Context column: test voltage or fuse type */}
                        <div className="col-span-2">
                          {sec.type === 'insulation_resistance' && (
                            <Select
                              value={String(row.test_voltage ?? 500)}
                              disabled={isLocked}
                              onValueChange={v => updateMeasRow(gi, 'test_voltage', Number(v))}
                            >
                              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="250">250V</SelectItem>
                                <SelectItem value="500">500V</SelectItem>
                                <SelectItem value="1000">1000V</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                          {sec.type === 'loop_impedance' && (
                            <Select
                              value={row.fuse_type ?? 'B16'}
                              disabled={isLocked}
                              onValueChange={v => updateMeasRow(gi, 'fuse_type', v)}
                            >
                              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {['B6','B10','B13','B16','B20','B25','B32','C6','C10','C13','C16','C20','C25','C32'].map(f => (
                                  <SelectItem key={f} value={f}>{f}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </div>

                        {/* Measured value */}
                        <div className="col-span-2">
                          <Input
                            type="number"
                            step="0.01"
                            value={row.measured_value || ''}
                            disabled={isLocked}
                            className="h-8 text-sm"
                            onChange={e => updateMeasRow(gi, 'measured_value', Number(e.target.value))}
                          />
                        </div>

                        {/* Limit value (read-only, auto-calculated) */}
                        <div className="col-span-2 text-xs text-slate-500 px-2">
                          {row.limit_value !== undefined ? `${row.limit_value} ${sec.unit}` : '-'}
                        </div>

                        {/* Result badge */}
                        <div className="col-span-2"><PassBadge result={row.result} /></div>

                        {/* Delete */}
                        <div className="col-span-1">
                          {!isLocked && (
                            <Button
                              variant="ghost"
                              size="sm"
                              type="button"
                              onClick={() => setMeasurements(p => p.filter((_, i) => i !== gi))}
                            >
                              <Trash2 className="h-3 w-3 text-red-500" />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {rows.length === 0 && (
                    <p className="text-sm text-slate-400 text-center py-4">
                      Keine Messungen. Klicken Sie &quot;Zeile&quot; um eine hinzuzufuegen.
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          );
        })}
      </Tabs>

      {/* VDE 0105 comparison hint */}
      {pType === 'vde_0105_100' && (
        <div className="text-xs text-slate-500 bg-blue-50 border border-blue-200 p-3 rounded-lg">
          VDE 0105-100: Vergleichswerte der letzten Pruefung werden automatisch angezeigt, sobald ein vorheriges Protokoll existiert.
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Defects                                                           */}
      {/* ----------------------------------------------------------------- */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Maengel</CardTitle>
            {!isLocked && (
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={() =>
                  setDefects(p => [...p, {
                    id: crypto.randomUUID(),
                    description: '',
                    severity: 'minor',
                    location: '',
                  }])
                }
              >
                <Plus className="h-3 w-3 mr-1" />Mangel
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {defects.map((d, idx) => (
            <div key={d.id} className="grid grid-cols-12 gap-2 items-start">
              <div className="col-span-5">
                <Input
                  value={d.description}
                  placeholder="Beschreibung"
                  disabled={isLocked}
                  className="text-sm"
                  onChange={e => {
                    const n = [...defects];
                    n[idx] = { ...n[idx], description: e.target.value };
                    setDefects(n);
                  }}
                />
              </div>
              <div className="col-span-3">
                <Input
                  value={d.location}
                  placeholder="Ort"
                  disabled={isLocked}
                  className="text-sm"
                  onChange={e => {
                    const n = [...defects];
                    n[idx] = { ...n[idx], location: e.target.value };
                    setDefects(n);
                  }}
                />
              </div>
              <div className="col-span-3">
                <Select
                  value={d.severity}
                  disabled={isLocked}
                  onValueChange={v => {
                    const n = [...defects];
                    n[idx] = { ...n[idx], severity: v as 'minor' | 'major' | 'critical' };
                    setDefects(n);
                  }}
                >
                  <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="minor">Gering</SelectItem>
                    <SelectItem value="major">Erheblich</SelectItem>
                    <SelectItem value="critical">Kritisch</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-1">
                {!isLocked && (
                  <Button
                    variant="ghost"
                    size="sm"
                    type="button"
                    onClick={() => setDefects(p => p.filter((_, i) => i !== idx))}
                  >
                    <Trash2 className="h-3 w-3 text-red-500" />
                  </Button>
                )}
              </div>
            </div>
          ))}
          {defects.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-2">Keine Maengel erfasst.</p>
          )}
        </CardContent>
      </Card>

      {/* ----------------------------------------------------------------- */}
      {/* Photos                                                            */}
      {/* ----------------------------------------------------------------- */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Fotos</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {photos.map((url, idx) => (
              <div key={idx} className="relative w-24 h-24 rounded-lg overflow-hidden border">
                <img src={url} alt="" className="w-full h-full object-cover" />
                {!isLocked && (
                  <button
                    type="button"
                    className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center"
                    onClick={() => setPhotos(p => p.filter((_, i) => i !== idx))}
                  >
                    x
                  </button>
                )}
              </div>
            ))}
            {!isLocked && (
              <label className="w-24 h-24 border-2 border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50">
                <Camera className="h-5 w-5 text-slate-400" />
                <span className="text-xs text-slate-400 mt-1">Foto</span>
                <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} disabled={uploadingPhoto} />
              </label>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ----------------------------------------------------------------- */}
      {/* Action buttons                                                    */}
      {/* ----------------------------------------------------------------- */}
      <div className="flex items-center justify-between pt-2">
        <Button variant="outline" type="button" onClick={onClose}>Abbrechen</Button>
        <div className="flex gap-2">
          {!isLocked && (
            <Button type="submit" disabled={createProtocol.isPending || updateProtocol.isPending}>
              Speichern
            </Button>
          )}
          {!isLocked && !isNew && (
            <Button type="button" variant="destructive" onClick={() => setShowFinalizeDialog(true)}>
              <Lock className="h-4 w-4 mr-1" />Pruefung abschliessen
            </Button>
          )}
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Finalize confirmation dialog                                      */}
      {/* ----------------------------------------------------------------- */}
      <AlertDialog open={showFinalizeDialog} onOpenChange={setShowFinalizeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Pruefung abschliessen?</AlertDialogTitle>
            <AlertDialogDescription>
              Das Protokoll wird gesperrt und das Gesamtergebnis automatisch berechnet.
              Diese Aktion kann nicht rueckgaengig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleFinalize}>Abschliessen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  );
}
