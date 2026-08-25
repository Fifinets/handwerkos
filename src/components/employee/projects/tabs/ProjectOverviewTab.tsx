// Überblick-Tab der Projekt-Detailansicht.
// Zeigt Stammdaten und bietet Schnellaktionen (Zeit erfassen, Material verbuchen, Notiz).

import { useState } from 'react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, Package, StickyNote } from 'lucide-react';
import { TimeEntryDialog } from '@/components/employee/timesheet/TimeEntryDialog';
import { ProjectStatusBadge } from '../projectStatusBadge';

export interface ProjectOverviewData {
  id: string;
  name: string;
  status: string;
  location?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  customers?: { company_name: string | null } | null;
}

interface ProjectOverviewTabProps {
  project: ProjectOverviewData;
  onNavigateTab?: (tab: string) => void;
}

const formatDate = (date?: string | null) => {
  if (!date) return '-';
  return format(new Date(date), 'dd.MM.yyyy', { locale: de });
};

export function ProjectOverviewTab({ project, onNavigateTab }: ProjectOverviewTabProps) {
  const [timeEntryDialogOpen, setTimeEntryDialogOpen] = useState(false);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Stammdaten</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Kunde</p>
            <p className="text-sm font-medium mt-0.5">{project.customers?.company_name || '-'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Ort</p>
            <p className="text-sm font-medium mt-0.5">{project.location || '-'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Zeitraum</p>
            <p className="text-sm font-medium mt-0.5">
              {formatDate(project.start_date)} - {formatDate(project.end_date)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Status</p>
            <div className="mt-0.5">
              <ProjectStatusBadge status={project.status} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Schnellaktionen</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button onClick={() => setTimeEntryDialogOpen(true)}>
            <Clock className="h-4 w-4 mr-2" /> Zeit erfassen
          </Button>
          <Button variant="outline" onClick={() => onNavigateTab?.('material')}>
            <Package className="h-4 w-4 mr-2" /> Material verbuchen
          </Button>
          <Button variant="outline" onClick={() => onNavigateTab?.('notizen')}>
            <StickyNote className="h-4 w-4 mr-2" /> Notiz
          </Button>
        </CardContent>
      </Card>

      <TimeEntryDialog
        open={timeEntryDialogOpen}
        onOpenChange={setTimeEntryDialogOpen}
        projects={[{ id: project.id, name: project.name }]}
        defaultProjectId={project.id}
      />
    </div>
  );
}

export default ProjectOverviewTab;
