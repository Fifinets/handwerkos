import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Package, AlertTriangle, TrendingDown, TrendingUp, Plus, Search, Truck, Edit } from "lucide-react";
import EditMaterialDialog from "./EditMaterialDialog";
import ReorderSuggestions from "./material/ReorderSuggestions";
import { 
  useMaterials, 
  useStockTransfers,
  useCreateMaterial,
  useUpdateMaterial,
  useStockCounts 
} from "@/hooks/useApi";

const MaterialModule = () => {
  // React Query hooks
  const { data: materialsResponse, isLoading: materialsLoading } = useMaterials();
  const { data: stockCountsResponse, isLoading: stockLoading } = useStockCounts();
  const { data: stockTransfersResponse, isLoading: transfersLoading } = useStockTransfers();
  
  const createMaterialMutation = useCreateMaterial();
  const updateMaterialMutation = useUpdateMaterial();
  
  // Local state for dialogs
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<any | null>(null);
  
  // Extract data from responses
  const materials = materialsResponse?.items || [];
  const stockCounts = stockCountsResponse?.items || [];
  const recentOrders = stockTransfersResponse?.items?.slice(0, 3) || [];
  
  // Loading state
  const isLoading = materialsLoading || stockLoading || transfersLoading;
  
  // Calculate stats from real data
  const totalItems = materials.length;
  const totalValue = materials.reduce((sum, material) => sum + (material.unit_cost * material.current_stock || 0), 0);
  const lowStockItems = materials.filter(material => 
    material.current_stock <= material.min_stock
  ).length;
  const openOrders = recentOrders.filter(order => 
    order.status === 'pending' || order.status === 'in_transit'
  ).length;

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
  
  const getStatusFromStockLevel = (material: any) => {
    if (!material.current_stock || !material.min_stock) return 'Verfügbar';
    return getStockLevel(material.current_stock, material.min_stock);
  };

  const handleEditMaterial = (material: any) => {
    setSelectedMaterial(material);
    setIsEditDialogOpen(true);
  };

  const handleMaterialUpdated = (updatedMaterial: any) => {
    // React Query will automatically refetch and update the cache
    setIsEditDialogOpen(false);
  };

  const handleShowMaterialDetails = (material: any) => {
    alert(`Details für ${material.name}:\n\nKategorie: ${material.category}\nBestand: ${material.current_stock} ${material.unit}\nLieferant: ${material.supplier_name}\nPreis: €${material.unit_cost}/${material.unit}`);
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-4xl font-bold text-gray-900">Materialwirtschaft</h1>
        <div className="flex items-center gap-6">
          <Button 
            variant="outline"
            className="rounded-lg px-6 py-3 text-lg font-medium"
          >
            <Truck className="h-5 w-5 mr-3" />
            Bestellung
          </Button>
          <Button className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-6 py-3 text-lg font-medium">
            <Plus className="h-5 w-5 mr-3" />
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
                {isLoading ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <p className="text-2xl font-bold">{totalItems}</p>
                )}
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
                {isLoading ? (
                  <Skeleton className="h-8 w-20" />
                ) : (
                  <p className="text-2xl font-bold">€{totalValue.toLocaleString('de-DE', { minimumFractionDigits: 0 })}</p>
                )}
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
                {isLoading ? (
                  <Skeleton className="h-8 w-8" />
                ) : (
                  <p className="text-2xl font-bold">{lowStockItems}</p>
                )}
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
                {isLoading ? (
                  <Skeleton className="h-8 w-8" />
                ) : (
                  <p className="text-2xl font-bold">{openOrders}</p>
                )}
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

          {isLoading ? (
            Array(4).fill(0).map((_, i) => (
              <Card key={i} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Skeleton className="h-6 w-48" />
                        <Skeleton className="h-6 w-20" />
                      </div>
                      <Skeleton className="h-4 w-32 mb-2" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                    <div className="text-right">
                      <Skeleton className="h-6 w-20 mb-1" />
                      <Skeleton className="h-4 w-28" />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <Skeleton className="h-2 w-full" />
                    <div className="grid grid-cols-3 gap-4">
                      <Skeleton className="h-8 w-full" />
                      <Skeleton className="h-8 w-full" />
                      <Skeleton className="h-8 w-full" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : materials.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center">
                <p className="text-gray-500">Keine Materialien gefunden.</p>
              </CardContent>
            </Card>
          ) : (
            materials.map((material) => {
              const status = getStatusFromStockLevel(material);
              return (
                <Card key={material.id} className="hover:shadow-lg transition-shadow">
                  <CardContent className="p-6 flex flex-col h-full">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="text-lg font-semibold">{material.name}</h4>
                          <Badge className={getStatusColor(status)}>
                            {status}
                          </Badge>
                        </div>
                        <p className="text-gray-600 mb-2">{material.category}</p>
                        <p className="text-sm text-gray-500">Art.-Nr: {material.sku}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-blue-600">€{material.unit_cost}/{material.unit}</p>
                        <p className="text-sm text-gray-500">{material.supplier_name}</p>
                      </div>
                    </div>

                    <div className="space-y-3 flex-grow">
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Lagerbestand</span>
                          <span>{material.current_stock} {material.unit} / {material.max_stock} {material.unit}</span>
                        </div>
                        <Progress 
                          value={getStockPercentage(material.current_stock, material.max_stock)} 
                          className={`h-2 ${
                            getStockLevel(material.current_stock, material.min_stock) === 'Kritisch' ? 'bg-red-100' :
                            getStockLevel(material.current_stock, material.min_stock) === 'Niedrig' ? 'bg-yellow-100' : 'bg-green-100'
                          }`}
                        />
                      </div>

                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-gray-500">Mindestbestand:</p>
                          <p>{material.min_stock} {material.unit}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Letzte Bestellung:</p>
                          <p>{material.last_ordered_at ? new Date(material.last_ordered_at).toLocaleDateString('de-DE') : 'Nie'}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Preis pro {material.unit}:</p>
                          <p>€{material.unit_cost}/{material.unit}</p>
                        </div>
                      </div>

                      {material.current_stock <= material.min_stock && (
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
                      {status !== 'Verfügbar' && (
                        <Button size="sm" className="bg-orange-600 hover:bg-orange-700">
                          <Truck className="h-4 w-4 mr-1" />
                          Nachbestellen
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })
          )}
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
                {isLoading ? (
                  Array(3).fill(0).map((_, i) => (
                    <div key={i} className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-6 w-16" />
                      </div>
                      <Skeleton className="h-4 w-32 mb-1" />
                      <div className="flex justify-between items-center">
                        <Skeleton className="h-4 w-16" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                    </div>
                  ))
                ) : recentOrders.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">Keine aktuellen Bestellungen</p>
                ) : (
                  recentOrders.map((order) => (
                    <div key={order.id} className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <p className="font-medium text-sm">{order.transfer_number || order.id}</p>
                        <Badge className={getStatusColor(order.status)}>
                          {order.status === 'completed' ? 'Geliefert' : 
                           order.status === 'in_transit' ? 'Unterwegs' : 
                           order.status === 'pending' ? 'Bestellt' : order.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600 mb-1">{order.from_location || 'Unbekannter Lieferant'}</p>
                      <div className="flex justify-between items-center">
                        <p className="text-sm font-bold text-green-600">€{order.total_value || '0'}</p>
                        <p className="text-xs text-gray-500">{new Date(order.created_at).toLocaleDateString('de-DE')}</p>
                      </div>
                    </div>
                  ))
                )}
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
                {isLoading ? (
                  Array(2).fill(0).map((_, i) => (
                    <div key={i} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-3 w-12" />
                    </div>
                  ))
                ) : materials.filter(m => getStatusFromStockLevel(m) === 'Kritisch' || getStatusFromStockLevel(m) === 'Niedrig').slice(0, 5).map((material) => {
                  const status = getStatusFromStockLevel(material);
                  return (
                    <div key={material.id} className={`flex items-center justify-between p-2 rounded ${
                      status === 'Kritisch' ? 'bg-red-50' : 'bg-yellow-50'
                    }`}>
                      <span className="text-sm">{material.name}</span>
                      <span className={`text-xs ${
                        status === 'Kritisch' ? 'text-red-600' : 'text-yellow-600'
                      }`}>{material.current_stock} {material.unit}</span>
                    </div>
                  )
                })}
                {!isLoading && materials.filter(m => getStatusFromStockLevel(m) === 'Kritisch' || getStatusFromStockLevel(m) === 'Niedrig').length === 0 && (
                  <p className="text-sm text-gray-500 text-center py-2">Keine kritischen Bestände 🎉</p>
                )}
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
