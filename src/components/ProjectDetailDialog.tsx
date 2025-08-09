
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, Calendar, Users, Package, Clock, Euro, Wrench, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Project {
  id: string;
  name: string;
  customer: string;
  status: string;
  progress: number;
  startDate: string;
  endDate: string;
  budget: string;
  team: string[];
  location: string;
}

interface WorkHour {
  id: string;
  employee_name: string;
  work_date: string;
  hours_worked: number;
  work_description: string;
}

interface MaterialPurchase {
  id: string;
  material_name: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total_price: number;
  purchase_date: string;
  supplier: string;
}

interface MaterialUsage {
  id: string;
  material_name: string;
  quantity_used: number;
  unit: string;
  usage_date: string;
  used_by_employee: string;
  notes: string;
}

interface ProjectDetailDialogProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project | null;
}

const ProjectDetailDialog = ({ isOpen, onClose, project }: ProjectDetailDialogProps) => {
  const { toast } = useToast();
  const [workHours, setWorkHours] = useState<WorkHour[]>([]);
  const [materialPurchases, setMaterialPurchases] = useState<MaterialPurchase[]>([]);
  const [materialUsage, setMaterialUsage] = useState<MaterialUsage[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchProjectData = async () => {
    if (!project) return;
    
    setLoading(true);
    try {
      // Arbeitsstunden laden
      const { data: hoursData, error: hoursError } = await supabase
        .from('project_work_hours')
        .select('*')
        .eq('project_id', project.id)
        .order('work_date', { ascending: false });

      if (hoursError) throw hoursError;
      setWorkHours(hoursData || []);

      // Materialeinkäufe laden
      const { data: purchasesData, error: purchasesError } = await supabase
        .from('project_material_purchases')
        .select('*')
        .eq('project_id', project.id)
        .order('purchase_date', { ascending: false });

      if (purchasesError) throw purchasesError;
      setMaterialPurchases(purchasesData || []);

      // Materialverbrauch laden
      const { data: usageData, error: usageError } = await supabase
        .from('project_material_usage')
        .select('*')
        .eq('project_id', project.id)
        .order('usage_date', { ascending: false });

      if (usageError) throw usageError;
      setMaterialUsage(usageData || []);

    } catch (error) {
      console.error('Fehler beim Laden der Projektdaten:', error);
      toast({
        title: "Fehler",
        description: "Projektdaten konnten nicht geladen werden.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && project) {
      fetchProjectData();
    }
  }, [isOpen, project]);

  if (!project) return null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'In Bearbeitung': return 'bg-yellow-100 text-yellow-800';
      case 'Abgeschlossen': return 'bg-green-100 text-green-800';
      case 'Planung': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Arbeitsstunden nach Mitarbeiter gruppieren
  const groupedWorkHours = workHours.reduce((acc, hour) => {
    if (!acc[hour.employee_name]) {
      acc[hour.employee_name] = [];
    }
    acc[hour.employee_name].push(hour);
    return acc;
  }, {} as Record<string, WorkHour[]>);

  // Gesamtstunden berechnen
  const totalHours = workHours.reduce((sum, hour) => sum + hour.hours_worked, 0);
  const totalMaterialCosts = materialPurchases.reduce((sum, purchase) => sum + purchase.total_price, 0);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl min-h-[80vh] max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            {project.name} - Details
          </DialogTitle>
          <DialogDescription>
            Detaillierte Projektinformationen, Arbeitsstunden und Materialverbrauch
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Projekt Übersicht */}
          <Card>
            <CardHeader>
              <CardTitle>Projekt Übersicht</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Kunde</p>
                  <p className="font-medium">{project.customer}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Status</p>
                  <Badge className={getStatusColor(project.status)}>
                    {project.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Budget</p>
                  <p className="font-medium text-green-600">{project.budget}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Standort</p>
                  <p className="font-medium">{project.location}</p>
                </div>
              </div>
              <div className="mt-4">
                <div className="flex justify-between text-sm mb-1">
                  <span>Fortschritt</span>
                  <span>{project.progress}%</span>
                </div>
                <Progress value={project.progress} className="h-2" />
              </div>
            </CardContent>
          </Card>

          {/* Statistiken */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Gesamte Arbeitsstunden</p>
                    <p className="text-2xl font-bold">{totalHours.toFixed(1)} h</p>
                  </div>
                  <Clock className="h-8 w-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Materialkosten</p>
                    <p className="text-2xl font-bold">€{totalMaterialCosts.toFixed(2)}</p>
                  </div>
                  <Euro className="h-8 w-8 text-green-600" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Mitarbeiter</p>
                    <p className="text-2xl font-bold">{Object.keys(groupedWorkHours).length}</p>
                  </div>
                  <Users className="h-8 w-8 text-purple-600" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Detaillierte Tabs */}
          <Tabs defaultValue="work-hours" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="work-hours">Arbeitsstunden</TabsTrigger>
              <TabsTrigger value="material-purchases">Materialeinkäufe</TabsTrigger>
              <TabsTrigger value="material-usage">Materialverbrauch</TabsTrigger>
            </TabsList>

            <TabsContent value="work-hours" className="space-y-4 min-h-[400px]">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Arbeitsstunden nach Mitarbeiter
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {Object.entries(groupedWorkHours).map(([employeeName, hours]) => (
                    <div key={employeeName} className="mb-6 p-4 border rounded-lg">
                      <h4 className="font-semibold mb-3">{employeeName}</h4>
                      <div className="space-y-2">
                        {hours.map((hour) => (
                          <div key={hour.id} className="flex justify-between items-start p-2 bg-gray-50 rounded">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <Calendar className="h-4 w-4 text-gray-400" />
                                <span className="text-sm font-medium">{hour.work_date}</span>
                                <Badge variant="outline">{hour.hours_worked}h</Badge>
                              </div>
                              {hour.work_description && (
                                <p className="text-sm text-gray-600">{hour.work_description}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-2 pt-2 border-t">
                        <span className="text-sm font-medium">
                          Gesamt: {hours.reduce((sum, h) => sum + h.hours_worked, 0).toFixed(1)} Stunden
                        </span>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="material-purchases" className="space-y-4 min-h-[400px]">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    Materialeinkäufe
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {materialPurchases.map((purchase) => (
                      <div key={purchase.id} className="p-4 border rounded-lg">
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-semibold">{purchase.material_name}</h4>
                          <Badge className="bg-green-100 text-green-800">
                            €{purchase.total_price.toFixed(2)}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                          <div>
                            <span className="text-gray-500">Menge:</span>
                            <span className="ml-1">{purchase.quantity} {purchase.unit}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Einheitspreis:</span>
                            <span className="ml-1">€{purchase.unit_price.toFixed(2)}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Datum:</span>
                            <span className="ml-1">{purchase.purchase_date}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Lieferant:</span>
                            <span className="ml-1">{purchase.supplier || 'Nicht angegeben'}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="material-usage" className="space-y-4 min-h-[400px]">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Wrench className="h-5 w-5" />
                    Materialverbrauch
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {materialUsage.map((usage) => (
                      <div key={usage.id} className="p-4 border rounded-lg">
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-semibold">{usage.material_name}</h4>
                          <Badge variant="outline">
                            {usage.quantity_used} {usage.unit}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm mb-2">
                          <div>
                            <span className="text-gray-500">Verwendet von:</span>
                            <span className="ml-1">{usage.used_by_employee}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Datum:</span>
                            <span className="ml-1">{usage.usage_date}</span>
                          </div>
                        </div>
                        {usage.notes && (
                          <div className="text-sm">
                            <span className="text-gray-500">Notizen:</span>
                            <p className="mt-1 text-gray-600">{usage.notes}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <div className="flex justify-end pt-4">
          <Button onClick={onClose}>Schließen</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProjectDetailDialog;
