
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

interface Customer {
  id: string;
  company_name: string;
  contact_person: string;
  email: string;
  phone?: string;
  address?: string;
  city?: string;
  postal_code?: string;
  country?: string;
  status: string;
  created_at: string;
  updated_at: string;
  // Erweiterte Felder
  anrede?: string;
  first_name?: string;
  last_name?: string;
  mobile?: string;
  website?: string;
  erreichbarkeit?: string;
  sonstiges?: string;
  festnetz?: string;
  fax?: string;
  zahlungsziel?: string;
  skonto?: string;
  skontofrist?: string;
  verkaufspreise_gruppe?: string;
  iban?: string;
  bic?: string;
  bank_name?: string;
  umsatzsteuer_id?: string;
  debitor_konto?: string;
}

interface EditCustomerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer | null;
  onCustomerUpdated: (customer: Customer) => void;
}

const EditCustomerDialog = ({ isOpen, onClose, customer, onCustomerUpdated }: EditCustomerDialogProps) => {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    company_name: customer?.company_name || '',
    contact_person: customer?.contact_person || '',
    email: customer?.email || '',
    phone: customer?.phone || '',
    address: customer?.address || '',
    city: customer?.city || '',
    postal_code: customer?.postal_code || '',
    country: customer?.country || 'Deutschland',
    status: customer?.status || 'Aktiv',
    // Erweiterte Felder
    anrede: customer?.anrede || '',
    first_name: customer?.first_name || '',
    last_name: customer?.last_name || '',
    mobile: customer?.mobile || '',
    website: customer?.website || '',
    erreichbarkeit: customer?.erreichbarkeit || '',
    sonstiges: customer?.sonstiges || '',
    festnetz: customer?.festnetz || '',
    fax: customer?.fax || '',
    zahlungsziel: customer?.zahlungsziel || '',
    skonto: customer?.skonto || '',
    skontofrist: customer?.skontofrist || '',
    verkaufspreise_gruppe: customer?.verkaufspreise_gruppe || '',
    iban: customer?.iban || '',
    bic: customer?.bic || '',
    bank_name: customer?.bank_name || '',
    umsatzsteuer_id: customer?.umsatzsteuer_id || '',
    debitor_konto: customer?.debitor_konto || ''
  });

  React.useEffect(() => {
    if (customer) {
      setFormData({
        company_name: customer.company_name,
        contact_person: customer.contact_person,
        email: customer.email,
        phone: customer.phone || '',
        address: customer.address || '',
        city: customer.city || '',
        postal_code: customer.postal_code || '',
        country: customer.country || 'Deutschland',
        status: customer.status,
        // Erweiterte Felder
        anrede: customer.anrede || '',
        first_name: customer.first_name || '',
        last_name: customer.last_name || '',
        mobile: customer.mobile || '',
        website: customer.website || '',
        erreichbarkeit: customer.erreichbarkeit || '',
        sonstiges: customer.sonstiges || '',
        festnetz: customer.festnetz || '',
        fax: customer.fax || '',
        zahlungsziel: customer.zahlungsziel || '',
        skonto: customer.skonto || '',
        skontofrist: customer.skontofrist || '',
        verkaufspreise_gruppe: customer.verkaufspreise_gruppe || '',
        iban: customer.iban || '',
        bic: customer.bic || '',
        bank_name: customer.bank_name || '',
        umsatzsteuer_id: customer.umsatzsteuer_id || '',
        debitor_konto: customer.debitor_konto || ''
      });
    }
  }, [customer]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!customer) return;

    // Validierung
    if (!formData.company_name || !formData.contact_person || !formData.email) {
      toast({
        title: "Fehler",
        description: "Bitte füllen Sie alle Pflichtfelder aus.",
        variant: "destructive"
      });
      return;
    }

    // E-Mail Validierung
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      toast({
        title: "Fehler",
        description: "Bitte geben Sie eine gültige E-Mail-Adresse ein.",
        variant: "destructive"
      });
      return;
    }

    const updatedCustomer = {
      ...customer,
      ...formData
    };

    onCustomerUpdated(updatedCustomer);
    onClose();
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  if (!customer) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Kunde bearbeiten</DialogTitle>
          <DialogDescription>
            Bearbeiten Sie die Informationen für den Kunden.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Tabs defaultValue="kontaktdetails" className="w-full">
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="ansprechpartner">ANSPRECHPARTNER</TabsTrigger>
              <TabsTrigger value="kontaktdetails">KONTAKTDETAILS</TabsTrigger>
              <TabsTrigger value="adresse">ADRESSE</TabsTrigger>
              <TabsTrigger value="konditionen">KONDITIONEN</TabsTrigger>
              <TabsTrigger value="zahlungsdaten">ZAHLUNGSDATEN</TabsTrigger>
              <TabsTrigger value="zugprd">ZUGPRD 2.0 STANDARD</TabsTrigger>
            </TabsList>

            <TabsContent value="ansprechpartner" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="anrede">Anrede</Label>
                  <Select value={formData.anrede} onValueChange={(value) => handleInputChange('anrede', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Anrede wählen" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Herr">Herr</SelectItem>
                      <SelectItem value="Frau">Frau</SelectItem>
                      <SelectItem value="Divers">Divers</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="company_name">Firmenname *</Label>
                  <Input
                    id="company_name"
                    value={formData.company_name}
                    onChange={(e) => handleInputChange('company_name', e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="first_name">Vorname</Label>
                  <Input
                    id="first_name"
                    value={formData.first_name}
                    onChange={(e) => handleInputChange('first_name', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="last_name">Nachname</Label>
                  <Input
                    id="last_name"
                    value={formData.last_name}
                    onChange={(e) => handleInputChange('last_name', e.target.value)}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="kontaktdetails" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="email">Emailadresse *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="mobile">Mobiltelefon</Label>
                  <Input
                    id="mobile"
                    value={formData.mobile}
                    onChange={(e) => handleInputChange('mobile', e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="erreichbarkeit">Erreichbarkeit</Label>
                  <Textarea
                    id="erreichbarkeit"
                    value={formData.erreichbarkeit}
                    onChange={(e) => handleInputChange('erreichbarkeit', e.target.value)}
                    rows={2}
                  />
                </div>
                <div>
                  <Label htmlFor="website">Website</Label>
                  <Input
                    id="website"
                    value={formData.website}
                    onChange={(e) => handleInputChange('website', e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="sonstiges">Sonstiges</Label>
                  <Select value={formData.sonstiges} onValueChange={(value) => handleInputChange('sonstiges', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sonstiges wählen" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Standard">Standard</SelectItem>
                      <SelectItem value="VIP">VIP</SelectItem>
                      <SelectItem value="Premium">Premium</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="festnetz">Festnetz</Label>
                  <Input
                    id="festnetz"
                    value={formData.festnetz}
                    onChange={(e) => handleInputChange('festnetz', e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="fax">Fax</Label>
                  <Input
                    id="fax"
                    value={formData.fax}
                    onChange={(e) => handleInputChange('fax', e.target.value)}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="adresse" className="space-y-4">
              <div>
                <Label htmlFor="address">Straße & Hausnummer</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => handleInputChange('address', e.target.value)}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="postal_code">Postleitzahl</Label>
                  <Input
                    id="postal_code"
                    value={formData.postal_code}
                    onChange={(e) => handleInputChange('postal_code', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="city">Ort</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => handleInputChange('city', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="country">Land</Label>
                  <Input
                    id="country"
                    value={formData.country}
                    onChange={(e) => handleInputChange('country', e.target.value)}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="konditionen" className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="zahlungsziel">Zahlungsziel (Tage)</Label>
                  <Input
                    id="zahlungsziel"
                    value={formData.zahlungsziel}
                    onChange={(e) => handleInputChange('zahlungsziel', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="skonto">Skonto %</Label>
                  <Input
                    id="skonto"
                    value={formData.skonto}
                    onChange={(e) => handleInputChange('skonto', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="skontofrist">Skontofrist (Tage)</Label>
                  <Input
                    id="skontofrist"
                    value={formData.skontofrist}
                    onChange={(e) => handleInputChange('skontofrist', e.target.value)}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="verkaufspreise_gruppe">Verkaufspreise-Gruppe</Label>
                <Select value={formData.verkaufspreise_gruppe} onValueChange={(value) => handleInputChange('verkaufspreise_gruppe', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Gruppe wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Standard-VK">Standard-VK</SelectItem>
                    <SelectItem value="Premium-VK">Premium-VK</SelectItem>
                    <SelectItem value="Großkunden-VK">Großkunden-VK</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>

            <TabsContent value="zahlungsdaten" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="iban">IBAN</Label>
                  <Input
                    id="iban"
                    value={formData.iban}
                    onChange={(e) => handleInputChange('iban', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="bic">BIC</Label>
                  <Input
                    id="bic"
                    value={formData.bic}
                    onChange={(e) => handleInputChange('bic', e.target.value)}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="bank_name">Bank Name</Label>
                <Input
                  id="bank_name"
                  value={formData.bank_name}
                  onChange={(e) => handleInputChange('bank_name', e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="umsatzsteuer_id">Umsatzsteuer ID</Label>
                  <Input
                    id="umsatzsteuer_id"
                    value={formData.umsatzsteuer_id}
                    onChange={(e) => handleInputChange('umsatzsteuer_id', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="debitor_konto">Debitor / Kreditor Konto</Label>
                  <Input
                    id="debitor_konto"
                    value={formData.debitor_konto}
                    onChange={(e) => handleInputChange('debitor_konto', e.target.value)}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="zugprd" className="space-y-4">
              <div className="text-muted-foreground text-sm">
                Diese Information ist erforderlich, um Rechnungen zu ZUGFeRD 2.0 Standard zu erstellen. 
                Dieser Standard ist verpflichtend für die Rechnungsstellung an öffentliche Behörden/Auftraggeber.
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Abbrechen
            </Button>
            <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700">
              Speichern
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditCustomerDialog;
