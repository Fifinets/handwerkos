
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

interface Customer {
  id: number;
  name: string;
  contact: string;
  email: string;
  phone: string;
  address: string;
  projects: number;
  revenue: string;
  status: string;
}

interface AddProjectDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onProjectAdded: (project: any) => void;
  customers: Customer[];
}

const AddProjectDialog = ({ isOpen, onClose, onProjectAdded, customers }: AddProjectDialogProps) => {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: '',
    customer: '',
    location: '',
    budget: '',
    startDate: '',
    endDate: '',
    team: '',
    status: 'Planung'
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validierung
    if (!formData.name || !formData.customer || !formData.budget) {
      toast({
        title: "Fehler",
        description: "Bitte füllen Sie alle Pflichtfelder aus.",
        variant: "destructive"
      });
      return;
    }

    // Neues Projekt erstellen
    const newProject = {
      id: `P2024-${String(Date.now()).slice(-3)}`,
      name: formData.name,
      customer: formData.customer,
      status: formData.status,
      progress: 0,
      startDate: formData.startDate || new Date().toLocaleDateString('de-DE'),
      endDate: formData.endDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('de-DE'),
      budget: formData.budget.startsWith('€') ? formData.budget : `€${formData.budget}`,
      team: formData.team ? formData.team.split(',').map(name => name.trim()) : ['Nicht zugewiesen'],
      location: formData.location || 'Nicht angegeben'
    };

    onProjectAdded(newProject);
    
    // Formular zurücksetzen
    setFormData({
      name: '',
      customer: '',
      location: '',
      budget: '',
      startDate: '',
      endDate: '',
      team: '',
      status: 'Planung'
    });

    toast({
      title: "Erfolg",
      description: "Projekt wurde erfolgreich hinzugefügt."
    });

    onClose();
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleCustomerChange = (customerName: string) => {
    const selectedCustomer = customers.find(customer => customer.name === customerName);
    
    setFormData(prev => ({
      ...prev,
      customer: customerName,
      location: selectedCustomer ? selectedCustomer.address : ''
    }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Neues Projekt erstellen</DialogTitle>
          <DialogDescription>
            Geben Sie die Informationen für das neue Projekt ein.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Projektname *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              placeholder="z.B. Büroerweiterung Müller GmbH"
              required
            />
          </div>

          <div>
            <Label htmlFor="customer">Kunde *</Label>
            <Select value={formData.customer} onValueChange={handleCustomerChange}>
              <SelectTrigger>
                <SelectValue placeholder="Kunde auswählen" />
              </SelectTrigger>
              <SelectContent>
                {customers.map((customer) => (
                  <SelectItem key={customer.id} value={customer.name}>
                    {customer.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="location">Standort</Label>
            <Input
              id="location"
              value={formData.location}
              onChange={(e) => handleInputChange('location', e.target.value)}
              placeholder="Wird automatisch aus Kundendaten übernommen"
              readOnly
              className="bg-gray-50"
            />
          </div>

          <div>
            <Label htmlFor="budget">Budget *</Label>
            <Input
              id="budget"
              value={formData.budget}
              onChange={(e) => handleInputChange('budget', e.target.value)}
              placeholder="z.B. 15000 oder €15.000"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="startDate">Startdatum</Label>
              <Input
                id="startDate"
                type="date"
                value={formData.startDate}
                onChange={(e) => handleInputChange('startDate', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="endDate">Enddatum</Label>
              <Input
                id="endDate"
                type="date"
                value={formData.endDate}
                onChange={(e) => handleInputChange('endDate', e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="team">Team (durch Komma getrennt)</Label>
            <Input
              id="team"
              value={formData.team}
              onChange={(e) => handleInputChange('team', e.target.value)}
              placeholder="z.B. Max Mustermann, Lisa Weber"
            />
          </div>

          <div>
            <Label htmlFor="status">Status</Label>
            <Select value={formData.status} onValueChange={(value) => handleInputChange('status', value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Planung">Planung</SelectItem>
                <SelectItem value="In Bearbeitung">In Bearbeitung</SelectItem>
                <SelectItem value="Abgeschlossen">Abgeschlossen</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Abbrechen
            </Button>
            <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700">
              Projekt erstellen
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddProjectDialog;
