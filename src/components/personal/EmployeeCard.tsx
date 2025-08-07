
import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Clock, Car, Calendar, Shield, Edit } from "lucide-react";

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

interface EmployeeCardProps {
  employee: Employee;
  onShowDetails: (employee: Employee) => void;
  onEdit: (employee: Employee) => void;
}

const EmployeeCard = ({ employee, onShowDetails, onEdit }: EmployeeCardProps) => {
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

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardContent className="p-6 flex flex-col h-full">
        <div className="flex items-start gap-4">
          <Avatar className="h-12 w-12">
            <AvatarFallback>{getInitials(employee.name)}</AvatarFallback>
          </Avatar>
          
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h4 className="text-lg font-semibold">{employee.name}</h4>
              <Badge className={getStatusColor(employee.status)}>
                {employee.status}
              </Badge>
            </div>
            <p className="text-gray-600 mb-2">{employee.position}</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mb-4 flex-grow">
              <div>
                <p className="text-gray-500">Aktuelles Projekt:</p>
                <p>{employee.currentProject}</p>
              </div>
              <div>
                <p className="text-gray-500">Stunden (Monat):</p>
                <p className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {employee.hoursThisMonth}h
                </p>
              </div>
              <div>
                <p className="text-gray-500">Führerschein:</p>
                <p className="flex items-center gap-1">
                  <Car className="h-4 w-4" />
                  {employee.license || 'Nicht angegeben'}
                </p>
              </div>
              <div>
                <p className="text-gray-500">Resturlaub:</p>
                <p className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {employee.vacationDays} Tage
                </p>
              </div>
            </div>

            <div className="mb-4">
              <p className="text-gray-500 text-sm mb-2">Qualifikationen:</p>
              <div className="flex flex-wrap gap-2">
                {employee.qualifications.length > 0 ? employee.qualifications.map((qual) => (
                  <Badge key={qual} variant="outline" className="text-xs">
                    <Shield className="h-3 w-3 mr-1" />
                    {qual}
                  </Badge>
                )) : (
                  <span className="text-sm text-gray-400">Keine Qualifikationen hinterlegt</span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-auto">
          <Button
            size="sm" 
            variant="outline"
            onClick={() => onShowDetails(employee)}
          >
            Details
          </Button>
          <Button
            size="sm" 
            
            onClick={() => onEdit(employee)}
          >
            <Edit className="h-4 w-4 mr-1" />
            Bearbeiten
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default EmployeeCard;
