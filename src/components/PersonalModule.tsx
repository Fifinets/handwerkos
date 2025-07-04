import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { UserCheck, Calendar, Clock, GraduationCap, Car, Shield, Plus, Mail, Phone, MapPin } from "lucide-react";

const PersonalModule = () => {
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);

  const employees = [
    {
      id: 1,
      name: 'Max Mustermann',
      position: 'Elektrikermeister',
      email: 'max.mustermann@firma.de',
      phone: '+49 123 456789',
      status: 'Aktiv',
      qualifications: ['Elektrikermeister', 'DGUV V3', 'Schaltberechtigung'],
      license: 'B, BE',
      currentProject: 'Büroerweiterung Müller GmbH',
      hoursThisMonth: 168,
      vacationDays: 5
    },
    {
      id: 2,
      name: 'Lisa Weber',
      position: 'Elektronikerin',
      email: 'lisa.weber@firma.de',
      phone: '+49 987 654321',
      status: 'Aktiv',
      qualifications: ['Elektronikerin', 'Erste Hilfe'],
      license: 'B',
      currentProject: 'Wohnanlage Phase 2',
      hoursThisMonth: 160,
      vacationDays: 12
    },
    {
      id: 3,
      name: 'Tom Fischer',
      position: 'Elektroinstallateur',
      email: 'tom.fischer@firma.de',
      phone: '+49 555 123456',
      status: 'Urlaub',
      qualifications: ['Elektroinstallateur', 'Hubarbeitsbühne'],
      license: 'B',
      currentProject: '-',
      hoursThisMonth: 120,
      vacationDays: 8
    }
  ];

  const upcomingTraining = [
    { employee: 'Max Mustermann', training: 'DGUV V3 Auffrischung', date: '15.02.2024', type: 'Pflicht' },
    { employee: 'Lisa Weber', training: 'Photovoltaik Grundlagen', date: '20.02.2024', type: 'Weiterbildung' },
    { employee: 'Tom Fischer', training: 'Erste Hilfe Kurs', date: '25.02.2024', type: 'Pflicht' }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Aktiv': return 'bg-green-100 text-green-800';
      case 'Urlaub': return 'bg-yellow-100 text-yellow-800';
      case 'Krank': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTrainingTypeColor = (type: string) => {
    switch (type) {
      case 'Pflicht': return 'bg-red-100 text-red-800';
      case 'Weiterbildung': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('');
  };

  const handleShowDetails = (employee) => {
    setSelectedEmployee(employee);
    setIsDetailsOpen(true);
  };

  const handleEditEmployee = (employee) => {
    setSelectedEmployee(employee);
    setIsEditOpen(true);
  };

  const handleQuickAction = (action: string) => {
    alert(`${action} wird geöffnet...`);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <UserCheck className="h-6 w-6 text-blue-600" />
            Personalverwaltung
          </h2>
          <p className="text-gray-600">Mitarbeiterdaten und Qualifikationen verwalten</p>
        </div>
        <Button 
          className="bg-blue-600 hover:bg-blue-700"
          onClick={() => handleQuickAction('Neuer Mitarbeiter')}
        >
          <Plus className="h-4 w-4 mr-2" />
          Mitarbeiter hinzufügen
        </Button>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Mitarbeiter gesamt</p>
                <p className="text-2xl font-bold">8</p>
              </div>
              <UserCheck className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Aktiv</p>
                <p className="text-2xl font-bold">6</p>
              </div>
              <UserCheck className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Urlaub</p>
                <p className="text-2xl font-bold">2</p>
              </div>
              <Calendar className="h-8 w-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Stunden (Monat)</p>
                <p className="text-2xl font-bold">1.248</p>
              </div>
              <Clock className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Employee List */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-lg font-semibold">Mitarbeiterliste</h3>
          {employees.map((employee) => (
            <Card key={employee.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
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
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mb-4">
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
                          {employee.license}
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
                        {employee.qualifications.map((qual, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            <Shield className="h-3 w-3 mr-1" />
                            {qual}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleShowDetails(employee)}
                      >
                        Details
                      </Button>
                      <Button 
                        size="sm" 
                        className="bg-blue-600 hover:bg-blue-700"
                        onClick={() => handleEditEmployee(employee)}
                      >
                        Bearbeiten
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Training & Quick Actions */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GraduationCap className="h-5 w-5" />
                Anstehende Schulungen
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {upcomingTraining.map((training, index) => (
                  <div key={index} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <Badge className={getTrainingTypeColor(training.type)}>
                        {training.type}
                      </Badge>
                    </div>
                    <p className="font-medium text-sm mb-1">{training.employee}</p>
                    <p className="text-sm text-gray-600 mb-1">{training.training}</p>
                    <p className="text-xs text-gray-500 flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {training.date}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Personalaktionen</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="space-y-2">
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => handleQuickAction('Urlaub planen')}
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  Urlaub planen
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => handleQuickAction('Arbeitszeiten')}
                >
                  <Clock className="h-4 w-4 mr-2" />
                  Arbeitszeiten
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => handleQuickAction('Schulung buchen')}
                >
                  <GraduationCap className="h-4 w-4 mr-2" />
                  Schulung buchen
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => handleQuickAction('Zertifikate')}
                >
                  <Shield className="h-4 w-4 mr-2" />
                  Zertifikate
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Employee Details Dialog */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Mitarbeiterdetails</DialogTitle>
            <DialogDescription>
              Detaillierte Informationen über den Mitarbeiter
            </DialogDescription>
          </DialogHeader>
          {selectedEmployee && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarFallback className="text-lg">
                    {getInitials(selectedEmployee.name)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-xl font-semibold">{selectedEmployee.name}</h3>
                  <p className="text-gray-600">{selectedEmployee.position}</p>
                  <Badge className={getStatusColor(selectedEmployee.status)}>
                    {selectedEmployee.status}
                  </Badge>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-gray-500" />
                    <span className="text-sm">{selectedEmployee.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-gray-500" />
                    <span className="text-sm">{selectedEmployee.phone}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Car className="h-4 w-4 text-gray-500" />
                    <span className="text-sm">Führerschein: {selectedEmployee.license}</span>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-gray-500" />
                    <span className="text-sm">{selectedEmployee.hoursThisMonth}h diesen Monat</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-gray-500" />
                    <span className="text-sm">{selectedEmployee.vacationDays} Tage Resturlaub</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-gray-500" />
                    <span className="text-sm">{selectedEmployee.currentProject}</span>
                  </div>
                </div>
              </div>
              
              <div>
                <h4 className="font-medium mb-2">Qualifikationen</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedEmployee.qualifications.map((qual, index) => (
                    <Badge key={index} variant="outline">
                      <Shield className="h-3 w-3 mr-1" />
                      {qual}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Employee Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Mitarbeiter bearbeiten</DialogTitle>
            <DialogDescription>
              Mitarbeiterdaten bearbeiten
            </DialogDescription>
          </DialogHeader>
          {selectedEmployee && (
            <div className="space-y-4">
              <p className="text-center text-gray-600">
                Bearbeitungsformular für <strong>{selectedEmployee.name}</strong>
              </p>
              <p className="text-sm text-gray-500 text-center">
                Hier würde normalerweise ein Formular zum Bearbeiten der Mitarbeiterdaten erscheinen.
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsEditOpen(false)}>
                  Abbrechen
                </Button>
                <Button className="bg-blue-600 hover:bg-blue-700">
                  Speichern
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PersonalModule;
