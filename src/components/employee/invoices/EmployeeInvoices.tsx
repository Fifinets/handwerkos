// Rechnungen
// Extrahiert aus DesktopEmployeePage.tsx (activeTab === 'invoices')

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useEmployeePermissions } from '@/hooks/useEmployeePermissions';
import { supabase } from '@/integrations/supabase/client';

export function EmployeeInvoices() {
  const { employee, canViewInvoices } = useEmployeePermissions();
  const [invoiceList, setInvoiceList] = useState<any[]>([]);

  useEffect(() => {
    if (employee?.id && canViewInvoices()) {
      fetchInvoices();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employee?.id]);

  const fetchInvoices = async () => {
    if (!employee || !canViewInvoices()) return;
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('company_id', employee.company_id)
        .order('invoice_date', { ascending: false })
        .limit(50);
      if (error) console.error('Invoice fetch error:', error);
      setInvoiceList(data || []);
    } catch (err) {
      console.error('Error fetching invoices:', err);
    }
  };

  const formatDate = (date: string | undefined) => {
    if (!date) return '-';
    return format(new Date(date), 'dd.MM.yyyy', { locale: de });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 }).format(amount);
  };

  const getInvoiceStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Bezahlt</Badge>;
      case 'sent':
      case 'issued':
        return <Badge variant="default">Versendet</Badge>;
      case 'overdue':
        return <Badge variant="destructive">Überfällig</Badge>;
      case 'cancelled':
        return <Badge variant="secondary">Storniert</Badge>;
      case 'draft':
      default:
        return <Badge variant="outline">Entwurf</Badge>;
    }
  };

  if (!canViewInvoices()) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-muted-foreground">Kein Zugriff auf Rechnungen.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Rechnungen</h1>
          <p className="text-muted-foreground">Rechnungsübersicht</p>
        </div>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nr.</TableHead>
              <TableHead>Datum</TableHead>
              <TableHead>Kunde</TableHead>
              <TableHead>Betrag</TableHead>
              <TableHead>Fällig</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoiceList.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Keine Rechnungen vorhanden
                </TableCell>
              </TableRow>
            ) : (
              invoiceList.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell className="font-mono text-sm">{inv.invoice_number}</TableCell>
                  <TableCell>{formatDate(inv.invoice_date)}</TableCell>
                  <TableCell>{inv.snapshot_customer_name || '—'}</TableCell>
                  <TableCell>{formatCurrency(inv.gross_amount || inv.amount || 0)}</TableCell>
                  <TableCell>
                    <span className={inv.due_date && new Date(inv.due_date) < new Date() && inv.status !== 'paid' && inv.status !== 'cancelled' ? 'text-red-600 font-medium' : ''}>
                      {formatDate(inv.due_date)}
                    </span>
                  </TableCell>
                  <TableCell>{getInvoiceStatusBadge(inv.status)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

export default EmployeeInvoices;
