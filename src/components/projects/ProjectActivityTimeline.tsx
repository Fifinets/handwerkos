import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { 
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AuditLogService, AuditAction } from '@/services/auditLogService';
import { 
  Activity,
  PlusCircle,
  Pencil,
  Trash2,
  Eye,
  Printer,
  FileDown,
  Send,
  CheckCircle,
  XCircle,
  XSquare,
  RefreshCcw,
  LucideIcon
} from 'lucide-react';

interface ProjectActivityTimelineProps {
  projectId: string;
}

const ACTION_ICONS: Record<AuditAction, LucideIcon> = {
  CREATE: PlusCircle,
  UPDATE: Pencil,
  DELETE: Trash2,
  VIEW: Eye,
  PRINT: Printer,
  EXPORT: FileDown,
  SEND: Send,
  APPROVE: CheckCircle,
  REJECT: XCircle,
  CANCEL: XSquare,
  RESTORE: RefreshCcw,
};

const ACTION_COLORS: Record<AuditAction, string> = {
  CREATE: 'text-green-500 bg-green-50',
  UPDATE: 'text-blue-500 bg-blue-50',
  DELETE: 'text-red-500 bg-red-50',
  VIEW: 'text-slate-500 bg-slate-50',
  PRINT: 'text-slate-500 bg-slate-50',
  EXPORT: 'text-indigo-500 bg-indigo-50',
  SEND: 'text-sky-500 bg-sky-50',
  APPROVE: 'text-emerald-500 bg-emerald-50',
  REJECT: 'text-orange-500 bg-orange-50',
  CANCEL: 'text-zinc-500 bg-zinc-50',
  RESTORE: 'text-teal-500 bg-teal-50',
};

const ACTION_LABELS: Record<AuditAction, string> = {
  CREATE: 'Erstellt',
  UPDATE: 'Aktualisiert',
  DELETE: 'Gelöscht',
  VIEW: 'Angesehen',
  PRINT: 'Gedruckt',
  EXPORT: 'Exportiert',
  SEND: 'Gesendet',
  APPROVE: 'Freigegeben',
  REJECT: 'Abgelehnt',
  CANCEL: 'Storniert',
  RESTORE: 'Wiederhergestellt',
};

export function ProjectActivityTimeline({ projectId }: ProjectActivityTimelineProps) {
  const { data: logs, isLoading, error } = useQuery({
    queryKey: ['project-audit-trail', projectId],
    queryFn: async () => {
      const trail = await AuditLogService.getAuditTrail('project', projectId);
      // Sort by timestamp descending for timeline view
      return trail.logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Aktivitäts-Timeline
          </CardTitle>
          <CardDescription>
            Lade Aktivitäten...
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-4">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error || !logs || logs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Aktivitäts-Timeline
          </CardTitle>
          <CardDescription>
            Bisher keine Aktivitäten aufgezeichnet.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Aktivitäts-Timeline
        </CardTitle>
        <CardDescription>
          Alle durchgeführten Aktionen für dieses Projekt
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="relative space-y-8 before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
          {logs.map((log) => {
            const Icon = ACTION_ICONS[log.action] || Activity;
            const colorClass = ACTION_COLORS[log.action] || 'text-slate-500 bg-slate-50';
            
            return (
              <div key={log.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                {/* Icon */}
                <div className={`flex items-center justify-center w-10 h-10 rounded-full border border-white bg-slate-100 shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm z-10 ${colorClass}`}>
                  <Icon className="w-5 h-5" />
                </div>
                
                {/* Content Container */}
                <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">
                  <div className="flex items-center justify-between space-x-2 mb-1">
                    <div className="font-semibold text-slate-800 text-sm">
                      {ACTION_LABELS[log.action] || log.action}
                    </div>
                    <time className="font-mono text-xs text-slate-500">
                      {format(new Date(log.timestamp), 'dd.MM.yyyy HH:mm', { locale: de })}
                    </time>
                  </div>
                  <div className="text-slate-600 text-sm mb-2">
                    durch <span className="font-medium">{log.user_name}</span>
                  </div>
                  
                  {/* Additional details depending on action */}
                  {log.action === 'UPDATE' && log.changed_fields && log.changed_fields.length > 0 && (
                    <div className="mt-2 text-xs text-slate-500 bg-slate-50 p-2 rounded border border-slate-100">
                      <span className="font-semibold">Geändert: </span>
                      {log.changed_fields.join(', ')}
                    </div>
                  )}
                  {log.reason && (
                    <div className="mt-2 text-xs italic text-slate-500 border-l-2 border-slate-300 pl-2">
                      "{log.reason}"
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
