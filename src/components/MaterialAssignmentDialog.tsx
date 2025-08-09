import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, UserCheck, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";
import { toast } from "sonner";

interface Material {
  id: string;
  name: string;
  current_stock: number;
  unit: string;
  category: string;
}

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

interface Project {
  id: string;
  name: string;
}

interface MaterialAssignment {
  id: string;
  material_name: string;
  employee_name: string;
  project_name: string;
  assigned_quantity: number;
  used_quantity: number;
  unit: string;
  assigned_at: string;
  notes?: string;
}

interface MaterialAssignmentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  selectedMaterial?: Material | null;
  onAssignmentComplete?: () => void;
}

const MaterialAssignmentDialog: React.FC<MaterialAssignmentDialogProps> = ({
  isOpen,
  onClose,
  selectedMaterial,
  onAssignmentComplete
}) => {
  const { user, companyId } = useSupabaseAuth();
  const [activeTab, setActiveTab] = useState<'assign' | 'view'>('assign');
  
  // Form states
  const [materials, setMaterials] = useState<Material[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [assignments, setAssignments] = useState<MaterialAssignment[]>([]);
  
  const [assignmentForm, setAssignmentForm] = useState({
    material_id: selectedMaterial?.id || '',
    employee_id: '',
    project_id: '',
    assigned_quantity: 0,
    notes: ''
  });

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && companyId) {
      fetchData();
    }
  }, [isOpen, companyId]);

  useEffect(() => {
    if (selectedMaterial) {
      setAssignmentForm(prev => ({
        ...prev,
        material_id: selectedMaterial.id
      }));
    }
  }, [selectedMaterial]);

  const fetchData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchMaterials(),
        fetchEmployees(),
        fetchProjects(),
        fetchAssignments()
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
      .select('id, name, current_stock, unit, category')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('name');

    if (error) {
      console.error('Error fetching materials:', error);
      return;
    }

    setMaterials(data || []);
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

  const fetchProjects = async () => {
    const { data, error } = await supabase
      .from('projects')
      .select('id, name')
      .eq('company_id', companyId)
      .order('name');

    if (error) {
      console.error('Error fetching projects:', error);
      return;
    }

    setProjects(data || []);
  };

  const fetchAssignments = async () => {
    const { data, error } = await supabase
      .from('project_material_assignments')
      .select(`
        id,
        assigned_quantity,
        used_quantity,
        assigned_at,
        notes,
        materials:material_id (name, unit),
        employees:assigned_by (first_name, last_name),
        projects:project_id (name)
      `)
      .order('assigned_at', { ascending: false })
      .limit(20);

    if (error) {
      console.error('Error fetching assignments:', error);
      return;
    }

    const formattedAssignments = data?.map((assignment: any) => ({
      ...assignment,
      material_name: assignment.materials?.name || 'Unbekannt',
      employee_name: `${assignment.employees?.first_name || ''} ${assignment.employees?.last_name || ''}`.trim() || 'Unbekannt',
      project_name: assignment.projects?.name || 'Unbekannt',
      unit: assignment.materials?.unit || 'Stk'
    })) || [];

    setAssignments(formattedAssignments);
  };

  const handleAssignment = async () => {
    if (!assignmentForm.material_id || !assignmentForm.employee_id || !assignmentForm.project_id || !assignmentForm.assigned_quantity) {
      toast.error('Bitte füllen Sie alle Pflichtfelder aus');
      return;
    }

    // Check if enough stock is available
    const selectedMaterialData = materials.find(m => m.id === assignmentForm.material_id);
    if (selectedMaterialData && assignmentForm.assigned_quantity > selectedMaterialData.current_stock) {
      toast.error(`Nicht genügend Bestand verfügbar. Verfügbar: ${selectedMaterialData.current_stock} ${selectedMaterialData.unit}`);
      return;
    }

    try {
      setLoading(true);

      // Insert assignment record
      const { error: assignmentError } = await supabase
        .from('project_material_assignments')
        .upsert({
          project_id: assignmentForm.project_id,
          material_id: assignmentForm.material_id,
          assigned_quantity: assignmentForm.assigned_quantity,
          assigned_by: user?.id,
          notes: assignmentForm.notes
        });

      if (assignmentError) throw assignmentError;

      // Create stock movement to reserve material
      const { error: stockError } = await supabase
        .from('material_stock_movements')
        .insert({
          material_id: assignmentForm.material_id,
          movement_type: 'out',
          reference_type: 'assignment',
          reference_id: assignmentForm.project_id,
          quantity: -assignmentForm.assigned_quantity, // Negative for outgoing
          employee_id: assignmentForm.employee_id,
          project_id: assignmentForm.project_id,
          reason: `Material zugewiesen an ${employees.find(e => e.id === assignmentForm.employee_id)?.first_name}`,
          created_by: user?.id
        });

      if (stockError) throw stockError;

      toast.success('Material wurde erfolgreich zugewiesen');
      
      // Reset form
      setAssignmentForm({
        material_id: selectedMaterial?.id || '',
        employee_id: '',
        project_id: '',
        assigned_quantity: 0,
        notes: ''
      });

      // Refresh data
      await fetchAssignments();
      
      if (onAssignmentComplete) {
        onAssignmentComplete();
      }

    } catch (error) {
      console.error('Error creating assignment:', error);
      toast.error('Fehler beim Zuweisen des Materials');
    } finally {
      setLoading(false);
    }
  };

  const selectedMaterialData = materials.find(m => m.id === assignmentForm.material_id);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Material-Zuweisung
          </DialogTitle>
          <DialogDescription>
            Weisen Sie Material einem Mitarbeiter für ein Projekt zu
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2 mb-4">
          <Button 
            variant={activeTab === 'assign' ? 'default' : 'outline'}
            onClick={() => setActiveTab('assign')}
          >
            Material zuweisen
          </Button>
          <Button 
            variant={activeTab === 'view' ? 'default' : 'outline'}
            onClick={() => setActiveTab('view')}
          >
            Zuweisungen anzeigen
          </Button>
        </div>

        {activeTab === 'assign' && (
          <div className="space-y-4">
            {/* Material Selection */}
            <div>
              <label className="block text-sm font-medium mb-2">Material *</label>
              <Select
                value={assignmentForm.material_id}
                onValueChange={(value) => setAssignmentForm(prev => ({ ...prev, material_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Material wählen" />
                </SelectTrigger>
                <SelectContent>
                  {materials.map(material => (
                    <SelectItem key={material.id} value={material.id}>
                      <div className="flex justify-between items-center w-full">
                        <span>{material.name}</span>
                        <Badge variant="outline" className="ml-2">
                          {material.current_stock} {material.unit}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedMaterialData && (
                <div className="mt-2 p-2 bg-blue-50 rounded-lg">
                  <p className="text-sm">
                    <strong>Verfügbar:</strong> {selectedMaterialData.current_stock} {selectedMaterialData.unit}
                  </p>
                  <p className="text-sm text-gray-600">
                    <strong>Kategorie:</strong> {selectedMaterialData.category}
                  </p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Employee Selection */}
              <div>
                <label className="block text-sm font-medium mb-2">Mitarbeiter *</label>
                <Select
                  value={assignmentForm.employee_id}
                  onValueChange={(value) => setAssignmentForm(prev => ({ ...prev, employee_id: value }))}
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

              {/* Project Selection */}
              <div>
                <label className="block text-sm font-medium mb-2">Projekt *</label>
                <Select
                  value={assignmentForm.project_id}
                  onValueChange={(value) => setAssignmentForm(prev => ({ ...prev, project_id: value }))}
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
            </div>

            {/* Quantity */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Menge * {selectedMaterialData && `(${selectedMaterialData.unit})`}
              </label>
              <Input
                type="number"
                step="0.1"
                min="0"
                max={selectedMaterialData?.current_stock || 999999}
                value={assignmentForm.assigned_quantity}
                onChange={(e) => setAssignmentForm(prev => ({ ...prev, assigned_quantity: parseFloat(e.target.value) || 0 }))}
                placeholder="Zuzuweisende Menge"
              />
              {selectedMaterialData && assignmentForm.assigned_quantity > selectedMaterialData.current_stock && (
                <div className="flex items-center gap-2 mt-1 text-red-600">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-sm">Nicht genügend Bestand verfügbar!</span>
                </div>
              )}
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium mb-2">Notizen (optional)</label>
              <Textarea
                value={assignmentForm.notes}
                onChange={(e) => setAssignmentForm(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Zusätzliche Informationen zur Zuweisung..."
                rows={3}
              />
            </div>
          </div>
        )}

        {activeTab === 'view' && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Aktuelle Zuweisungen</h3>
            <div className="grid gap-4 max-h-96 overflow-y-auto">
              {assignments.map((assignment) => (
                <Card key={assignment.id}>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="font-medium">{assignment.material_name}</h4>
                        <p className="text-sm text-gray-600">
                          {assignment.employee_name} • {assignment.project_name}
                        </p>
                      </div>
                      <Badge variant="outline">
                        {assignment.used_quantity} / {assignment.assigned_quantity} {assignment.unit}
                      </Badge>
                    </div>
                    <div className="text-sm text-gray-500">
                      Zugewiesen: {new Date(assignment.assigned_at).toLocaleDateString('de-DE')}
                    </div>
                    {assignment.notes && (
                      <div className="text-sm text-gray-600 mt-2 p-2 bg-gray-50 rounded">
                        {assignment.notes}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Schließen
          </Button>
          {activeTab === 'assign' && (
            <Button 
              onClick={handleAssignment}
              disabled={
                loading || 
                !assignmentForm.material_id || 
                !assignmentForm.employee_id || 
                !assignmentForm.project_id || 
                !assignmentForm.assigned_quantity ||
                (selectedMaterialData && assignmentForm.assigned_quantity > selectedMaterialData.current_stock)
              }
            >
              <UserCheck className="h-4 w-4 mr-2" />
              Material zuweisen
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MaterialAssignmentDialog;