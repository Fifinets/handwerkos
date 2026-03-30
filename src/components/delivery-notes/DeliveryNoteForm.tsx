// Form for creating/editing delivery notes (Lieferscheine)

import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Trash2, Camera, Package, Clock, Save, AlertTriangle, Info, Users, Euro, X } from 'lucide-react';
import { useDeliveryNotes, type DeliveryNote } from '@/hooks/useDeliveryNotes';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { supabase } from '@/integrations/supabase/client';

interface PrefillData {
  work_date?: string;
  start_time?: string;
  end_time?: string;
  break_minutes?: number;
  description?: string;
}

interface DeliveryNoteFormProps {
  projectId?: string;   // optional — wenn leer, zeigt Dropdown
  customerId?: string;
  deliveryNoteId?: string;
  prefillData?: PrefillData;  // Vorausgefüllte Zeiten aus Zeiterfassung
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface MaterialItem {
  id?: string;
  material_name: string;
  material_quantity: number;
  material_unit: string;
  unit_price?: number;
  markup_percent: number;  // Aufschlag %
  vat_rate: number;        // MwSt-Satz (19 oder 7)
}

interface PhotoItem {
  id?: string;
  photo_url: string;
  photo_caption: string;
  localPreview?: string; // blob URL for immediate preview
}

interface ProjectOption {
  id: string;
  name: string;
  customer_name?: string;
}

// ArbZG: min break based on gross hours
const getMinBreak = (grossHours: number): number => {
  if (grossHours > 9) return 45;
  if (grossHours > 6) return 30;
  return 0;
};

// Auto-Pause: 30min wenn Zeitraum durch 12:00–12:30 geht
const calcAutoBreak = (startTime: string, endTime: string): number => {
  const toMinutes = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  const start = toMinutes(startTime);
  const end = toMinutes(endTime);
  // Mittagspause 12:00–12:30 liegt im Zeitraum
  if (start <= 720 && end >= 750) return 30; // 720=12:00, 750=12:30
  return 0;
};

export function DeliveryNoteForm({
  projectId: initialProjectId,
  customerId,
  deliveryNoteId,
  prefillData,
  open,
  onOpenChange,
  onSuccess,
}: DeliveryNoteFormProps) {
  const { companyId, user } = useSupabaseAuth();
  const {
    createDeliveryNote,
    updateDeliveryNote,
    fetchDeliveryNote,
    addItem,
    removeItem,
    isLoading,
  } = useDeliveryNotes();

  const [materials, setMaterials] = useState<MaterialItem[]>([]);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [activeTab, setActiveTab] = useState('details');
  const [submitting, setSubmitting] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState(initialProjectId || '');
  // Track if user manually changed the break (to not auto-override)
  const [breakManuallySet, setBreakManuallySet] = useState(false);
  // Employees for multi-select
  const [allEmployees, setAllEmployees] = useState<{ id: string; name: string; hourly_wage: number }[]>([]);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [currentEmployeeId, setCurrentEmployeeId] = useState<string | null>(null);
  // Fallback hourly rate if employee has none configured in DB
  const [manualHourlyRate, setManualHourlyRate] = useState<number>(0);

  // Form state — prefillData kommt aus Zeiterfassung
  const [formData, setFormData] = useState({
    work_date: prefillData?.work_date ?? new Date().toISOString().split('T')[0],
    start_time: prefillData?.start_time ?? '08:00',
    end_time: prefillData?.end_time ?? '16:30',
    break_minutes: prefillData?.break_minutes ?? 0,
    description: prefillData?.description ?? '',
  });

  // Reset form when prefillData changes (new time entry opened)
  useEffect(() => {
    if (!open) return;
    if (prefillData && !deliveryNoteId) {
      setFormData({
        work_date: prefillData.work_date ?? new Date().toISOString().split('T')[0],
        start_time: prefillData.start_time ?? '08:00',
        end_time: prefillData.end_time ?? '16:30',
        break_minutes: prefillData.break_minutes ?? 0,
        description: prefillData.description ?? '',
      });
      setBreakManuallySet(false);
    }
  }, [open, prefillData, deliveryNoteId]);

  // Fetch projects and employees for dropdown
  useEffect(() => {
    if (!open || !companyId || !user?.id) return;
    supabase
      .from('projects')
      .select('id, name, customers(company_name)')
      .eq('company_id', companyId)
      .in('status', ['anfrage', 'besichtigung', 'angebot', 'beauftragt', 'in_bearbeitung'])
      .order('name')
      .then(({ data }) => {
        setProjects(
          (data || []).map((p: any) => ({
            id: p.id,
            name: p.name,
            customer_name: p.customers?.company_name,
          }))
        );
      });

    // Fetch employees for multi-select + get current user's employee ID
    supabase
      .from('employees')
      .select('id, first_name, last_name, hourly_wage, user_id')
      .eq('company_id', companyId)
      .order('first_name')
      .then(({ data }) => {
        const emps = (data || []).map((e: any) => ({
          id: e.id,
          name: `${e.first_name} ${e.last_name}`.trim(),
          hourly_wage: e.hourly_wage ?? 0,
          user_id: e.user_id,
        }));
        setAllEmployees(emps);
        // Find current user's employee record
        const me = emps.find((e: any) => e.user_id === user.id);
        if (me) setCurrentEmployeeId(me.id);
      });
  }, [open, companyId, user?.id]);

  // Auto-break calculation — only if user hasn't manually set it
  const autoBreak = calcAutoBreak(formData.start_time, formData.end_time);

  const handleTimeChange = useCallback((field: 'start_time' | 'end_time', value: string) => {
    setFormData(p => {
      const next = { ...p, [field]: value };
      // Auto-update break only if not manually set
      if (!breakManuallySet) {
        next.break_minutes = calcAutoBreak(
          field === 'start_time' ? value : p.start_time,
          field === 'end_time' ? value : p.end_time,
        );
      }
      return next;
    });
  }, [breakManuallySet]);

  const handleBreakChange = (value: number) => {
    setBreakManuallySet(true);
    setFormData(p => ({ ...p, break_minutes: value }));
  };

  const resetAutoBreak = () => {
    setBreakManuallySet(false);
    setFormData(p => ({ ...p, break_minutes: autoBreak }));
  };

  // Load existing delivery note for editing
  useEffect(() => {
    if (deliveryNoteId && open) {
      fetchDeliveryNote(deliveryNoteId).then((note: DeliveryNote | null) => {
        if (note) {
          setSelectedProjectId(note.project_id);
          setBreakManuallySet(true); // treat existing value as manual
          setFormData({
            work_date: note.work_date,
            start_time: note.start_time || '08:00',
            end_time: note.end_time || '16:30',
            break_minutes: note.break_minutes ?? 0,
            description: note.description,
          });

          const materialItems = (note.delivery_note_items || [])
            .filter((i) => i.item_type === 'material')
            .map((i) => ({
              id: i.id,
              material_name: i.material_name || '',
              material_quantity: i.material_quantity ?? 1,
              material_unit: i.material_unit || 'Stk',
              unit_price: i.unit_price ?? undefined,
              markup_percent: 0,
              vat_rate: 19,
            }));

          const photoItems = (note.delivery_note_items || [])
            .filter((i) => i.item_type === 'photo')
            .map((i) => ({
              id: i.id,
              photo_url: i.photo_url || '',
              photo_caption: i.photo_caption || '',
            }));

          setMaterials(materialItems);
          setPhotos(photoItems);
          setSelectedEmployeeIds(note.additional_employee_ids || []);
        }
      });
    } else if (!deliveryNoteId && open) {
      setSelectedProjectId(initialProjectId || '');
      setBreakManuallySet(false);
      const initBreak = calcAutoBreak('08:00', '16:30');
      setFormData({
        work_date: new Date().toISOString().split('T')[0],
        start_time: '08:00',
        end_time: '16:30',
        break_minutes: initBreak,
        description: '',
      });
      setMaterials([]);
      setPhotos([]);
      setSelectedEmployeeIds([]);
      setActiveTab('details');
    }
  }, [deliveryNoteId, open, initialProjectId]);

  // Calculations
  const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const grossMinutes = Math.max(0, toMin(formData.end_time) - toMin(formData.start_time));
  const grossHours = grossMinutes / 60;
  const netHours = Math.max(0, grossHours - formData.break_minutes / 60);
  const minBreak = getMinBreak(grossHours);
  const isAutoBreak = !breakManuallySet;

  const warnings: string[] = [];
  if (netHours > 10) warnings.push('Tägliche Arbeitszeit über 10 Stunden (§3 ArbZG)');
  if (grossHours > 6 && formData.break_minutes < minBreak) {
    warnings.push(`Mindestpause: ${minBreak} Min. bei ${grossHours > 9 ? '>9h' : '>6h'} Arbeitszeit (§4 ArbZG)`);
  }

  // Material handlers
  const addMaterial = () => {
    setMaterials([...materials, { material_name: '', material_quantity: 1, material_unit: 'Stk', markup_percent: 0, vat_rate: 19 }]);
  };

  const updateMaterial = (index: number, field: keyof MaterialItem, value: any) => {
    const updated = [...materials];
    updated[index] = { ...updated[index], [field]: value };
    setMaterials(updated);
  };

  const removeMaterial = async (index: number) => {
    const item = materials[index];
    if (item.id && deliveryNoteId) {
      await removeItem(item.id, deliveryNoteId);
    }
    setMaterials(materials.filter((_, i) => i !== index));
  };

  // Photo handlers
  const addPhotoUrl = () => {
    setPhotos([...photos, { photo_url: '', photo_caption: '' }]);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Immediate local preview
    const localPreview = URL.createObjectURL(file);
    const newIndex = photos.length;
    setPhotos(prev => [...prev, { photo_url: '', photo_caption: '', localPreview }]);

    setUploadingPhoto(true);
    try {
      const ext = file.name.split('.').pop();
      const fileName = `delivery-photos/${Date.now()}.${ext}`;
      const { data, error } = await supabase.storage
        .from('documents')
        .upload(fileName, file, { upsert: false });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(data.path);
      // Update with real URL, keep local preview as fallback
      setPhotos(prev => prev.map((p, i) => i === newIndex ? { ...p, photo_url: publicUrl } : p));
    } catch (err) {
      console.error('Photo upload failed:', err);
      toast.error('Foto-Upload fehlgeschlagen — lokale Vorschau bleibt erhalten');
    } finally {
      setUploadingPhoto(false);
      // Reset file input so same file can be re-selected
      e.target.value = '';
    }
  };

  const updatePhoto = (index: number, field: keyof PhotoItem, value: string) => {
    const updated = [...photos];
    updated[index] = { ...updated[index], [field]: value };
    setPhotos(updated);
  };

  const removePhoto = async (index: number) => {
    const item = photos[index];
    if (item.id && deliveryNoteId) {
      await removeItem(item.id, deliveryNoteId);
    }
    setPhotos(photos.filter((_, i) => i !== index));
  };

  // Save
  const handleSave = async () => {
    if (!selectedProjectId) {
      alert('Bitte ein Projekt auswählen.');
      return;
    }
    if (formData.description.trim().length < 10) {
      alert('Bitte eine Tätigkeitsbeschreibung eingeben (mind. 10 Zeichen).');
      setActiveTab('details');
      return;
    }

    setSubmitting(true);
    try {
      let noteId = deliveryNoteId;

      if (deliveryNoteId) {
        const ok = await updateDeliveryNote(deliveryNoteId, {
          project_id: selectedProjectId,
          work_date: formData.work_date,
          start_time: formData.start_time,
          end_time: formData.end_time,
          break_minutes: formData.break_minutes,
          description: formData.description,
          additional_employee_ids: selectedEmployeeIds,
        });
        if (!ok) return;
      } else {
        const created = await createDeliveryNote({
          project_id: selectedProjectId,
          customer_id: customerId,
          work_date: formData.work_date,
          start_time: formData.start_time,
          end_time: formData.end_time,
          break_minutes: formData.break_minutes,
          description: formData.description,
          additional_employee_ids: selectedEmployeeIds,
        });
        if (!created) return;
        noteId = created.id;
      }

      if (!noteId) return;

      for (let i = 0; i < materials.length; i++) {
        const m = materials[i];
        if (!m.id && m.material_name.trim()) {
          await addItem(noteId, {
            item_type: 'material',
            material_name: m.material_name,
            material_quantity: m.material_quantity,
            material_unit: m.material_unit || 'Stk',
            unit_price: m.unit_price,
            sort_order: i,
          });
        }
      }

      for (let i = 0; i < photos.length; i++) {
        const p = photos[i];
        if (!p.id && p.photo_url.trim()) {
          await addItem(noteId, {
            item_type: 'photo',
            photo_url: p.photo_url,
            photo_caption: p.photo_caption,
            sort_order: i,
          });
        }
      }

      onOpenChange(false);
      onSuccess?.();
    } finally {
      setSubmitting(false);
    }
  };

  // Material cost helpers
  const calcLineNet = (m: MaterialItem) => {
    const base = (m.material_quantity || 0) * (m.unit_price || 0);
    return base * (1 + (m.markup_percent || 0) / 100);
  };
  const calcLineGross = (m: MaterialItem) => calcLineNet(m) * (1 + (m.vat_rate || 19) / 100);

  const materialNetto = materials.reduce((sum, m) => sum + calcLineNet(m), 0);
  const materialMwst = materials.reduce((sum, m) => sum + (calcLineGross(m) - calcLineNet(m)), 0);
  const materialBrutto = materialNetto + materialMwst;
  // For backward compat: totalCost uses netto
  const materialTotal = materialNetto;

  // Cost calculations
  const currentEmp = allEmployees.find(e => e.id === currentEmployeeId);
  const workerCount = 1 + selectedEmployeeIds.length;
  const dbHourlyRate = (currentEmp?.hourly_wage ?? 0) +
    selectedEmployeeIds.reduce((sum, id) => {
      const emp = allEmployees.find(e => e.id === id);
      return sum + (emp?.hourly_wage ?? 0);
    }, 0);
  const hasDbRate = dbHourlyRate > 0;
  const totalHourlyRate = hasDbRate ? dbHourlyRate : manualHourlyRate * workerCount;
  const laborCost = netHours * totalHourlyRate;
  const totalCostNetto = laborCost + materialNetto;
  const totalCostBrutto = laborCost + materialBrutto;

  // Available employees for selection (exclude current user)
  const availableEmployees = allEmployees.filter(e => e.id !== currentEmployeeId);

  const selectedProject = projects.find(p => p.id === selectedProjectId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {deliveryNoteId ? 'Lieferschein bearbeiten' : 'Neuer Lieferschein'}
          </DialogTitle>
        </DialogHeader>

        {/* Project selector — always visible at top */}
        <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-3 border">
          <Label className="text-xs text-muted-foreground mb-1 block">Projekt *</Label>
          {initialProjectId && projects.length > 0 ? (
            // Pre-selected but can still change
            <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
              <SelectTrigger>
                <SelectValue placeholder="Projekt wählen..." />
              </SelectTrigger>
              <SelectContent>
                {projects.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}{p.customer_name ? ` — ${p.customer_name}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : initialProjectId && projects.length === 0 ? (
            // Show placeholder while loading
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200 py-1">
              {selectedProject?.name || 'Wird geladen...'}
            </p>
          ) : (
            // Free project selection (manager or no preselection)
            <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
              <SelectTrigger className={!selectedProjectId ? 'border-red-300' : ''}>
                <SelectValue placeholder="Projekt wählen..." />
              </SelectTrigger>
              <SelectContent>
                {projects.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}{p.customer_name ? ` — ${p.customer_name}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="details" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Arbeitszeit
            </TabsTrigger>
            <TabsTrigger value="materials" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Material ({materials.length})
              {materialBrutto > 0 && (
                <span className="ml-1 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">
                  {materialBrutto.toFixed(0)}€
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="photos" className="flex items-center gap-2">
              <Camera className="h-4 w-4" />
              Fotos ({photos.length})
            </TabsTrigger>
          </TabsList>

          {/* ---- DETAILS TAB ---- */}
          <TabsContent value="details" className="space-y-4 mt-4 min-h-[600px]">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="work_date">Datum *</Label>
                <Input
                  id="work_date"
                  type="date"
                  value={formData.work_date}
                  onChange={(e) => setFormData(p => ({ ...p, work_date: e.target.value }))}
                />
              </div>
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Label htmlFor="start_time">Von</Label>
                  <Input
                    id="start_time"
                    type="time"
                    value={formData.start_time}
                    onChange={(e) => handleTimeChange('start_time', e.target.value)}
                  />
                </div>
                <span className="pb-2 text-muted-foreground">–</span>
                <div className="flex-1">
                  <Label htmlFor="end_time">Bis</Label>
                  <Input
                    id="end_time"
                    type="time"
                    value={formData.end_time}
                    onChange={(e) => handleTimeChange('end_time', e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="break_minutes">Pause (Minuten)</Label>
                <Input
                  id="break_minutes"
                  type="number"
                  min={0}
                  max={480}
                  step={5}
                  value={formData.break_minutes}
                  onChange={(e) => handleBreakChange(parseInt(e.target.value) || 0)}
                />
                {isAutoBreak ? (
                  <p className="text-xs text-blue-500 mt-1 flex items-center gap-1">
                    <Info className="h-3 w-3" />
                    Auto: Mittagspause 12:00–12:30
                  </p>
                ) : (
                  <button
                    type="button"
                    className="text-xs text-muted-foreground mt-1 underline hover:text-blue-500"
                    onClick={resetAutoBreak}
                  >
                    Auto zurücksetzen ({autoBreak} Min.)
                  </button>
                )}
                {minBreak > 0 && formData.break_minutes < minBreak && (
                  <p className="text-xs text-amber-600 mt-1">
                    Gesetzl. Min.: {minBreak} Min.
                  </p>
                )}
              </div>

              {grossHours > 0 && (
                <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Brutto</span><span>{grossHours.toFixed(1)}h</span>
                  </div>
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Pause</span>
                    <span className={isAutoBreak ? 'text-blue-500' : ''}>
                      −{formData.break_minutes} Min.{isAutoBreak ? ' (auto)' : ''}
                    </span>
                  </div>
                  <div className="flex justify-between border-t pt-1">
                    <span className="text-sm font-medium">Netto</span>
                    <span className="text-lg font-bold text-blue-600">{netHours.toFixed(1)}h</span>
                  </div>
                </div>
              )}
            </div>

            {warnings.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                {warnings.map((w, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-amber-800">
                    <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                    <span>{w}</span>
                  </div>
                ))}
              </div>
            )}

            <div>
              <Label htmlFor="description">Tätigkeitsbeschreibung *</Label>
              <Textarea
                id="description"
                placeholder="Was wurde heute gemacht? (mind. 10 Zeichen)"
                className="min-h-[120px]"
                value={formData.description}
                onChange={(e) => setFormData(p => ({ ...p, description: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {formData.description.length} Zeichen (mind. 10)
              </p>
            </div>

            {/* Weitere Mitarbeiter */}
            <div>
              <Label className="flex items-center gap-2 mb-2">
                <Users className="h-4 w-4" />
                Weitere Mitarbeiter
              </Label>
              {selectedEmployeeIds.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {selectedEmployeeIds.map(id => {
                    const emp = allEmployees.find(e => e.id === id);
                    if (!emp) return null;
                    return (
                      <span key={id} className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded-md text-sm">
                        {emp.name}
                        {emp.hourly_wage > 0 && <span className="text-blue-400 text-xs">({emp.hourly_wage}€/h)</span>}
                        <button
                          type="button"
                          onClick={() => setSelectedEmployeeIds(prev => prev.filter(x => x !== id))}
                          className="ml-1 hover:text-red-600"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}
              {availableEmployees.length > 0 && (
                <Select
                  value=""
                  onValueChange={(id) => {
                    if (id && !selectedEmployeeIds.includes(id)) {
                      setSelectedEmployeeIds(prev => [...prev, id]);
                    }
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Mitarbeiter hinzufügen..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableEmployees
                      .filter(e => !selectedEmployeeIds.includes(e.id))
                      .map(emp => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {emp.name}{emp.hourly_wage > 0 ? ` (${emp.hourly_wage}€/h)` : ''}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                {workerCount} Person(en) auf diesem Lieferschein
              </p>
            </div>

            {/* Kostenzusammenfassung — always visible when there are net hours */}
            {netHours > 0 && (
              <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4 border space-y-2">
                <Label className="flex items-center gap-2 text-sm font-semibold">
                  <Euro className="h-4 w-4" />
                  Kostenzusammenfassung
                </Label>
                {/* Show per-worker breakdown */}
                <div className="space-y-1">
                  {currentEmp && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        {currentEmp.name} ({netHours.toFixed(1)}h × {currentEmp.hourly_wage > 0 ? `${currentEmp.hourly_wage}€/h` : 'kein Satz'})
                      </span>
                      <span className="font-medium">
                        {currentEmp.hourly_wage > 0 ? `${(netHours * currentEmp.hourly_wage).toFixed(2)} €` : '—'}
                      </span>
                    </div>
                  )}
                  {selectedEmployeeIds.map(id => {
                    const emp = allEmployees.find(e => e.id === id);
                    if (!emp) return null;
                    return (
                      <div key={id} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          {emp.name} ({netHours.toFixed(1)}h × {emp.hourly_wage > 0 ? `${emp.hourly_wage}€/h` : 'kein Satz'})
                        </span>
                        <span className="font-medium">
                          {emp.hourly_wage > 0 ? `${(netHours * emp.hourly_wage).toFixed(2)} €` : '—'}
                        </span>
                      </div>
                    );
                  })}
                </div>
                {!hasDbRate && (
                  <div className="flex items-center gap-1.5 text-sm">
                    <span className="text-amber-600 text-xs">Kein Stundensatz hinterlegt — manuell eingeben:</span>
                    <Input
                      type="number"
                      min={0}
                      step={1}
                      placeholder="€/h"
                      value={manualHourlyRate || ''}
                      onChange={(e) => setManualHourlyRate(parseFloat(e.target.value) || 0)}
                      className="w-20 h-7 text-right text-sm"
                    />
                    <span className="text-muted-foreground text-xs">€/h</span>
                  </div>
                )}
                {hasDbRate && (
                  <div className="flex justify-between text-sm border-t pt-1">
                    <span className="text-muted-foreground">Lohnkosten gesamt</span>
                    <span className="font-medium">{laborCost.toFixed(2)} €</span>
                  </div>
                )}
                {materialNetto > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Material netto</span>
                    <span className="font-medium">{materialNetto.toFixed(2)} €</span>
                  </div>
                )}
                {materialMwst > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Material MwSt</span>
                    <span className="font-medium">{materialMwst.toFixed(2)} €</span>
                  </div>
                )}
                <div className="flex justify-between border-t pt-2 text-sm font-semibold">
                  <span>Gesamt (brutto)</span>
                  <span className="text-blue-600">
                    {totalHourlyRate > 0 || materialNetto > 0 ? `${totalCostBrutto.toFixed(2)} €` : '—'}
                  </span>
                </div>
              </div>
            )}
          </TabsContent>

          {/* ---- MATERIALS TAB ---- */}
          <TabsContent value="materials" className="space-y-4 mt-4 min-h-[600px]">
            {materials.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Noch keine Materialien eingetragen.
              </p>
            )}
            {materials.map((material, index) => {
              const lineNet = calcLineNet(material);
              const lineGross = calcLineGross(material);
              return (
                <Card key={index}>
                  <CardContent className="pt-4 space-y-2">
                    <div className="flex gap-2">
                      <div className="flex-1 grid grid-cols-4 gap-2">
                        <div className="col-span-2">
                          <Label className="text-xs">Bezeichnung</Label>
                          <Input
                            placeholder="z.B. Zement 25kg"
                            value={material.material_name}
                            onChange={(e) => updateMaterial(index, 'material_name', e.target.value)}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Menge</Label>
                          <Input
                            type="number"
                            min={0.01}
                            step={0.01}
                            value={material.material_quantity}
                            onChange={(e) =>
                              updateMaterial(index, 'material_quantity', parseFloat(e.target.value) || 0)
                            }
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Einheit</Label>
                          <Input
                            placeholder="Stk"
                            value={material.material_unit}
                            onChange={(e) => updateMaterial(index, 'material_unit', e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="self-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          onClick={() => removeMaterial(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    {/* Price row: EK netto, Aufschlag, MwSt */}
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <Label className="text-xs">EK netto (€)</Label>
                        <Input
                          type="number"
                          step={0.01}
                          min={0}
                          placeholder="0.00"
                          value={material.unit_price ?? ''}
                          onChange={(e) =>
                            updateMaterial(index, 'unit_price', parseFloat(e.target.value) || undefined)
                          }
                          className="h-8 text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Aufschlag %</Label>
                        <Input
                          type="number"
                          step={1}
                          min={0}
                          placeholder="0"
                          value={material.markup_percent || ''}
                          onChange={(e) =>
                            updateMaterial(index, 'markup_percent', parseFloat(e.target.value) || 0)
                          }
                          className="h-8 text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">MwSt %</Label>
                        <Select
                          value={String(material.vat_rate)}
                          onValueChange={(v) => updateMaterial(index, 'vat_rate', Number(v))}
                        >
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="19">19%</SelectItem>
                            <SelectItem value="7">7%</SelectItem>
                            <SelectItem value="0">0%</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    {/* Line total */}
                    {material.unit_price ? (
                      <div className="flex justify-between text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1.5">
                        <span>
                          {material.material_quantity} × {material.unit_price.toFixed(2)}€
                          {material.markup_percent > 0 && ` + ${material.markup_percent}%`}
                          {' '}= {lineNet.toFixed(2)}€ netto
                        </span>
                        <span className="font-medium text-foreground">
                          {lineGross.toFixed(2)}€ brutto
                        </span>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              );
            })}
            <Button type="button" variant="outline" className="w-full" onClick={addMaterial}>
              <Plus className="h-4 w-4 mr-2" />
              Material hinzufügen
            </Button>
            {/* Cost summary on materials tab */}
            {materialNetto > 0 && (
              <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-3 border space-y-1.5">
                <p className="text-xs font-semibold flex items-center gap-1.5 text-muted-foreground uppercase tracking-wide">
                  <Euro className="h-3.5 w-3.5" /> Materialkosten
                </p>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Netto</span>
                  <span>{materialNetto.toFixed(2)} €</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">MwSt</span>
                  <span>{materialMwst.toFixed(2)} €</span>
                </div>
                <div className="flex justify-between border-t pt-1.5 text-sm font-semibold">
                  <span>Material brutto</span>
                  <span className="text-blue-600">{materialBrutto.toFixed(2)} €</span>
                </div>
                {totalHourlyRate > 0 && (
                  <>
                    <div className="flex justify-between text-sm border-t pt-1.5">
                      <span className="text-muted-foreground">+ Lohnkosten ({netHours.toFixed(1)}h)</span>
                      <span>{laborCost.toFixed(2)} €</span>
                    </div>
                    <div className="flex justify-between border-t pt-1.5 text-sm font-bold">
                      <span>Gesamtkosten</span>
                      <span className="text-blue-600">{totalCostBrutto.toFixed(2)} €</span>
                    </div>
                  </>
                )}
              </div>
            )}
          </TabsContent>

          {/* ---- PHOTOS TAB ---- */}
          <TabsContent value="photos" className="space-y-4 mt-4 min-h-[600px]">
            {photos.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Noch keine Fotos hinzugefügt.
              </p>
            )}
            {photos.map((photo, index) => (
              <Card key={index}>
                <CardContent className="pt-4">
                  <div className="flex gap-4">
                    <div className="flex-1 space-y-2">
                      {(photo.localPreview || photo.photo_url) && (
                        <img
                          src={photo.localPreview || photo.photo_url}
                          alt={photo.photo_caption || 'Foto'}
                          className="w-full max-h-48 object-cover rounded border"
                          onError={(e) => {
                            // If remote URL fails but we have local preview, try that
                            const img = e.target as HTMLImageElement;
                            if (photo.localPreview && img.src !== photo.localPreview) {
                              img.src = photo.localPreview;
                            } else {
                              img.style.display = 'none';
                            }
                          }}
                        />
                      )}
                      {!photo.localPreview && (
                        <div>
                          <Label className="text-xs">Foto-URL</Label>
                          <Input
                            placeholder="https://..."
                            value={photo.photo_url}
                            onChange={(e) => updatePhoto(index, 'photo_url', e.target.value)}
                          />
                        </div>
                      )}
                      <div>
                        <Label className="text-xs">Beschreibung</Label>
                        <Input
                          placeholder="Was zeigt das Foto?"
                          value={photo.photo_caption}
                          onChange={(e) => updatePhoto(index, 'photo_caption', e.target.value)}
                        />
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="self-start text-destructive"
                      onClick={() => removePhoto(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                disabled={uploadingPhoto}
                onClick={() => document.getElementById('photo-upload-input')?.click()}
              >
                <Camera className="h-4 w-4 mr-2" />
                {uploadingPhoto ? 'Wird hochgeladen...' : 'Foto hochladen'}
              </Button>
              <input
                id="photo-upload-input"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoUpload}
              />
              <Button type="button" variant="outline" onClick={addPhotoUrl}>
                <Plus className="h-4 w-4 mr-2" />
                URL eingeben
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-6 gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button
            type="button"
            disabled={submitting || isLoading || formData.description.length < 10 || !selectedProjectId}
            onClick={() => handleSave()}
          >
            <Save className="h-4 w-4 mr-2" />
            Speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
