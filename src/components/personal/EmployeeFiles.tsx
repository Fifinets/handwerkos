import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface EmployeeFile {
  id: string;
  employee_id: string;
  file_name: string;
  file_url: string;
  file_type?: string | null;
  expiry_date?: string | null;
}

interface EmployeeFilesProps {
  /** ID of the employee whose files are managed */
  employeeId: string;
}

/**
 * EmployeeFiles manages uploading and listing of documents for a single employee.
 * Files are stored in the `employee-files` bucket and referenced via the
 * `employee_files` table in Supabase. Optionally, each file can have a
 * type/category and an expiry date, which allows the UI to highlight
 * certifications or documents that will expire soon.
 */
const EmployeeFiles: React.FC<EmployeeFilesProps> = ({ employeeId }) => {
  const { toast } = useToast();
  const [files, setFiles] = useState<EmployeeFile[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [fileType, setFileType] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchFiles = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('employee_files')
      .select('*')
      .eq('employee_id', employeeId)
      .order('created_at', { ascending: false });
    if (error) {
      console.error(error);
      toast({
        title: 'Fehler',
        description: 'Mitarbeiterdokumente konnten nicht geladen werden.',
      });
    } else {
      setFiles(data as EmployeeFile[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchFiles();
  }, [employeeId]);

  const handleUpload = async () => {
    if (!file) {
      toast({
        title: 'Keine Datei ausgewählt',
        description: 'Bitte wählen Sie eine Datei aus.',
      });
      return;
    }
    const filePath = `${employeeId}/${file.name}`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('employee-files')
      .upload(filePath, file);
    if (uploadError) {
      console.error(uploadError);
      toast({ title: 'Upload fehlgeschlagen', description: uploadError.message });
      return;
    }
    // get public url
    const { data: publicUrlData } = supabase.storage
      .from('employee-files')
      .getPublicUrl(filePath);
    const publicUrl = publicUrlData?.publicUrl;
    // insert record
    const { error: insertError } = await supabase.from('employee_files').insert({
      employee_id: employeeId,
      file_name: file.name,
      file_url: publicUrl,
      file_type: fileType || null,
      expiry_date: expiryDate || null,
    });
    if (insertError) {
      console.error(insertError);
      toast({ title: 'Speichern fehlgeschlagen', description: insertError.message });
    } else {
      toast({ title: 'Datei hochgeladen', description: `${file.name} wurde gespeichert.` });
      setFile(null);
      setFileType('');
      setExpiryDate('');
      fetchFiles();
    }
  };

  // Highlight files expiring within 30 days
  const isExpiringSoon = (expiry: string | null | undefined) => {
    if (!expiry) return false;
    const expiryDate = new Date(expiry);
    const now = new Date();
    const diff = expiryDate.getTime() - now.getTime();
    const days = diff / (1000 * 60 * 60 * 24);
    return days <= 30;
  };

  return (
    <div className="mt-6">
      <h3 className="font-semibold mb-2">Mitarbeiterdokumente</h3>
      {loading ? (
        <p>Lade...</p>
      ) : files.length === 0 ? (
        <p>Keine Dokumente vorhanden.</p>
      ) : (
        <table className="w-full text-sm mb-4 border-collapse">
          <thead>
            <tr>
              <th className="border-b pb-1 text-left">Datei</th>
              <th className="border-b pb-1 text-left">Typ</th>
              <th className="border-b pb-1 text-left">Ablaufdatum</th>
              <th className="border-b pb-1 text-left">Aktion</th>
            </tr>
          </thead>
          <tbody>
            {files.map((f) => (
              <tr key={f.id} className={`border-b last:border-b-0 ${isExpiringSoon(f.expiry_date) ? 'bg-yellow-50' : ''}`}>
                <td className="py-1 pr-2">
                  <a href={f.file_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
                    {f.file_name}
                  </a>
                </td>
                <td className="py-1 pr-2">{f.file_type || '-'}</td>
                <td className="py-1 pr-2">{f.expiry_date ? f.expiry_date.substring(0, 10) : '-'}</td>
                <td className="py-1 pr-2">
                  {/* Placeholder for future actions such as delete or edit */}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="mt-4 space-y-2">
        <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="border p-2 w-full" />
        <input
          type="text"
          placeholder="Typ (z.B. Zertifikat, Vertrag)"
          value={fileType}
          onChange={(e) => setFileType(e.target.value)}
          className="border p-2 w-full"
        />
        <input
          type="date"
          placeholder="Ablaufdatum"
          value={expiryDate}
          onChange={(e) => setExpiryDate(e.target.value)}
          className="border p-2 w-full"
        />
        <Button onClick={handleUpload}>Datei hochladen</Button>
      </div>
      <p className="text-xs mt-3 text-gray-500">
        Dokumente mit einem Ablaufdatum in den nächsten 30 Tagen werden gelb hervorgehoben. Nutzen Sie diese Funktion,
        um rechtzeitig an ablaufende Zertifikate oder Schulungen zu denken.
      </p>
    </div>
  );
};

export default EmployeeFiles;
