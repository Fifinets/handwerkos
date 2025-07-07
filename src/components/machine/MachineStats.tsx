
import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Settings, CheckCircle, Clock, AlertTriangle } from "lucide-react";

const MachineStats = () => {
  return (
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
  );
};

export default MachineStats;
