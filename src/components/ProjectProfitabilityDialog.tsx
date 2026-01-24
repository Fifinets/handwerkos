import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle, 
  DollarSign,
  Clock,
  Package,
  Users,
  Calculator
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface ProjectProfitabilityData {
  project: any;
  
  // Geplante Werte (aus Vor-Kalkulation)
  plannedMaterialCosts: number;
  plannedLaborCosts: number;
  plannedSubcontractorCosts: number;
  plannedTravelCosts: number;
  plannedTotalCosts: number;
  plannedPrice: number;
  plannedProfit: number;
  plannedProfitMargin: number;
  
  // Tatsächliche Werte (aus Zeiterfassung & Materialeinkäufen)
  actualMaterialCosts: number;
  actualLaborCosts: number;
  actualSubcontractorCosts: number;
  actualTravelCosts: number;
  actualTotalCosts: number;
  actualPrice: number;
  actualProfit: number;
  actualProfitMargin: number;
  
  // Abweichungen
  materialDeviation: number;
  laborDeviation: number;
  subcontractorDeviation: number;
  totalCostDeviation: number;
  profitDeviation: number;
  
  // Kennzahlen
  budgetUtilization: number;
  efficiency: number;
  status: 'profitable' | 'break_even' | 'loss';
}

interface ProjectProfitabilityDialogProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectName: string;
}

