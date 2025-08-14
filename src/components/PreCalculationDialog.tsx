import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Calculator, Plus, Trash2, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface MaterialItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  pricePerUnit: number;
  supplier?: string;
  markup: number; // Aufschlag in %
  totalCost: number;
  isEstimate: boolean; // Kennzeichnung als Schätzung
}

interface LaborItem {
  id: string;
  description: string;
  hours: number;
  workers: number;
  hourlyRate: number;
  totalCost: number;
  isEstimate: boolean; // Kennzeichnung als Schätzung
}

interface SubcontractorItem {
  id: string;
  description: string;
  supplier: string;
  cost: number;
}

interface PreCalculation {
  id?: string;
  projectId: string;
  projectName: string;
  customerId: string;
  
  // Kosten-Kategorien
  materials: MaterialItem[];
  labor: LaborItem[];
  subcontractors: SubcontractorItem[];
  
  // Zusätzliche Kosten
  travelCosts: number;
  travelDescription: string;
  
  // Zuschläge und Margen
  safetyBuffer: number; // Sicherheitszuschlag in %
  profitMargin: number; // Gewinnmarge in %
  
  // Berechnete Werte
  materialCosts: number;
  laborCosts: number;
  subcontractorCosts: number;
  totalBaseCosts: number;
  totalCostsWithBuffer: number;
  finalPrice: number;
  
  notes: string;
  createdAt?: string;
  updatedAt?: string;
}

interface PreCalculationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectName: string;
  customerId: string;
  onCalculationSaved?: (calculation: PreCalculation) => void;
}

