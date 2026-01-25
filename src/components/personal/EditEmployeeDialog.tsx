import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Plus, Shield, X, Trash2, Key } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useDeleteEmployee } from "@/hooks/useApi";

// Definierte Freigaben - KEINE NEUEN ERFINDEN
type Permission =
  | 'delivery_note.edit_all'
  | 'delivery_note.approve'
  | 'timesheet.edit_all'
  | 'project.status.change'
  | 'prices.view'
  | 'invoices.view';

const AVAILABLE_GRANTS: { id: Permission; label: string; description: string }[] = [
  { id: 'delivery_note.edit_all', label: 'Alle Lieferscheine bearbeiten', description: 'Kann alle Lieferscheine bearbeiten, nicht nur eigene' },
  { id: 'delivery_note.approve', label: 'Lieferscheine freigeben', description: 'Kann Lieferscheine von anderen Mitarbeitern freigeben' },
  { id: 'timesheet.edit_all', label: 'Alle Zeiten bearbeiten', description: 'Kann Zeiteinträge aller Mitarbeiter bearbeiten' },
  { id: 'project.status.change', label: 'Projektstatus ändern', description: 'Kann den Status von Projekten ändern' },
  { id: 'prices.view', label: 'Preise & Margen sehen', description: 'Kann Preise, Kosten und Margen einsehen' },
  { id: 'invoices.view', label: 'Rechnungen sehen', description: 'Kann Rechnungen einsehen' },
];

interface Employee {
  id: string;
  name: string;
  position: string;
  email: string;
  phone: string;
  status: string;
  qualifications: string[];
  license: string;
  currentProject: string;
  hoursThisMonth: number;
  vacationDays: number;
  role?: 'employee' | 'manager';
  grants?: string[];
}

interface EditFormData {
  name: string;
  position: string;
  email: string;
  phone: string;
  status: string;
  license: string;
  qualifications: string[];
  currentProject: string;
  hoursThisMonth: number;
  vacationDays: number;
  role: 'employee' | 'manager';
  grants: string[];
}

interface EditEmployeeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  employee: Employee | null;
  onSave: (formData: EditFormData) => void;
}

