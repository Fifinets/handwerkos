
import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GraduationCap, Calendar, Clock, Shield } from "lucide-react";

interface PersonalSidebarProps {
  onQuickAction: (action: string) => void;
}

const PersonalSidebar = ({ onQuickAction }: PersonalSidebarProps) => {
  const upcomingTraining = [
    { employee: 'Keine Schulungen geplant', training: '', date: '', type: 'Info' }
  ];

  const getTrainingTypeColor = (type: string) => {
    switch (type) {
      case 'Pflicht': return 'bg-red-100 text-red-800';
      case 'Weiterbildung': return 'bg-blue-100 text-blue-800';
      case 'Info': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
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
            {upcomingTraining.map((training) => (
              <div key={training.employee} className="p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <Badge className={getTrainingTypeColor(training.type)}>
                    {training.type}
                  </Badge>
                </div>
                <p className="font-medium text-sm mb-1">{training.employee}</p>
                {training.training && <p className="text-sm text-gray-600 mb-1">{training.training}</p>}
                {training.date && (
                  <p className="text-xs text-gray-500 flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {training.date}
                  </p>
                )}
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
              onClick={() => onQuickAction('Urlaub planen')}
            >
              <Calendar className="h-4 w-4 mr-2" />
              Urlaub planen
            </Button>
            <Button
              variant="outline" 
              className="w-full justify-start"
              onClick={() => onQuickAction('Arbeitszeiten')}
            >
              <Clock className="h-4 w-4 mr-2" />
              Arbeitszeiten
            </Button>
            <Button
              variant="outline" 
              className="w-full justify-start"
              onClick={() => onQuickAction('Schulung buchen')}
            >
              <GraduationCap className="h-4 w-4 mr-2" />
              Schulung buchen
            </Button>
            <Button
              variant="outline" 
              className="w-full justify-start"
              onClick={() => onQuickAction('Zertifikate')}
            >
              <Shield className="h-4 w-4 mr-2" />
              Zertifikate
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PersonalSidebar;
