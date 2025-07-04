
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

interface AddMaterialDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onMaterialAdded: (material: any) => void;
}

const AddMaterialDialog = ({ isOpen, onClose, onMaterialAdded }: AddMaterialDialogProps) => {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    unit: '',
    quantity: '',
    pricePerUnit: '',
    supplier: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.category || !formData.quantity) {
      toast({
        title: "Fehler",
        description: "Name, Kategorie und Menge sind Pflichtfelder.",
        variant: "destructive"
      });
      return;
    }

    const newMaterial = {
      id: `MAT${Date.now()}`,
      name: formData.name,
      category: formData.category,
      unit: formData.unit || 'Stück',
      quantity: parseInt(formData.quantity) || 0,
      pricePerUnit: formData.pricePerUnit || '0',
      supplier: formData.supplier || 'Nicht angegeben',
      lastUpdated: new Date().toLocaleDateString('de-DE')
    };

    onMaterialAdded(newMaterial);
    
    setFormData({
      name: '',
      category: '',
      unit: '',
      quantity: '',
      pricePerUnit: '',
      supplier: ''
    });

    toast({
      title: "Erfolg",
      description: "Material wurde erfolgreich hinzugefügt."
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
          <DialogTitle>Neues Material hinzufügen</DialogTitle>
          <DialogDescription>
            Geben Sie die Informationen für das neue Material ein.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Materialname *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              placeholder="z.B. Betonmischung C25/30"
              required
            />
          </div>

          <div>
            <Label htmlFor="category">Kategorie *</Label>
            <Select value={formData.category} onValueChange={(value) => handleInputChange('category', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Kategorie auswählen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Beton">Beton</SelectItem>
                <SelectItem value="Stahl">Stahl</SelectItem>
                <SelectItem value="Holz">Holz</SelectItem>
                <SelectItem value="Ziegel">Ziegel</SelectItem>
                <SelectItem value="Isolation">Isolation</SelectItem>
                <SelectItem value="Sonstiges">Sonstiges</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="quantity">Menge *</Label>
              <Input
                id="quantity"
                type="number"
                value={formData.quantity}
                onChange={(e) => handleInputChange('quantity', e.target.value)}
                placeholder="100"
                required
              />
            </div>
            <div>
              <Label htmlFor="unit">Einheit</Label>
              <Select value={formData.unit} onValueChange={(value) => handleInputChange('unit', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Einheit" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Stück">Stück</SelectItem>
                  <SelectItem value="m³">m³</SelectItem>
                  <SelectItem value="m²">m²</SelectItem>
                  <SelectItem value="kg">kg</SelectItem>
                  <SelectItem value="t">t</SelectItem>
                  <SelectItem value="l">l</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="pricePerUnit">Preis pro Einheit</Label>
            <Input
              id="pricePerUnit"
              value={formData.pricePerUnit}
              onChange={(e) => handleInputChange('pricePerUnit', e.target.value)}
              placeholder="z.B. 12.50"
            />
          </div>

          <div>
            <Label htmlFor="supplier">Lieferant</Label>
            <Input
              id="supplier"
              value={formData.supplier}
              onChange={(e) => handleInputChange('supplier', e.target.value)}
              placeholder="z.B. Baustoff GmbH"
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Abbrechen
            </Button>
            <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700">
              Material hinzufügen
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddMaterialDialog;
