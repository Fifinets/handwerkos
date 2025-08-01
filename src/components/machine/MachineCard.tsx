
import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, AlertTriangle, CheckCircle, Clock, Wrench } from "lucide-react";

interface Machine {
  id: string;
  name: string;
  category: string;
  location: string;
  status: string;
  lastMaintenance: string;
  nextMaintenance: string;
  dguv: string;
  nextDguv: string;
  operatingHours: number;
  condition: string;
}

interface MachineCardProps {
  machine: Machine;
}

const MachineCard = ({ machine }: MachineCardProps) => {
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Verfügbar': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'Im Einsatz': return <Clock className="h-4 w-4 text-blue-600" />;
      case 'Wartung fällig': return <AlertTriangle className="h-4 w-4 text-red-600" />;
      case 'In Wartung': return <Wrench className="h-4 w-4 text-yellow-600" />;
      default: return <CheckCircle className="h-4 w-4 text-gray-600" />;
    }
  };

  return (
    <Card className="hover:shadow-lg transition-shadow">
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
  );
};

export default MachineCard;
