import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Package, 
  AlertTriangle, 
  TrendingDown, 
  TrendingUp, 
  Plus, 
  Search, 
  Truck, 
  Edit,
  Trash2,
  Users,
  ClipboardList,
  BarChart3,
  ShoppingCart,
  UserCheck,
  Building2,
  Eye,
  BookOpen
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";
import { toast } from "sonner";
import MaterialAssignmentDialog from "./MaterialAssignmentDialog";
import MaterialPricesModule from "./MaterialPricesModule";

interface Material {
  id: string;
  name: string;
  description?: string;
  category: string;
  unit: string;
  current_stock: number;
  min_stock: number;
  max_stock: number;
  unit_price: number;
  supplier_id?: string;
  supplier_name?: string;
  supplier_article_number?: string;
  storage_location?: string;
  barcode?: string;
  is_active: boolean;
}

interface Supplier {
  id: string;
  name: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  address?: string;
}

interface Project {
  id: string;
  name: string;
  status: string;
}

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

interface MaterialUsage {
  id: string;
  material_name: string;
  employee_name: string;
  project_name: string;
  quantity_used: number;
  unit: string;
  usage_date: string;
  notes?: string;
}

const MaterialModuleEnhanced = () => {
  const { user, companyId } = useSupabaseAuth();
  
  // States
  const [activeTab, setActiveTab] = useState('inventory');
  const [materials, setMaterials] = useState<Material[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [materialUsage, setMaterialUsage] = useState<MaterialUsage[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Dialog states
  const [showAddMaterialDialog, setShowAddMaterialDialog] = useState(false);
  const [showEditMaterialDialog, setShowEditMaterialDialog] = useState(false);
  const [showUsageDialog, setShowUsageDialog] = useState(false);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [showMaterialAssignmentDialog, setShowMaterialAssignmentDialog] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  
  // Form states
  const [materialForm, setMaterialForm] = useState({
    name: '',
    description: '',
    category: '',
    unit: 'Stk',
    current_stock: 0,
    min_stock: 0,
    max_stock: 0,
    unit_price: 0,
    supplier_id: '',
    storage_location: ''
  });
  
  const [usageForm, setUsageForm] = useState({
    material_id: '',
    employee_id: '',
    project_id: '',
    quantity_used: 0,
    notes: ''
  });

  // Fetch all data
  useEffect(() => {
    if (companyId) {
      fetchAllData();
    }
  }, [companyId]);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchMaterials(),
        fetchSuppliers(),
        fetchProjects(),
        fetchEmployees(),
        fetchMaterialUsage()
      ]);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Fehler beim Laden der Daten');
    } finally {
      setLoading(false);
    }
  };

  const fetchMaterials = async () => {
    const { data, error } = await supabase
      .from('materials')
      .select(`
        *,
        suppliers:supplier_id (
          id,
          name
        )
      `)
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('name');

    if (error) {
      console.error('Error fetching materials:', error);
      return;
    }

    const formattedMaterials = data?.map((material: any) => ({
      ...material,
      supplier_name: material.suppliers?.name || 'Kein Lieferant'
    })) || [];

    setMaterials(formattedMaterials);
  };

  const fetchSuppliers = async () => {
    const { data, error } = await supabase
      .from('suppliers')
      .select('*')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('name');

    if (error) {
      console.error('Error fetching suppliers:', error);
      return;
    }

    setSuppliers(data || []);
  };

  const fetchProjects = async () => {
    const { data, error } = await supabase
      .from('projects')
      .select('id, name, status')
      .eq('company_id', companyId)
      .order('name');

    if (error) {
      console.error('Error fetching projects:', error);
      return;
    }

    setProjects(data || []);
  };

  const fetchEmployees = async () => {
    const { data, error } = await supabase
      .from('employees')
      .select('id, first_name, last_name, email')
      .eq('company_id', companyId)
      .eq('status', 'active')
      .order('first_name');

    if (error) {
      console.error('Error fetching employees:', error);
      return;
    }

    setEmployees(data || []);
  };

  const fetchMaterialUsage = async () => {
    const { data, error } = await supabase
      .from('employee_material_usage')
      .select(`
        *,
        materials:material_id (name, unit),
        employees:employee_id (first_name, last_name),
        projects:project_id (name)
      `)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Error fetching material usage:', error);
      return;
    }

    const formattedUsage = data?.map((usage: any) => ({
      ...usage,
      material_name: usage.materials?.name || 'Unbekannt',
      employee_name: `${usage.employees?.first_name} ${usage.employees?.last_name}`,
      project_name: usage.projects?.name || 'Unbekannt',
      unit: usage.materials?.unit || 'Stk'
    })) || [];

    setMaterialUsage(formattedUsage);
  };

  // CRUD Operations
  const createMaterial = async () => {
    try {
      const { error } = await supabase
        .from('materials')
        .insert({
          ...materialForm,
          company_id: companyId,
          created_by: user?.id
        });

      if (error) throw error;

      toast.success('Material wurde erfolgreich erstellt');
      setShowAddMaterialDialog(false);
      resetMaterialForm();
      fetchMaterials();
    } catch (error) {
      console.error('Error creating material:', error);
      toast.error('Fehler beim Erstellen des Materials');
    }
  };

  const updateMaterial = async () => {
    if (!selectedMaterial) return;

    try {
      const { error } = await supabase
        .from('materials')
        .update({
          ...materialForm,
          updated_at: new Date().toISOString(),
          updated_by: user?.id
        })
        .eq('id', selectedMaterial.id);

      if (error) throw error;

      toast.success('Material wurde erfolgreich aktualisiert');
      setShowEditMaterialDialog(false);
      setSelectedMaterial(null);
      resetMaterialForm();
      fetchMaterials();
    } catch (error) {
      console.error('Error updating material:', error);
      toast.error('Fehler beim Aktualisieren des Materials');
    }
  };

  const deleteMaterial = async (materialId: string) => {
    try {
      const { error } = await supabase
        .from('materials')
        .update({ is_active: false })
        .eq('id', materialId);

      if (error) throw error;

      toast.success('Material wurde erfolgreich gelöscht');
      fetchMaterials();
    } catch (error) {
      console.error('Error deleting material:', error);
      toast.error('Fehler beim Löschen des Materials');
    }
  };

  const recordMaterialUsage = async () => {
    try {
      const { error } = await supabase
        .from('employee_material_usage')
        .insert({
          ...usageForm,
          usage_date: new Date().toISOString().split('T')[0],
          created_by: user?.id
        });

      if (error) throw error;

      toast.success('Materialverbrauch wurde erfolgreich erfasst');
      setShowUsageDialog(false);
      resetUsageForm();
      fetchMaterialUsage();
      fetchMaterials(); // Refresh to update stock
    } catch (error) {
      console.error('Error recording material usage:', error);
      toast.error('Fehler beim Erfassen des Materialverbrauchs');
    }
  };

  const assignMaterialToProject = async (projectId: string, materialId: string, quantity: number) => {
    try {
      const { error } = await supabase
        .from('project_material_assignments')
        .upsert({
          project_id: projectId,
          material_id: materialId,
          assigned_quantity: quantity,
          assigned_by: user?.id
        });

      if (error) throw error;

      toast.success('Material wurde dem Projekt zugewiesen');
      setShowAssignDialog(false);
    } catch (error) {
      console.error('Error assigning material to project:', error);
      toast.error('Fehler beim Zuweisen des Materials');
    }
  };

  // Helper functions
  const resetMaterialForm = () => {
    setMaterialForm({
      name: '',
      description: '',
      category: '',
      unit: 'Stk',
      current_stock: 0,
      min_stock: 0,
      max_stock: 0,
      unit_price: 0,
      supplier_id: '',
      storage_location: ''
    });
  };

  const resetUsageForm = () => {
    setUsageForm({
      material_id: '',
      employee_id: '',
      project_id: '',
      quantity_used: 0,
      notes: ''
    });
  };

  const editMaterial = (material: Material) => {
    setSelectedMaterial(material);
    setMaterialForm({
      name: material.name,
      description: material.description || '',
      category: material.category,
      unit: material.unit,
      current_stock: material.current_stock,
      min_stock: material.min_stock,
      max_stock: material.max_stock,
      unit_price: material.unit_price,
      supplier_id: material.supplier_id || '',
      storage_location: material.storage_location || ''
    });
    setShowEditMaterialDialog(true);
  };

  const getStatusColor = (current: number, min: number) => {
    if (current <= min * 0.5) return 'bg-red-100 text-red-800';
    if (current <= min) return 'bg-yellow-100 text-yellow-800';
    return 'bg-green-100 text-green-800';
  };

  const getStatusText = (current: number, min: number) => {
    if (current <= min * 0.5) return 'Kritisch';
    if (current <= min) return 'Niedrig';
    return 'Verfügbar';
  };

  const getStockPercentage = (current: number, max: number) => {
    return Math.min((current / max) * 100, 100);
  };

  const filteredMaterials = materials.filter(material =>
    material.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    material.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const lowStockMaterials = materials.filter(m => m.current_stock <= m.min_stock);
  const totalValue = materials.reduce((sum, m) => sum + (m.current_stock * m.unit_price), 0);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-4xl font-bold bg-gradient-to-r from-slate-800 to-red-600 bg-clip-text text-transparent flex items-center gap-3">
            <Package className="h-8 w-8 text-red-600" />
            Materialwirtschaft
          </h2>
          <p className="text-gray-600">Vollständige Material- und Lagerverwaltung</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowAddMaterialDialog(true)}>
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
                <p className="text-sm font-medium text-muted-foreground">Materialien</p>
                <p className="text-2xl font-bold">{materials.length}</p>
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
                <p className="text-2xl font-bold">€{totalValue.toLocaleString('de-DE', { maximumFractionDigits: 0 })}</p>
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
                <p className="text-2xl font-bold">{lowStockMaterials.length}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Verbrauch (30 Tage)</p>
                <p className="text-2xl font-bold">{materialUsage.length}</p>
              </div>
              <BarChart3 className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="inventory">Lagerbestand</TabsTrigger>
          <TabsTrigger value="usage">Verbrauch</TabsTrigger>
          <TabsTrigger value="assignments">Zuweisungen</TabsTrigger>
          <TabsTrigger value="prices">Preise</TabsTrigger>
          <TabsTrigger value="analytics">Analysen</TabsTrigger>
        </TabsList>

        <TabsContent value="inventory" className="space-y-6 min-h-[600px]">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input 
                  placeholder="Material suchen..." 
                  className="pl-10 w-64" 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Button 
                variant="outline"
                onClick={() => setShowUsageDialog(true)}
              >
                <BookOpen className="h-4 w-4 mr-2" />
                Verbrauch erfassen
              </Button>
            </div>
          </div>

          <div className="grid gap-4">
            {filteredMaterials.map((material) => (
              <Card key={material.id} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="text-lg font-semibold">{material.name}</h4>
                        <Badge className={getStatusColor(material.current_stock, material.min_stock)}>
                          {getStatusText(material.current_stock, material.min_stock)}
                        </Badge>
                      </div>
                      <p className="text-gray-600 mb-2">{material.category}</p>
                      <p className="text-sm text-gray-500">{material.description}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-blue-600">€{material.unit_price.toFixed(2)}/{material.unit}</p>
                      <p className="text-sm text-gray-500">{material.supplier_name}</p>
                    </div>
                  </div>

                  <div className="space-y-3 mb-4">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Lagerbestand</span>
                        <span>{material.current_stock} {material.unit} / {material.max_stock} {material.unit}</span>
                      </div>
                      <Progress 
                        value={getStockPercentage(material.current_stock, material.max_stock)} 
                        className="h-2"
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-gray-500">Mindestbestand:</p>
                        <p>{material.min_stock} {material.unit}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Lagerwert:</p>
                        <p>€{(material.current_stock * material.unit_price).toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Lagerort:</p>
                        <p>{material.storage_location || 'Nicht angegeben'}</p>
                      </div>
                    </div>
                  </div>

                  {material.current_stock <= material.min_stock && (
                    <div className="mb-4 p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <div className="flex items-center gap-2 text-yellow-800">
                        <AlertTriangle className="h-4 w-4" />
                        <span className="text-sm font-medium">
                          Bestand unter Mindestmenge! Nachbestellung empfohlen.
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => editMaterial(material)}
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Bearbeiten
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedMaterial(material);
                        setShowMaterialAssignmentDialog(true);
                      }}
                    >
                      <UserCheck className="h-4 w-4 mr-1" />
                      Zuweisen
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-600 hover:text-red-700"
                      onClick={() => deleteMaterial(material.id)}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Löschen
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="usage" className="space-y-6 min-h-[600px]">
          <Card>
            <CardHeader>
              <CardTitle>Materialverbrauch</CardTitle>
              <CardDescription>Übersicht über den Materialverbrauch der letzten 50 Einträge</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {materialUsage.map((usage) => (
                  <div key={usage.id} className="flex justify-between items-center p-4 border rounded-lg">
                    <div className="flex-1">
                      <h4 className="font-medium">{usage.material_name}</h4>
                      <p className="text-sm text-gray-600">
                        {usage.employee_name} • {usage.project_name}
                      </p>
                      <p className="text-xs text-gray-500">{new Date(usage.usage_date).toLocaleDateString('de-DE')}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{usage.quantity_used} {usage.unit}</p>
                      {usage.notes && <p className="text-sm text-gray-600">{usage.notes}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="assignments" className="space-y-6 min-h-[600px]">
          <Card>
            <CardHeader>
              <CardTitle>Projekt-Zuweisungen</CardTitle>
              <CardDescription>Materialzuweisungen zu Projekten verwalten</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-gray-500">
                <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Projekt-Zuweisungen werden hier angezeigt</p>
                <p className="text-sm">Funktion wird in Kürze erweitert</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6 min-h-[600px]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Bestandsanalyse</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <span>Materialien mit niedrigem Bestand:</span>
                    <span className="font-bold text-red-600">{lowStockMaterials.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Durchschnittlicher Lagerwert pro Material:</span>
                    <span className="font-bold">€{materials.length > 0 ? (totalValue / materials.length).toFixed(2) : 0}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Verbrauchsanalyse</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-gray-500">
                  <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Detaillierte Verbrauchsanalysen</p>
                  <p className="text-sm">Werden in Kürze erweitert</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="prices" className="space-y-6 min-h-[600px]">
          <MaterialPricesModule />
        </TabsContent>
      </Tabs>

      {/* Add Material Dialog */}
      <Dialog open={showAddMaterialDialog} onOpenChange={setShowAddMaterialDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Material hinzufügen</DialogTitle>
            <DialogDescription>
              Fügen Sie ein neues Material zu Ihrem Lager hinzu
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Name *</label>
              <Input
                value={materialForm.name}
                onChange={(e) => setMaterialForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Material-Name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Kategorie</label>
              <Select
                value={materialForm.category}
                onValueChange={(value) => setMaterialForm(prev => ({ ...prev, category: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Kategorie wählen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Kabel & Leitungen">Kabel & Leitungen</SelectItem>
                  <SelectItem value="Installationsmaterial">Installationsmaterial</SelectItem>
                  <SelectItem value="Schaltgeräte">Schaltgeräte</SelectItem>
                  <SelectItem value="Werkzeuge">Werkzeuge</SelectItem>
                  <SelectItem value="Sonstiges">Sonstiges</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Einheit *</label>
              <Select
                value={materialForm.unit}
                onValueChange={(value) => setMaterialForm(prev => ({ ...prev, unit: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Einheit" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Stk">Stück</SelectItem>
                  <SelectItem value="m">Meter</SelectItem>
                  <SelectItem value="kg">Kilogramm</SelectItem>
                  <SelectItem value="l">Liter</SelectItem>
                  <SelectItem value="m²">Quadratmeter</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Preis pro Einheit (€)</label>
              <Input
                type="number"
                step="0.01"
                value={materialForm.unit_price}
                onChange={(e) => setMaterialForm(prev => ({ ...prev, unit_price: parseFloat(e.target.value) || 0 }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Aktueller Bestand</label>
              <Input
                type="number"
                value={materialForm.current_stock}
                onChange={(e) => setMaterialForm(prev => ({ ...prev, current_stock: parseFloat(e.target.value) || 0 }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Mindestbestand</label>
              <Input
                type="number"
                value={materialForm.min_stock}
                onChange={(e) => setMaterialForm(prev => ({ ...prev, min_stock: parseFloat(e.target.value) || 0 }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Maximalbestand</label>
              <Input
                type="number"
                value={materialForm.max_stock}
                onChange={(e) => setMaterialForm(prev => ({ ...prev, max_stock: parseFloat(e.target.value) || 0 }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Lieferant</label>
              <Select
                value={materialForm.supplier_id}
                onValueChange={(value) => setMaterialForm(prev => ({ ...prev, supplier_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Lieferant wählen" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map(supplier => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-2">Beschreibung</label>
              <Textarea
                value={materialForm.description}
                onChange={(e) => setMaterialForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Beschreibung des Materials..."
                rows={3}
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-2">Lagerort</label>
              <Input
                value={materialForm.storage_location}
                onChange={(e) => setMaterialForm(prev => ({ ...prev, storage_location: e.target.value }))}
                placeholder="z.B. Lager A, Regal 1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddMaterialDialog(false)}>
              Abbrechen
            </Button>
            <Button onClick={createMaterial} disabled={!materialForm.name}>
              Material erstellen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Material Dialog */}
      <Dialog open={showEditMaterialDialog} onOpenChange={setShowEditMaterialDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Material bearbeiten</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            {/* Same form fields as Add Dialog but with update function */}
            <div>
              <label className="block text-sm font-medium mb-2">Name *</label>
              <Input
                value={materialForm.name}
                onChange={(e) => setMaterialForm(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Aktueller Bestand</label>
              <Input
                type="number"
                value={materialForm.current_stock}
                onChange={(e) => setMaterialForm(prev => ({ ...prev, current_stock: parseFloat(e.target.value) || 0 }))}
              />
            </div>
            {/* Add other fields as needed */}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditMaterialDialog(false)}>
              Abbrechen
            </Button>
            <Button onClick={updateMaterial}>
              Aktualisieren
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Material Usage Dialog */}
      <Dialog open={showUsageDialog} onOpenChange={setShowUsageDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Materialverbrauch erfassen</DialogTitle>
            <DialogDescription>
              Erfassen Sie den Verbrauch von Material durch einen Mitarbeiter
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Material</label>
              <Select
                value={usageForm.material_id}
                onValueChange={(value) => setUsageForm(prev => ({ ...prev, material_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Material wählen" />
                </SelectTrigger>
                <SelectContent>
                  {materials.map(material => (
                    <SelectItem key={material.id} value={material.id}>
                      {material.name} ({material.current_stock} {material.unit} verfügbar)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Mitarbeiter</label>
              <Select
                value={usageForm.employee_id}
                onValueChange={(value) => setUsageForm(prev => ({ ...prev, employee_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Mitarbeiter wählen" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map(employee => (
                    <SelectItem key={employee.id} value={employee.id}>
                      {employee.first_name} {employee.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Projekt</label>
              <Select
                value={usageForm.project_id}
                onValueChange={(value) => setUsageForm(prev => ({ ...prev, project_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Projekt wählen" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map(project => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Verbrauchte Menge</label>
              <Input
                type="number"
                step="0.1"
                value={usageForm.quantity_used}
                onChange={(e) => setUsageForm(prev => ({ ...prev, quantity_used: parseFloat(e.target.value) || 0 }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Notizen (optional)</label>
              <Textarea
                value={usageForm.notes}
                onChange={(e) => setUsageForm(prev => ({ ...prev, notes: e.target.value }))}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUsageDialog(false)}>
              Abbrechen
            </Button>
            <Button 
              onClick={recordMaterialUsage}
              disabled={!usageForm.material_id || !usageForm.employee_id || !usageForm.project_id || !usageForm.quantity_used}
            >
              Verbrauch erfassen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Material Assignment Dialog */}
      <MaterialAssignmentDialog
        isOpen={showMaterialAssignmentDialog}
        onClose={() => setShowMaterialAssignmentDialog(false)}
        selectedMaterial={selectedMaterial}
        onAssignmentComplete={() => {
          fetchMaterials(); // Refresh materials to update stock
          fetchMaterialUsage(); // Refresh usage data
        }}
      />
    </div>
  );
};

export default MaterialModuleEnhanced;