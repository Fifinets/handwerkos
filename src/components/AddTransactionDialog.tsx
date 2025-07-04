
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

interface AddTransactionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onTransactionAdded: (transaction: any) => void;
}

const AddTransactionDialog = ({ isOpen, onClose, onTransactionAdded }: AddTransactionDialogProps) => {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    type: '',
    amount: '',
    category: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
    project: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.type || !formData.amount || !formData.category) {
      toast({
        title: "Fehler",
        description: "Typ, Betrag und Kategorie sind Pflichtfelder.",
        variant: "destructive"
      });
      return;
    }

    const newTransaction = {
      id: `T${Date.now()}`,
      type: formData.type,
      amount: parseFloat(formData.amount) || 0,
      category: formData.category,
      description: formData.description || 'Keine Beschreibung',
      date: formData.date,
      project: formData.project || 'Allgemein',
      status: 'Bestätigt'
    };

    onTransactionAdded(newTransaction);
    
    setFormData({
      type: '',
      amount: '',
      category: '',
      description: '',
      date: new Date().toISOString().split('T')[0],
      project: ''
    });

    toast({
      title: "Erfolg",
      description: "Transaktion wurde erfolgreich hinzugefügt."
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
          <DialogTitle>Neue Transaktion hinzufügen</DialogTitle>
          <DialogDescription>
            Geben Sie die Informationen für die neue Transaktion ein.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="type">Typ *</Label>
            <Select value={formData.type} onValueChange={(value) => handleInputChange('type', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Transaktionstyp auswählen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Einnahme">Einnahme</SelectItem>
                <SelectItem value="Ausgabe">Ausgabe</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="amount">Betrag (€) *</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              value={formData.amount}
              onChange={(e) => handleInputChange('amount', e.target.value)}
              placeholder="z.B. 1500.00"
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
                <SelectItem value="Material">Material</SelectItem>
                <SelectItem value="Personal">Personal</SelectItem>
                <SelectItem value="Maschinen">Maschinen</SelectItem>
                <SelectItem value="Sonstiges">Sonstiges</SelectItem>
                <SelectItem value="Projekteinnahme">Projekteinnahme</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="date">Datum</Label>
            <Input
              id="date"
              type="date"
              value={formData.date}
              onChange={(e) => handleInputChange('date', e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="project">Projekt</Label>
            <Input
              id="project"
              value={formData.project}
              onChange={(e) => handleInputChange('project', e.target.value)}
              placeholder="z.B. Büroerweiterung Müller GmbH"
            />
          </div>

          <div>
            <Label htmlFor="description">Beschreibung</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="Zusätzliche Informationen zur Transaktion..."
              rows={3}
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Abbrechen
            </Button>
            <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700">
              Transaktion hinzufügen
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddTransactionDialog;
