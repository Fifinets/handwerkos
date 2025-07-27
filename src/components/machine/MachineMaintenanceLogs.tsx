import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/use-toast';

interface MaintenanceLog {
  id: string;
  machine_id: string;
  date: string;
  description: string;
  parts_replaced?: string | null;
}

interface MachineMaintenanceLogsProps {
  machineId: string;
}

/**
 * MachineMaintenanceLogs manages and displays maintenance logs for a single
 * machine. It loads logs from Supabase on mount and allows the user to add
 * new logs via a simple form. Logs include the maintenance date, a
 * description of the work carried out and optional information about
 * replaced parts.
 */
const MachineMaintenanceLogs: React.FC<MachineMaintenanceLogsProps> = ({ machineId }) => {
  const [logs, setLogs] = useState<MaintenanceLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [newLog, setNewLog] = useState({ date: '', description: '', parts_replaced: '' });

  const fetchLogs = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('machine_logs')
      .select('*')
      .eq('machine_id', machineId)
      .order('date', { ascending: false });
    if (error) {
      console.error(error);
      toast({ title: 'Fehler beim Laden', description: error.message });
    } else {
      setLogs((data ?? []) as MaintenanceLog[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchLogs();
  }, [machineId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLog.date || !newLog.description) {
      toast({ title: 'Bitte ausfüllen', description: 'Datum und Beschreibung sind erforderlich.' });
      return;
    }
    const { error } = await supabase.from('machine_logs').insert({
      machine_id: machineId,
      date: newLog.date,
      description: newLog.description,
      parts_replaced: newLog.parts_replaced || null,
    });
    if (error) {
      console.error(error);
      toast({ title: 'Speichern fehlgeschlagen', description: error.message });
    } else {
      toast({ title: 'Wartung protokolliert', description: 'Der Eintrag wurde gespeichert.' });
      setNewLog({ date: '', description: '', parts_replaced: '' });
      fetchLogs();
    }
  };

  return (
    <div className="mt-4">
      <h3 className="font-semibold mb-2">Wartungsprotokolle</h3>
      {loading ? (
        <p>Lade Einträge...</p>
      ) : logs.length === 0 ? (
        <p>Keine Wartungsprotokolle vorhanden.</p>
      ) : (
        <ul className="space-y-2 mb-4">
          {logs.map((log) => (
            <li key={log.id} className="p-2 border rounded-md">
              <div className="text-sm text-gray-500">{log.date}</div>
              <div className="font-medium">{log.description}</div>
              {log.parts_replaced && (
                <div className="text-sm text-gray-600">
                  Ersatzteile: {log.parts_replaced}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={handleSubmit} className="space-y-2">
        <div className="flex space-x-2">
          <input
            type="date"
            className="border p-2 flex-1"
            value={newLog.date}
            onChange={(e) => setNewLog({ ...newLog, date: e.target.value })}
          />
          <input
            type="text"
            placeholder="Beschreibung"
            className="border p-2 flex-1"
            value={newLog.description}
            onChange={(e) => setNewLog({ ...newLog, description: e.target.value })}
          />
        </div>
        <input
          type="text"
          placeholder="Ersatzteile (optional)"
          className="border p-2 w-full"
          value={newLog.parts_replaced}
          onChange={(e) => setNewLog({ ...newLog, parts_replaced: e.target.value })}
        />
        <Button type="submit">Protokoll hinzufügen</Button>
      </form>
    </div>
  );
};

export default MachineMaintenanceLogs;
