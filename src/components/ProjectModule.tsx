import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Building2, Calendar, Users, Package, AlertTriangle, CheckCircle, Clock, Plus } from "lucide-react";
import AddProjectDialog from "./AddProjectDialog";

const ProjectModule = () => {
  const [isAddProjectOpen, setIsAddProjectOpen] = useState(false);
  
  // Kundendaten für die Auswahl
  const customers = [
    {
      id: 1,
      name: 'Müller GmbH',
      contact: 'Hans Müller',
      email: 'mueller@firma.de',
      phone: '+49 123 456789',
      address: 'Berlin, Hauptstraße 123',
      projects: 3,
      revenue: '€25.400',
      status: 'Aktiv'
    },
    {
      id: 2,
      name: 'Schmidt AG',
      contact: 'Anna Schmidt',
      email: 'schmidt@ag.de',
      phone: '+49 987 654321',
      address: 'Hamburg, Industriestr. 45',
      projects: 1,
      revenue: '€8.750',
      status: 'Aktiv'
    },
    {
      id: 3,
      name: 'Weber Bau',
      contact: 'Peter Weber',
      email: 'weber@bau.de',
      phone: '+49 555 123456',
      address: 'München, Bahnhofstr. 78',
      projects: 5,
      revenue: '€45.200',
      status: 'Premium'
    }
  ];

  // Teammitglieder mit ihren aktuellen Projekten
  const teamMembers = [
    {
      id: 1,
      name: 'Max Mustermann',
      role: 'Projektleiter',
      projects: [
        { name: 'Büroerweiterung Müller GmbH', startDate: '01.01.2024', endDate: '15.02.2024' },
        { name: 'Wohnanlage Phase 2', startDate: '01.02.2024', endDate: '30.04.2024' }
      ]
    },
    {
      id: 2,
      name: 'Lisa Weber',
      role: 'Elektrikerin',
      projects: [
        { name: 'Büroerweiterung Müller GmbH', startDate: '01.01.2024', endDate: '15.02.2024' },
        { name: 'Wohnanlage Phase 2', startDate: '01.02.2024', endDate: '30.04.2024' }
      ]
    },
    {
      id: 3,
      name: 'Tom Fischer',
      role: 'Installateur',
      projects: [
        { name: 'Werkshalle Elektrik', startDate: '15.12.2023', endDate: '10.01.2024' },
        { name: 'Wohnanlage Phase 2', startDate: '01.02.2024', endDate: '30.04.2024' }
      ]
    },
    {
      id: 4,
      name: 'Anna Klein',
      role: 'Technikerin',
      projects: [
        { name: 'Werkshalle Elektrik', startDate: '15.12.2023', endDate: '10.01.2024' }
      ]
    },
    {
      id: 5,
      name: 'Michael Schmidt',
      role: 'Monteur',
      projects: []
    },
    {
      id: 6,
      name: 'Sarah Wagner',
      role: 'Planerin',
      projects: [
        { name: 'Wohnanlage Phase 2', startDate: '01.02.2024', endDate: '30.04.2024' }
      ]
    }
  ];

  const [projects, setProjects] = useState([
    {
      id: 'P2024-001',
      name: 'Büroerweiterung Müller GmbH',
      customer: 'Müller GmbH',
      status: 'In Bearbeitung',
      progress: 65,
      startDate: '01.01.2024',
      endDate: '15.02.2024',
      budget: '€12.500',
      team: ['Max Mustermann', 'Lisa Weber'],
      location: 'Berlin, Hauptstraße 123'
    },
    {
      id: 'P2024-002',
      name: 'Werkshalle Elektrik',
      customer: 'Schmidt AG',
      status: 'Abgeschlossen',
      progress: 100,
      startDate: '15.12.2023',
      endDate: '10.01.2024',
      budget: '€8.750',
      team: ['Tom Fischer', 'Anna Klein'],
      location: 'Hamburg, Industriestr. 45'
    },
    {
      id: 'P2024-003',
      name: 'Wohnanlage Phase 2',
      customer: 'Weber Bau',
      status: 'Planung',
      progress: 15,
      startDate: '01.02.2024',
      endDate: '30.04.2024',
      budget: '€28.900',
      team: ['Max Mustermann', 'Lisa Weber', 'Tom Fischer'],
      location: 'München, Bahnhofstr. 78'
    }
  ]);

  const upcomingTasks = [
    { task: 'DGUV V3 Prüfung - Schmidt AG', date: '25.01.2024', priority: 'Hoch', type: 'Wartung' },
    { task: 'Material bestellen - Kabel 5x2.5', date: '26.01.2024', priority: 'Mittel', type: 'Beschaffung' },
    { task: 'Abnahme Büroerweiterung', date: '28.01.2024', priority: 'Hoch', type: 'Termin' },
    { task: 'Angebot Weber Bau Phase 3', date: '30.01.2024', priority: 'Mittel', type: 'Angebot' }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'In Bearbeitung': return 'bg-yellow-100 text-yellow-800';
      case 'Abgeschlossen': return 'bg-green-100 text-green-800';
      case 'Planung': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'Hoch': return 'bg-red-100 text-red-800';
      case 'Mittel': return 'bg-yellow-100 text-yellow-800';
      case 'Niedrig': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Abgeschlossen': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'In Bearbeitung': return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'Planung': return <Calendar className="h-4 w-4 text-blue-600" />;
      default: return <Building2 className="h-4 w-4 text-gray-600" />;
    }
  };

  const handleAddProject = (newProject: any) => {
    setProjects(prev => [...prev, newProject]);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Building2 className="h-6 w-6 text-blue-600" />
            Projekte & Baustellen
          </h2>
          <p className="text-gray-600">Verwalten Sie Ihre Baustellen und Projekttermine</p>
        </div>
        <Button 
          className="bg-blue-600 hover:bg-blue-700"
          onClick={() => setIsAddProjectOpen(true)}
        >
          <Plus className="h-4 w-4 mr-2" />
          Neues Projekt
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Project Overview Stats */}
        <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Aktive Projekte</p>
                  <p className="text-2xl font-bold">3</p>
                </div>
                <Building2 className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Abgeschlossen</p>
                  <p className="text-2xl font-bold">1</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Gesamtbudget</p>
                  <p className="text-2xl font-bold">€50.150</p>
                </div>
                <Package className="h-8 w-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Offene Aufgaben</p>
                  <p className="text-2xl font-bold">12</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-orange-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Active Projects */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-lg font-semibold">Aktuelle Projekte</h3>
          {projects.map((project) => (
            <Card key={project.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {getStatusIcon(project.status)}
                      <h4 className="text-lg font-semibold">{project.name}</h4>
                      <Badge className={getStatusColor(project.status)}>
                        {project.status}
                      </Badge>
                    </div>
                    <p className="text-gray-600 mb-2">{project.customer}</p>
                    <p className="text-sm text-gray-500 flex items-center gap-1">
                      <Building2 className="h-4 w-4" />
                      {project.location}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-green-600">{project.budget}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Fortschritt</span>
                      <span>{project.progress}%</span>
                    </div>
                    <Progress value={project.progress} className="h-2" />
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500">Start:</p>
                      <p className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {project.startDate}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">Ende:</p>
                      <p className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {project.endDate}
                      </p>
                    </div>
                  </div>

                  <div>
                    <p className="text-gray-500 text-sm mb-1">Team:</p>
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-gray-400" />
                      <span className="text-sm">{project.team.join(', ')}</span>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button size="sm" variant="outline">Details</Button>
                    <Button size="sm" className="bg-blue-600 hover:bg-blue-700">Bearbeiten</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Upcoming Tasks */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Anstehende Aufgaben</h3>
          <Card>
            <CardContent className="p-4">
              <div className="space-y-3">
                {upcomingTasks.map((task, index) => (
                  <div key={index} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="outline" className="text-xs">
                        {task.type}
                      </Badge>
                      <Badge className={getPriorityColor(task.priority)}>
                        {task.priority}
                      </Badge>
                    </div>
                    <p className="text-sm font-medium mb-1">{task.task}</p>
                    <p className="text-xs text-gray-500 flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {task.date}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Schnellaktionen</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="space-y-2">
                <Button variant="outline" className="w-full justify-start">
                  <Calendar className="h-4 w-4 mr-2" />
                  Termin planen
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <Package className="h-4 w-4 mr-2" />
                  Material bestellen
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <Users className="h-4 w-4 mr-2" />
                  Team zuweisen
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <AddProjectDialog
        isOpen={isAddProjectOpen}
        onClose={() => setIsAddProjectOpen(false)}
        onProjectAdded={handleAddProject}
        customers={customers}
        teamMembers={teamMembers}
      />
    </div>
  );
};

export default ProjectModule;
