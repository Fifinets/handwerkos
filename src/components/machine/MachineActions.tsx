
import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, CheckCircle, MapPin, Settings } from "lucide-react";

const MachineActions = () => {
  return (
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
  );
};

export default MachineActions;
