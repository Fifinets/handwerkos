// Form for creating/editing delivery notes (Lieferscheine)

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Trash2, Camera, Package, Clock, Save, Send } from 'lucide-react';
import { useDeliveryNotes } from '@/hooks/useDeliveryNotes';
import { DeliveryNoteCreateSchema, type DeliveryNoteCreate, type DeliveryNoteItemCreate } from '@/types';

interface DeliveryNoteFormProps {
  projectId: string;
  deliveryNoteId?: string; // For editing
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface MaterialItem {
  id?: string;
  material_name: string;
  material_quantity: number;
  material_unit: string;
  is_additional_work: boolean;
  unit_price?: number;
}

interface PhotoItem {
  id?: string;
  photo_url: string;
  photo_caption: string;
}

export function DeliveryNoteForm({
  projectId,
  deliveryNoteId,
  open,
  onOpenChange,
  onSuccess,
}: DeliveryNoteFormProps) {
  const {
    createDeliveryNote,
    updateDeliveryNote,
    fetchDeliveryNote,
    addItem,
    removeItem,
    submitForApproval,
    isLoading,
    currentDeliveryNote,
  } = useDeliveryNotes({ projectId });

  const [materials, setMaterials] = useState<MaterialItem[]>([]);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [activeTab, setActiveTab] = useState('details');

  const form = useForm<DeliveryNoteCreate>({
    resolver: zodResolver(DeliveryNoteCreateSchema),
    defaultValues: {
      project_id: projectId,
      work_date: new Date().toISOString().split('T')[0],
      start_time: '08:00',
      end_time: '16:30',
      break_minutes: 30,
      description: '',
    },
  });

  // Load existing delivery note for editing
  useEffect(() => {
    if (deliveryNoteId && open) {
      fetchDeliveryNote(deliveryNoteId).then((note) => {
        if (note) {
          form.reset({
            project_id: note.project_id,
            work_date: note.work_date,
            start_time: note.start_time || undefined,
            end_time: note.end_time || undefined,
            break_minutes: note.break_minutes || 0,
            description: note.description,
          });

          // Load items
          const materialItems = note.items
            ?.filter((i) => i.item_type === 'material')
            .map((i) => ({
              id: i.id,
              material_name: i.material_name || '',
              material_quantity: i.material_quantity || 0,
              material_unit: i.material_unit || 'Stk',
              is_additional_work: i.is_additional_work,
              unit_price: i.unit_price || undefined,
            })) || [];

          const photoItems = note.items
            ?.filter((i) => i.item_type === 'photo')
            .map((i) => ({
              id: i.id,
              photo_url: i.photo_url || '',
              photo_caption: i.photo_caption || '',
            })) || [];

          setMaterials(materialItems);
          setPhotos(photoItems);
        }
      });
    } else if (!deliveryNoteId && open) {
      form.reset({
        project_id: projectId,
        work_date: new Date().toISOString().split('T')[0],
        start_time: '08:00',
        end_time: '16:30',
        break_minutes: 30,
        description: '',
      });
      setMaterials([]);
      setPhotos([]);
    }
  }, [deliveryNoteId, open, projectId, fetchDeliveryNote, form]);

  // Calculate work hours
  const startTime = form.watch('start_time');
  const endTime = form.watch('end_time');
  const breakMinutes = form.watch('break_minutes') || 0;

  const calculateWorkHours = () => {
    if (!startTime || !endTime) return null;
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;
    const workMinutes = endMinutes - startMinutes - breakMinutes;
    return (workMinutes / 60).toFixed(2);
  };

  const workHours = calculateWorkHours();

  // Material handlers
  const addMaterial = () => {
    setMaterials([
      ...materials,
      {
        material_name: '',
        material_quantity: 1,
        material_unit: 'Stk',
        is_additional_work: false,
      },
    ]);
  };

  const updateMaterial = (index: number, field: keyof MaterialItem, value: any) => {
    const updated = [...materials];
    updated[index] = { ...updated[index], [field]: value };
    setMaterials(updated);
  };

  const removeMaterial = async (index: number) => {
    const item = materials[index];
    if (item.id) {
      await removeItem(item.id);
    }
    setMaterials(materials.filter((_, i) => i !== index));
  };

  // Photo handlers
  const addPhoto = () => {
    setPhotos([
      ...photos,
      {
        photo_url: '',
        photo_caption: '',
      },
    ]);
  };

  const updatePhoto = (index: number, field: keyof PhotoItem, value: string) => {
    const updated = [...photos];
    updated[index] = { ...updated[index], [field]: value };
    setPhotos(updated);
  };

  const removePhoto = async (index: number) => {
    const item = photos[index];
    if (item.id) {
      await removeItem(item.id);
    }
    setPhotos(photos.filter((_, i) => i !== index));
  };

  // Save delivery note
  const onSubmit = async (data: DeliveryNoteCreate, submitAfter = false) => {
    let noteId = deliveryNoteId;

    // Create or update the delivery note
    if (deliveryNoteId) {
      await updateDeliveryNote(deliveryNoteId, data);
    } else {
      const created = await createDeliveryNote(data);
      if (!created) return;
      noteId = created.id;
    }

    if (!noteId) return;

    // Save materials
    for (const material of materials) {
      if (!material.id && material.material_name) {
        await addItem(noteId, {
          item_type: 'material',
          material_name: material.material_name,
          material_quantity: material.material_quantity,
          material_unit: material.material_unit,
          is_additional_work: material.is_additional_work,
          unit_price: material.unit_price,
        });
      }
    }

    // Save photos
    for (const photo of photos) {
      if (!photo.id && photo.photo_url) {
        await addItem(noteId, {
          item_type: 'photo',
          photo_url: photo.photo_url,
          photo_caption: photo.photo_caption,
        });
      }
    }

    // Submit for approval if requested
    if (submitAfter) {
      await submitForApproval(noteId);
    }

    onOpenChange(false);
    onSuccess?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {deliveryNoteId ? 'Lieferschein bearbeiten' : 'Neuer Lieferschein'}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => onSubmit(data, false))}>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="details" className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Arbeitszeit
                </TabsTrigger>
                <TabsTrigger value="materials" className="flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Material ({materials.length})
                </TabsTrigger>
                <TabsTrigger value="photos" className="flex items-center gap-2">
                  <Camera className="h-4 w-4" />
                  Fotos ({photos.length})
                </TabsTrigger>
              </TabsList>

