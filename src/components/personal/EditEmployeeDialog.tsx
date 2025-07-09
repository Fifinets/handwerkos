
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
}

interface EditFormData {
  name: string;
  position: string;
  email: string;
  phone: string;
  status: string;
  license: string;
  currentProject: string;
  hoursThisMonth: number;
  vacationDays: number;
}

interface EditEmployeeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  employee: Employee | null;
  onSave: (formData: EditFormData) => void;
}

const EditEmployeeDialog = ({ isOpen, onClose, employee, onSave }: EditEmployeeDialogProps) => {
  const [editFormData, setEditFormData] = useState<EditFormData>({
    name: '',
    position: '',
    email: '',
    phone: '',
    status: 'Aktiv',
    license: '',
    currentProject: '',
    hoursThisMonth: 0,
    vacationDays: 0
  });

  useEffect(() => {
    if (employee) {
      setEditFormData({
        name: employee.name,
        position: employee.position,
        email: employee.email,
        phone: employee.phone,
        status: employee.status,
        license: employee.license,
        currentProject: employee.currentProject,
        hoursThisMonth: employee.hoursThisMonth,
        vacationDays: employee.vacationDays
      });
    }
  }, [employee]);

  const handleInputChange = (field: string, value: string | number) => {
    setEditFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(editFormData);
  };

  if (!employee) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
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

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Abbrechen
            </Button>
            <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
              Speichern
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditEmployeeDialog;
