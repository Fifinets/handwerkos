
import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { UserCheck, Calendar, Clock } from "lucide-react";

interface PersonalStatsProps {
  totalEmployees: number;
  activeEmployees: number;
  onVacationEmployees: number;
  totalHours: number;
}

const PersonalStats = ({ totalEmployees, activeEmployees, onVacationEmployees, totalHours }: PersonalStatsProps) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Mitarbeiter gesamt</p>
              <p className="text-2xl font-bold">{totalEmployees}</p>
            </div>
            <UserCheck className="h-8 w-8 text-blue-600" />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Aktiv</p>
              <p className="text-2xl font-bold">{activeEmployees}</p>
            </div>
            <UserCheck className="h-8 w-8 text-green-600" />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Urlaub</p>
              <p className="text-2xl font-bold">{onVacationEmployees}</p>
            </div>
            <Calendar className="h-8 w-8 text-yellow-600" />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Stunden (Monat)</p>
              <p className="text-2xl font-bold">{totalHours}</p>
            </div>
            <Clock className="h-8 w-8 text-purple-600" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PersonalStats;