const ProjectProfitabilityDialog: React.FC<ProjectProfitabilityDialogProps> = ({
  isOpen,
  onClose,
  projectId,
  projectName
}) => {
  const { toast } = useToast();
  const [profitabilityData, setProfitabilityData] = useState<ProjectProfitabilityData | null>(null);
  const [preCalculation, setPreCalculation] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && projectId) {
      loadProfitabilityData();
    }
  }, [isOpen, projectId]);

  const loadProfitabilityData = async () => {
    setLoading(true);
    try {
      // Projekt-Daten laden
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();

      if (projectError || !project) {
        throw new Error('Projekt nicht gefunden');
      }

      // Vor-Kalkulation aus Beschreibung extrahieren
      let extractedPreCalculation = null;
      if (project.description) {
        const preCalcMatch = project.description.match(/\[PRECALC:(.*?)\]/);
        if (preCalcMatch) {
          try {
            extractedPreCalculation = JSON.parse(preCalcMatch[1]);
            setPreCalculation(extractedPreCalculation);
          } catch (e) {
            console.warn('Fehler beim Parsen der Vor-Kalkulation:', e);
          }
        }
      }

      // Tatsächliche Zeit-Einträge laden (Mock-Daten, da Tabelle möglicherweise nicht existiert)
      const actualTimeEntries = [
        { hours: 45, hourlyRate: 45, cost: 45 * 45 },
        { hours: 12, hourlyRate: 55, cost: 12 * 55 }
      ];

      // Tatsächliche Material-Kosten laden (Mock-Daten)
      const actualMaterialCosts = [
        { name: 'Fliesen', cost: 850 },
        { name: 'Kleber', cost: 120 },
        { name: 'Fugenmasse', cost: 75 }
      ];

      // Berechnungen durchführen
      const plannedData = extractedPreCalculation || {
        materialCosts: 0,
        laborCosts: 0,
        subcontractorCosts: 0,
        travelCosts: 0,
        totalBaseCosts: 0,
        finalPrice: project.budget || 0,
        profitMargin: 20
      };

      const actualMaterialTotal = actualMaterialCosts.reduce((sum, item) => sum + item.cost, 0);
      const actualLaborTotal = actualTimeEntries.reduce((sum, entry) => sum + entry.cost, 0);
      const actualTotalCosts = actualMaterialTotal + actualLaborTotal;
      const actualPrice = project.budget || plannedData.finalPrice;
      const actualProfit = actualPrice - actualTotalCosts;
      const actualProfitMargin = actualPrice > 0 ? (actualProfit / actualPrice) * 100 : 0;

      const profitabilityData: ProjectProfitabilityData = {
        project,
        
        // Geplante Werte
        plannedMaterialCosts: plannedData.materialCosts || 0,
        plannedLaborCosts: plannedData.laborCosts || 0,
        plannedSubcontractorCosts: plannedData.subcontractorCosts || 0,
        plannedTravelCosts: plannedData.travelCosts || 0,
        plannedTotalCosts: plannedData.totalBaseCosts || 0,
        plannedPrice: plannedData.finalPrice || 0,
        plannedProfit: (plannedData.finalPrice || 0) - (plannedData.totalBaseCosts || 0),
        plannedProfitMargin: plannedData.profitMargin || 20,
        
        // Tatsächliche Werte
        actualMaterialCosts: actualMaterialTotal,
        actualLaborCosts: actualLaborTotal,
        actualSubcontractorCosts: 0,
        actualTravelCosts: 50, // Mock
        actualTotalCosts,
        actualPrice,
        actualProfit,
        actualProfitMargin,
        
        // Abweichungen
        materialDeviation: actualMaterialTotal - (plannedData.materialCosts || 0),
        laborDeviation: actualLaborTotal - (plannedData.laborCosts || 0),
        subcontractorDeviation: 0,
        totalCostDeviation: actualTotalCosts - (plannedData.totalBaseCosts || 0),
        profitDeviation: actualProfit - ((plannedData.finalPrice || 0) - (plannedData.totalBaseCosts || 0)),
        
        // Kennzahlen
        budgetUtilization: plannedData.totalBaseCosts > 0 ? (actualTotalCosts / plannedData.totalBaseCosts) * 100 : 0,
        efficiency: plannedData.laborCosts > 0 ? (plannedData.laborCosts / actualLaborTotal) * 100 : 100,
        status: actualProfit > 0 ? 'profitable' : actualProfit === 0 ? 'break_even' : 'loss'
      };

      setProfitabilityData(profitabilityData);
    } catch (error) {
      console.error('Fehler beim Laden der Rentabilitätsdaten:', error);
      toast({
        title: "Fehler",
        description: "Rentabilitätsdaten konnten nicht geladen werden",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  const formatPercentage = (value: number, decimals = 1) => {
    return `${value.toFixed(decimals)}%`;
  };

  const getDeviationColor = (deviation: number) => {
    if (deviation > 0) return 'text-red-600';
    if (deviation < 0) return 'text-green-600';
    return 'text-gray-600';
  };

  const getDeviationIcon = (deviation: number) => {
    if (deviation > 0) return <TrendingUp className="h-4 w-4 text-red-600" />;
    if (deviation < 0) return <TrendingDown className="h-4 w-4 text-green-600" />;
    return <CheckCircle className="h-4 w-4 text-gray-600" />;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'profitable':
        return <Badge className="bg-green-100 text-green-800">Rentabel</Badge>;
      case 'break_even':
        return <Badge className="bg-yellow-100 text-yellow-800">Break-Even</Badge>;
      case 'loss':
        return <Badge className="bg-red-100 text-red-800">Verlust</Badge>;
      default:
        return <Badge variant="outline">Unbekannt</Badge>;
    }
  };

  if (loading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl">
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">Rentabilitätsdaten werden geladen...</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!profitabilityData) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl">
          <div className="text-center py-8">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Keine Daten verfügbar</h3>
            <p className="text-gray-600">Für dieses Projekt konnten keine Rentabilitätsdaten geladen werden.</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Nachkalkulation & Rentabilität: {projectName}
          </DialogTitle>
          <DialogDescription className="flex items-center gap-4">
            <span>Vergleich von geplanten und tatsächlichen Kosten</span>
            {getStatusBadge(profitabilityData.status)}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Übersicht</TabsTrigger>
            <TabsTrigger value="costs">Kostenanalyse</TabsTrigger>
            <TabsTrigger value="estimates">Schätzungen vs. Ist</TabsTrigger>
            <TabsTrigger value="deviations">Abweichungen</TabsTrigger>
            <TabsTrigger value="kpis">Kennzahlen</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Profit-Übersicht */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-green-600" />
                    Gewinn
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Geplant:</span>
                      <span>{formatCurrency(profitabilityData.plannedProfit)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Tatsächlich:</span>
                      <span className={profitabilityData.actualProfit >= 0 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
                        {formatCurrency(profitabilityData.actualProfit)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm border-t pt-2">
                      <span className="text-gray-600">Abweichung:</span>
                      <div className="flex items-center gap-1">
                        {getDeviationIcon(profitabilityData.profitDeviation)}
                        <span className={getDeviationColor(profitabilityData.profitDeviation)}>
                          {formatCurrency(Math.abs(profitabilityData.profitDeviation))}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Budget-Auslastung */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5 text-blue-600" />
                    Budget-Nutzung
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span>Geplante Kosten:</span>
                      <span>{formatCurrency(profitabilityData.plannedTotalCosts)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Tatsächliche Kosten:</span>
                      <span>{formatCurrency(profitabilityData.actualTotalCosts)}</span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Auslastung:</span>
                        <span className={profitabilityData.budgetUtilization > 100 ? 'text-red-600 font-semibold' : 'text-green-600'}>
                          {formatPercentage(profitabilityData.budgetUtilization)}
                        </span>
                      </div>
                      <Progress 
                        value={Math.min(profitabilityData.budgetUtilization, 100)} 
                        className="h-2"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Effizienz */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-purple-600" />
                    Arbeitseffizienz
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span>Geplante Stunden:</span>
                      <span>{(profitabilityData.plannedLaborCosts / 45).toFixed(1)}h</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Tatsächliche Stunden:</span>
                      <span>{(profitabilityData.actualLaborCosts / 45).toFixed(1)}h</span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Effizienz:</span>
                        <span className={profitabilityData.efficiency >= 100 ? 'text-green-600 font-semibold' : 'text-orange-600'}>
                          {formatPercentage(profitabilityData.efficiency)}
                        </span>
                      </div>
                      <Progress 
                        value={Math.min(profitabilityData.efficiency, 100)} 
                        className="h-2"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Zusammenfassung */}
            <Card>
              <CardHeader>
                <CardTitle>Projekt-Zusammenfassung</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {formatCurrency(profitabilityData.actualPrice)}
                    </div>
                    <div className="text-sm text-gray-600">Verkaufspreis</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">
                      {formatCurrency(profitabilityData.actualTotalCosts)}
                    </div>
                    <div className="text-sm text-gray-600">Gesamtkosten</div>
                  </div>
                  <div className="text-center">
                    <div className={`text-2xl font-bold ${profitabilityData.actualProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(profitabilityData.actualProfit)}
                    </div>
                    <div className="text-sm text-gray-600">Gewinn/Verlust</div>
                  </div>
                  <div className="text-center">
                    <div className={`text-2xl font-bold ${profitabilityData.actualProfitMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatPercentage(profitabilityData.actualProfitMargin)}
                    </div>
                    <div className="text-sm text-gray-600">Gewinnmarge</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="costs" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Geplante Kosten</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span>Material:</span>
                      <span>{formatCurrency(profitabilityData.plannedMaterialCosts)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Lohn:</span>
                      <span>{formatCurrency(profitabilityData.plannedLaborCosts)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Fremdleistungen:</span>
                      <span>{formatCurrency(profitabilityData.plannedSubcontractorCosts)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Fahrtkosten:</span>
                      <span>{formatCurrency(profitabilityData.plannedTravelCosts)}</span>
                    </div>
                    <hr />
                    <div className="flex justify-between font-semibold">
                      <span>Gesamt:</span>
                      <span>{formatCurrency(profitabilityData.plannedTotalCosts)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Tatsächliche Kosten</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span>Material:</span>
                      <span>{formatCurrency(profitabilityData.actualMaterialCosts)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Lohn:</span>
                      <span>{formatCurrency(profitabilityData.actualLaborCosts)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Fremdleistungen:</span>
                      <span>{formatCurrency(profitabilityData.actualSubcontractorCosts)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Fahrtkosten:</span>
                      <span>{formatCurrency(profitabilityData.actualTravelCosts)}</span>
                    </div>
                    <hr />
                    <div className="flex justify-between font-semibold">
                      <span>Gesamt:</span>
                      <span>{formatCurrency(profitabilityData.actualTotalCosts)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="estimates" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="h-5 w-5 text-blue-600" />
                  Schätzungen vs. Bestätigte Werte vs. Tatsächlicher Verbrauch
                </CardTitle>
                <CardDescription>
                  Vergleich zwischen geschätzten Werten, bestätigten Planungswerten und dem tatsächlichen Materialverbrauch
                </CardDescription>
              </CardHeader>
              <CardContent>
                {preCalculation ? (
                  <div className="space-y-6">
                    {/* Material-Vergleich */}
                    {preCalculation.materials && preCalculation.materials.length > 0 && (
                      <div>
                        <h4 className="font-semibold mb-4 flex items-center gap-2">
                          <Package className="h-4 w-4" />
                          Material-Vergleich
                        </h4>
                        <div className="space-y-3">
                          <div className="grid grid-cols-6 gap-4 text-sm font-medium text-gray-600 border-b pb-2">
                            <span>Material</span>
                            <span>Geplant</span>
                            <span>Status</span>
                            <span>Tatsächlich</span>
                            <span>Abweichung</span>
                            <span>Typ</span>
                          </div>
                          {preCalculation.materials.map((material, index) => {
                            const actualCost = index === 0 ? 850 : index === 1 ? 120 : 95; // Mock actual costs
                            const plannedCost = material.quantity * material.pricePerUnit * (1 + material.markup / 100);
                            const deviation = actualCost - plannedCost;
                            return (
                              <div key={material.id} className="grid grid-cols-6 gap-4 items-center py-2 border-b">
                                <span className="text-sm">{material.name || 'Material ' + (index + 1)}</span>
                                <span className="text-sm">{formatCurrency(plannedCost)}</span>
                                <div>
                                  {material.isEstimate ? (
                                    <Badge variant="outline" className="text-orange-600 border-orange-600 text-xs">
                                      Schätzung
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-green-600 border-green-600 text-xs">
                                      Bestätigt
                                    </Badge>
                                  )}
                                </div>
                                <span className="text-sm">{formatCurrency(actualCost)}</span>
                                <div className="flex items-center gap-1">
                                  {getDeviationIcon(deviation)}
                                  <span className={`text-sm ${getDeviationColor(deviation)}`}>
                                    {formatCurrency(Math.abs(deviation))}
                                  </span>
                                </div>
                                <span className="text-xs text-gray-500">
                                  {material.unit} ({material.quantity}x)
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Labor-Vergleich */}
                    {preCalculation.labor && preCalculation.labor.length > 0 && (
                      <div>
                        <h4 className="font-semibold mb-4 flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          Arbeitszeit-Vergleich
                        </h4>
                        <div className="space-y-3">
                          <div className="grid grid-cols-6 gap-4 text-sm font-medium text-gray-600 border-b pb-2">
                            <span>Arbeitsposition</span>
                            <span>Geplant</span>
                            <span>Status</span>
                            <span>Tatsächlich</span>
                            <span>Abweichung</span>
                            <span>Details</span>
                          </div>
                          {preCalculation.labor.map((labor, index) => {
                            const actualCost = index === 0 ? 2025 : 660; // Mock actual costs
                            const plannedCost = labor.hours * labor.workers * labor.hourlyRate;
                            const deviation = actualCost - plannedCost;
                            return (
                              <div key={labor.id} className="grid grid-cols-6 gap-4 items-center py-2 border-b">
                                <span className="text-sm">{labor.description || 'Arbeitsposition ' + (index + 1)}</span>
                                <span className="text-sm">{formatCurrency(plannedCost)}</span>
                                <div>
                                  {labor.isEstimate ? (
                                    <Badge variant="outline" className="text-orange-600 border-orange-600 text-xs">
                                      Schätzung
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-green-600 border-green-600 text-xs">
                                      Bestätigt
                                    </Badge>
                                  )}
                                </div>
                                <span className="text-sm">{formatCurrency(actualCost)}</span>
                                <div className="flex items-center gap-1">
                                  {getDeviationIcon(deviation)}
                                  <span className={`text-sm ${getDeviationColor(deviation)}`}>
                                    {formatCurrency(Math.abs(deviation))}
                                  </span>
                                </div>
                                <span className="text-xs text-gray-500">
                                  {labor.hours}h × {labor.workers} Pers.
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Zusammenfassung der Schätzungsgenauigkeit */}
                    <div className="mt-6">
                      <h4 className="font-semibold mb-4">Schätzungsgenauigkeit</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Card className="bg-orange-50">
                          <CardContent className="p-4">
                            <div className="text-center">
                              <div className="text-2xl font-bold text-orange-600">
                                {preCalculation.materials ? preCalculation.materials.filter(m => m.isEstimate).length : 0}
                              </div>
                              <div className="text-sm text-orange-700">Material-Schätzungen</div>
                            </div>
                          </CardContent>
                        </Card>
                        <Card className="bg-green-50">
                          <CardContent className="p-4">
                            <div className="text-center">
                              <div className="text-2xl font-bold text-green-600">
                                {preCalculation.materials ? preCalculation.materials.filter(m => !m.isEstimate).length : 0}
                              </div>
                              <div className="text-sm text-green-700">Bestätigte Materialien</div>
                            </div>
                          </CardContent>
                        </Card>
                        <Card className="bg-blue-50">
                          <CardContent className="p-4">
                            <div className="text-center">
                              <div className="text-2xl font-bold text-blue-600">
                                {preCalculation.materials && preCalculation.labor ? 
                                  Math.round(100 - (Math.abs(profitabilityData.totalCostDeviation) / profitabilityData.plannedTotalCosts) * 100) : 0}%
                              </div>
                              <div className="text-sm text-blue-700">Gesamt-Genauigkeit</div>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    </div>

                    {/* Empfehlungen für Schätzungen */}
                    <div className="mt-6">
                      <Card className="bg-blue-50">
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2 text-blue-700">
                            <AlertTriangle className="h-5 w-5" />
                            Empfehlungen für zukünftige Schätzungen
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2 text-blue-700">
                            <p>• Als Schätzung markierte Positionen sollten vor Projektbeginn noch einmal überprüft werden</p>
                            <p>• Verwenden Sie bestätigte Werte aus ähnlichen abgeschlossenen Projekten</p>
                            <p>• Planen Sie für geschätzte Positionen einen höheren Sicherheitspuffer ein</p>
                            <p>• Dokumentieren Sie Abweichungen zwischen Schätzungen und tatsächlichen Werten für bessere zukünftige Kalkulationen</p>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Calculator className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Keine Vor-Kalkulation verfügbar</h3>
                    <p>Für dieses Projekt wurde keine detaillierte Vor-Kalkulation mit Schätzungsmarkierungen erstellt.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="deviations" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Kostenabweichungen</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-4 gap-4 text-sm font-medium text-gray-600 border-b pb-2">
                    <span>Kategorie</span>
                    <span>Geplant</span>
                    <span>Tatsächlich</span>
                    <span>Abweichung</span>
                  </div>

                  <div className="grid grid-cols-4 gap-4 items-center">
                    <span>Material</span>
                    <span>{formatCurrency(profitabilityData.plannedMaterialCosts)}</span>
                    <span>{formatCurrency(profitabilityData.actualMaterialCosts)}</span>
                    <div className="flex items-center gap-2">
                      {getDeviationIcon(profitabilityData.materialDeviation)}
                      <span className={getDeviationColor(profitabilityData.materialDeviation)}>
                        {formatCurrency(Math.abs(profitabilityData.materialDeviation))}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-4 items-center">
                    <span>Lohn</span>
                    <span>{formatCurrency(profitabilityData.plannedLaborCosts)}</span>
                    <span>{formatCurrency(profitabilityData.actualLaborCosts)}</span>
                    <div className="flex items-center gap-2">
                      {getDeviationIcon(profitabilityData.laborDeviation)}
                      <span className={getDeviationColor(profitabilityData.laborDeviation)}>
                        {formatCurrency(Math.abs(profitabilityData.laborDeviation))}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-4 items-center border-t pt-2">
                    <span className="font-semibold">Gesamtabweichung</span>
                    <span className="font-semibold">{formatCurrency(profitabilityData.plannedTotalCosts)}</span>
                    <span className="font-semibold">{formatCurrency(profitabilityData.actualTotalCosts)}</span>
                    <div className="flex items-center gap-2">
                      {getDeviationIcon(profitabilityData.totalCostDeviation)}
                      <span className={`font-semibold ${getDeviationColor(profitabilityData.totalCostDeviation)}`}>
                        {formatCurrency(Math.abs(profitabilityData.totalCostDeviation))}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {profitabilityData.totalCostDeviation > 0 && (
              <Card className="border-red-200 bg-red-50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-red-700">
                    <AlertTriangle className="h-5 w-5" />
                    Kostenüberschreitung
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-red-700">
                    Das Projekt hat die geplanten Kosten um {formatCurrency(profitabilityData.totalCostDeviation)} überschritten.
                    Das entspricht einer Überschreitung von {formatPercentage((profitabilityData.totalCostDeviation / profitabilityData.plannedTotalCosts) * 100)}.
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="kpis" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Rentabilitäts-KPIs</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span>Gewinnmarge (geplant):</span>
                    <span className="font-semibold">{formatPercentage(profitabilityData.plannedProfitMargin)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Gewinnmarge (tatsächlich):</span>
                    <span className={`font-semibold ${profitabilityData.actualProfitMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatPercentage(profitabilityData.actualProfitMargin)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>ROI (Return on Investment):</span>
                    <span className={`font-semibold ${profitabilityData.actualProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatPercentage((profitabilityData.actualProfit / profitabilityData.actualTotalCosts) * 100)}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Effizienz-KPIs</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span>Budget-Ausschöpfung:</span>
                    <span className={`font-semibold ${profitabilityData.budgetUtilization > 100 ? 'text-red-600' : 'text-green-600'}`}>
                      {formatPercentage(profitabilityData.budgetUtilization)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Arbeitseffizienz:</span>
                    <span className={`font-semibold ${profitabilityData.efficiency >= 100 ? 'text-green-600' : 'text-orange-600'}`}>
                      {formatPercentage(profitabilityData.efficiency)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Kostengenauigkeit:</span>
                    <span className="font-semibold">
                      {formatPercentage(100 - Math.abs((profitabilityData.totalCostDeviation / profitabilityData.plannedTotalCosts) * 100))}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Empfehlungen */}
            <Card>
              <CardHeader>
                <CardTitle>Empfehlungen für zukünftige Projekte</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {profitabilityData.materialDeviation > profitabilityData.plannedMaterialCosts * 0.1 && (
                    <div className="flex items-start gap-3 p-3 bg-yellow-50 rounded-lg">
                      <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                      <div>
                        <div className="font-medium text-yellow-800">Materialkosten-Planung verbessern</div>
                        <div className="text-sm text-yellow-700">
                          Materialkosten waren {formatPercentage((profitabilityData.materialDeviation / profitabilityData.plannedMaterialCosts) * 100)} höher als geplant.
                          Prüfen Sie Ihre Lieferantenpreise und Mengenschätzungen.
                        </div>
                      </div>
                    </div>
                  )}

                  {profitabilityData.efficiency < 90 && (
                    <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
                      <Clock className="h-5 w-5 text-blue-600 mt-0.5" />
                      <div>
                        <div className="font-medium text-blue-800">Arbeitsplanung optimieren</div>
                        <div className="text-sm text-blue-700">
                          Die Arbeitseffizienz lag bei nur {formatPercentage(profitabilityData.efficiency)}. 
                          Überprüfen Sie die Zeitschätzungen und Arbeitsabläufe.
                        </div>
                      </div>
                    </div>
                  )}

                  {profitabilityData.actualProfitMargin > profitabilityData.plannedProfitMargin * 1.2 && (
                    <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg">
                      <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                      <div>
                        <div className="font-medium text-green-800">Sehr gute Rentabilität</div>
                        <div className="text-sm text-green-700">
                          Das Projekt war deutlich rentabler als geplant. Diese Kalkulations-Ansätze können als Vorlage für ähnliche Projekte dienen.
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

      </DialogContent>
    </Dialog>
  );
};

export default ProjectProfitabilityDialog;