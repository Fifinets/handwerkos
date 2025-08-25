
import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Mail, Phone, Car, Clock, Calendar, MapPin, Shield } from "lucide-react";
// TODO: Re-enable when EmployeeFiles is implemented
// import EmployeeFiles from "./EmployeeFiles";

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

interface EmployeeDetailsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  employee: Employee | null;
}

const EmployeeDetailsDialog = ({ isOpen, onClose, employee }: EmployeeDetailsDialogProps) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Aktiv': return 'bg-green-100 text-green-800';
      case 'Urlaub': return 'bg-yellow-100 text-yellow-800';
      case 'Krank': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('');
  };

  if (!employee) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Mitarbeiterdetails</DialogTitle>
          <DialogDescription>
            Detaillierte Informationen über den Mitarbeiter
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="text-lg">
                {getInitials(employee.name)}
              </AvatarFallback>
            </Avatar>
            <div>
              <h3 className="text-xl font-semibold">{employee.name}</h3>
              <p className="text-gray-600">{employee.position}</p>
              <Badge className={getStatusColor(employee.status)}>
                {employee.status}
              </Badge>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-gray-500" />
                <span className="text-sm">{employee.email}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-gray-500" />
                <span className="text-sm">{employee.phone || 'Nicht angegeben'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Car className="h-4 w-4 text-gray-500" />
                <span className="text-sm">Führerschein: {employee.license || 'Nicht angegeben'}</span>
              </div>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-gray-500" />
                <span className="text-sm">{employee.hoursThisMonth}h diesen Monat</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-500" />
                <span className="text-sm">{employee.vacationDays} Tage Resturlaub</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-gray-500" />
                <span className="text-sm">{employee.currentProject}</span>
              </div>
            </div>
          </div>
          
          <div>
            <h4 className="font-medium mb-2">Qualifikationen</h4>
            <div className="flex flex-wrap gap-2">
              {employee.qualifications.length > 0 ? employee.qualifications.map((qual) => (
                <Badge key={qual} variant="outline">
                  <Shield className="h-3 w-3 mr-1" />
                  {qual}
                </Badge>
          )) : (
            <span className="text-sm text-gray-400">Keine Qualifikationen hinterlegt</span>
          )}
        </div>
      </div>

      {/* TODO: Re-enable when EmployeeFiles is implemented */}
      {/* <EmployeeFiles employeeId={employee.id} /> */}
      <div className="p-4 border rounded-lg bg-gray-50">
        <h4 className="font-medium mb-2">Dateien & Dokumente</h4>
        <p className="text-sm text-gray-500">Diese Funktion wird bald verfügbar sein.</p>
      </div>
    </div>
  </DialogContent>
</Dialog>
  );
};

export default EmployeeDetailsDialog;
