import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  WifiOff,
  MapPin
} from "lucide-react";

interface InfoViewProps {
  user: any;
  userRole: string;
  assignedProjects: any[];
  isOnline: boolean;
  currentLocation: any;
}

export const InfoView: React.FC<InfoViewProps> = ({
  user,
  userRole,
  assignedProjects,
  isOnline,
  currentLocation
}) => {
  return (
    <div className="space-y-4 w-full overflow-hidden">
      {/* Aktuelle Projekt-Übersicht */}
      {assignedProjects.length > 0 && (
        <Card>
          <CardHeader className="p-4">
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Meine Projekte
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="space-y-3">
              {assignedProjects.slice(0, 3).map((project, index) => (
                <div key={project.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium">{project.name}</p>
                    <p className="text-sm text-gray-600">{project.location}</p>
                  </div>
                  <Badge variant={project.status === 'aktiv' ? 'default' : 'secondary'}>
                    {project.status || 'Aktiv'}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {!isOnline && (
        <Card className="border-orange-400 bg-orange-50">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-orange-700">
              <WifiOff className="h-4 w-4" />
              <span className="font-medium">Offline-Modus</span>
            </div>
            <p className="text-orange-600 text-sm mt-1">
              Daten werden bei nächster Verbindung synchronisiert.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};