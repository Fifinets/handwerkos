
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

interface AddCustomerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCustomerAdded: (customer: any) => void;
}

const AddCustomerDialog = ({ isOpen, onClose, onCustomerAdded }: AddCustomerDialogProps) => {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: '',
    contact: '',
    email: '',
    phone: '',
    address: '',
    status: 'Aktiv'
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validierung
    if (!formData.name || !formData.contact || !formData.email) {
      toast({
        title: "Fehler",
        description: "Bitte füllen Sie alle Pflichtfelder aus.",
        variant: "destructive"
      });
      return;
    }

    // Neuen Kunden erstellen
    const newCustomer = {
      id: Date.now(), // Temporäre ID für Demo
      name: formData.name,
      contact: formData.contact,
      email: formData.email,
      phone: formData.phone,
      address: formData.address,
      projects: 0,
      revenue: '€0',
      status: formData.status
    };

    onCustomerAdded(newCustomer);
    
    // Formular zurücksetzen
    setFormData({
      name: '',
      contact: '',
      email: '',
      phone: '',
      address: '',
      status: 'Aktiv'
    });

    toast({
      title: "Erfolg",
      description: "Kunde wurde erfolgreich hinzugefügt."
    });

    onClose();
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Neuen Kunden hinzufügen</DialogTitle>
          <DialogDescription>
            Geben Sie die Informationen für den neuen Kunden ein.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Firmenname *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              placeholder="z.B. Mustermann GmbH"
              required
            />
          </div>

          <div>
            <Label htmlFor="contact">Ansprechpartner *</Label>
            <Input
              id="contact"
              value={formData.contact}
              onChange={(e) => handleInputChange('contact', e.target.value)}
              placeholder="z.B. Max Mustermann"
              required
            />
          </div>

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
            <Label htmlFor="phone">Telefon</Label>
            <Input
              id="phone"
              value={formData.phone}
              onChange={(e) => handleInputChange('phone', e.target.value)}
              placeholder="+49 123 456789"
            />
          </div>

          <div>
            <Label htmlFor="address">Adresse</Label>
            <Textarea
              id="address"
              value={formData.address}
              onChange={(e) => handleInputChange('address', e.target.value)}
              placeholder="Straße, PLZ Ort"
              rows={2}
            />
          </div>

          <div>
            <Label htmlFor="status">Status</Label>
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
