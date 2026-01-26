
import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

const OverdueMaintenance = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base text-red-600">Wartung überfällig</CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between p-2 bg-red-50 rounded">
            <span className="text-sm">Hubarbeitsbühne</span>
            <span className="text-xs text-red-600">3 Tage</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default OverdueMaintenance;
