import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";

interface Customer {
  company_name: string;
  anrede?: string;
  first_name?: string;
  last_name?: string;
  contact_person: string;
  email: string;
  phone?: string;
  mobile?: string;
  fax?: string;
  website?: string;
  address?: string;
  city?: string;
  postal_code?: string;
  country?: string;
  status: string;
  customer_number?: string;
  tax_number?: string;
  zahlungsziel?: string;
  skonto_prozent?: string;
  skonto_tage?: string;
  waehrung?: string;
  preisgruppe?: string;
  iban?: string;
  bic?: string;
  bank_name?: string;
  kontoinhaber?: string;
  zugprd_status?: string;
  benutzer_id?: string;
  passwort?: string;
}

interface AddCustomerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCustomerAdded: (customer: Customer) => void;
}

const AddCustomerDialog = ({ isOpen, onClose, onCustomerAdded }: AddCustomerDialogProps) => {
  const { toast } = useToast();
  const [formData, setFormData] = useState<Customer>({
    company_name: '',
    anrede: '',
    first_name: '',
    last_name: '',
    contact_person: '',
    email: '',
    phone: '',
    mobile: '',
    fax: '',
    website: '',
    address: '',
    city: '',
    postal_code: '',
    country: 'Deutschland',
    status: 'Aktiv',
    customer_number: '',
    tax_number: '',
    zahlungsziel: '30',
    skonto_prozent: '',
    skonto_tage: '',
    waehrung: 'EUR',
    preisgruppe: 'Standard',
    iban: '',
    bic: '',
    bank_name: '',
    kontoinhaber: '',
    zugprd_status: 'Inaktiv',
    benutzer_id: '',
    passwort: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
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

    onCustomerAdded(formData);
    
    // Formular zurücksetzen
    setFormData({
      company_name: '',
      anrede: '',
      first_name: '',
      last_name: '',
      contact_person: '',
      email: '',
      phone: '',
      mobile: '',
      fax: '',
      website: '',
      address: '',
      city: '',
      postal_code: '',
      country: 'Deutschland',
      status: 'Aktiv',
      customer_number: '',
      tax_number: '',
      zahlungsziel: '30',
      skonto_prozent: '',
      skonto_tage: '',
      waehrung: 'EUR',
      preisgruppe: 'Standard',
      iban: '',
      bic: '',
      bank_name: '',
      kontoinhaber: '',
      zugprd_status: 'Inaktiv',
      benutzer_id: '',
      passwort: ''
    });

    onClose();
  };

  const handleInputChange = (field: keyof Customer, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Neuen Kunden hinzufügen</DialogTitle>
          <DialogDescription>
            Geben Sie die Informationen für den neuen Kunden ein.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Tabs defaultValue="ansprechpartner" className="w-full">
            <TabsList className="grid grid-cols-6 w-full">
              <TabsTrigger value="ansprechpartner">ANSPRECHPARTNER</TabsTrigger>
              <TabsTrigger value="kontaktdetails">KONTAKTDETAILS</TabsTrigger>
              <TabsTrigger value="adresse">ADRESSE</TabsTrigger>
              <TabsTrigger value="konditionen">KONDITIONEN</TabsTrigger>
              <TabsTrigger value="zahlungsdaten">ZAHLUNGSDATEN</TabsTrigger>
              <TabsTrigger value="zugprd">ZUGPRD 2.0 STANDARD</TabsTrigger>
            </TabsList>

            <TabsContent value="ansprechpartner" className="space-y-4 mt-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="company_name">Firmenname *</Label>
                  <Input
                    id="company_name"
                    value={formData.company_name}
                    onChange={(e) => handleInputChange('company_name', e.target.value)}
                    placeholder="z.B. Mustermann GmbH"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="customer_number">Kundennummer</Label>
                  <Input
                    id="customer_number"
                    value={formData.customer_number}
                    onChange={(e) => handleInputChange('customer_number', e.target.value)}
                    placeholder="AUTO"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="anrede">Anrede</Label>
                  <Select value={formData.anrede} onValueChange={(value) => handleInputChange('anrede', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Wählen..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Herr">Herr</SelectItem>
                      <SelectItem value="Frau">Frau</SelectItem>
                      <SelectItem value="Divers">Divers</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="first_name">Vorname</Label>
                  <Input
                    id="first_name"
                    value={formData.first_name}
                    onChange={(e) => handleInputChange('first_name', e.target.value)}
                    placeholder="Max"
                  />
                </div>
                <div>
                  <Label htmlFor="last_name">Nachname</Label>
                  <Input
                    id="last_name"
                    value={formData.last_name}
                    onChange={(e) => handleInputChange('last_name', e.target.value)}
                    placeholder="Mustermann"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="contact_person">Ansprechpartner *</Label>
                <Input
                  id="contact_person"
                  value={formData.contact_person}
                  onChange={(e) => handleInputChange('contact_person', e.target.value)}
                  placeholder="z.B. Max Mustermann"
                  required
                />
              </div>
            </TabsContent>

            <TabsContent value="kontaktdetails" className="space-y-4 mt-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="email">E-Mail *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    placeholder="kontakt@firma.de"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="website">Website</Label>
                  <Input
                    id="website"
                    value={formData.website}
                    onChange={(e) => handleInputChange('website', e.target.value)}
                    placeholder="www.firma.de"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="phone">Telefon</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    placeholder="+49 123 456789"
                  />
                </div>
                <div>
                  <Label htmlFor="mobile">Mobil</Label>
                  <Input
                    id="mobile"
                    value={formData.mobile}
                    onChange={(e) => handleInputChange('mobile', e.target.value)}
                    placeholder="+49 123 456789"
                  />
                </div>
                <div>
                  <Label htmlFor="fax">Fax</Label>
                  <Input
                    id="fax"
                    value={formData.fax}
                    onChange={(e) => handleInputChange('fax', e.target.value)}
                    placeholder="+49 123 456789"
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="adresse" className="space-y-4 mt-6">
              <div>
                <Label htmlFor="address">Straße und Hausnummer</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => handleInputChange('address', e.target.value)}
                  placeholder="Musterstraße 123"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="postal_code">PLZ</Label>
                  <Input
                    id="postal_code"
                    value={formData.postal_code}
                    onChange={(e) => handleInputChange('postal_code', e.target.value)}
                    placeholder="12345"
                  />
                </div>
                <div>
                  <Label htmlFor="city">Ort</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => handleInputChange('city', e.target.value)}
                    placeholder="Berlin"
                  />
                </div>
                <div>
                  <Label htmlFor="country">Land</Label>
                  <Input
                    id="country"
                    value={formData.country}
                    onChange={(e) => handleInputChange('country', e.target.value)}
                    placeholder="Deutschland"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="tax_number">Steuernummer</Label>
                <Input
                  id="tax_number"
                  value={formData.tax_number}
                  onChange={(e) => handleInputChange('tax_number', e.target.value)}
                  placeholder="123/456/78910"
                />
              </div>
            </TabsContent>

            <TabsContent value="konditionen" className="space-y-4 mt-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="zahlungsziel">Zahlungsziel (Tage)</Label>
                  <Select value={formData.zahlungsziel} onValueChange={(value) => handleInputChange('zahlungsziel', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="14">14 Tage</SelectItem>
                      <SelectItem value="30">30 Tage</SelectItem>
                      <SelectItem value="60">60 Tage</SelectItem>
                      <SelectItem value="90">90 Tage</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="waehrung">Währung</Label>
                  <Select value={formData.waehrung} onValueChange={(value) => handleInputChange('waehrung', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EUR">EUR</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="GBP">GBP</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="skonto_prozent">Skonto %</Label>
                  <Input
                    id="skonto_prozent"
                    value={formData.skonto_prozent}
                    onChange={(e) => handleInputChange('skonto_prozent', e.target.value)}
                    placeholder="2"
                  />
                </div>
                <div>
                  <Label htmlFor="skonto_tage">Skonto Tage</Label>
                  <Input
                    id="skonto_tage"
                    value={formData.skonto_tage}
                    onChange={(e) => handleInputChange('skonto_tage', e.target.value)}
                    placeholder="10"
                  />
                </div>
                <div>
                  <Label htmlFor="preisgruppe">Preisgruppe</Label>
                  <Select value={formData.preisgruppe} onValueChange={(value) => handleInputChange('preisgruppe', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Standard">Standard</SelectItem>
                      <SelectItem value="Premium">Premium</SelectItem>
                      <SelectItem value="VIP">VIP</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="zahlungsdaten" className="space-y-4 mt-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="iban">IBAN</Label>
                  <Input
                    id="iban"
                    value={formData.iban}
                    onChange={(e) => handleInputChange('iban', e.target.value)}
                    placeholder="DE89 3704 0044 0532 0130 00"
                  />
                </div>
                <div>
                  <Label htmlFor="bic">BIC</Label>
                  <Input
                    id="bic"
                    value={formData.bic}
                    onChange={(e) => handleInputChange('bic', e.target.value)}
                    placeholder="COBADEFFXXX"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="bank_name">Bank</Label>
                  <Input
                    id="bank_name"
                    value={formData.bank_name}
                    onChange={(e) => handleInputChange('bank_name', e.target.value)}
                    placeholder="Commerzbank AG"
                  />
                </div>
                <div>
                  <Label htmlFor="kontoinhaber">Kontoinhaber</Label>
                  <Input
                    id="kontoinhaber"
                    value={formData.kontoinhaber}
                    onChange={(e) => handleInputChange('kontoinhaber', e.target.value)}
                    placeholder="Mustermann GmbH"
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="zugprd" className="space-y-4 mt-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="zugprd_status">Status</Label>
                  <Select value={formData.zugprd_status} onValueChange={(value) => handleInputChange('zugprd_status', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Aktiv">Aktiv</SelectItem>
                      <SelectItem value="Inaktiv">Inaktiv</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="status">Kundenstatus</Label>
                  <Select value={formData.status} onValueChange={(value) => handleInputChange('status', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Aktiv">Aktiv</SelectItem>
                      <SelectItem value="Premium">Premium</SelectItem>
                      <SelectItem value="Inaktiv">Inaktiv</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="benutzer_id">Benutzer-ID</Label>
                  <Input
                    id="benutzer_id"
                    value={formData.benutzer_id}
                    onChange={(e) => handleInputChange('benutzer_id', e.target.value)}
                    placeholder="user123"
                  />
                </div>
                <div>
                  <Label htmlFor="passwort">Passwort</Label>
                  <Input
                    id="passwort"
                    type="password"
                    value={formData.passwort}
                    onChange={(e) => handleInputChange('passwort', e.target.value)}
                    placeholder="••••••••"
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Abbrechen
            </Button>
            <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700">
              Kunde hinzufügen
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddCustomerDialog;