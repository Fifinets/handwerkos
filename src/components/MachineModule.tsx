
import React from 'react';
import { Button } from "@/components/ui/button";
import { Settings, Plus } from "lucide-react";
import MachineCard from "@/components/machine/MachineCard";
import MachineStats from "@/components/machine/MachineStats";
import MaintenanceSchedule from "@/components/machine/MaintenanceSchedule";
import MachineActions from "@/components/machine/MachineActions";
import OverdueMaintenance from "@/components/machine/OverdueMaintenance";

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
      <MachineStats />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Machine List */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-lg font-semibold">Maschinenübersicht</h3>
          {machines.map((machine) => (
            <MachineCard key={machine.id} machine={machine} />
          ))}
        </div>

        {/* Maintenance Schedule & Quick Actions */}
        <div className="space-y-6">
          <MaintenanceSchedule />
          <MachineActions />
          <OverdueMaintenance />
        </div>
      </div>
    </div>
  );
};

export default MachineModule;
