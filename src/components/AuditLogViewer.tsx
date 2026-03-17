import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  FileText,
  Search,
  History,
  AlertCircle
} from 'lucide-react';
import { AuditLogService, AuditLog, AuditAction, AuditEntityType } from '@/services/auditLogService';

const ACTION_COLORS: Record<AuditAction, string> = {
  CREATE: 'bg-green-100 text-green-800',
  UPDATE: 'bg-blue-100 text-blue-800',
  DELETE: 'bg-red-100 text-red-800',
  VIEW: 'bg-slate-100 text-slate-800',
  PRINT: 'bg-slate-100 text-slate-800',
  EXPORT: 'bg-indigo-100 text-indigo-800',
  SEND: 'bg-sky-100 text-sky-800',
  APPROVE: 'bg-emerald-100 text-emerald-800',
  REJECT: 'bg-orange-100 text-orange-800',
  CANCEL: 'bg-zinc-100 text-zinc-800',
  RESTORE: 'bg-teal-100 text-teal-800',
};

const ENTITY_LABELS: Record<AuditEntityType, string> = {
  customer: 'Kunde',
  invoice: 'Rechnung',
  quote: 'Angebot',
  order: 'Auftrag',
  project: 'Projekt',
  timesheet: 'Zeiterfassung',
  material: 'Material',
  expense: 'Ausgabe',
  employee: 'Mitarbeiter',
  document: 'Dokument',
  payment: 'Zahlung',
};

export function AuditLogViewer() {
  const [page, setPage] = useState(1);
  const [entityFilter, setEntityFilter] = useState<AuditEntityType | 'ALL'>('ALL');
  const [actionFilter, setActionFilter] = useState<AuditAction | 'ALL'>('ALL');

  const { data, isLoading, error } = useQuery({
    queryKey: ['audit-logs', page, entityFilter, actionFilter],
    queryFn: async () => {
      return AuditLogService.getAuditLogs(
        { page, limit: 15, sort_by: 'timestamp', sort_order: 'desc' },
        { 
          entity_type: entityFilter === 'ALL' ? undefined : entityFilter,
          action: actionFilter === 'ALL' ? undefined : actionFilter 
        }
      );
    }
  });

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5 text-muted-foreground" />
          Audit Log
        </CardTitle>
        <CardDescription>
          GoBD-konformes Protokoll aller systemrelevanten Änderungen
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex gap-4 mb-4">
          <div className="w-[200px]">
            <Select value={entityFilter} onValueChange={(v) => setEntityFilter(v as AuditEntityType | 'ALL')}>
              <SelectTrigger>
                <SelectValue placeholder="Alle Entitäten" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Alle Entitäten</SelectItem>
                {Object.entries(ENTITY_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-[200px]">
            <Select value={actionFilter} onValueChange={(v) => setActionFilter(v as AuditAction | 'ALL')}>
              <SelectTrigger>
                <SelectValue placeholder="Alle Aktionen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Alle Aktionen</SelectItem>
                {Object.keys(ACTION_COLORS).map((action) => (
                  <SelectItem key={action} value={action}>{action}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Zeitpunkt</TableHead>
                <TableHead>Benutzer</TableHead>
                <TableHead>Aktion</TableHead>
                <TableHead>Entität</TableHead>
                <TableHead>ID</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Lade Audit-Logs...
                  </TableCell>
                </TableRow>
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-red-500 flex items-center justify-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    Fehler beim Laden der Logs
                  </TableCell>
                </TableRow>
              ) : !data?.items || data.items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Keine Einträge gefunden.
                  </TableCell>
                </TableRow>
              ) : (
                data.items.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap text-sm">
                      {format(new Date(log.timestamp), 'dd.MM.yyyy HH:mm', { locale: de })}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-medium">{log.user_name}</div>
                      <div className="text-xs text-muted-foreground">{log.user_email}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={ACTION_COLORS[log.action]}>
                        {log.action}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {ENTITY_LABELS[log.entity_type] || log.entity_type}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {log.entity_id.substring(0, 8)}...
                    </TableCell>
                    <TableCell className="text-sm">
                      {log.changed_fields?.length > 0 ? (
                        <span>Geändert: {log.changed_fields.join(', ')}</span>
                      ) : log.reason ? (
                        <span className="text-muted-foreground">{log.reason}</span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination Controls */}
        {data?.pagination && data.pagination.total_pages > 1 && (
          <div className="flex items-center justify-between pt-4">
            <p className="text-sm text-muted-foreground">
              Zeige Seite {data.pagination.page} von {data.pagination.total_pages}
            </p>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={!data.pagination.has_prev}
              >
                Zurück
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setPage(p => p + 1)}
                disabled={!data.pagination.has_next}
              >
                Weiter
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
