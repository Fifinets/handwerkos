
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Settings, Calendar, MapPin, AlertTriangle, CheckCircle, Clock, Wrench, Plus } from "lucide-react";

const MachineModule = () => {
  const machines = [
    {
      id: 'M001',
      name: 'Bohrmaschine Hilti TE 6-A36',
      category: 'Bohrgeräte',
      location: 'Baustelle Müller GmbH',
      status: 'Im Einsatz',
      lastMaintenance: '15.12.2023',
      nextMaintenance: '15.03.2024',
      dguv: '22.11.2023',
      nextDguv: '22.11.2024',
      operatingHours: 324,
      condition: 'Gut'
    },
    {
      id: 'M002',
      name: 'Messgerät Fluke 1587',
      category: 'Messgeräte',
      location: 'Lager',
      status: 'Verfügbar',
      lastMaintenance: '10.01.2024',
      nextMaintenance: '10.07.2024',
      dguv: '05.01.2024',
      nextDguv: '05.01.2025',
      operatingHours: 156,
      condition: 'Sehr gut'
    },
    {
      id: 'M003',
      name: 'Hubarbeitsbühne Genie GS-1932',
      category: 'Hebegeräte',
      location: 'Baustelle Weber Bau',
      status: 'Wartung fällig',
      lastMaintenance: '20.10.2023',
      nextMaintenance: '20.01.2024',
      dguv: '15.12.2023',
      nextDguv: '15.12.2024',
      operatingHours: 892,
      condition: 'Wartung erforderlich'
    },
    {
      id: 'M004',
      name: 'Kabelzuggerät Greenlee 855GX',
      category: 'Installationshilfen',
      location: 'Fahrzeug 1',
      status: 'Im Einsatz',
      lastMaintenance: '08.01.2024',
      nextMaintenance: '08.04.2024',
      dguv: '30.11.2023',
      nextDguv: '30.11.2024',
      operatingHours: 245,
      condition: 'Gut'
    }
  ];

  const upcomingMaintenance = [
    { machine: 'Hubarbeitsbühne Genie GS-1932', type: 'Wartung', date: '20.01.2024', priority: 'Hoch' },
    { machine: 'Bohrmaschine Hilti TE 6-A36', type: 'Wartung', date: '15.03.2024', priority: 'Mittel' },
    { machine: 'Kabelzuggerät Greenlee 855GX', type: 'Wartung', date: '08.04.2024', priority: 'Niedrig' },
    { machine: 'Messgerät Fluke 1587', type: 'DGUV V3', date: '05.01.2025', priority: 'Niedrig' }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Verfügbar': return 'bg-green-100 text-green-800';
      case 'Im Einsatz': return 'bg-blue-100 text-blue-800';
      case 'Wartung fällig': return 'bg-red-100 text-red-800';
      case 'In Wartung': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getConditionColor = (condition: string) => {
    switch (condition) {
      case 'Sehr gut': return 'text-green-600';
      case 'Gut': return 'text-blue-600';
      case 'Ausreichend': return 'text-yellow-600';
      case 'Wartung erforderlich': return 'text-red-600';
      default: return 'text-gray-600';
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
      case 'Verfügbar': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'Im Einsatz': return <Clock className="h-4 w-4 text-blue-600" />;
      case 'Wartung fällig': return <AlertTriangle className="h-4 w-4 text-red-600" />;
      case 'In Wartung': return <Wrench className="h-4 w-4 text-yellow-600" />;
      default: return <Settings className="h-4 w-4 text-gray-600" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Settings className="h-6 w-6 text-blue-600" />
            Maschinen & Geräte
          </h2>
          <p className="text-gray-600">Verwalten Sie Ihren Maschinenpark und Wartungsintervalle</p>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-700">
          <Plus className="h-4 w-4 mr-2" />
          Gerät hinzufügen
        </Button>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Geräte gesamt</p>
                <p className="text-2xl font-bold">24</p>
              </div>
              <Settings className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Verfügbar</p>
                <p className="text-2xl font-bold">18</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Im Einsatz</p>
                <p className="text-2xl font-bold">5</p>
              </div>
              <Clock className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Wartung fällig</p>
                <p className="text-2xl font-bold">1</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Machine List */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-lg font-semibold">Maschinenübersicht</h3>
          {machines.map((machine) => (
            <Card key={machine.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6 flex flex-col h-full">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {getStatusIcon(machine.status)}
                      <h4 className="text-lg font-semibold">{machine.name}</h4>
                      <Badge className={getStatusColor(machine.status)}>
                        {machine.status}
                      </Badge>
                    </div>
                    <p className="text-gray-600 mb-2">{machine.category}</p>
                    <p className="text-sm text-gray-500 flex items-center gap-1 mb-2">
                      <MapPin className="h-4 w-4" />
                      {machine.location}
                    </p>
                    <p className="text-sm flex items-center gap-1">
                      <span className="text-gray-500">Zustand:</span>
                      <span className={`font-medium ${getConditionColor(machine.condition)}`}>
                        {machine.condition}
                      </span>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">ID: {machine.id}</p>
                    <p className="text-lg font-bold text-blue-600">{machine.operatingHours}h</p>
                    <p className="text-xs text-gray-500">Betriebsstunden</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm mb-4 flex-grow">
                  <div>
                    <p className="text-gray-500">Letzte Wartung:</p>
                    <p className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {machine.lastMaintenance}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Nächste Wartung:</p>
                    <p className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {machine.nextMaintenance}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">DGUV V3 Prüfung:</p>
                    <p className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {machine.dguv}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Nächste DGUV V3:</p>
                    <p className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {machine.nextDguv}
                    </p>
                  </div>
                </div>

                {machine.status === 'Wartung fällig' && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-center gap-2 text-red-800">
                      <AlertTriangle className="h-4 w-4" />
                      <span className="text-sm font-medium">
                        Wartung überfällig! Gerät nicht verwenden.
                      </span>
                    </div>
                  </div>
                )}

                <div className="flex gap-2 mt-auto">
                  <Button size="sm" variant="outline">Details</Button>
                  <Button size="sm" variant="outline">
                    <Calendar className="h-4 w-4 mr-1" />
                    Wartung
                  </Button>
                  {machine.status === 'Wartung fällig' && (
                    <Button size="sm" className="bg-red-600 hover:bg-red-700">
                      <Wrench className="h-4 w-4 mr-1" />
                      Wartung planen
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Maintenance Schedule & Quick Actions */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Wartungsplan
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {upcomingMaintenance.map((maintenance, index) => (
                  <div key={index} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="outline" className="text-xs">
                        {maintenance.type}
                      </Badge>
                      <Badge className={getPriorityColor(maintenance.priority)}>
                        {maintenance.priority}
                      </Badge>
                    </div>
                    <p className="font-medium text-sm mb-1">{maintenance.machine}</p>
                    <p className="text-xs text-gray-500 flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {maintenance.date}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Geräteaktionen</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="space-y-2">
                <Button variant="outline" className="w-full justify-start">
                  <Calendar className="h-4 w-4 mr-2" />
                  Wartung planen
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <CheckCircle className="h-4 w-4 mr-2" />
                  DGUV V3 Prüfung
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <MapPin className="h-4 w-4 mr-2" />
                  Standort ändern
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <Settings className="h-4 w-4 mr-2" />
                  Inventar
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base text-red-600">Wartung überfällig</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between p-2 bg-red-50 rounded">
                  <span className="text-sm">Hubarbeitsbühne</span>
                  <span className="text-xs text-red-600">3 Tage</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default MachineModule;
