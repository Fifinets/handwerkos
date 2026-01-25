import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Loader2, Lock } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { OfferItemsEditor, OfferTargetsForm, OfferSummaryCard } from '@/components/offers';
import {
  useOffer,
  useOfferItems,
  useUpdateOffer,
  useUpdateOfferTargets,
  useAddOfferItem,
  useUpdateOfferItem,
  useDeleteOfferItem,
  useEmployees,
} from '@/hooks/useApi';
import {
  OfferUpdate,
  OfferItem,
  OfferItemCreate,
  OfferTargetCreate,
} from '@/types/offer';

interface EditOfferDialogProps {
  isOpen: boolean;
  onClose: () => void;
  offerId: string | null;
  onOfferUpdated?: () => void;
}

export function EditOfferDialog({
  isOpen,
  onClose,
  offerId,
  onOfferUpdated,
}: EditOfferDialogProps) {
  const { toast } = useToast();
  const { data: employeesData } = useEmployees();

  // Queries
  const { data: offer, isLoading: offerLoading } = useOffer(offerId || '', {
    enabled: !!offerId && isOpen,
  });
  const { data: offerItems, isLoading: itemsLoading } = useOfferItems(offerId || '', {
    enabled: !!offerId && isOpen,
  });

  // Mutations
  const updateOfferMutation = useUpdateOffer();
  const updateTargetsMutation = useUpdateOfferTargets();
  const addItemMutation = useAddOfferItem();
  const updateItemMutation = useUpdateOfferItem();
  const deleteItemMutation = useDeleteOfferItem();

  // Form state
  const [activeTab, setActiveTab] = useState('basics');
  const [offerData, setOfferData] = useState<OfferUpdate>({});
  const [items, setItems] = useState<(OfferItem | OfferItemCreate)[]>([]);
  const [targets, setTargets] = useState<OfferTargetCreate>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Load offer data when dialog opens
  useEffect(() => {
    if (offer) {
      setOfferData({
        customer_name: offer.customer_name,
        customer_address: offer.customer_address || '',
        contact_person: offer.contact_person || '',
        project_name: offer.project_name,
        project_location: offer.project_location || '',
        valid_until: offer.valid_until || '',
        payment_terms: offer.payment_terms || '14 Tage netto',
        notes: offer.notes || '',
      });

      // Load targets
      if (offer.targets) {
        setTargets({
          planned_hours_total: offer.targets.planned_hours_total || undefined,
          internal_hourly_rate: offer.targets.internal_hourly_rate || undefined,
          billable_hourly_rate: offer.targets.billable_hourly_rate || undefined,
          planned_material_cost_total: offer.targets.planned_material_cost_total || undefined,
          planned_other_cost: offer.targets.planned_other_cost || 0,
          target_start_date: offer.targets.target_start_date || undefined,
          target_end_date: offer.targets.target_end_date || undefined,
          project_manager_id: offer.targets.project_manager_id || undefined,
          complexity: offer.targets.complexity || 'medium',
        });
      }
    }
  }, [offer]);

  // Load items
  useEffect(() => {
    if (offerItems) {
      setItems(offerItems);
    }
  }, [offerItems]);

  const isLocked = offer?.is_locked || offer?.status !== 'draft';

  const updateOfferField = (field: keyof OfferUpdate, value: any) => {
    setOfferData({ ...offerData, [field]: value });
    if (errors[field]) {
      setErrors({ ...errors, [field]: '' });
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!offerData.project_name?.trim()) {
      newErrors.project_name = 'Projektname ist erforderlich';
    }

    if (items.length === 0) {
      newErrors.items = 'Mindestens eine Position ist erforderlich';
    } else {
      const hasEmptyDescription = items.some(item => !item.description?.trim());
      if (hasEmptyDescription) {
        newErrors.items = 'Alle Positionen müssen eine Beschreibung haben';
      }
    }

    // Targets validation - planned_hours is OPTIONAL (internal only)
    // No validation required for planned_hours or target_end_date

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!offerId || !offer) return;
    if (isLocked) {
      toast({
        title: 'Angebot gesperrt',
        description: 'Dieses Angebot kann nicht mehr bearbeitet werden.',
        variant: 'destructive',
      });
      return;
    }

    if (!validate()) {
      if (errors.project_name) {
        setActiveTab('basics');
      } else if (errors.items) {
        setActiveTab('items');
      }

      toast({
        title: 'Validierungsfehler',
        description: 'Bitte füllen Sie alle Pflichtfelder aus.',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);

    try {
      // Update offer basic data
      await updateOfferMutation.mutateAsync({
        id: offerId,
        data: offerData,
      });

      // Update targets
      await updateTargetsMutation.mutateAsync({
        offerId,
        targets,
      });

      // Handle items - compare with original items
      const originalItems = offerItems || [];
      const originalIds = new Set(originalItems.map(i => i.id));
      const currentIds = new Set(items.filter(i => 'id' in i && i.id).map(i => (i as OfferItem).id));

      // Delete removed items
      for (const item of originalItems) {
        if (!currentIds.has(item.id)) {
          await deleteItemMutation.mutateAsync(item.id);
        }
      }

      // Add new items or update existing
      for (const item of items) {
        if ('id' in item && item.id && originalIds.has(item.id)) {
          // Update existing item
          const { id, offer_id, created_at, updated_at, ...updateData } = item;
          await updateItemMutation.mutateAsync({
            itemId: id,
            data: updateData,
          });
        } else {
          // Add new item
          await addItemMutation.mutateAsync({
            offerId,
            item: item as OfferItemCreate,
          });
        }
      }

      toast({
        title: 'Angebot gespeichert',
        description: 'Das Angebot wurde erfolgreich aktualisiert.',
      });

      onOfferUpdated?.();
      handleClose();
    } catch (error: any) {
      toast({
        title: 'Fehler',
        description: error.message || 'Angebot konnte nicht gespeichert werden.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setActiveTab('basics');
    setOfferData({});
    setItems([]);
    setTargets({});
    setErrors({});
    onClose();
  };

  const isLoading = offerLoading || itemsLoading;
  const employees = employeesData?.items || [];

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Angebot bearbeiten
            {isLocked && (
              <span className="inline-flex items-center gap-1 text-sm font-normal text-muted-foreground">
                <Lock className="h-4 w-4" />
                Gesperrt
              </span>
            )}
          </DialogTitle>
          <DialogDescription>
            {offer?.offer_number} - {offer?.project_name}
            {isLocked && (
              <span className="block text-amber-600 mt-1">
                Dieses Angebot ist gesperrt und kann nicht mehr bearbeitet werden.
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="basics">
                  1. Grunddaten
                  {errors.project_name && <span className="ml-1 text-red-500">*</span>}
                </TabsTrigger>
                <TabsTrigger value="items">
                  2. Positionen
                  {errors.items && <span className="ml-1 text-red-500">*</span>}
                </TabsTrigger>
                <TabsTrigger value="targets">
                  3. Zielwerte (optional)
                </TabsTrigger>
                <TabsTrigger value="summary">4. Übersicht</TabsTrigger>
              </TabsList>

              {/* Tab 1: Basic Information */}
              <TabsContent value="basics" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Kunde</Label>
                    <Input
                      value={offer?.customer_name || ''}
                      disabled
                      className="bg-muted"
                    />
                    <p className="text-xs text-muted-foreground">
                      Der Kunde kann nicht geändert werden
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="contact_person">Ansprechpartner</Label>
                    <Input
                      id="contact_person"
                      value={offerData.contact_person || ''}
                      onChange={(e) => updateOfferField('contact_person', e.target.value)}
                      placeholder="Name des Ansprechpartners"
                      disabled={isLocked}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="customer_address">Kundenadresse</Label>
                  <Input
                    id="customer_address"
                    value={offerData.customer_address || ''}
                    onChange={(e) => updateOfferField('customer_address', e.target.value)}
                    disabled={isLocked}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="project_name">Projektname *</Label>
                    <Input
                      id="project_name"
                      value={offerData.project_name || ''}
                      onChange={(e) => updateOfferField('project_name', e.target.value)}
                      placeholder="z.B. Dachrenovierung Müller"
                      className={errors.project_name ? 'border-red-500' : ''}
                      disabled={isLocked}
                    />
                    {errors.project_name && (
                      <p className="text-sm text-red-500">{errors.project_name}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="project_location">Projektort</Label>
                    <Input
                      id="project_location"
                      value={offerData.project_location || ''}
                      onChange={(e) => updateOfferField('project_location', e.target.value)}
                      placeholder="z.B. Musterstraße 123, 12345 Berlin"
                      disabled={isLocked}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Gültig bis</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full justify-start text-left font-normal"
                          disabled={isLocked}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {offerData.valid_until ? (
                            format(new Date(offerData.valid_until), 'dd.MM.yyyy', { locale: de })
                          ) : (
                            <span className="text-muted-foreground">Datum wählen</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={offerData.valid_until ? new Date(offerData.valid_until) : undefined}
                          onSelect={(date) =>
                            updateOfferField('valid_until', date?.toISOString().split('T')[0])
                          }
                          locale={de}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="payment_terms">Zahlungsbedingungen</Label>
                    <Select
                      value={offerData.payment_terms || '14 Tage netto'}
                      onValueChange={(value) => updateOfferField('payment_terms', value)}
                      disabled={isLocked}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sofort">Sofort fällig</SelectItem>
                        <SelectItem value="7 Tage netto">7 Tage netto</SelectItem>
                        <SelectItem value="14 Tage netto">14 Tage netto</SelectItem>
                        <SelectItem value="30 Tage netto">30 Tage netto</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notizen (intern)</Label>
                  <Textarea
                    id="notes"
                    value={offerData.notes || ''}
                    onChange={(e) => updateOfferField('notes', e.target.value)}
                    placeholder="Interne Notizen zum Angebot..."
                    rows={3}
                    disabled={isLocked}
                  />
                </div>
              </TabsContent>

              {/* Tab 2: Items */}
              <TabsContent value="items" className="mt-4">
                {errors.items && (
                  <p className="text-sm text-red-500 mb-4">{errors.items}</p>
                )}
                <OfferItemsEditor
                  items={items}
                  onChange={setItems}
                  disabled={isLocked}
                />
              </TabsContent>

              {/* Tab 3: Targets */}
              <TabsContent value="targets" className="mt-4">
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                  <p className="text-sm text-blue-700">
                    <strong>Interne Planung (optional)</strong><br />
                    Diese Werte sind nur für Sie sichtbar und dienen der Projektsteuerung.
                  </p>
                </div>
                <OfferTargetsForm
                  targets={targets}
                  onChange={setTargets}
                  employees={employees}
                  disabled={isLocked}
                />
              </TabsContent>

              {/* Tab 4: Summary */}
              <TabsContent value="summary" className="mt-4">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-semibold mb-2">Kundendaten</h3>
                      <div className="text-sm space-y-1">
                        <p><strong>Kunde:</strong> {offer?.customer_name || '-'}</p>
                        <p><strong>Ansprechpartner:</strong> {offerData.contact_person || '-'}</p>
                        <p><strong>Adresse:</strong> {offerData.customer_address || '-'}</p>
                      </div>
                    </div>
                    <div>
                      <h3 className="font-semibold mb-2">Projektdaten</h3>
                      <div className="text-sm space-y-1">
                        <p><strong>Projektname:</strong> {offerData.project_name || '-'}</p>
                        <p><strong>Ort:</strong> {offerData.project_location || '-'}</p>
                        <p><strong>Gültig bis:</strong> {offerData.valid_until ? format(new Date(offerData.valid_until), 'dd.MM.yyyy', { locale: de }) : '-'}</p>
                      </div>
                    </div>
                    <div>
                      <h3 className="font-semibold mb-2">Zielwerte</h3>
                      <div className="text-sm space-y-1">
                        <p><strong>Geplante Stunden:</strong> {targets.planned_hours_total || '-'}</p>
                        <p><strong>Ziel-Enddatum:</strong> {targets.target_end_date ? format(new Date(targets.target_end_date), 'dd.MM.yyyy', { locale: de }) : '-'}</p>
                        <p><strong>Interner Stundensatz:</strong> {targets.internal_hourly_rate ? `${targets.internal_hourly_rate} €` : '-'}</p>
                      </div>
                    </div>
                  </div>
                  <div>
                    <OfferSummaryCard items={items as OfferItem[]} />
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex justify-between pt-4 border-t">
              <Button variant="outline" onClick={handleClose}>
                {isLocked ? 'Schließen' : 'Abbrechen'}
              </Button>
              {!isLocked && (
                <div className="flex gap-2">
                  {activeTab !== 'basics' && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        const tabs = ['basics', 'items', 'targets', 'summary'];
                        const currentIndex = tabs.indexOf(activeTab);
                        if (currentIndex > 0) setActiveTab(tabs[currentIndex - 1]);
                      }}
                    >
                      Zurück
                    </Button>
                  )}
                  {activeTab !== 'summary' ? (
                    <Button
                      onClick={() => {
                        const tabs = ['basics', 'items', 'targets', 'summary'];
                        const currentIndex = tabs.indexOf(activeTab);
                        if (currentIndex < tabs.length - 1) setActiveTab(tabs[currentIndex + 1]);
                      }}
                    >
                      Weiter
                    </Button>
                  ) : (
                    <Button
                      onClick={handleSubmit}
                      disabled={isSaving}
                    >
                      {isSaving && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Änderungen speichern
                    </Button>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default EditOfferDialog;
