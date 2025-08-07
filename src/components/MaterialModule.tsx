import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Package, AlertTriangle, TrendingDown, TrendingUp, Plus, Search, Truck, Edit } from "lucide-react";
import EditMaterialDialog from "./EditMaterialDialog";
import ReorderSuggestions from "./material/ReorderSuggestions";

const MaterialModule = () => {
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState(null);
  const [materials, setMaterials] = useState([
    {
      id: 'MAT001',
      name: 'Kabel NYM-J 3x1,5 mm²',
      category: 'Kabel & Leitungen',
      currentStock: 150,
      minStock: 100,
      maxStock: 500,
      unit: 'm',
      price: '€1.25/m',
      supplier: 'ElektroGroßhandel GmbH',
      lastOrder: '15.01.2024',
      status: 'Verfügbar'
    },
    {
      id: 'MAT002',
      name: 'Schalter Jung LS990',
      category: 'Installationsmaterial',
      currentStock: 25,
      minStock: 50,
      maxStock: 200,
      unit: 'Stk',
      price: '€8.90/Stk',
      supplier: 'Jung Vertrieb',
      lastOrder: '10.01.2024',
      status: 'Niedrig'
    },
    {
      id: 'MAT003',
      name: 'Sicherungsautomat B16A',
      category: 'Schaltgeräte',
      currentStock: 75,
      minStock: 30,
      maxStock: 150,
      unit: 'Stk',
      price: '€12.50/Stk',
      supplier: 'Hager Vertrieb',
      lastOrder: '20.01.2024',
      status: 'Verfügbar'
    },
    {
      id: 'MAT004',
      name: 'Kabel YCYM 5x1,5 mm²',
      category: 'Kabel & Leitungen',
      currentStock: 5,
      minStock: 25,
      maxStock: 200,
      unit: 'm',
      price: '€2.80/m',
      supplier: 'ElektroGroßhandel GmbH',
      lastOrder: '05.01.2024',
      status: 'Kritisch'
    }
  ]);

  const recentOrders = [
    { id: 'B2024-001', supplier: 'ElektroGroßhandel GmbH', amount: '€1.247', status: 'Geliefert', date: '20.01.2024' },
    { id: 'B2024-002', supplier: 'Jung Vertrieb', amount: '€445', status: 'Unterwegs', date: '22.01.2024' },
    { id: 'B2024-003', supplier: 'Hager Vertrieb', amount: '€875', status: 'Bestellt', date: '24.01.2024' }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Verfügbar': return 'bg-green-100 text-green-800';
      case 'Niedrig': return 'bg-yellow-100 text-yellow-800';
      case 'Kritisch': return 'bg-red-100 text-red-800';
      case 'Geliefert': return 'bg-green-100 text-green-800';
      case 'Unterwegs': return 'bg-blue-100 text-blue-800';
      case 'Bestellt': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStockPercentage = (current: number, max: number) => {
    return (current / max) * 100;
  };

  const getStockLevel = (current: number, min: number) => {
    if (current <= min * 0.5) return 'Kritisch';
    if (current <= min) return 'Niedrig';
    return 'Verfügbar';
  };

  const handleEditMaterial = (material) => {
    setSelectedMaterial(material);
    setIsEditDialogOpen(true);
  };

  const handleMaterialUpdated = (updatedMaterial) => {
    setMaterials(prev => prev.map(material => 
      material.id === updatedMaterial.id ? updatedMaterial : material
    ));
  };

  const handleShowMaterialDetails = (material) => {
    // Für jetzt als einfacher Alert - später kann hier ein Detail-Dialog geöffnet werden
    alert(`Details für ${material.name}:\n\nKategorie: ${material.category}\nBestand: ${material.currentStock} ${material.unit}\nLieferant: ${material.supplier}\nPreis: ${material.price}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Package className="h-6 w-6 text-blue-600" />
            Materialwirtschaft
          </h2>
          <p className="text-gray-600">Lagerbestand und Bestellungen verwalten</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Truck className="h-4 w-4 mr-2" />
            Bestellung
          </Button>
          <Button >
            <Plus className="h-4 w-4 mr-2" />
            Material hinzufügen
          </Button>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Lagerposten</p>
                <p className="text-2xl font-bold">247</p>
              </div>
              <Package className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Lagerwert</p>
                <p className="text-2xl font-bold">€24.580</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Niedrige Bestände</p>
                <p className="text-2xl font-bold">8</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Offene Bestellungen</p>
                <p className="text-2xl font-bold">3</p>
              </div>
              <Truck className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Material Inventory */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Lagerbestand</h3>
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input placeholder="Material suchen..." className="pl-10 w-64" />
              </div>
            </div>
          </div>

          {materials.map((material) => (
            <Card key={material.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6 flex flex-col h-full">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="text-lg font-semibold">{material.name}</h4>
                      <Badge className={getStatusColor(material.status)}>
                        {material.status}
                      </Badge>
                    </div>
                    <p className="text-gray-600 mb-2">{material.category}</p>
                    <p className="text-sm text-gray-500">Art.-Nr: {material.id}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-blue-600">{material.price}</p>
                    <p className="text-sm text-gray-500">{material.supplier}</p>
                  </div>
                </div>

                <div className="space-y-3 flex-grow">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Lagerbestand</span>
                      <span>{material.currentStock} {material.unit} / {material.maxStock} {material.unit}</span>
                    </div>
                    <Progress 
                      value={getStockPercentage(material.currentStock, material.maxStock)} 
                      className={`h-2 ${
                        getStockLevel(material.currentStock, material.minStock) === 'Kritisch' ? 'bg-red-100' :
                        getStockLevel(material.currentStock, material.minStock) === 'Niedrig' ? 'bg-yellow-100' : 'bg-green-100'
                      }`}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500">Mindestbestand:</p>
                      <p>{material.minStock} {material.unit}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Letzte Bestellung:</p>
                      <p>{material.lastOrder}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Preis pro {material.unit}:</p>
                      <p>{material.price}</p>
                    </div>
                  </div>

                  {material.currentStock <= material.minStock && (
                    <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <div className="flex items-center gap-2 text-yellow-800">
                        <AlertTriangle className="h-4 w-4" />
                        <span className="text-sm font-medium">
                          Bestand unter Mindestmenge! Nachbestellung empfohlen.
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-4 mt-auto">
                  <Button
                    size="sm" 
                    variant="outline"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleShowMaterialDetails(material);
                    }}
                  >
                    <Package className="h-4 w-4 mr-1" />
                    Details
                  </Button>
                  <Button
                    size="sm" 
                    variant="outline"
                    onClick={() => handleEditMaterial(material)}
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    Bearbeiten
                  </Button>
                  {material.status !== 'Verfügbar' && (
                    <Button size="sm" className="bg-orange-600 hover:bg-orange-700">
                      <Truck className="h-4 w-4 mr-1" />
                      Nachbestellen
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Recent Orders & Quick Actions */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5" />
                Letzte Bestellungen
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentOrders.map((order) => (
                  <div key={order.id} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-medium text-sm">{order.id}</p>
                      <Badge className={getStatusColor(order.status)}>
                        {order.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600 mb-1">{order.supplier}</p>
                    <div className="flex justify-between items-center">
                      <p className="text-sm font-bold text-green-600">{order.amount}</p>
                      <p className="text-xs text-gray-500">{order.date}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Materialaktionen</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="space-y-2">
                <Button variant="outline" className="w-full justify-start">
                  <Plus className="h-4 w-4 mr-2" />
                  Wareneingang
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <Package className="h-4 w-4 mr-2" />
                  Inventur
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <TrendingDown className="h-4 w-4 mr-2" />
                  Verbrauch
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <Truck className="h-4 w-4 mr-2" />
                  Lieferanten
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base text-red-600">Kritische Bestände</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between p-2 bg-red-50 rounded">
                  <span className="text-sm">Kabel YCYM 5x1,5</span>
                  <span className="text-xs text-red-600">5m</span>
                </div>
                <div className="flex items-center justify-between p-2 bg-yellow-50 rounded">
                  <span className="text-sm">Schalter Jung LS990</span>
                  <span className="text-xs text-yellow-600">25 Stk</span>
                </div>
              </div>
          </CardContent>
          </Card>

          <ReorderSuggestions materials={materials} />
        </div>
      </div>

      <EditMaterialDialog
        isOpen={isEditDialogOpen}
        onClose={() => setIsEditDialogOpen(false)}
        material={selectedMaterial}
        onMaterialUpdated={handleMaterialUpdated}
      />
    </div>
  );
};

export default MaterialModule;
