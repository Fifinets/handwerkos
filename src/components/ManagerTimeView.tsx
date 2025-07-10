import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Clock, 
  Users,
  Eye,
  BarChart3
} from "lucide-react";

const ManagerTimeView = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Arbeitszeit-Management
        </CardTitle>
        <CardDescription>
          Als Manager haben Sie Zugriff auf erweiterte Arbeitszeit-Funktionen
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Button variant="outline" className="h-16 flex-col">
            <Users className="h-6 w-6 mb-2" />
            <span>Mitarbeiter-Zeiten</span>
          </Button>
          <Button variant="outline" className="h-16 flex-col">
            <Eye className="h-6 w-6 mb-2" />
            <span>Live-Tracking</span>
          </Button>
          <Button variant="outline" className="h-16 flex-col">
            <BarChart3 className="h-6 w-6 mb-2" />
            <span>Zeitauswertung</span>
          </Button>
          <Button variant="outline" className="h-16 flex-col">
            <Clock className="h-6 w-6 mb-2" />
            <span>Korrekturen</span>
          </Button>
        </div>
        
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>Manager-Hinweis:</strong> Die GPS-basierte Arbeitszeit-Erfassung ist nur für Mitarbeiter verfügbar. 
            Als Manager können Sie die Zeiten Ihrer Mitarbeiter überwachen und verwalten.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default ManagerTimeView;