import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, Plus, Edit, Trash2, Search, TrendingUp, TrendingDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface MaterialPrice {
  id: string;
  name: string;
  category: string;
  supplier: string;
  unit: string;
  currentPrice: number;
  previousPrice: number;
  lastUpdated: string;
  isActive: boolean;
  notes?: string;
}

const MATERIAL_CATEGORIES = [
  'Fliesen & Keramik',
  'Sanitär',
  'Heizung',
  'Elektro',
  'Bauchemie',
  'Werkzeuge',
  'Befestigung',
  'Dichtung & Abdichtung',
  'Sonstiges'
];

const UNITS = ['Stück', 'm²', 'm', 'kg', 'l', 'Paket', 'Set', 'Rolle'];

const MaterialPricesModule: React.FC = () => {
  const { toast } = useToast();
  const [materials, setMaterials] = useState<MaterialPrice[]>([]);
  const [filteredMaterials, setFilteredMaterials] = useState<MaterialPrice[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<MaterialPrice | null>(null);

  // Formular-Zustand
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    supplier: '',
    unit: 'Stück',
    currentPrice: 0,
    notes: ''
  });

  // Mock-Daten laden
  useEffect(() => {
    loadMaterialPrices();
  }, []);

  // Filter anwenden
  useEffect(() => {
    let filtered = materials;

    if (searchTerm) {
      filtered = filtered.filter(material =>
        material.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        material.supplier.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (selectedCategory && selectedCategory !== 'all') {
      filtered = filtered.filter(material => material.category === selectedCategory);
    }

    setFilteredMaterials(filtered);
  }, [materials, searchTerm, selectedCategory]);

  const loadMaterialPrices = () => {
    // Mock-Daten - in echter App würde das aus der Datenbank kommen
    const mockMaterials: MaterialPrice[] = [
      {
        id: '1',
        name: 'Bodenfliese 30x30cm Grau',
        category: 'Fliesen & Keramik',
        supplier: 'Fliesenmarkt GmbH',
        unit: 'm²',
        currentPrice: 24.99,
        previousPrice: 22.50,
        lastUpdated: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        isActive: true,
        notes: 'Gute Qualität, schnelle Lieferung'
      },
      {
        id: '2',
        name: 'Fliesenkleber C1 25kg',
        category: 'Bauchemie',
        supplier: 'Bauchemie Express',
        unit: 'Paket',
        currentPrice: 12.50,
        previousPrice: 13.20,
        lastUpdated: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        isActive: true
      },
      {
        id: '3',
        name: 'Fugenmasse weiß 5kg',
        category: 'Bauchemie',
        supplier: 'Bauchemie Express',
        unit: 'Paket',
        currentPrice: 8.75,
        previousPrice: 8.75,
        lastUpdated: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
        isActive: true
      },
      {
        id: '4',
        name: 'Mischbatterie Küche Edelstahl',
        category: 'Sanitär',
        supplier: 'Sanitär Partner',
        unit: 'Stück',
        currentPrice: 89.99,
        previousPrice: 85.00,
        lastUpdated: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        isActive: true
      },
      {
        id: '5',
        name: 'Heizkörperventil 1/2"',
        category: 'Heizung',
        supplier: 'Heizung & Klima AG',
        unit: 'Stück',
        currentPrice: 15.50,
        previousPrice: 16.20,
        lastUpdated: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        isActive: true
      }
    ];

    setMaterials(mockMaterials);
  };

  const handleAddMaterial = () => {
    const newMaterial: MaterialPrice = {
      id: Date.now().toString(),
      name: formData.name,
      category: formData.category,
      supplier: formData.supplier,
      unit: formData.unit,
      currentPrice: formData.currentPrice,
      previousPrice: formData.currentPrice,
      lastUpdated: new Date().toISOString(),
      isActive: true,
      notes: formData.notes
    };

    setMaterials(prev => [...prev, newMaterial]);
    resetForm();
    setIsAddDialogOpen(false);

    toast({
      title: "Material hinzugefügt",
      description: `${formData.name} wurde zur Preisliste hinzugefügt.`
    });
  };

  const handleEditMaterial = (material: MaterialPrice) => {
    setEditingMaterial(material);
    setFormData({
      name: material.name,
      category: material.category,
      supplier: material.supplier,
      unit: material.unit,
      currentPrice: material.currentPrice,
      notes: material.notes || ''
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdateMaterial = () => {
    if (!editingMaterial) return;

    setMaterials(prev => prev.map(material =>
      material.id === editingMaterial.id
        ? {
          ...material,
          name: formData.name,
          category: formData.category,
          supplier: formData.supplier,
          unit: formData.unit,
          previousPrice: material.currentPrice,
          currentPrice: formData.currentPrice,
          lastUpdated: new Date().toISOString(),
          notes: formData.notes
        }
        : material
    ));

    resetForm();
    setIsEditDialogOpen(false);
    setEditingMaterial(null);

    toast({
      title: "Material aktualisiert",
      description: `${formData.name} wurde erfolgreich aktualisiert.`
    });
  };

  const handleDeleteMaterial = (id: string) => {
    setMaterials(prev => prev.filter(material => material.id !== id));
    toast({
      title: "Material entfernt",
      description: "Das Material wurde aus der Preisliste entfernt."
    });
  };

  const resetForm = () => {
    setFormData({
      name: '',
      category: '',
      supplier: '',
      unit: 'Stück',
      currentPrice: 0,
      notes: ''
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('de-DE');
  };

  const getPriceChangeIndicator = (current: number, previous: number) => {
    if (current > previous) {
      return <TrendingUp className="h-4 w-4 text-red-500" title="Preis gestiegen" />;
    } else if (current < previous) {
      return <TrendingDown className="h-4 w-4 text-green-500" title="Preis gefallen" />;
    }
    return null;
  };

  const getPriceChangePercentage = (current: number, previous: number) => {
    if (previous === 0) return 0;
    return ((current - previous) / previous) * 100;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="h-6 w-6 text-blue-600" />
          <h2 className="text-2xl font-bold">Materialpreise</h2>
        </div>
        <Button onClick={() => setIsAddDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Material hinzufügen
        </Button>
      </div>

      {/* Statistiken */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{materials.length}</div>
            <div className="text-sm text-gray-600">Materialien gesamt</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">
              {materials.filter(m => m.currentPrice < m.previousPrice).length}
            </div>
            <div className="text-sm text-gray-600">Preise gefallen</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-red-600">
              {materials.filter(m => m.currentPrice > m.previousPrice).length}
            </div>
            <div className="text-sm text-gray-600">Preise gestiegen</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">
              {MATERIAL_CATEGORIES.length}
            </div>
            <div className="text-sm text-gray-600">Kategorien</div>
          </CardContent>
        </Card>
      </div>

      {/* Filter & Suche */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Material oder Lieferant suchen..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="w-full md:w-64">
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Kategorie wählen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Kategorien</SelectItem>
                  {MATERIAL_CATEGORIES.map(category => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {(searchTerm || (selectedCategory && selectedCategory !== 'all')) && (
              <Button
                variant="outline"
                onClick={() => {
                  setSearchTerm('');
                  setSelectedCategory('all');
                }}
              >
                Filter zurücksetzen
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Materialien-Liste */}
      <Card>
        <CardHeader>
          <CardTitle>Materialpreise ({filteredMaterials.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredMaterials.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                {searchTerm || selectedCategory ? 'Keine Materialien gefunden.' : 'Noch keine Materialien vorhanden.'}
              </div>
            ) : (
              filteredMaterials.map(material => (
                <div key={material.id} className="border rounded-lg p-4 hover:bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-lg">{material.name}</h3>
                        <Badge variant="outline">{material.category}</Badge>
                        {getPriceChangeIndicator(material.currentPrice, material.previousPrice)}
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                        <div>
                          <span className="font-medium">Lieferant:</span> {material.supplier}
                        </div>
                        <div>
                          <span className="font-medium">Einheit:</span> {material.unit}
                        </div>
                        <div>
                          <span className="font-medium">Letzte Aktualisierung:</span> {formatDate(material.lastUpdated)}
                        </div>
                      </div>

                      {material.notes && (
                        <div className="mt-2 text-sm text-gray-600">
                          <span className="font-medium">Notizen:</span> {material.notes}
                        </div>
                      )}
                    </div>

                    <div className="text-right ml-4">
                      <div className="text-2xl font-bold text-blue-600">
                        {formatCurrency(material.currentPrice)}
                      </div>
                      <div className="text-sm text-gray-500">
                        pro {material.unit}
                      </div>
                      {material.previousPrice !== material.currentPrice && (
                        <div className={`text-sm ${material.currentPrice > material.previousPrice ? 'text-red-600' : 'text-green-600'}`}>
                          {material.currentPrice > material.previousPrice ? '+' : ''}
                          {getPriceChangePercentage(material.currentPrice, material.previousPrice).toFixed(1)}%
                          <div className="text-xs text-gray-500">
                            vorher: {formatCurrency(material.previousPrice)}
                          </div>
                        </div>
                      )}
                      
                      <div className="flex gap-2 mt-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditMaterial(material)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteMaterial(material.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Material hinzufügen Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Neues Material hinzufügen</DialogTitle>
            <DialogDescription>
              Fügen Sie ein neues Material zur Preisliste hinzu.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Materialname *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="z.B. Bodenfliese 30x30cm Grau"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="category">Kategorie *</Label>
                <Select 
                  value={formData.category} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Kategorie wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {MATERIAL_CATEGORIES.map(category => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="unit">Einheit *</Label>
                <Select 
                  value={formData.unit} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, unit: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNITS.map(unit => (
                      <SelectItem key={unit} value={unit}>
                        {unit}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="supplier">Lieferant *</Label>
                <Input
                  id="supplier"
                  value={formData.supplier}
                  onChange={(e) => setFormData(prev => ({ ...prev, supplier: e.target.value }))}
                  placeholder="z.B. Baumarkt GmbH"
                  required
                />
              </div>

              <div>
                <Label htmlFor="price">Preis pro Einheit (€) *</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.currentPrice}
                  onChange={(e) => setFormData(prev => ({ ...prev, currentPrice: parseFloat(e.target.value) || 0 }))}
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="notes">Notizen</Label>
              <Input
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Zusätzliche Informationen (optional)"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => { resetForm(); setIsAddDialogOpen(false); }}>
              Abbrechen
            </Button>
            <Button 
              onClick={handleAddMaterial}
              disabled={!formData.name || !formData.category || !formData.supplier}
            >
              Hinzufügen
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Material bearbeiten Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Material bearbeiten</DialogTitle>
            <DialogDescription>
              Bearbeiten Sie die Informationen für das Material.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-name">Materialname *</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-category">Kategorie *</Label>
                <Select 
                  value={formData.category} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MATERIAL_CATEGORIES.map(category => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="edit-unit">Einheit *</Label>
                <Select 
                  value={formData.unit} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, unit: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNITS.map(unit => (
                      <SelectItem key={unit} value={unit}>
                        {unit}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-supplier">Lieferant *</Label>
                <Input
                  id="edit-supplier"
                  value={formData.supplier}
                  onChange={(e) => setFormData(prev => ({ ...prev, supplier: e.target.value }))}
                  required
                />
              </div>

              <div>
                <Label htmlFor="edit-price">Neuer Preis pro Einheit (€) *</Label>
                <Input
                  id="edit-price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.currentPrice}
                  onChange={(e) => setFormData(prev => ({ ...prev, currentPrice: parseFloat(e.target.value) || 0 }))}
                  required
                />
                {editingMaterial && (
                  <div className="text-sm text-gray-500 mt-1">
                    Aktueller Preis: {formatCurrency(editingMaterial.currentPrice)}
                  </div>
                )}
              </div>
            </div>

            <div>
              <Label htmlFor="edit-notes">Notizen</Label>
              <Input
                id="edit-notes"
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Zusätzliche Informationen (optional)"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => { resetForm(); setIsEditDialogOpen(false); setEditingMaterial(null); }}>
              Abbrechen
            </Button>
            <Button 
              onClick={handleUpdateMaterial}
              disabled={!formData.name || !formData.category || !formData.supplier}
            >
              Aktualisieren
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MaterialPricesModule;