
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

interface AddMachineDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onMachineAdded: (machine: any) => void;
}

const AddMachineDialog = ({ isOpen, onClose, onMachineAdded }: AddMachineDialogProps) => {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: '',
    type: '',
    location: '',
    purchaseDate: '',
    value: '',
    description: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.type) {
      toast({
        title: "Fehler",
        description: "Name und Typ sind Pflichtfelder.",
        variant: "destructive"
      });
      return;
    }

    const newMachine = {
      id: `M${Date.now()}`,
      name: formData.name,
      type: formData.type,
      location: formData.location || 'Nicht angegeben',
      purchaseDate: formData.purchaseDate || new Date().toLocaleDateString('de-DE'),
      value: formData.value || 'Nicht angegeben',
      status: 'Verfügbar',
      description: formData.description || 'Keine Beschreibung'
    };

    onMachineAdded(newMachine);
    
    setFormData({
      name: '',
      type: '',
      location: '',
      purchaseDate: '',
      value: '',
      description: ''
    });

    toast({
      title: "Erfolg",
      description: "Maschine wurde erfolgreich hinzugefügt."
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
          <DialogTitle>Neue Maschine hinzufügen</DialogTitle>
          <DialogDescription>
            Geben Sie die Informationen für die neue Maschine ein.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Maschinenname *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              placeholder="z.B. Bohrmaschine XY-2000"
              required
            />
          </div>

          <div>
            <Label htmlFor="type">Typ *</Label>
            <Select value={formData.type} onValueChange={(value) => handleInputChange('type', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Maschinentyp auswählen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Bohrmaschine">Bohrmaschine</SelectItem>
                <SelectItem value="Bagger">Bagger</SelectItem>
                <SelectItem value="Kran">Kran</SelectItem>
                <SelectItem value="Säge">Säge</SelectItem>
                <SelectItem value="Generator">Generator</SelectItem>
                <SelectItem value="Sonstiges">Sonstiges</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="location">Standort</Label>
            <Input
              id="location"
              value={formData.location}
              onChange={(e) => handleInputChange('location', e.target.value)}
              placeholder="z.B. Lager A, Halle 1"
            />
          </div>

          <div>
            <Label htmlFor="purchaseDate">Kaufdatum</Label>
            <Input
              id="purchaseDate"
              type="date"
              value={formData.purchaseDate}
              onChange={(e) => handleInputChange('purchaseDate', e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="value">Wert</Label>
            <Input
              id="value"
              value={formData.value}
              onChange={(e) => handleInputChange('value', e.target.value)}
              placeholder="z.B. €25.000"
            />
          </div>

          <div>
            <Label htmlFor="description">Beschreibung</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="Zusätzliche Informationen zur Maschine..."
              rows={3}
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Abbrechen
            </Button>
            <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700">
              Maschine hinzufügen
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddMachineDialog;
