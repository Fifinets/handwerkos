import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';

interface MaterialSerialManagementProps {
  /**
   * ID of the material for which serial numbers are managed. Only serials
   * associated with this material will be fetched and edited.
   */
  materialId: string;
}

interface SerialEntry {
  id: string;
  serial_number: string;
  batch?: string | null;
  status?: string | null;
}

/**
 * MaterialSerialManagement handles the creation and listing of serial numbers
 * for a specific material. It loads existing serial entries from the
 * `material_serials` table and provides a form to add new serial numbers
 * (optionally with batch number and status). A future improvement could
 * include barcode generation and scanning capabilities.
 */
const MaterialSerialManagement: React.FC<MaterialSerialManagementProps> = ({ materialId }) => {
  const [serials, setSerials] = useState<SerialEntry[]>([]);
  const [newSerial, setNewSerial] = useState({ serial_number: '', batch: '', status: 'verfügbar' });
  const [loading, setLoading] = useState(true);

  const fetchSerials = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('material_serials')
      .select('*')
      .eq('material_id', materialId)
      .order('created_at', { ascending: false });
    if (error) {
      console.error(error);
      toast({ title: 'Fehler', description: 'Seriennummern konnten nicht geladen werden.' });
    } else {
      setSerials(data as SerialEntry[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSerials();
  }, [materialId]);

  const handleAddSerial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSerial.serial_number) {
      toast({ title: 'Seriennummer erforderlich', description: 'Bitte geben Sie eine Seriennummer ein.' });
      return;
    }
    const { error } = await supabase.from('material_serials').insert({
      material_id: materialId,
      serial_number: newSerial.serial_number,
      batch: newSerial.batch || null,
      status: newSerial.status || 'verfügbar',
    });
    if (error) {
      console.error(error);
      toast({ title: 'Speichern fehlgeschlagen', description: error.message });
    } else {
      toast({ title: 'Seriennummer hinzugefügt', description: `${newSerial.serial_number} gespeichert.` });
      setNewSerial({ serial_number: '', batch: '', status: 'verfügbar' });
      fetchSerials();
    }
  };

  return (
    <div className="mt-6">
      <h3 className="font-semibold mb-2">Seriennummern / Chargen</h3>
      {loading ? (
        <p>Lade...</p>
      ) : serials.length === 0 ? (
        <p>Keine Seriennummern erfasst.</p>
      ) : (
        <table className="w-full text-sm mb-4 border-collapse">
          <thead>
            <tr>
              <th className="border-b pb-1 text-left">Seriennummer</th>
              <th className="border-b pb-1 text-left">Charge</th>
              <th className="border-b pb-1 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {serials.map((s) => (
              <tr key={s.id} className="border-b last:border-b-0">
                <td className="py-1 pr-2 font-mono">{s.serial_number}</td>
                <td className="py-1 pr-2">{s.batch || '-'}</td>
                <td className="py-1 pr-2">{s.status || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <form onSubmit={handleAddSerial} className="space-y-2">
        <input
          type="text"
          placeholder="Seriennummer"
          value={newSerial.serial_number}
          onChange={(e) => setNewSerial({ ...newSerial, serial_number: e.target.value })}
          className="border p-2 w-full"
        />
        <input
          type="text"
          placeholder="Charge (optional)"
          value={newSerial.batch}
          onChange={(e) => setNewSerial({ ...newSerial, batch: e.target.value })}
          className="border p-2 w-full"
        />
        <select
          value={newSerial.status}
          onChange={(e) => setNewSerial({ ...newSerial, status: e.target.value })}
          className="border p-2 w-full"
        >
          <option value="verfügbar">Verfügbar</option>
          <option value="reserviert">Reserviert</option>
          <option value="verbraucht">Verbraucht</option>
        </select>
        <Button type="submit">Seriennummer hinzufügen</Button>
      </form>
      <p className="text-xs mt-4 text-gray-500">
        Hinweis: Barcode- oder QR-Code-Erstellung kann hier integriert werden, indem die
        Seriennummer als Datenquelle für einen Barcode-Generator (z.&nbsp;B. react-qrcode)
        verwendet wird.
      </p>
    </div>
  );
};

export default MaterialSerialManagement;