const PreCalculationDialog: React.FC<PreCalculationDialogProps> = ({
  isOpen,
  onClose,
  projectId,
  projectName,
  customerId,
  onCalculationSaved
}) => {
  const { toast } = useToast();
  
  const [calculation, setCalculation] = useState<PreCalculation>({
    projectId,
    projectName,
    customerId,
    materials: [],
    labor: [],
    subcontractors: [],
    travelCosts: 0,
    travelDescription: '',
    safetyBuffer: 10, // Standard 10%
    profitMargin: 20, // Standard 20%
    materialCosts: 0,
    laborCosts: 0,
    subcontractorCosts: 0,
    totalBaseCosts: 0,
    totalCostsWithBuffer: 0,
    finalPrice: 0,
    notes: ''
  });

  // Load existing calculation when dialog opens
  useEffect(() => {
    if (isOpen && projectId) {
      loadExistingCalculation();
    }
  }, [isOpen, projectId]);

  const loadExistingCalculation = async () => {
    try {
      const { data: project } = await supabase
        .from('projects')
        .select('description')
        .eq('id', projectId)
        .single();

      if (project?.description) {
        const preCalcMatch = project.description.match(/\[PRECALC:(.*?)\]/);
        if (preCalcMatch) {
          try {
            const existingCalculation = JSON.parse(preCalcMatch[1]);
            console.log('📊 Loading existing calculation:', existingCalculation);
            
            // Merge existing calculation with current state
            setCalculation(prev => ({
              ...prev,
              ...existingCalculation,
              projectId, // Ensure correct IDs
              projectName,
              customerId
            }));

            toast({
              title: "Bestehende Kalkulation geladen",
              description: "Die vorhandene Vor-Kalkulation wurde geladen."
            });
          } catch (e) {
            console.warn('Error parsing existing calculation:', e);
          }
        }
      }
    } catch (error) {
      console.error('Error loading existing calculation:', error);
    }
  };

  // Berechnung aktualisieren wenn sich Werte ändern
  useEffect(() => {
    calculateTotals();
  }, [
    calculation.materials,
    calculation.labor,
    calculation.subcontractors,
    calculation.travelCosts,
    calculation.safetyBuffer,
    calculation.profitMargin
  ]);

  const calculateTotals = () => {
    const materialCosts = calculation.materials.reduce((sum, item) => {
      const basePrice = item.quantity * item.pricePerUnit;
      const withMarkup = basePrice * (1 + item.markup / 100);
      return sum + withMarkup;
    }, 0);

    const laborCosts = calculation.labor.reduce((sum, item) => {
      return sum + (item.hours * item.workers * item.hourlyRate);
    }, 0);

    const subcontractorCosts = calculation.subcontractors.reduce((sum, item) => {
      return sum + item.cost;
    }, 0);

    const totalBaseCosts = materialCosts + laborCosts + subcontractorCosts + calculation.travelCosts;
    const totalCostsWithBuffer = totalBaseCosts * (1 + calculation.safetyBuffer / 100);
    const finalPrice = totalCostsWithBuffer * (1 + calculation.profitMargin / 100);

    setCalculation(prev => ({
      ...prev,
      materialCosts,
      laborCosts,
      subcontractorCosts,
      totalBaseCosts,
      totalCostsWithBuffer,
      finalPrice
    }));
  };

  const addMaterialItem = () => {
    const newItem: MaterialItem = {
      id: Date.now().toString(),
      name: '',
      quantity: 1,
      unit: 'Stück',
      pricePerUnit: 0,
      markup: 15,
      totalCost: 0,
      isEstimate: false
    };
    setCalculation(prev => ({
      ...prev,
      materials: [...prev.materials, newItem]
    }));
  };

  const addLaborItem = () => {
    const newItem: LaborItem = {
      id: Date.now().toString(),
      description: '',
      hours: 8,
      workers: 1,
      hourlyRate: 45, // Standard Handwerker-Stundensatz
      totalCost: 0,
      isEstimate: false
    };
    setCalculation(prev => ({
      ...prev,
      labor: [...prev.labor, newItem]
    }));
  };

  const addSubcontractorItem = () => {
    const newItem: SubcontractorItem = {
      id: Date.now().toString(),
      description: '',
      supplier: '',
      cost: 0
    };
    setCalculation(prev => ({
      ...prev,
      subcontractors: [...prev.subcontractors, newItem]
    }));
  };

  const removeMaterialItem = (id: string) => {
    setCalculation(prev => ({
      ...prev,
      materials: prev.materials.filter(item => item.id !== id)
    }));
  };

  const removeLaborItem = (id: string) => {
    setCalculation(prev => ({
      ...prev,
      labor: prev.labor.filter(item => item.id !== id)
    }));
  };

  const removeSubcontractorItem = (id: string) => {
    setCalculation(prev => ({
      ...prev,
      subcontractors: prev.subcontractors.filter(item => item.id !== id)
    }));
  };

  const updateMaterialItem = (id: string, field: keyof MaterialItem, value: any) => {
    setCalculation(prev => ({
      ...prev,
      materials: prev.materials.map(item => 
        item.id === id ? { ...item, [field]: value } : item
      )
    }));
  };

  const updateLaborItem = (id: string, field: keyof LaborItem, value: any) => {
    setCalculation(prev => ({
      ...prev,
      labor: prev.labor.map(item => 
        item.id === id ? { ...item, [field]: value } : item
      )
    }));
  };

  const updateSubcontractorItem = (id: string, field: keyof SubcontractorItem, value: any) => {
    setCalculation(prev => ({
      ...prev,
      subcontractors: prev.subcontractors.map(item => 
        item.id === id ? { ...item, [field]: value } : item
      )
    }));
  };

  const saveCalculation = async () => {
    try {
      // Import applyEstimateWithApproval für Human-Approval
      const { applyEstimateWithApproval } = await import('../services/aiEstimationService');
      
      const calculationData = {
        ...calculation,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      // Human-Approval bei AI-gestützten Schätzungen
      if (calculation.isEstimate || calculation.materials.some(m => m.isEstimate)) {
        const approved = await applyEstimateWithApproval({
          projectId: projectId,
          estimate: calculationData,
          userId: undefined // würde normalerweise aus Auth-Context kommen
        });
        
        if (!approved) {
          return; // User hat abgebrochen
        }
      }

      // In Projekt-Beschreibung als [PRECALC:...] speichern
      const calculationInfo = `[PRECALC:${JSON.stringify(calculationData)}]`;
      
      // Update project with calculation data AND budget
      const updateData: any = {};
      
      // Store calculation in description (append, don't overwrite existing description)
      const { data: currentProject } = await supabase
        .from('projects')
        .select('description, budget')
        .eq('id', projectId)
        .single();
      
      let newDescription = calculationInfo;
      if (currentProject?.description && !currentProject.description.includes('[PRECALC:')) {
        // Preserve existing description, add calculation
        newDescription = `${currentProject.description} ${calculationInfo}`;
      } else if (currentProject?.description && currentProject.description.includes('[PRECALC:')) {
        // Replace existing calculation
        newDescription = currentProject.description.replace(/\[PRECALC:.*?\]/, calculationInfo);
      }
      
      updateData.description = newDescription;
      
      // Always set the budget from calculation
      updateData.budget = Math.round(calculation.finalPrice);
      
      console.log('💰 Setting project budget to:', updateData.budget);
      
      const { error } = await supabase
        .from('projects')
        .update(updateData)
        .eq('id', projectId);

      if (error) {
        throw error;
      }

      toast({
        title: "Vor-Kalkulation gespeichert",
        description: `Budget wurde auf €${calculation.finalPrice.toFixed(2)} gesetzt`
      });

      // Call callback with calculation data
      onCalculationSaved?.(calculationData);
      onClose();
    } catch (error) {
      console.error('Error saving pre-calculation:', error);
      toast({
        title: "Fehler",
        description: "Vor-Kalkulation konnte nicht gespeichert werden",
        variant: "destructive"
      });
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Vor-Kalkulation: {projectName}
          </DialogTitle>
          <DialogDescription>
            Detaillierte Kostenberechnung für das Projekt erstellen
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="materials" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="materials">Material</TabsTrigger>
            <TabsTrigger value="labor">Arbeitszeit</TabsTrigger>
            <TabsTrigger value="subcontractors">Fremdleistungen</TabsTrigger>
            <TabsTrigger value="costs">Zusatzkosten</TabsTrigger>
            <TabsTrigger value="summary">Zusammenfassung</TabsTrigger>
          </TabsList>

          <TabsContent value="materials" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Materialkosten</h3>
              <Button onClick={addMaterialItem} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Material hinzufügen
              </Button>
            </div>

            <div className="space-y-4">
              {calculation.materials.map((item, index) => (
                <Card key={item.id}>
                  <CardContent className="p-4">
                    <div className="grid grid-cols-8 gap-4 items-center">
                      <div>
                        <Label>Material</Label>
                        <Input
                          value={item.name}
                          onChange={(e) => updateMaterialItem(item.id, 'name', e.target.value)}
                          placeholder="z.B. Fliesen 30x30cm"
                        />
                      </div>
                      <div>
                        <Label>Menge</Label>
                        <Input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateMaterialItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <div>
                        <Label>Einheit</Label>
                        <Select 
                          value={item.unit}
                          onValueChange={(value) => updateMaterialItem(item.id, 'unit', value)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Stück">Stück</SelectItem>
                            <SelectItem value="m²">m²</SelectItem>
                            <SelectItem value="m">m</SelectItem>
                            <SelectItem value="kg">kg</SelectItem>
                            <SelectItem value="l">l</SelectItem>
                            <SelectItem value="Paket">Paket</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Preis/Einheit</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={item.pricePerUnit}
                          onChange={(e) => updateMaterialItem(item.id, 'pricePerUnit', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <div>
                        <Label>Aufschlag %</Label>
                        <Input
                          type="number"
                          value={item.markup}
                          onChange={(e) => updateMaterialItem(item.id, 'markup', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <div>
                        <Label>Gesamt</Label>
                        <div className="font-bold">
                          {formatCurrency(item.quantity * item.pricePerUnit * (1 + item.markup / 100))}
                        </div>
                      </div>
                      <div>
                        <Label>Schätzung</Label>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            checked={item.isEstimate}
                            onCheckedChange={(checked) => updateMaterialItem(item.id, 'isEstimate', checked)}
                          />
                          <span className="text-sm text-gray-600">
                            {item.isEstimate ? 'Schätzung' : 'Bestätigt'}
                          </span>
                        </div>
                      </div>
                      <div>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => removeMaterialItem(item.id)}
                          className="text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {calculation.materials.length === 0 && (
                <div className="text-center text-gray-500 py-8">
                  Noch keine Materialien hinzugefügt. Klicken Sie auf "Material hinzufügen" um zu beginnen.
                </div>
              )}
            </div>

            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="font-semibold">Gesamte Materialkosten:</span>
                <span className="text-xl font-bold text-blue-600">
                  {formatCurrency(calculation.materialCosts)}
                </span>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="labor" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Arbeitszeit & Lohnkosten</h3>
              <Button onClick={addLaborItem} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Arbeitsposition hinzufügen
              </Button>
            </div>

            <div className="space-y-4">
              {calculation.labor.map((item) => (
                <Card key={item.id}>
                  <CardContent className="p-4">
                    <div className="grid grid-cols-7 gap-4 items-center">
                      <div className="col-span-2">
                        <Label>Arbeitsposition</Label>
                        <Input
                          value={item.description}
                          onChange={(e) => updateLaborItem(item.id, 'description', e.target.value)}
                          placeholder="z.B. Fliesen verlegen"
                        />
                      </div>
                      <div>
                        <Label>Stunden</Label>
                        <Input
                          type="number"
                          step="0.5"
                          value={item.hours}
                          onChange={(e) => updateLaborItem(item.id, 'hours', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <div>
                        <Label>Personen</Label>
                        <Input
                          type="number"
                          value={item.workers}
                          onChange={(e) => updateLaborItem(item.id, 'workers', parseInt(e.target.value) || 1)}
                        />
                      </div>
                      <div>
                        <Label>€/Stunde</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={item.hourlyRate}
                          onChange={(e) => updateLaborItem(item.id, 'hourlyRate', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <div>
                        <Label>Gesamt</Label>
                        <div className="font-bold">
                          {formatCurrency(item.hours * item.workers * item.hourlyRate)}
                        </div>
                      </div>
                      <div>
                        <Label>Schätzung</Label>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            checked={item.isEstimate}
                            onCheckedChange={(checked) => updateLaborItem(item.id, 'isEstimate', checked)}
                          />
                          <span className="text-sm text-gray-600">
                            {item.isEstimate ? 'Schätzung' : 'Bestätigt'}
                          </span>
                        </div>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => removeLaborItem(item.id)}
                          className="text-red-600 mt-2"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {calculation.labor.length === 0 && (
                <div className="text-center text-gray-500 py-8">
                  Noch keine Arbeitspositionen hinzugefügt.
                </div>
              )}
            </div>

            <div className="bg-green-50 p-4 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="font-semibold">Gesamte Lohnkosten:</span>
                <span className="text-xl font-bold text-green-600">
                  {formatCurrency(calculation.laborCosts)}
                </span>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="subcontractors" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Fremdleistungen & Subunternehmer</h3>
              <Button onClick={addSubcontractorItem} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Fremdleistung hinzufügen
              </Button>
            </div>

            <div className="space-y-4">
              {calculation.subcontractors.map((item) => (
                <Card key={item.id}>
                  <CardContent className="p-4">
                    <div className="grid grid-cols-4 gap-4 items-center">
                      <div className="col-span-2">
                        <Label>Leistung</Label>
                        <Input
                          value={item.description}
                          onChange={(e) => updateSubcontractorItem(item.id, 'description', e.target.value)}
                          placeholder="z.B. Elektroinstallation"
                        />
                      </div>
                      <div>
                        <Label>Anbieter</Label>
                        <Input
                          value={item.supplier}
                          onChange={(e) => updateSubcontractorItem(item.id, 'supplier', e.target.value)}
                          placeholder="Firma/Name"
                        />
                      </div>
                      <div>
                        <Label>Kosten</Label>
                        <div className="flex gap-2">
                          <Input
                            type="number"
                            step="0.01"
                            value={item.cost}
                            onChange={(e) => updateSubcontractorItem(item.id, 'cost', parseFloat(e.target.value) || 0)}
                          />
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => removeSubcontractorItem(item.id)}
                            className="text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {calculation.subcontractors.length === 0 && (
                <div className="text-center text-gray-500 py-8">
                  Noch keine Fremdleistungen hinzugefügt.
                </div>
              )}
            </div>

            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="font-semibold">Gesamte Fremdleistungen:</span>
                <span className="text-xl font-bold text-purple-600">
                  {formatCurrency(calculation.subcontractorCosts)}
                </span>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="costs" className="space-y-4">
            <h3 className="text-lg font-semibold">Zusatzkosten & Zuschläge</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Fahrtkosten</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Beschreibung</Label>
                    <Input
                      value={calculation.travelDescription}
                      onChange={(e) => setCalculation(prev => ({ ...prev, travelDescription: e.target.value }))}
                      placeholder="z.B. 50km Anfahrt × 2 Fahrten"
                    />
                  </div>
                  <div>
                    <Label>Kosten</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={calculation.travelCosts}
                      onChange={(e) => setCalculation(prev => ({ ...prev, travelCosts: parseFloat(e.target.value) || 0 }))}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Zuschläge & Margen</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Sicherheitszuschlag (%)</Label>
                    <Input
                      type="number"
                      value={calculation.safetyBuffer}
                      onChange={(e) => setCalculation(prev => ({ ...prev, safetyBuffer: parseFloat(e.target.value) || 0 }))}
                    />
                    <div className="text-sm text-gray-500 mt-1">
                      Üblich: 5-15% für unvorhergesehene Kosten
                    </div>
                  </div>
                  <div>
                    <Label>Gewinnmarge (%)</Label>
                    <Input
                      type="number"
                      value={calculation.profitMargin}
                      onChange={(e) => setCalculation(prev => ({ ...prev, profitMargin: parseFloat(e.target.value) || 0 }))}
                    />
                    <div className="text-sm text-gray-500 mt-1">
                      Üblich: 15-25% je nach Wettbewerb
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Notizen & Bemerkungen</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={calculation.notes}
                  onChange={(e) => setCalculation(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Zusätzliche Hinweise zur Kalkulation..."
                  rows={4}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="summary" className="space-y-4">
            <h3 className="text-lg font-semibold">Kalkulationsergebnis</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Kostenaufstellung</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span>Materialkosten:</span>
                    <span className="font-medium">{formatCurrency(calculation.materialCosts)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Lohnkosten:</span>
                    <span className="font-medium">{formatCurrency(calculation.laborCosts)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Fremdleistungen:</span>
                    <span className="font-medium">{formatCurrency(calculation.subcontractorCosts)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Fahrtkosten:</span>
                    <span className="font-medium">{formatCurrency(calculation.travelCosts)}</span>
                  </div>
                  <hr />
                  <div className="flex justify-between font-semibold">
                    <span>Grundkosten:</span>
                    <span>{formatCurrency(calculation.totalBaseCosts)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>+ Sicherheit ({calculation.safetyBuffer}%):</span>
                    <span>{formatCurrency(calculation.totalCostsWithBuffer - calculation.totalBaseCosts)}</span>
                  </div>
                  <div className="flex justify-between font-semibold">
                    <span>Kosten mit Puffer:</span>
                    <span>{formatCurrency(calculation.totalCostsWithBuffer)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>+ Gewinn ({calculation.profitMargin}%):</span>
                    <span>{formatCurrency(calculation.finalPrice - calculation.totalCostsWithBuffer)}</span>
                  </div>
                  <hr className="border-2" />
                  <div className="flex justify-between text-xl font-bold text-green-600">
                    <span>Verkaufspreis:</span>
                    <span>{formatCurrency(calculation.finalPrice)}</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Kennzahlen</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span>Materialanteil:</span>
                    <span>{((calculation.materialCosts / calculation.totalBaseCosts) * 100 || 0).toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Lohnanteil:</span>
                    <span>{((calculation.laborCosts / calculation.totalBaseCosts) * 100 || 0).toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Fremdleistungsanteil:</span>
                    <span>{((calculation.subcontractorCosts / calculation.totalBaseCosts) * 100 || 0).toFixed(1)}%</span>
                  </div>
                  <hr />
                  <div className="flex justify-between">
                    <span>Deckungsbeitrag:</span>
                    <span className="font-medium">{formatCurrency(calculation.finalPrice - calculation.totalBaseCosts)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Deckungsgrad:</span>
                    <span>{((calculation.finalPrice / calculation.totalBaseCosts - 1) * 100 || 0).toFixed(1)}%</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {calculation.notes && (
              <Card>
                <CardHeader>
                  <CardTitle>Notizen</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="whitespace-pre-wrap text-sm">{calculation.notes}</div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        <div className="flex justify-between pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Abbrechen
          </Button>
          <div className="flex gap-2">
            <Button onClick={saveCalculation} className="flex items-center gap-2">
              <Save className="h-4 w-4" />
              Kalkulation speichern
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PreCalculationDialog;