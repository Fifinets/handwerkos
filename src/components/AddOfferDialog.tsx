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
import { CalendarIcon, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { OfferItemsEditor, OfferTargetsForm, OfferSummaryCard } from '@/components/offers';
import { useCreateOffer, useEmployees } from '@/hooks/useApi';
import {
  OfferCreate,
  OfferItemCreate,
  OfferTargetCreate,
} from '@/types/offer';

interface Customer {
  id: string;
  company_name: string;
  contact_person: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  postal_code: string | null;
}

interface AddOfferDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onOfferCreated?: (offerId: string) => void;
  preselectedCustomerId?: string;
}

const DEFAULT_TARGETS: OfferTargetCreate = {
  planned_hours_total: undefined,
  internal_hourly_rate: undefined,
  billable_hourly_rate: undefined,
  planned_material_cost_total: undefined,
  planned_other_cost: 0,
  target_start_date: undefined,
  target_end_date: undefined,
  project_manager_id: undefined,
  complexity: 'medium',
};

const DEFAULT_ITEM: OfferItemCreate = {
  position_number: 1,
  description: '',
  quantity: 1,
  unit: 'Std',
  unit_price_net: 0,
  vat_rate: 19,
  item_type: 'labor',
  is_optional: false,
};

export function AddOfferDialog({
  isOpen,
  onClose,
  onOfferCreated,
  preselectedCustomerId,
}: AddOfferDialogProps) {
  const { toast } = useToast();
  const createOfferMutation = useCreateOffer();
  const { data: employeesData } = useEmployees();

  // Form state
  const [activeTab, setActiveTab] = useState('basics');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);

  // Offer data
  const [offerData, setOfferData] = useState<OfferCreate>({
    customer_id: preselectedCustomerId || '',
    customer_name: '',
    customer_address: '',
    contact_person: '',
    project_name: '',
    project_location: '',
    valid_until: '',
    payment_terms: '14 Tage netto',
    notes: '',
  });

  // Items & Targets
  const [items, setItems] = useState<OfferItemCreate[]>([DEFAULT_ITEM]);
  const [targets, setTargets] = useState<OfferTargetCreate>(DEFAULT_TARGETS);

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Load customers on open
  useEffect(() => {
    if (isOpen) {
      loadCustomers();
    }
  }, [isOpen]);

  // Pre-fill customer if preselected
  useEffect(() => {
    if (preselectedCustomerId && customers.length > 0) {
      const customer = customers.find(c => c.id === preselectedCustomerId);
      if (customer) {
        handleCustomerSelect(customer.id);
      }
    }
  }, [preselectedCustomerId, customers]);

  const loadCustomers = async () => {
    setLoadingCustomers(true);
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('id, company_name, contact_person, email, address, city, postal_code')
        .eq('status', 'Aktiv')
        .order('company_name');

      if (error) throw error;
      setCustomers(data || []);
    } catch (error) {
      console.error('Error loading customers:', error);
    } finally {
      setLoadingCustomers(false);
    }
  };

  const handleCustomerSelect = (customerId: string) => {
    const customer = customers.find(c => c.id === customerId);
    if (customer) {
      const address = [customer.address, customer.postal_code, customer.city]
        .filter(Boolean)
        .join(', ');

      setOfferData({
        ...offerData,
        customer_id: customer.id,
        customer_name: customer.company_name,
        customer_address: address,
        contact_person: customer.contact_person || '',
      });
    }
  };

  const updateOfferField = (field: keyof OfferCreate, value: any) => {
    setOfferData({ ...offerData, [field]: value });
    if (errors[field]) {
      setErrors({ ...errors, [field]: '' });
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Required fields
    if (!offerData.customer_id) {
      newErrors.customer_id = 'Bitte wählen Sie einen Kunden aus';
    }
    if (!offerData.project_name?.trim()) {
      newErrors.project_name = 'Projektname ist erforderlich';
    }

    // Items validation
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
    if (!validate()) {
      // Show which tab has errors
      if (errors.customer_id || errors.project_name) {
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

    try {
      const result = await createOfferMutation.mutateAsync({
        data: offerData,
        targets,
        items,
      });

      onOfferCreated?.(result.id);
      handleClose();
    } catch (error) {
      // Error toast is handled by the mutation
    }
  };

  const handleClose = () => {
    // Reset form
    setActiveTab('basics');
    setOfferData({
      customer_id: '',
      customer_name: '',
      customer_address: '',
      contact_person: '',
      project_name: '',
      project_location: '',
      valid_until: '',
      payment_terms: '14 Tage netto',
      notes: '',
    });
    setItems([DEFAULT_ITEM]);
    setTargets(DEFAULT_TARGETS);
    setErrors({});
    onClose();
  };

  const employees = employeesData?.items || [];

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Neues Angebot erstellen</DialogTitle>
          <DialogDescription>
            Erstellen Sie ein neues Angebot mit Positionen und Zielwerten.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="basics">
              1. Grunddaten
              {(errors.customer_id || errors.project_name) && (
                <span className="ml-1 text-red-500">*</span>
              )}
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
                <Label htmlFor="customer">Kunde *</Label>
                <Select
                  value={offerData.customer_id}
                  onValueChange={handleCustomerSelect}
                >
                  <SelectTrigger className={errors.customer_id ? 'border-red-500' : ''}>
                    <SelectValue placeholder="Kunde auswählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {loadingCustomers ? (
                      <SelectItem value="loading" disabled>
                        Laden...
                      </SelectItem>
                    ) : (
                      customers.map((customer) => (
                        <SelectItem key={customer.id} value={customer.id}>
                          {customer.company_name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {errors.customer_id && (
                  <p className="text-sm text-red-500">{errors.customer_id}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact_person">Ansprechpartner</Label>
                <Input
                  id="contact_person"
                  value={offerData.contact_person}
                  onChange={(e) => updateOfferField('contact_person', e.target.value)}
                  placeholder="Name des Ansprechpartners"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="customer_address">Kundenadresse</Label>
              <Input
                id="customer_address"
                value={offerData.customer_address}
                onChange={(e) => updateOfferField('customer_address', e.target.value)}
                placeholder="Wird automatisch vom Kunden übernommen"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="project_name">Projektname *</Label>
                <Input
                  id="project_name"
                  value={offerData.project_name}
                  onChange={(e) => updateOfferField('project_name', e.target.value)}
                  placeholder="z.B. Dachrenovierung Müller"
                  className={errors.project_name ? 'border-red-500' : ''}
                />
                {errors.project_name && (
                  <p className="text-sm text-red-500">{errors.project_name}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="project_location">Projektort</Label>
                <Input
                  id="project_location"
                  value={offerData.project_location}
                  onChange={(e) => updateOfferField('project_location', e.target.value)}
                  placeholder="z.B. Musterstraße 123, 12345 Berlin"
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
                      disabled={(date) => date < new Date()}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label htmlFor="payment_terms">Zahlungsbedingungen</Label>
                <Select
                  value={offerData.payment_terms}
                  onValueChange={(value) => updateOfferField('payment_terms', value)}
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
                value={offerData.notes}
                onChange={(e) => updateOfferField('notes', e.target.value)}
                placeholder="Interne Notizen zum Angebot..."
                rows={3}
              />
            </div>
          </TabsContent>

          {/* Tab 2: Items */}
          <TabsContent value="items" className="mt-4">
            {errors.items && (
              <p className="text-sm text-red-500 mb-4">{errors.items}</p>
            )}
            <OfferItemsEditor items={items} onChange={setItems} />
          </TabsContent>

          {/* Tab 3: Targets */}
          <TabsContent value="targets" className="mt-4">
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-sm text-blue-700">
                <strong>Interne Planung (optional)</strong><br />
                Diese Werte sind nur für Sie sichtbar und dienen der Projektsteuerung.
                Sie können das Angebot auch ohne diese Angaben erstellen.
              </p>
            </div>
            <OfferTargetsForm
              targets={targets}
              onChange={setTargets}
              employees={employees}
            />
          </TabsContent>

          {/* Tab 4: Summary */}
          <TabsContent value="summary" className="mt-4">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">Kundendaten</h3>
                  <div className="text-sm space-y-1">
                    <p><strong>Kunde:</strong> {offerData.customer_name || '-'}</p>
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
                <OfferSummaryCard items={items} />
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-between pt-4 border-t">
          <Button variant="outline" onClick={handleClose}>
            Abbrechen
          </Button>
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
                disabled={createOfferMutation.isPending}
              >
                {createOfferMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Angebot erstellen
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default AddOfferDialog;
