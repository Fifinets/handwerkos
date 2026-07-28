// Zeit-Tab der Projekt-Detailansicht.
// Zeigt die eigenen Zeiteinträge dieses Projekts, erlaubt neue Erfassung.
// Basierend auf DesktopEmployeePage.tsx (ehemals :880-919), auf dieses Projekt gefiltert.

import { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus } from 'lucide-react';
import { useEmployeePermissions } from '@/hooks/useEmployeePermissions';
import { supabase } from '@/integrations/supabase/client';
import { TimeEntryDialog } from '@/components/employee/timesheet/TimeEntryDialog';

interface ProjectTimeTabProps {
  projectId: string;
  projectName: string;
}

interface TimeEntry {
  id: string;
  start_time: string;
  end_time?: string;
  description?: string;
  status: string;
}

const formatDate = (date: string | undefined) => {
  if (!date) return '-';
  return format(new Date(date), 'dd.MM.yyyy', { locale: de });
};

const formatTime = (datetime: string | undefined) => {
  if (!datetime) return '-';
  return format(new Date(datetime), 'HH:mm', { locale: de });
};

const calculateHours = (start: string, end?: string) => {
  if (!end) return '-';
  const diff = new Date(end).getTime() - new Date(start).getTime();
  return (diff / (1000 * 60 * 60)).toFixed(1) + 'h';
};

export function ProjectTimeTab({ projectId, projectName }: ProjectTimeTabProps) {
  const { employee } = useEmployeePermissions();
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [timeEntryDialogOpen, setTimeEntryDialogOpen] = useState(false);

  const fetchTimeEntries = useCallback(async () => {
    if (!employee?.id) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('time_entries')
        .select('id, start_time, end_time, description, status')
        .eq('employee_id', employee.id)
        .eq('project_id', projectId)
        .order('start_time', { ascending: false });

      if (error) throw error;
      setTimeEntries(data || []);
    } catch (err) {
      console.error('Error fetching time entries:', err);
    } finally {
      setIsLoading(false);
    }
  }, [employee?.id, projectId]);

  useEffect(() => {
    fetchTimeEntries();
  }, [fetchTimeEntries]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">Meine erfassten Arbeitszeiten für dieses Projekt</p>
        <Button onClick={() => setTimeEntryDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Zeit erfassen
        </Button>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Datum</TableHead>
              <TableHead>Start</TableHead>
              <TableHead>Ende</TableHead>
              <TableHead>Stunden</TableHead>
              <TableHead>Beschreibung</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  Wird geladen...
                </TableCell>
              </TableRow>
            ) : timeEntries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Keine Zeiteinträge vorhanden
                </TableCell>
              </TableRow>
            ) : (
              timeEntries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>{formatDate(entry.start_time)}</TableCell>
                  <TableCell>{formatTime(entry.start_time)}</TableCell>
                  <TableCell>{formatTime(entry.end_time)}</TableCell>
                  <TableCell>{calculateHours(entry.start_time, entry.end_time)}</TableCell>
                  <TableCell className="max-w-xs truncate">
                    {entry.description || '-'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={entry.status === 'approved' ? 'default' : 'outline'}>
                      {entry.status === 'approved' ? 'Bestätigt' : entry.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <TimeEntryDialog
        open={timeEntryDialogOpen}
        onOpenChange={setTimeEntryDialogOpen}
        projects={[{ id: projectId, name: projectName }]}
        defaultProjectId={projectId}
        onSaved={fetchTimeEntries}
      />
    </div>
  );
}

export default ProjectTimeTab;
