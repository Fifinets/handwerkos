
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Shield, X } from "lucide-react";

interface NewEmployee {
  email: string;
  firstName: string;
  lastName: string;
  position: string;
  phone: string;
  license: string;
  qualifications: string[];
}

interface AddEmployeeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (employee: NewEmployee) => void;
  isLoading: boolean;
}

const AddEmployeeDialog = ({ isOpen, onClose, onSubmit, isLoading }: AddEmployeeDialogProps) => {
  const [newEmployee, setNewEmployee] = useState<NewEmployee>({
    email: '',
    firstName: '',
    lastName: '',
    position: '',
    phone: '',
    license: '',
    qualifications: []
  });

  const [qualificationInput, setQualificationInput] = useState('');

  const handleNewEmployeeChange = (field: string, value: string) => {
    setNewEmployee(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const addQualification = () => {
    if (qualificationInput.trim() && !newEmployee.qualifications.includes(qualificationInput.trim())) {
      setNewEmployee(prev => ({
        ...prev,
        qualifications: [...prev.qualifications, qualificationInput.trim()]
      }));
      setQualificationInput('');
    }
  };

  const removeQualification = (qualification: string) => {
    setNewEmployee(prev => ({
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(newEmployee);
  };

  const resetForm = () => {
    setNewEmployee({
      email: '',
      firstName: '',
      lastName: '',
      position: '',
      phone: '',
      license: '',
      qualifications: []
    });
    setQualificationInput('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Neuen Mitarbeiter erstellen</DialogTitle>
          <DialogDescription>
            Erstelle einen neuen Mitarbeiter. Der Mitarbeiter erhält eine E-Mail zur Bestätigung seines Kontos.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="add-firstName">Vorname</Label>
              <Input
                id="add-firstName"
                type="text"
                value={newEmployee.firstName}
                onChange={(e) => handleNewEmployeeChange('firstName', e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="add-lastName">Nachname</Label>
              <Input
                id="add-lastName"
                type="text"
                value={newEmployee.lastName}
                onChange={(e) => handleNewEmployeeChange('lastName', e.target.value)}
                required
              />
            </div>
          </div>
          
          <div>
            <Label htmlFor="add-email">E-Mail</Label>
            <Input
              id="add-email"
              type="email"
              value={newEmployee.email}
              onChange={(e) => handleNewEmployeeChange('email', e.target.value)}
              required
            />
          </div>
          
          <div>
            <Label htmlFor="add-position">Position</Label>
            <Input
              id="add-position"
              type="text"
              value={newEmployee.position}
              onChange={(e) => handleNewEmployeeChange('position', e.target.value)}
              placeholder="z.B. Elektriker, Elektroniker"
            />
          </div>

          <div>
            <Label htmlFor="add-phone">Telefon</Label>
            <Input
              id="add-phone"
              type="tel"
              value={newEmployee.phone}
              onChange={(e) => handleNewEmployeeChange('phone', e.target.value)}
              placeholder="+49 123 456789"
            />
          </div>

          <div>
            <Label htmlFor="add-license">Führerschein</Label>
            <Input
              id="add-license"
              type="text"
              value={newEmployee.license}
              onChange={(e) => handleNewEmployeeChange('license', e.target.value)}
              placeholder="z.B. B, BE"
            />
          </div>

          <div>
            <Label htmlFor="add-qualifications">Qualifikationen</Label>
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  id="add-qualifications"
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
              {newEmployee.qualifications.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {newEmployee.qualifications.map((qualification) => (
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
          
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={handleClose}>
              Abbrechen
            </Button>
            <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={isLoading}>
              {isLoading ? 'Wird erstellt...' : 'Mitarbeiter erstellen'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddEmployeeDialog;