              {/* DETAILS TAB */}
              <TabsContent value="details" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="work_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Datum *</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex items-end gap-2">
                    <FormField
                      control={form.control}
                      name="start_time"
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormLabel>Beginn</FormLabel>
                          <FormControl>
                            <Input type="time" {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <span className="pb-2">-</span>
                    <FormField
                      control={form.control}
                      name="end_time"
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormLabel>Ende</FormLabel>
                          <FormControl>
                            <Input type="time" {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="break_minutes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Pause (Minuten)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={0}
                            max={480}
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  {workHours && (
                    <div className="flex items-end">
                      <Card className="w-full bg-muted/50">
                        <CardContent className="py-3">
                          <div className="text-sm text-muted-foreground">Arbeitszeit</div>
                          <div className="text-2xl font-bold">{workHours} Std.</div>
                        </CardContent>
                      </Card>
                    </div>
                  )}
                </div>

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tätigkeitsbeschreibung *</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Was wurde heute gemacht? (mind. 20 Zeichen)"
                          className="min-h-[120px]"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        {field.value?.length || 0}/20 Zeichen (Minimum)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>

              {/* MATERIALS TAB */}
              <TabsContent value="materials" className="space-y-4 mt-4">
                {materials.map((material, index) => (
                  <Card key={index}>
                    <CardContent className="pt-4">
                      <div className="flex gap-4">
                        <div className="flex-1 grid grid-cols-4 gap-2">
                          <div className="col-span-2">
                            <Label>Material</Label>
                            <Input
                              placeholder="Bezeichnung"
                              value={material.material_name}
                              onChange={(e) =>
                                updateMaterial(index, 'material_name', e.target.value)
                              }
                            />
                          </div>
                          <div>
                            <Label>Menge</Label>
                            <Input
                              type="number"
                              min={0.01}
                              step={0.01}
                              value={material.material_quantity}
                              onChange={(e) =>
                                updateMaterial(
                                  index,
                                  'material_quantity',
                                  parseFloat(e.target.value) || 0
                                )
                              }
                            />
                          </div>
                          <div>
                            <Label>Einheit</Label>
                            <Input
                              placeholder="Stk"
                              value={material.material_unit}
                              onChange={(e) =>
                                updateMaterial(index, 'material_unit', e.target.value)
                              }
                            />
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="self-end text-destructive"
                          onClick={() => removeMaterial(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="flex items-center gap-4 mt-2">
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={material.is_additional_work}
                            onChange={(e) =>
                              updateMaterial(index, 'is_additional_work', e.target.checked)
                            }
                            className="rounded"
                          />
                          Zusatzarbeit (nicht im Angebot)
                        </label>

                        {material.is_additional_work && (
                          <div className="flex items-center gap-2">
                            <Label>Einzelpreis €</Label>
                            <Input
                              type="number"
                              step={0.01}
                              className="w-24"
                              value={material.unit_price || ''}
                              onChange={(e) =>
                                updateMaterial(
                                  index,
                                  'unit_price',
                                  parseFloat(e.target.value) || undefined
                                )
                              }
                            />
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}

                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={addMaterial}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Material hinzufügen
                </Button>
              </TabsContent>

              {/* PHOTOS TAB */}
              <TabsContent value="photos" className="space-y-4 mt-4">
                {photos.map((photo, index) => (
                  <Card key={index}>
                    <CardContent className="pt-4">
                      <div className="flex gap-4">
                        <div className="flex-1 space-y-2">
                          <div>
                            <Label>Foto-URL</Label>
                            <Input
                              placeholder="https://..."
                              value={photo.photo_url}
                              onChange={(e) =>
                                updatePhoto(index, 'photo_url', e.target.value)
                              }
                            />
                          </div>
                          <div>
                            <Label>Beschreibung</Label>
                            <Input
                              placeholder="Was zeigt das Foto?"
                              value={photo.photo_caption}
                              onChange={(e) =>
                                updatePhoto(index, 'photo_caption', e.target.value)
                              }
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

                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={addPhoto}
                >
                  <Camera className="h-4 w-4 mr-2" />
                  Foto hinzufügen
                </Button>

                <p className="text-sm text-muted-foreground">
                  Tipp: Fotos können über einen Upload-Service hochgeladen und dann hier verlinkt werden.
                </p>
              </TabsContent>
            </Tabs>

            <DialogFooter className="mt-6 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Abbrechen
              </Button>
              <Button type="submit" disabled={isLoading}>
                <Save className="h-4 w-4 mr-2" />
                Speichern
              </Button>
              <Button
                type="button"
                onClick={form.handleSubmit((data) => onSubmit(data, true))}
                disabled={isLoading || (form.watch('description')?.length || 0) < 20}
              >
                <Send className="h-4 w-4 mr-2" />
                Speichern & Einreichen
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
