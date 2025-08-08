import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Package, Calculator } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { MaterialEntryFormData } from "@/types/project";
import { useToast } from "@/hooks/use-toast";

interface MaterialEntryFormProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  onMaterialEntryAdded: (entry: MaterialEntryFormData) => void;
}

const MaterialEntryForm: React.FC<MaterialEntryFormProps> = ({ 
  isOpen, 
  onClose, 
  projectId, 
  onMaterialEntryAdded 
}) => {
  const { toast } = useToast();
  const [formData, setFormData] = useState<MaterialEntryFormData>({
    entry_date: new Date().toISOString().split('T')[0],
    material_name: '',
    quantity: 1,
    unit: 'Stück',
    unit_cost: 0,
    category: 'baumaterial',
    supplier: ''
  });
  const [entryDate, setEntryDate] = useState<Date>(new Date());
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.material_name.trim()) {
      toast({
        title: "Fehler",
        description: "Bitte geben Sie einen Materialnamen ein.",
        variant: "destructive"
      });
      return;
    }

    if (formData.quantity <= 0) {
      toast({
        title: "Fehler",
        description: "Die Menge muss größer als 0 sein.",
        variant: "destructive"
      });
      return;
    }

    if (formData.unit_cost < 0) {
      toast({
        title: "Fehler",
        description: "Der Stückpreis kann nicht negativ sein.",
        variant: "destructive"
      });
      return;
    }

    setSubmitting(true);
    
    try {
      const materialEntry: MaterialEntryFormData = {
        ...formData,
        entry_date: format(entryDate, 'yyyy-MM-dd')
      };

      onMaterialEntryAdded(materialEntry);
      
      const totalCost = formData.quantity * formData.unit_cost;
      
      toast({
        title: "Erfolg",
        description: `Material im Wert von ${totalCost.toFixed(2)}€ erfasst.`
      });

      // Reset form
      setFormData({
        entry_date: new Date().toISOString().split('T')[0],
        material_name: '',
        quantity: 1,
        unit: 'Stück',
        unit_cost: 0,
        category: 'baumaterial',
        supplier: ''
      });
      setEntryDate(new Date());
      
      onClose();
    } catch (error) {
      toast({
        title: "Fehler",
        description: "Material konnte nicht erfasst werden.",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleInputChange = (field: keyof MaterialEntryFormData, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const calculateTotalCost = () => {
    return formData.quantity * formData.unit_cost;
  };

  const totalCost = calculateTotalCost();

  const commonUnits = [
    'Stück', 'kg', 'g', 'Liter', 'ml', 'm', 'cm', 'mm', 'm²', 'cm²', 
    'Paket', 'Karton', 'Rolle', 'Meter', 'qm', 'Sack', 'Palette'
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Material erfassen
          </DialogTitle>
          <DialogDescription>
            Erfassen Sie verwendete Materialien für dieses Projekt.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="entry_date">Datum *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(entryDate, "dd.MM.yyyy", { locale: de })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={entryDate}
                  onSelect={(date) => {
                    if (date) {
                      setEntryDate(date);
                      handleInputChange('entry_date', format(date, 'yyyy-MM-dd'));
                    }
                  }}
                  initialFocus
                  locale={de}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div>
            <Label htmlFor="material_name">Materialname *</Label>
            <Input
              id="material_name"
              placeholder="z.B. Zement, Kabel, Schrauben..."
              value={formData.material_name}
              onChange={(e) => handleInputChange('material_name', e.target.value)}
              required
            />
          </div>

          <div>
            <Label htmlFor="category">Kategorie *</Label>
            <Select 
              value={formData.category} 
              onValueChange={(value) => handleInputChange('category', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="baumaterial">Baumaterial</SelectItem>
                <SelectItem value="werkzeug">Werkzeug</SelectItem>
                <SelectItem value="verbrauchsmaterial">Verbrauchsmaterial</SelectItem>
                <SelectItem value="sonstiges">Sonstiges</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="quantity">Menge *</Label>
              <Input
                id="quantity"
                type="number"
                min="0.01"
                step="0.01"
                value={formData.quantity}
                onChange={(e) => handleInputChange('quantity', parseFloat(e.target.value) || 0)}
                required
              />
            </div>
            <div>
              <Label htmlFor="unit">Einheit *</Label>
              <Select 
                value={formData.unit} 
                onValueChange={(value) => handleInputChange('unit', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {commonUnits.map(unit => (
                    <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="unit_cost">Stückpreis (€) *</Label>
            <Input
              id="unit_cost"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={formData.unit_cost}
              onChange={(e) => handleInputChange('unit_cost', parseFloat(e.target.value) || 0)}
              required
            />
          </div>

          <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calculator className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-800">Gesamtkosten:</span>
              </div>
              <span className="text-lg font-bold text-blue-600">
                {totalCost.toFixed(2)}€
              </span>
            </div>
            <div className="text-xs text-blue-600 mt-1">
              {formData.quantity} {formData.unit} × {formData.unit_cost.toFixed(2)}€
            </div>
          </div>

          <div>
            <Label htmlFor="supplier">Lieferant</Label>
            <Input
              id="supplier"
              placeholder="z.B. Baumarkt, Großhandel..."
              value={formData.supplier}
              onChange={(e) => handleInputChange('supplier', e.target.value)}
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={onClose} 
              className="flex-1"
              disabled={submitting}
            >
              Abbrechen
            </Button>
            <Button 
              type="submit" 
              className="flex-1"
              disabled={submitting || !formData.material_name.trim() || formData.quantity <= 0}
            >
              {submitting ? 'Speichern...' : 'Material erfassen'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default MaterialEntryForm;