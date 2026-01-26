
import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "lucide-react";

interface MaintenanceItem {
  machine: string;
  type: string;
  date: string;
  priority: string;
}

const MaintenanceSchedule = () => {
  const upcomingMaintenance: MaintenanceItem[] = [
    { machine: 'Hubarbeitsbühne Genie GS-1932', type: 'Wartung', date: '20.01.2024', priority: 'Hoch' },
    { machine: 'Bohrmaschine Hilti TE 6-A36', type: 'Wartung', date: '15.03.2024', priority: 'Mittel' },
    { machine: 'Kabelzuggerät Greenlee 855GX', type: 'Wartung', date: '08.04.2024', priority: 'Niedrig' },
    { machine: 'Messgerät Fluke 1587', type: 'DGUV V3', date: '05.01.2025', priority: 'Niedrig' }
  ];

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'Hoch': return 'bg-red-100 text-red-800';
      case 'Mittel': return 'bg-yellow-100 text-yellow-800';
      case 'Niedrig': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Wartungsplan
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {upcomingMaintenance.map((maintenance) => (
            <div key={`${maintenance.machine}-${maintenance.date}`} className="p-3 bg-gray-50 rounded-lg">
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
  );
};

export default MaintenanceSchedule;
