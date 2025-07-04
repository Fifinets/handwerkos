import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Settings, Plus, MapPin, Calendar } from 'lucide-react';
import AddMachineDialog from './AddMachineDialog';

const MachineModule = () => {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [machines, setMachines] = useState([
    {
      id: "M001",
      name: "Hydraulikbagger CAT 320",
      type: "Bagger",
      location: "Lager A",
      purchaseDate: "15.01.2023",
      value: "€125.000",
      status: "Verfügbar",
      description: "Schwerer Hydraulikbagger für Erdarbeiten"
    },
    {
      id: "M002",
      name: "Betonmischer Lescha SM 200",
      type: "Mischer",
      location: "Baustelle B",
      purchaseDate: "28.02.2023",
      value: "€2.500",
      status: "Im Einsatz",
      description: "Mobiler Betonmischer für kleinere Projekte"
    },
    {
      id: "M003",
      name: "Baugerüst Layher Blitz",
      type: "Gerüst",
      location: "Lager B",
      purchaseDate: "10.05.2023",
      value: "€8.000",
      status: "Verfügbar",
      description: "Modulares Fassadengerüst für vielseitige Anwendungen"
    }
  ]);

  const handleAddMachine = (newMachine: any) => {
    setMachines(prev => [...prev, newMachine]);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Verfügbar': return 'bg-green-100 text-green-800';
      case 'Im Einsatz': return 'bg-blue-100 text-blue-800';
      case 'Wartung': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold tracking-tight">Maschinen & Geräte</h2>
        <Button 
          onClick={() => setIsAddDialogOpen(true)}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="mr-2 h-4 w-4" />
          Neue Maschine
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {machines.map((machine) => (
          <Card key={machine.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{machine.name}</CardTitle>
                <Badge className={getStatusColor(machine.status)}>
                  {machine.status}
                </Badge>
              </div>
              <CardDescription>{machine.type}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center text-sm text-gray-600">
                  <MapPin className="mr-2 h-4 w-4" />
                  {machine.location}
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <Calendar className="mr-2 h-4 w-4" />
                  Gekauft: {machine.purchaseDate}
                </div>
                <div className="text-sm">
                  <span className="font-medium">Wert:</span> {machine.value}
                </div>
                <div className="text-sm text-gray-600">
                  {machine.description}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <AddMachineDialog
        isOpen={isAddDialogOpen}
        onClose={() => setIsAddDialogOpen(false)}
        onMachineAdded={handleAddMachine}
      />
    </div>
  );
};

export default MachineModule;
