// Projekt-Hub „Meine Projekte" — Liste der zugewiesenen Projekte, Zeile führt in die Detailansicht.
// Basierend auf DesktopEmployeePage.tsx (ehemals :711-761), ohne die Lieferschein-Aktion pro Zeile.

import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useEmployeePermissions } from '@/hooks/useEmployeePermissions';
import { useEmployeeProjects } from '@/hooks/useEmployeeProjects';
import { ProjectStatusBadge } from './projectStatusBadge';

const formatDate = (date: string | undefined) => {
  if (!date) return '-';
  return format(new Date(date), 'dd.MM.yyyy', { locale: de });
};

export function ProjectList() {
  const navigate = useNavigate();
  const { employee } = useEmployeePermissions();
  const { data: projects = [], isLoading } = useEmployeeProjects(employee?.id);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Meine Projekte</h1>
          <p className="text-muted-foreground">Projekte, denen du zugewiesen bist</p>
        </div>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Projekt</TableHead>
              <TableHead>Kunde</TableHead>
              <TableHead>Ort</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Zeitraum</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8">
                  Wird geladen...
                </TableCell>
              </TableRow>
            ) : projects.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  Keine Projekte zugewiesen
                </TableCell>
              </TableRow>
            ) : (
              projects.map((project) => (
                <TableRow
                  key={project.id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/employee/projekt/${project.id}`)}
                >
                  <TableCell className="font-medium">{project.name}</TableCell>
                  <TableCell>{project.customer_name || '-'}</TableCell>
                  <TableCell>{project.location || '-'}</TableCell>
                  <TableCell>
                    <ProjectStatusBadge status={project.status} />
                  </TableCell>
                  <TableCell>
                    {formatDate(project.start_date)} - {formatDate(project.end_date)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

export default ProjectList;
