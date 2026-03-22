import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar as CalendarIcon, Clock, User } from 'lucide-react';
import { PROJECT_STATUS_CONFIG, type ProjectStatus } from '@/types/project';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface WorkflowStatusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName: string;
  companyId: string;
  targetStatus?: ProjectStatus;
  editMode?: 'besichtigung' | 'in_bearbeitung';
  currentValues?: {
    besichtigung_date?: string | null;
    besichtigung_time_start?: string | null;
    besichtigung_time_end?: string | null;
    besichtigung_employee_id?: string | null;
    besichtigung_calendar_event_id?: string | null;
    work_start_date?: string | null;
    work_end_date?: string | null;
  };
  employees: { id: string; first_name: string; last_name: string }[];
  onSuccess: () => void;
}

export function WorkflowStatusDialog({
  open, onOpenChange, projectId, projectName, companyId,
  targetStatus, editMode, currentValues, employees, onSuccess,
}: WorkflowStatusDialogProps) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  // Besichtigung fields
  const [besichtigungDate, setBesichtigungDate] = useState('');
  const [besichtigungTimeStart, setBesichtigungTimeStart] = useState('');
  const [besichtigungTimeEnd, setBesichtigungTimeEnd] = useState('');
  const [besichtigungEmployeeId, setBesichtigungEmployeeId] = useState('');

  // In Arbeit fields
  const [workStartDate, setWorkStartDate] = useState('');
  const [workEndDate, setWorkEndDate] = useState('');

  const activeStage = editMode || targetStatus;
  const showBesichtigung = activeStage === 'besichtigung';
  const showInArbeit = activeStage === 'in_bearbeitung';
  const showConfirmOnly = activeStage === 'angebot' || activeStage === 'beauftragt' || activeStage === 'anfrage';
  const showFertig = activeStage === 'abgeschlossen';

  // Pre-fill from current values
  useEffect(() => {
    if (open && currentValues) {
      setBesichtigungDate(currentValues.besichtigung_date || '');
      setBesichtigungTimeStart(currentValues.besichtigung_time_start || '');
      setBesichtigungTimeEnd(currentValues.besichtigung_time_end || '');
      setBesichtigungEmployeeId(currentValues.besichtigung_employee_id || '');
      setWorkStartDate(currentValues.work_start_date || '');
      setWorkEndDate(currentValues.work_end_date || '');
    } else if (open) {
      setBesichtigungDate('');
      setBesichtigungTimeStart('');
      setBesichtigungTimeEnd('');
      setBesichtigungEmployeeId('');
      setWorkStartDate('');
      setWorkEndDate('');
    }
  }, [open, currentValues]);

  const getTitle = () => {
    if (editMode === 'besichtigung') return 'Besichtigungstermin bearbeiten';
    if (editMode === 'in_bearbeitung') return 'Baustart bearbeiten';
    if (!targetStatus) return '';
    const config = PROJECT_STATUS_CONFIG[targetStatus];
    return `Status: ${config.icon} ${config.label}`;
  };

  const canSave = () => {
    if (showBesichtigung && !editMode) {
      return !!besichtigungDate && !!besichtigungTimeStart && !!besichtigungEmployeeId;
    }
    if (showInArbeit && !editMode) {
      return !!workStartDate;
    }
    return true;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates: Record<string, any> = {};

      // Status change (not in edit mode)
      if (targetStatus && !editMode) {
        updates.status = targetStatus;
        if (targetStatus === 'abgeschlossen') {
          updates.completed_at = new Date().toISOString();
        }
      }

      // Besichtigung appointment
      if (showBesichtigung) {
        updates.besichtigung_date = besichtigungDate || null;
        updates.besichtigung_time_start = besichtigungTimeStart || null;
        updates.besichtigung_time_end = besichtigungTimeEnd || null;
        updates.besichtigung_employee_id = besichtigungEmployeeId || null;

        // Calendar event sync
        if (besichtigungDate) {
          const calendarData = {
            title: `Besichtigung: ${projectName}`,
            start_date: besichtigungDate,
            end_date: besichtigungDate,
            start_time: besichtigungTimeStart || null,
            end_time: besichtigungTimeEnd || null,
            type: 'besichtigung',
            company_id: companyId,
            project_id: projectId,
            assigned_employees: besichtigungEmployeeId ? [besichtigungEmployeeId] : [],
          };

          const existingEventId = currentValues?.besichtigung_calendar_event_id;
          if (existingEventId) {
            await supabase.from('calendar_events').update(calendarData).eq('id', existingEventId);
          } else {
            const { data: newEvent } = await supabase
              .from('calendar_events')
              .insert(calendarData)
              .select('id')
              .single();
            if (newEvent) {
              updates.besichtigung_calendar_event_id = newEvent.id;
            }
          }
        } else if (currentValues?.besichtigung_calendar_event_id) {
          // Date removed → delete calendar event
          await supabase.from('calendar_events').delete().eq('id', currentValues.besichtigung_calendar_event_id);
          updates.besichtigung_calendar_event_id = null;
        }
      }

      // In Arbeit dates
      if (showInArbeit) {
        updates.work_start_date = workStartDate || null;
        updates.work_end_date = workEndDate || null;
      }

      // Update project
      const { error } = await supabase
        .from('projects')
        .update(updates)
        .eq('id', projectId);

      if (error) throw error;

      const msg = editMode
        ? 'Termin gespeichert'
        : `Status zu "${PROJECT_STATUS_CONFIG[targetStatus!].label}" geändert`;
      toast({ title: 'Erfolg', description: msg });
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      toast({ title: 'Fehler', description: err.message || 'Speichern fehlgeschlagen', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleSkipAppointment = async () => {
    if (!targetStatus) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('projects')
        .update({ status: targetStatus })
        .eq('id', projectId);
      if (error) throw error;
      toast({ title: 'Erfolg', description: `Status zu "${PROJECT_STATUS_CONFIG[targetStatus].label}" geändert` });
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      toast({ title: 'Fehler', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg">{getTitle()}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Besichtigung fields */}
          {showBesichtigung && (
            <>
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <CalendarIcon className="h-3.5 w-3.5 text-slate-400" />
                  Datum {!editMode && '*'}
                </Label>
                <Input type="date" value={besichtigungDate} onChange={e => setBesichtigungDate(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-slate-400" />
                    Von {!editMode && '*'}
                  </Label>
                  <Input type="time" value={besichtigungTimeStart} onChange={e => setBesichtigungTimeStart(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Bis</Label>
                  <Input type="time" value={besichtigungTimeEnd} onChange={e => setBesichtigungTimeEnd(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-slate-400" />
                  Mitarbeiter {!editMode && '*'}
                </Label>
                <Select value={besichtigungEmployeeId} onValueChange={setBesichtigungEmployeeId}>
                  <SelectTrigger><SelectValue placeholder="Mitarbeiter wählen" /></SelectTrigger>
                  <SelectContent>
                    {employees.map(emp => (
                      <SelectItem key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {!editMode && (
                <button onClick={handleSkipAppointment} className="text-xs text-slate-400 hover:text-blue-500 transition-colors">
                  Ohne Termin fortfahren →
                </button>
              )}
            </>
          )}

          {/* In Arbeit fields */}
          {showInArbeit && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <CalendarIcon className="h-3.5 w-3.5 text-slate-400" />
                  Baustart {!editMode && '*'}
                </Label>
                <Input type="date" value={workStartDate} onChange={e => setWorkStartDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Geplantes Ende</Label>
                <Input type="date" value={workEndDate} onChange={e => setWorkEndDate(e.target.value)} />
              </div>
            </div>
          )}

          {/* Simple confirmation */}
          {showConfirmOnly && !editMode && (
            <p className="text-sm text-slate-600">
              Status zu <strong>{PROJECT_STATUS_CONFIG[targetStatus!]?.label}</strong> ändern?
            </p>
          )}

          {/* Fertig confirmation */}
          {showFertig && !editMode && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-700">
              Projekt als abgeschlossen markieren? Das Abschlussdatum wird automatisch gesetzt.
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
          <Button onClick={handleSave} disabled={saving || !canSave()}>
            {saving ? 'Speichern...' : editMode ? 'Speichern' : 'Bestätigen'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
