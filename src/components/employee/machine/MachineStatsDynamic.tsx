import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Settings, CheckCircle, Clock, AlertTriangle } from 'lucide-react';

/**
 * MachineStatsDynamic renders a set of KPI cards for the machine park based
 * on the provided list of machines. It replaces the previous static
 * implementation by computing the counts dynamically. The component
 * expects each machine to have a `status` field with values like
 * 'Verf\u00fcgbar', 'Im Einsatz' or 'Wartung f\u00e4llig'.
 */
interface Machine {
  id: string;
  status: string;
}

interface MachineStatsDynamicProps {
  machines: Machine[];
}

const MachineStatsDynamic: React.FC<MachineStatsDynamicProps> = ({ machines }) => {
  const total = machines.length;
  const available = machines.filter((m) => m.status === 'Verf\u00fcgbar').length;
  const inUse = machines.filter((m) => m.status === 'Im Einsatz').length;
  const maintenanceDue = machines.filter((m) => m.status === 'Wartung f\u00e4llig').length;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Card>
        <CardContent className="flex items-center justify-between p-4">
          <div>
            <p className="text-sm text-gray-600">Ger\u00e4te gesamt</p>
            <p className="text-lg font-bold">{total}</p>
          </div>
          <Settings className="w-5 h-5 text-blue-500" />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="flex items-center justify-between p-4">
          <div>
            <p className="text-sm text-gray-600">Verf\u00fcgbar</p>
            <p className="text-lg font-bold">{available}</p>
          </div>
          <CheckCircle className="w-5 h-5 text-green-500" />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="flex items-center justify-between p-4">
          <div>
            <p className="text-sm text-gray-600">Im Einsatz</p>
            <p className="text-lg font-bold">{inUse}</p>
          </div>
          <Clock className="w-5 h-5 text-yellow-500" />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="flex items-center justify-between p-4">
          <div>
            <p className="text-sm text-gray-600">Wartung f\u00e4llig</p>
            <p className="text-lg font-bold">{maintenanceDue}</p>
          </div>
          <AlertTriangle className="w-5 h-5 text-red-500" />
        </CardContent>
      </Card>
    </div>
  );
};

export default MachineStatsDynamic;
