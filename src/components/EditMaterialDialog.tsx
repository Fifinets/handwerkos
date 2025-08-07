
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

interface Material {
  id: string;
  name: string;
  category: string;
  currentStock: number;
  minStock: number;
  maxStock: number;
  unit: string;
  price: string;
  supplier: string;
  status: string;
}

interface EditMaterialDialogProps {
  isOpen: boolean;
  onClose: () => void;
  material: Material | null;
  onMaterialUpdated: (material: Material) => void;
}

const EditMaterialDialog = ({ isOpen, onClose, material, onMaterialUpdated }: EditMaterialDialogProps) => {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: material?.name || '',
    category: material?.category || '',
    currentStock: material?.currentStock || 0,
    minStock: material?.minStock || 0,
    maxStock: material?.maxStock || 0,
    unit: material?.unit || '',
    price: material?.price || '',
    supplier: material?.supplier || '',
    status: material?.status || 'Verfügbar'
  });

  React.useEffect(() => {
    if (material) {
      setFormData({
        name: material.name,
        category: material.category,
        currentStock: material.currentStock,
        minStock: material.minStock,
        maxStock: material.maxStock,
        unit: material.unit,
        price: material.price,
        supplier: material.supplier,
        status: material.status
      });
    }
  }, [material]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!material) return;

    const updatedMaterial = {
      ...material,
      ...formData
    };

    onMaterialUpdated(updatedMaterial);
    
    toast({
      title: "Erfolg",
      description: "Material wurde erfolgreich aktualisiert."
    });

    onClose();
  };

  const handleInputChange = (field: string, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  if (!material) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Material bearbeiten</DialogTitle>
          <DialogDescription>
            Bearbeiten Sie die Informationen für das Material.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Materialname</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              required
            />
          </div>

          <div>
            <Label htmlFor="category">Kategorie</Label>
            <Input
              id="category"
              value={formData.category}
              onChange={(e) => handleInputChange('category', e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="currentStock">Aktueller Bestand</Label>
              <Input
                id="currentStock"
                type="number"
                value={formData.currentStock}
                onChange={(e) => handleInputChange('currentStock', parseInt(e.target.value))}
                required
              />
            </div>
            <div>
              <Label htmlFor="unit">Einheit</Label>
              <Input
                id="unit"
                value={formData.unit}
                onChange={(e) => handleInputChange('unit', e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="minStock">Mindestbestand</Label>
              <Input
                id="minStock"
                type="number"
                value={formData.minStock}
                onChange={(e) => handleInputChange('minStock', parseInt(e.target.value))}
                required
              />
            </div>
            <div>
              <Label htmlFor="maxStock">Maximalbestand</Label>
              <Input
                id="maxStock"
                type="number"
                value={formData.maxStock}
                onChange={(e) => handleInputChange('maxStock', parseInt(e.target.value))}
                required
              />
            </div>
          </div>

          <div>
            <Label htmlFor="price">Preis</Label>
            <Input
              id="price"
              value={formData.price}
              onChange={(e) => handleInputChange('price', e.target.value)}
              required
            />
          </div>

          <div>
            <Label htmlFor="supplier">Lieferant</Label>
            <Input
              id="supplier"
              value={formData.supplier}
              onChange={(e) => handleInputChange('supplier', e.target.value)}
              required
            />
          </div>

          <div>
            <Label htmlFor="status">Status</Label>
            <Select value={formData.status} onValueChange={(value) => handleInputChange('status', value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Verfügbar">Verfügbar</SelectItem>
                <SelectItem value="Niedrig">Niedrig</SelectItem>
                <SelectItem value="Kritisch">Kritisch</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Abbrechen
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

export default EditMaterialDialog;