const EditEmployeeDialog = ({ isOpen, onClose, employee, onSave }: EditEmployeeDialogProps) => {
  const { toast } = useToast();
  const deleteEmployeeMutation = useDeleteEmployee();
  const [editFormData, setEditFormData] = useState<EditFormData>({
    name: '',
    position: '',
    email: '',
    phone: '',
    status: 'Aktiv',
    license: '',
    qualifications: [],
    currentProject: '',
    hoursThisMonth: 0,
    vacationDays: 0,
    role: 'employee',
    grants: []
  });

  const [qualificationInput, setQualificationInput] = useState('');

  useEffect(() => {
    if (employee) {
      setEditFormData({
        name: employee.name,
        position: employee.position,
        email: employee.email,
        phone: employee.phone,
        status: employee.status,
        license: employee.license,
        qualifications: employee.qualifications || [],
        currentProject: employee.currentProject,
        hoursThisMonth: employee.hoursThisMonth,
        vacationDays: employee.vacationDays,
        role: employee.role || 'employee',
        grants: employee.grants || []
      });
    }
  }, [employee]);

  const handleInputChange = (field: string, value: string | number) => {
    setEditFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const addQualification = () => {
    if (qualificationInput.trim() && !editFormData.qualifications.includes(qualificationInput.trim())) {
      setEditFormData(prev => ({
        ...prev,
        qualifications: [...prev.qualifications, qualificationInput.trim()]
      }));
      setQualificationInput('');
    }
  };

  const removeQualification = (qualification: string) => {
    setEditFormData(prev => ({
      ...prev,
      qualifications: prev.qualifications.filter(q => q !== qualification)
    }));
  };

  const handleQualificationKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addQualification();
    }
  };

  const toggleGrant = (grantId: Permission) => {
    setEditFormData(prev => ({
      ...prev,
      grants: prev.grants.includes(grantId)
        ? prev.grants.filter(g => g !== grantId)
        : [...prev.grants, grantId]
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(editFormData);
  };

  const handleDelete = () => {
    if (!employee) return;

    // Bestätigungsdialog
    if (window.confirm(`Möchten Sie den Mitarbeiter "${employee.name}" wirklich löschen?`)) {
      deleteEmployeeMutation.mutate(employee.id, {
        onSuccess: () => {
          toast({
            title: "Mitarbeiter gelöscht",
            description: `${employee.name} wurde erfolgreich gelöscht.`,
          });
          onClose();
        },
        onError: (error) => {
          toast({
            title: "Fehler beim Löschen",
            description: error.message,
            variant: "destructive",
          });
        }
      });
    }
  };

  if (!employee) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Mitarbeiter bearbeiten</DialogTitle>
          <DialogDescription>
            Mitarbeiterdaten bearbeiten
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={editFormData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              required
            />
          </div>

          <div>
            <Label htmlFor="position">Position</Label>
            <Input
              id="position"
              value={editFormData.position}
              onChange={(e) => handleInputChange('position', e.target.value)}
              required
            />
          </div>

          <div>
            <Label htmlFor="email">E-Mail</Label>
            <Input
              id="email"
              type="email"
              value={editFormData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              required
            />
          </div>

          <div>
            <Label htmlFor="phone">Telefon</Label>
            <Input
              id="phone"
              value={editFormData.phone}
              onChange={(e) => handleInputChange('phone', e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="status">Status</Label>
            <Select value={editFormData.status} onValueChange={(value) => handleInputChange('status', value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Aktiv">Aktiv</SelectItem>
                <SelectItem value="Urlaub">Urlaub</SelectItem>
                <SelectItem value="Krank">Krank</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="license">Führerschein</Label>
            <Input
              id="license"
              value={editFormData.license}
              onChange={(e) => handleInputChange('license', e.target.value)}
              placeholder="z.B. B, BE"
            />
          </div>

          <div>
            <Label htmlFor="qualifications">Qualifikationen</Label>
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  id="qualifications"
                  type="text"
                  value={qualificationInput}
                  onChange={(e) => setQualificationInput(e.target.value)}
                  onKeyPress={handleQualificationKeyPress}
                  placeholder="z.B. VDE 0100, Erste Hilfe"
                />
                <Button type="button" onClick={addQualification} size="sm">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {editFormData.qualifications.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {editFormData.qualifications.map((qualification) => (
                    <Badge key={qualification} variant="outline" className="text-xs">
                      <Shield className="h-3 w-3 mr-1" />
                      {qualification}
                      <button
                        type="button"
                        onClick={() => removeQualification(qualification)}
                        className="ml-1 hover:text-red-600"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="currentProject">Aktuelles Projekt</Label>
            <Input
              id="currentProject"
              value={editFormData.currentProject}
              onChange={(e) => handleInputChange('currentProject', e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="hoursThisMonth">Stunden (Monat)</Label>
              <Input
                id="hoursThisMonth"
                type="number"
                value={editFormData.hoursThisMonth}
                onChange={(e) => handleInputChange('hoursThisMonth', parseInt(e.target.value))}
              />
            </div>
            <div>
              <Label htmlFor="vacationDays">Resturlaub</Label>
              <Input
                id="vacationDays"
                type="number"
                value={editFormData.vacationDays}
                onChange={(e) => handleInputChange('vacationDays', parseInt(e.target.value))}
              />
            </div>
          </div>

          <Separator />

          {/* Rolle */}
          <div>
            <Label htmlFor="role">Rolle</Label>
            <Select
              value={editFormData.role}
              onValueChange={(value: 'employee' | 'manager') => handleInputChange('role', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="employee">Mitarbeiter</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Freigaben */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Key className="h-4 w-4 text-muted-foreground" />
              <Label className="text-sm font-medium">Zusätzliche Freigaben</Label>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Manager haben automatisch operative Rechte. Kommerzielle Rechte (Preise, Rechnungen) müssen explizit vergeben werden.
            </p>
            <div className="space-y-3">
              {AVAILABLE_GRANTS.map((grant) => (
                <div key={grant.id} className="flex items-start space-x-3">
                  <Checkbox
                    id={grant.id}
                    checked={editFormData.grants.includes(grant.id)}
                    onCheckedChange={() => toggleGrant(grant.id)}
                  />
                  <div className="grid gap-0.5 leading-none">
                    <label
                      htmlFor={grant.id}
                      className="text-sm font-medium cursor-pointer"
                    >
                      {grant.label}
                    </label>
                    <p className="text-xs text-muted-foreground">
                      {grant.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Abbrechen
            </Button>
            <Button 
              type="button" 
              variant="destructive" 
              onClick={handleDelete}
              disabled={deleteEmployeeMutation.isPending}
              className="flex items-center gap-2"
            >
              <Trash2 className="h-4 w-4" />
              {deleteEmployeeMutation.isPending ? "Lösche..." : "Löschen"}
            </Button>
            <Button type="submit">
              Speichern
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditEmployeeDialog;
