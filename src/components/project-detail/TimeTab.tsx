import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TabsContent } from "@/components/ui/tabs";
import {
  Clock,
  Plus,
  ClipboardList
} from "lucide-react";
import { ProjectPermissions } from "@/types/project";

export interface TimeTabProps {
  permissions: ProjectPermissions;
  totalHours: number;
  timeEntries: any[];
  deliveryNotes: any[];
  onSetIsTimeFormOpen: (open: boolean) => void;
}

const TimeTab: React.FC<TimeTabProps> = ({
  permissions,
  totalHours,
  timeEntries,
  deliveryNotes,
  onSetIsTimeFormOpen,
}) => {
  return (
    <TabsContent value="time" className="px-6 pb-6 pt-5 space-y-4 min-h-[600px] mt-0">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-800">Zeiterfassung</h3>
          <p className="text-xs text-slate-400">{totalHours.toFixed(1)}h gesamt · {timeEntries.length} Zeiteinträge · {deliveryNotes.length} Lieferscheine</p>
        </div>
        {permissions.can_add_time && (
          <Button onClick={() => onSetIsTimeFormOpen(true)} className="bg-slate-800 hover:bg-slate-900 text-white">
            <Plus className="h-4 w-4 mr-2" />
            Zeit erfassen
          </Button>
        )}
      </div>

      {/* Delivery Note Hours */}
      {deliveryNotes.length > 0 && (
        <Card className="bg-white border-slate-200 shadow-sm rounded-xl overflow-hidden">
          <CardHeader className="border-b border-slate-100 bg-teal-50/50 px-5 py-3">
            <CardTitle className="text-sm font-semibold text-teal-700 m-0 flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              Aus Lieferscheinen
            </CardTitle>
          </CardHeader>
          <div className="divide-y divide-slate-100">
            {deliveryNotes.map((dn: any) => {
              const date = new Date(dn.work_date);
              const startStr = dn.start_time ? dn.start_time.substring(0, 5) : '–';
              const endStr = dn.end_time ? dn.end_time.substring(0, 5) : '–';
              const dateStr = date.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
              let hours = 0;
              if (dn.start_time && dn.end_time) {
                const [sh, sm] = dn.start_time.split(':').map(Number);
                const [eh, em] = dn.end_time.split(':').map(Number);
                hours = Math.max(0, ((eh * 60 + em) - (sh * 60 + sm) - (dn.break_minutes ?? 0)) / 60);
              }
              const empName = dn.employee
                ? `${dn.employee.first_name} ${dn.employee.last_name}`
                : 'Mitarbeiter';

              return (
                <div key={dn.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 transition-colors">
                  <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-teal-50 border border-teal-200 flex flex-col items-center justify-center">
                    <span className="text-xs font-bold text-teal-700">{date.getDate()}</span>
                    <span className="text-[10px] text-teal-500 uppercase">{date.toLocaleDateString('de-DE', { month: 'short' })}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-medium text-slate-800">{empName}</span>
                      <span className="text-xs text-slate-400">{dateStr}</span>
                      <span className="text-[10px] px-1.5 py-0.5 bg-teal-100 text-teal-700 rounded font-medium">{dn.delivery_note_number}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span>{startStr} – {endStr}</span>
                      {dn.break_minutes > 0 && (
                        <span className="text-slate-300">· {dn.break_minutes}min Pause</span>
                      )}
                    </div>
                    {dn.description && (
                      <p className="text-xs text-slate-400 mt-1 truncate">{dn.description}</p>
                    )}
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <span className="text-sm font-bold text-teal-700">{hours.toFixed(1)}h</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Regular Time Entries */}
      {timeEntries.length > 0 && (
        <Card className="bg-white border-slate-200 shadow-sm rounded-xl overflow-hidden">
          {deliveryNotes.length > 0 && (
            <CardHeader className="border-b border-slate-100 bg-slate-50/50 px-5 py-3">
              <CardTitle className="text-sm font-semibold text-slate-700 m-0 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Manuelle Zeiteinträge
              </CardTitle>
            </CardHeader>
          )}
          <div className="divide-y divide-slate-100">
            {timeEntries.map(entry => {
              const date = new Date(entry.start_time);
              const startStr = new Date(entry.start_time).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
              const endStr = entry.end_time ? new Date(entry.end_time).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : '–';
              const dateStr = date.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });

              return (
                <div key={entry.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 transition-colors">
                  <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-slate-100 border border-slate-200 flex flex-col items-center justify-center">
                    <span className="text-xs font-bold text-slate-700">{date.getDate()}</span>
                    <span className="text-[10px] text-slate-400 uppercase">{date.toLocaleDateString('de-DE', { month: 'short' })}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-medium text-slate-800">{entry.employee_name}</span>
                      <span className="text-xs text-slate-400">{dateStr}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span>{startStr} – {endStr}</span>
                      {entry.break_duration > 0 && (
                        <span className="text-slate-300">· {entry.break_duration}min Pause</span>
                      )}
                    </div>
                    {entry.description && (
                      <p className="text-xs text-slate-400 mt-1 truncate">{entry.description}</p>
                    )}
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <span className="text-sm font-bold text-slate-800">{entry.hours.toFixed(1)}h</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {timeEntries.length === 0 && deliveryNotes.length === 0 && (
        <Card className="bg-white border-slate-200 shadow-sm rounded-xl">
          <CardContent className="p-8 text-center">
            <Clock className="h-10 w-10 text-slate-200 mx-auto mb-3" />
            <p className="text-sm text-slate-400">Noch keine Zeiteinträge vorhanden</p>
          </CardContent>
        </Card>
      )}
    </TabsContent>
  );
};

export default TimeTab;
