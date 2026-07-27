// Zeiterfassung
// Extrahiert aus DesktopEmployeePage.tsx (activeTab === 'timesheet')

import { useEffect, useState } from 'react';
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
import { TimeEntryDialog } from './TimeEntryDialog';

interface Project {
  id: string;
  name: string;
}

interface TimeEntry {
  id: string;
  project_id: string;
  project_name?: string;
  start_time: string;
  end_time?: string;
  description?: string;
  status: string;
}

export function EmployeeTimesheet() {
  const { employee } = useEmployeePermissions();

  const [projects, setProjects] = useState<Project[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [timeEntryDialogOpen, setTimeEntryDialogOpen] = useState(false);

  useEffect(() => {
    if (employee?.id) {
      fetchProjects();
      fetchTimeEntries();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employee?.id]);

  const fetchProjects = async () => {
    if (!employee) return;
    try {
      const { data: teamProjects, error } = await supabase
        .from('project_team_assignments')
        .select(`
          project_id,
          projects ( id, name )
        `)
        .eq('employee_id', employee.id);

      if (error) throw error;

      const projectList: Project[] = (teamProjects || [])
        .filter(tp => tp.projects)
        .map(tp => ({ id: tp.projects.id, name: tp.projects.name }));

      setProjects(projectList);
    } catch (err) {
      console.error('Error fetching projects:', err);
    }
  };

  const fetchTimeEntries = async () => {
    if (!employee) return;
    try {
      const { data, error } = await supabase
        .from('time_entries')
        .select(`
          id,
          project_id,
          start_time,
          end_time,
          description,
          status,
          projects (name)
        `)
        .eq('employee_id', employee.id)
        .order('start_time', { ascending: false })
        .limit(50);

      if (error) throw error;

      setTimeEntries((data || []).map(entry => ({
        ...entry,
        project_name: entry.projects?.name,
      })));
    } catch (err) {
      console.error('Error fetching time entries:', err);
    }
  };

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

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Zeiterfassung</h1>
          <p className="text-muted-foreground">Meine erfassten Arbeitszeiten</p>
        </div>
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
              <TableHead>Projekt</TableHead>
              <TableHead>Start</TableHead>
              <TableHead>Ende</TableHead>
              <TableHead>Stunden</TableHead>
              <TableHead>Beschreibung</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {timeEntries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  Keine Zeiteinträge vorhanden
                </TableCell>
              </TableRow>
            ) : (
              timeEntries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>{formatDate(entry.start_time)}</TableCell>
                  <TableCell>{entry.project_name || '-'}</TableCell>
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
        projects={projects}
        onSaved={fetchTimeEntries}
      />
    </div>
  );
}

export default EmployeeTimesheet;
