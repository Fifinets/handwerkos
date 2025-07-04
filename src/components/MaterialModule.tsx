import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Package, Plus, Truck, Calendar } from 'lucide-react';
import AddMaterialDialog from './AddMaterialDialog';

const MaterialModule = () => {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [materials, setMaterials] = useState([
    {
      id: "MAT001",
      name: "Betonmischung C25/30",
      category: "Beton",
      unit: "m³",
      quantity: 50,
      pricePerUnit: "85.00",
      supplier: "Betonwerk Schmidt GmbH",
      lastUpdated: "12.03.2024"
    },
    {
      id: "MAT002",
      name: "Bewehrungsstahl B500",
      category: "Stahl",
      unit: "t",
      quantity: 25,
      pricePerUnit: "650.00",
      supplier: "Stahlhandel Meier AG",
      lastUpdated: "05.03.2024"
    },
    {
      id: "MAT003",
      name: "Holzbretter Fichte 24mm",
      category: "Holz",
      unit: "m³",
      quantity: 30,
      pricePerUnit: "320.00",
      supplier: "Holzwerke Kuster KG",
      lastUpdated: "28.02.2024"
    },
    {
      id: "MAT004",
      name: "Mauerziegel HLz 12",
      category: "Ziegel",
      unit: "Stück",
      quantity: 2000,
      pricePerUnit: "0.85",
      supplier: "Ziegelwerke Lehmann GmbH",
      lastUpdated: "18.02.2024"
    },
    {
      id: "MAT005",
      name: "Dämmwolle ISOVER Integra",
      category: "Isolation",
      unit: "m²",
      quantity: 150,
      pricePerUnit: "18.50",
      supplier: "Saint-Gobain Isover G+H AG",
      lastUpdated: "02.02.2024"
    }
  ]);

  const handleAddMaterial = (newMaterial: any) => {
    setMaterials(prev => [...prev, newMaterial]);
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'Beton': return 'bg-gray-100 text-gray-800';
      case 'Stahl': return 'bg-blue-100 text-blue-800';
      case 'Holz': return 'bg-yellow-100 text-yellow-800';
      case 'Ziegel': return 'bg-red-100 text-red-800';
      default: return 'bg-green-100 text-green-800';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold tracking-tight">Material & Lager</h2>
        <Button 
          onClick={() => setIsAddDialogOpen(true)}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="mr-2 h-4 w-4" />
          Neues Material
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {materials.map((material) => (
          <Card key={material.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{material.name}</CardTitle>
                <Badge className={getCategoryColor(material.category)}>
                  {material.category}
                </Badge>
              </div>
              <CardDescription>ID: {material.id}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Bestand:</span>
                  <span className="text-sm">{material.quantity} {material.unit}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Preis/Einheit:</span>
                  <span className="text-sm">€{material.pricePerUnit}</span>
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <Truck className="mr-2 h-4 w-4" />
                  {material.supplier}
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <Calendar className="mr-2 h-4 w-4" />
                  Aktualisiert: {material.lastUpdated}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <AddMaterialDialog
        isOpen={isAddDialogOpen}
        onClose={() => setIsAddDialogOpen(false)}
        onMaterialAdded={handleAddMaterial}
      />
    </div>
  );
};

export default MaterialModule;
