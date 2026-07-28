// Material-Tab der Projekt-Detailansicht.
// Zeigt verbuchtes Material (useProjectMaterialUsage) und erlaubt das Verbuchen
// neuen Materials über den MaterialUsageDialog.

import { useState } from 'react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
import { useProjectMaterialUsage } from '@/hooks/useEmployeeMaterialUsage';
import { MaterialUsageDialog } from '@/components/employee/projects/MaterialUsageDialog';

interface ProjectMaterialTabProps {
  projectId: string;
}

// Die verschachtelten Selects (material:materials, employee:employees) sind vom
// Supabase-Client nur locker typisiert — hier explizit auf die tatsächlich
// benötigte Form gecastet.
interface MaterialUsageRow {
  id: string;
  quantity_used: number;
  notes: string | null;
  usage_date: string;
  created_at: string;
  material: { name: string; unit: string; sku: string | null; unit_price: number | null } | null;
  employee: { first_name: string; last_name: string } | null;
}

const formatDate = (date: string | undefined) => {
  if (!date) return '-';
  return format(new Date(date), 'dd.MM.yyyy', { locale: de });
};

const formatEUR = (value: number) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value);

export function ProjectMaterialTab({ projectId }: ProjectMaterialTabProps) {
  const { canViewPrices } = useEmployeePermissions();
  const showPrices = canViewPrices();
  const { data, isLoading } = useProjectMaterialUsage(projectId, showPrices);
  const rows = (data ?? []) as unknown as MaterialUsageRow[];

  const [dialogOpen, setDialogOpen] = useState(false);
  const colSpan = showPrices ? 6 : 5;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">Verbuchtes Material für dieses Projekt</p>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Material verbuchen
        </Button>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Datum</TableHead>
              <TableHead>Material</TableHead>
              <TableHead>Menge</TableHead>
              {showPrices && <TableHead>Wert</TableHead>}
              <TableHead>Notiz</TableHead>
              <TableHead>Erfasst von</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={colSpan} className="text-center py-8">
                  Wird geladen...
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={colSpan} className="text-center py-8 text-muted-foreground">
                  Noch kein Material verbucht.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => {
                const value =
                  row.material?.unit_price != null ? row.material.unit_price * row.quantity_used : null;
                return (
                  <TableRow key={row.id}>
                    <TableCell>{formatDate(row.usage_date)}</TableCell>
                    <TableCell>{row.material?.name ?? '—'}</TableCell>
                    <TableCell>
                      {row.quantity_used} {row.material?.unit ?? ''}
                    </TableCell>
                    {showPrices && <TableCell>{value != null ? formatEUR(value) : '—'}</TableCell>}
                    <TableCell className="max-w-xs truncate">{row.notes ?? '—'}</TableCell>
                    <TableCell>
                      {row.employee ? `${row.employee.first_name} ${row.employee.last_name}` : '—'}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      <MaterialUsageDialog open={dialogOpen} onOpenChange={setDialogOpen} projectId={projectId} />
    </div>
  );
}

export default ProjectMaterialTab;
