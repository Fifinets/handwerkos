// Urlaub
// Extrahiert aus DesktopEmployeePage.tsx (activeTab === 'vacation')

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { VacationRequestDialog } from '@/components/VacationRequestDialog';
import { supabase } from '@/integrations/supabase/client';

export function EmployeeVacation() {
  const { employee } = useEmployeePermissions();

  const [vacationRequests, setVacationRequests] = useState<any[]>([]);
  const [vacationDays, setVacationDays] = useState({ total: 30, used: 0 });
  const [vacationDialogOpen, setVacationDialogOpen] = useState(false);

  useEffect(() => {
    if (employee?.id) {
      fetchVacation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employee?.id]);

  const fetchVacation = async () => {
    if (!employee) return;
    try {
      const { data, error } = await supabase
        .from('vacation_requests')
        .select('*')
        .eq('employee_id', employee.id)
        .order('start_date', { ascending: false });
      if (error) console.error('Vacation fetch error:', error);
      setVacationRequests(data || []);

      const { data: empVacation } = await supabase
        .from('employees')
        .select('vacation_days_total, vacation_days_used')
        .eq('id', employee.id)
        .single();
      if (empVacation) {
        setVacationDays({
          total: empVacation.vacation_days_total || 30,
          used: empVacation.vacation_days_used || 0,
        });
      }
    } catch (err) {
      console.error('Error fetching vacation data:', err);
    }
  };

  const formatDate = (date: string | undefined) => {
    if (!date) return '-';
    return format(new Date(date), 'dd.MM.yyyy', { locale: de });
  };

  const getVacationStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Genehmigt</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Abgelehnt</Badge>;
      case 'pending':
      default:
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Ausstehend</Badge>;
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Urlaub</h1>
          <p className="text-muted-foreground">Urlaubsanträge verwalten</p>
        </div>
        <Button onClick={() => setVacationDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Urlaub beantragen
        </Button>
      </div>

      {/* Vacation KPI Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Gesamtanspruch</CardDescription>
            <CardTitle className="text-2xl">{vacationDays.total} Tage</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Genommen</CardDescription>
            <CardTitle className="text-2xl">{vacationDays.used} Tage</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Resturlaub</CardDescription>
            <CardTitle className="text-2xl">{vacationDays.total - vacationDays.used} Tage</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Vacation Requests Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Zeitraum</TableHead>
              <TableHead>Tage</TableHead>
              <TableHead>Grund</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {vacationRequests.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                  Keine Urlaubsanträge vorhanden
                </TableCell>
              </TableRow>
            ) : (
              vacationRequests.map((req) => (
                <TableRow key={req.id}>
                  <TableCell>
                    {formatDate(req.start_date)} – {formatDate(req.end_date)}
                  </TableCell>
                  <TableCell>{req.days_requested}</TableCell>
                  <TableCell>{req.reason || '—'}</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      {getVacationStatusBadge(req.status)}
                      {req.rejection_reason && (
                        <span className="text-xs text-red-600">{req.rejection_reason}</span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Vacation Dialog */}
      <VacationRequestDialog
        open={vacationDialogOpen}
        onOpenChange={setVacationDialogOpen}
        onSuccess={fetchVacation}
      />
    </div>
  );
}

export default EmployeeVacation;
