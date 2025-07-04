
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

interface AddPersonDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onPersonAdded: (person: any) => void;
}

const AddPersonDialog = ({ isOpen, onClose, onPersonAdded }: AddPersonDialogProps) => {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: '',
    role: '',
    email: '',
    phone: '',
    department: '',
    salary: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.role) {
      toast({
        title: "Fehler",
        description: "Name und Rolle sind Pflichtfelder.",
        variant: "destructive"
      });
      return;
    }

    const newPerson = {
      id: Date.now(),
      name: formData.name,
      role: formData.role,
      email: formData.email || 'Nicht angegeben',
      phone: formData.phone || 'Nicht angegeben',
      department: formData.department || 'Nicht zugewiesen',
      salary: formData.salary || 'Nicht angegeben',
      status: 'Aktiv',
      projects: []
    };

    onPersonAdded(newPerson);
    
    setFormData({
      name: '',
      role: '',
      email: '',
      phone: '',
      department: '',
      salary: ''
    });

    toast({
      title: "Erfolg",
      description: "Mitarbeiter wurde erfolgreich hinzugefügt."
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
          <DialogTitle>Neuen Mitarbeiter hinzufügen</DialogTitle>
          <DialogDescription>
            Geben Sie die Informationen für den neuen Mitarbeiter ein.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              placeholder="z.B. Max Mustermann"
              required
            />
          </div>

          <div>
            <Label htmlFor="role">Rolle *</Label>
            <Select value={formData.role} onValueChange={(value) => handleInputChange('role', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Rolle auswählen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Projektleiter">Projektleiter</SelectItem>
                <SelectItem value="Architekt">Architekt</SelectItem>
                <SelectItem value="Ingenieur">Ingenieur</SelectItem>
                <SelectItem value="Techniker">Techniker</SelectItem>
                <SelectItem value="Sachbearbeiter">Sachbearbeiter</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="email">E-Mail</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              placeholder="max.mustermann@example.com"
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
            <Label htmlFor="department">Abteilung</Label>
            <Input
              id="department"
              value={formData.department}
              onChange={(e) => handleInputChange('department', e.target.value)}
              placeholder="z.B. Konstruktion"
            />
          </div>

          <div>
            <Label htmlFor="salary">Gehalt</Label>
            <Input
              id="salary"
              value={formData.salary}
              onChange={(e) => handleInputChange('salary', e.target.value)}
              placeholder="z.B. €45.000"
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Abbrechen
            </Button>
            <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700">
              Mitarbeiter hinzufügen
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddPersonDialog;
