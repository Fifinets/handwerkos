import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useDeleteCustomer } from "@/hooks/useApi";
import { Trash2 } from "lucide-react";

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
  anrede?: string;
  first_name?: string;
  last_name?: string;
  mobile?: string;
  website?: string;
  fax?: string;
  zahlungsziel?: string;
  skonto_prozent?: string;
  skonto_tage?: string;
  preisgruppe?: string;
  iban?: string;
  bic?: string;
  bank_name?: string;
  tax_number?: string;
  kontoinhaber?: string;
  zugprd_status?: string;
  benutzer_id?: string;
  passwort?: string;
}

interface EditCustomerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer | null;
  onCustomerUpdated: (customer: Customer) => void;
}

const EditCustomerDialog = ({ isOpen, onClose, customer, onCustomerUpdated }: EditCustomerDialogProps) => {
  const { toast } = useToast();
  const deleteCustomerMutation = useDeleteCustomer();
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
    anrede: customer?.anrede || '',
    first_name: customer?.first_name || '',
    last_name: customer?.last_name || '',
    mobile: customer?.mobile || '',
    website: customer?.website || '',
    fax: customer?.fax || '',
    zahlungsziel: customer?.zahlungsziel || '',
    skonto_prozent: customer?.skonto_prozent || '',
    skonto_tage: customer?.skonto_tage || '',
    preisgruppe: customer?.preisgruppe || '',
    iban: customer?.iban || '',
    bic: customer?.bic || '',
    bank_name: customer?.bank_name || '',
    tax_number: customer?.tax_number || '',
    kontoinhaber: customer?.kontoinhaber || '',
    zugprd_status: customer?.zugprd_status || '',
    benutzer_id: customer?.benutzer_id || '',
    passwort: customer?.passwort || ''
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
        anrede: customer.anrede || '',
        first_name: customer.first_name || '',
        last_name: customer.last_name || '',
        mobile: customer.mobile || '',
        website: customer.website || '',
        fax: customer.fax || '',
        zahlungsziel: customer.zahlungsziel || '',
        skonto_prozent: customer.skonto_prozent || '',
        skonto_tage: customer.skonto_tage || '',
        preisgruppe: customer.preisgruppe || '',
        iban: customer.iban || '',
        bic: customer.bic || '',
        bank_name: customer.bank_name || '',
        tax_number: customer.tax_number || '',
        kontoinhaber: customer.kontoinhaber || '',
        zugprd_status: customer.zugprd_status || '',
        benutzer_id: customer.benutzer_id || '',
        passwort: customer.passwort || ''
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

  const handleDelete = () => {
    if (!customer) return;

    // Bestätigungsdialog
    if (window.confirm(`Möchten Sie den Kunden "${customer.company_name}" wirklich löschen?`)) {
      deleteCustomerMutation.mutate(customer.id, {
        onSuccess: () => {
          toast({
            title: "Kunde gelöscht",
            description: `${customer.company_name} wurde erfolgreich gelöscht.`,
          });
          onClose();
        },
        onError: (error) => {
          toast({
            title: "Fehler beim Löschen",
            description: error.message,
            variant: "destructive",
          });
        }
      });
    }
  };

  if (!customer) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl">
        <DialogHeader>
          <DialogTitle>Kunde bearbeiten</DialogTitle>
          <DialogDescription>
            Bearbeiten Sie die Informationen für den Kunden.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Tabs defaultValue="kontaktdetails" className="w-full">
            <TabsList className="grid w-full grid-cols-6 h-12">
              <TabsTrigger value="ansprechpartner">ANSPRECHPARTNER</TabsTrigger>
              <TabsTrigger value="kontaktdetails">KONTAKTDETAILS</TabsTrigger>
              <TabsTrigger value="adresse">ADRESSE</TabsTrigger>
              <TabsTrigger value="konditionen">KONDITIONEN</TabsTrigger>
              <TabsTrigger value="zahlungsdaten">ZAHLUNGSDATEN</TabsTrigger>
              <TabsTrigger value="zugprd">ZUGPRD 2.0 STANDARD</TabsTrigger>
            </TabsList>

            <TabsContent value="ansprechpartner" className="space-y-4 h-[320px]">
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

            <TabsContent value="kontaktdetails" className="space-y-4 h-[320px]">
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
                  <Label htmlFor="phone">Telefon</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
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
                  <Label htmlFor="tax_number">Steuernummer</Label>
                  <Input
                    id="tax_number"
                    value={formData.tax_number}
                    onChange={(e) => handleInputChange('tax_number', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="fax">Fax</Label>
                  <Input
                    id="fax"
                    value={formData.fax}
                    onChange={(e) => handleInputChange('fax', e.target.value)}
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

            <TabsContent value="adresse" className="space-y-4 h-[320px]">
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

            <TabsContent value="konditionen" className="space-y-4 h-[320px]">
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
                  <Label htmlFor="skonto_prozent">Skonto %</Label>
                  <Input
                    id="skonto_prozent"
                    value={formData.skonto_prozent}
                    onChange={(e) => handleInputChange('skonto_prozent', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="skonto_tage">Skonto Tage</Label>
                  <Input
                    id="skonto_tage"
                    value={formData.skonto_tage}
                    onChange={(e) => handleInputChange('skonto_tage', e.target.value)}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="preisgruppe">Preisgruppe</Label>
                <Select value={formData.preisgruppe} onValueChange={(value) => handleInputChange('preisgruppe', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Gruppe wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Standard">Standard</SelectItem>
                    <SelectItem value="Premium">Premium</SelectItem>
                    <SelectItem value="VIP">VIP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>

            <TabsContent value="zahlungsdaten" className="space-y-4 h-[320px]">
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
                  <Label htmlFor="kontoinhaber">Kontoinhaber</Label>
                  <Input
                    id="kontoinhaber"
                    value={formData.kontoinhaber}
                    onChange={(e) => handleInputChange('kontoinhaber', e.target.value)}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="zugprd" className="space-y-4 h-[320px]">
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

              <div className="grid grid-cols-2 gap-4 mt-4">
                <div>
                  <Label htmlFor="benutzer_id">Benutzer-ID</Label>
                  <Input
                    id="benutzer_id"
                    value={formData.benutzer_id}
                    onChange={(e) => handleInputChange('benutzer_id', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="passwort">Passwort</Label>
                  <Input
                    id="passwort"
                    type="password"
                    value={formData.passwort}
                    onChange={(e) => handleInputChange('passwort', e.target.value)}
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Abbrechen
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteCustomerMutation.isPending}
              className="flex items-center gap-2"
            >
              <Trash2 className="h-4 w-4" />
              {deleteCustomerMutation.isPending ? "Lösche..." : "Löschen"}
            </Button>
            <Button type="submit" className="flex-1">
              Speichern
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditCustomerDialog;
