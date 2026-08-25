// Wiederverwendbarer Dialog zum Erfassen einer Arbeitszeit.
// Extrahiert aus DesktopEmployeePage.tsx (Zeit erfassen Dialog + "Lieferschein erstellen?" Folge-Prompt).

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Clock, CheckCircle2, ClipboardList } from 'lucide-react';
import { useEmployeePermissions } from '@/hooks/useEmployeePermissions';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { DeliveryNoteForm } from '@/components/delivery-notes/DeliveryNoteForm';

interface TimeEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects: Array<{ id: string; name: string }>;
  defaultProjectId?: string;
  onSaved?: () => void;
}

const buildInitialForm = (defaultProjectId?: string) => ({
  project_id: defaultProjectId || '',
  work_date: new Date().toISOString().split('T')[0],
  start_time: '07:00',
  end_time: '15:30',
  break_minutes: 30,
  description: '',
});

export function TimeEntryDialog({ open, onOpenChange, projects, defaultProjectId, onSaved }: TimeEntryDialogProps) {
  const { toast } = useToast();
  const { employee } = useEmployeePermissions();

  const [timeForm, setTimeForm] = useState(buildInitialForm(defaultProjectId));
  const [timeFormSaving, setTimeFormSaving] = useState(false);

  // Lieferschein erstellen? Folge-Prompt
  const [lieferscheinPromptOpen, setLieferscheinPromptOpen] = useState(false);
  const [savedTimeEntryData, setSavedTimeEntryData] = useState<{
    project_id: string; work_date: string; start_time: string;
    end_time: string; break_minutes: number; description: string;
  } | null>(null);

  // Lieferschein-Formular (vorausgefüllt aus der erfassten Zeit)
  const [deliveryNoteFormOpen, setDeliveryNoteFormOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>();
  const [deliveryNotePrefill, setDeliveryNotePrefill] = useState<{
    work_date?: string; start_time?: string; end_time?: string;
    break_minutes?: number; description?: string;
  } | undefined>();

  // Formular bei jedem Öffnen zurücksetzen
  useEffect(() => {
    if (open) {
      setTimeForm(buildInitialForm(defaultProjectId));
    }
  }, [open, defaultProjectId]);

  const handleSaveTimeEntry = async () => {
    if (!employee || !timeForm.project_id || !timeForm.start_time || !timeForm.end_time) return;
    setTimeFormSaving(true);
    try {
      const startISO = `${timeForm.work_date}T${timeForm.start_time}:00`;
      const endISO = `${timeForm.work_date}T${timeForm.end_time}:00`;
      const { error } = await supabase.from('time_entries').insert({
        employee_id: employee.id,
        project_id: timeForm.project_id,
        company_id: employee.company_id,
        start_time: startISO,
        end_time: endISO,
        break_duration: timeForm.break_minutes,
        description: timeForm.description,
        status: 'pending',
      });
      if (error) throw error;
      toast({ title: 'Zeit gespeichert' });
      setSavedTimeEntryData({ ...timeForm });
      onOpenChange(false);
      onSaved?.();
      // Prompt: Lieferschein erstellen?
      setLieferscheinPromptOpen(true);
    } catch (err) {
      toast({ title: 'Fehler', description: 'Zeit konnte nicht gespeichert werden.', variant: 'destructive' });
    } finally {
      setTimeFormSaving(false);
    }
  };

  const handleCreateLieferscheinFromTime = () => {
    if (!savedTimeEntryData) return;
    setLieferscheinPromptOpen(false);
    setSelectedProjectId(savedTimeEntryData.project_id);
    setDeliveryNotePrefill({
      work_date: savedTimeEntryData.work_date,
      start_time: savedTimeEntryData.start_time,
      end_time: savedTimeEntryData.end_time,
      break_minutes: savedTimeEntryData.break_minutes,
      description: savedTimeEntryData.description,
    });
    setDeliveryNoteFormOpen(true);
  };

  return (
    <>
      {/* Zeit erfassen Dialog */}
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-600" />
              Zeit erfassen
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Projekt</Label>
              <Select value={timeForm.project_id} onValueChange={v => setTimeForm(f => ({ ...f, project_id: v }))}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Projekt wählen..." />
                </SelectTrigger>
                <SelectContent>
                  {projects.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Datum</Label>
              <Input type="date" className="mt-1" value={timeForm.work_date}
                onChange={e => setTimeForm(f => ({ ...f, work_date: e.target.value }))} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Von</Label>
                <Input type="time" className="mt-1" value={timeForm.start_time}
                  onChange={e => setTimeForm(f => ({ ...f, start_time: e.target.value }))} />
              </div>
              <div>
                <Label>Bis</Label>
                <Input type="time" className="mt-1" value={timeForm.end_time}
                  onChange={e => setTimeForm(f => ({ ...f, end_time: e.target.value }))} />
              </div>
              <div>
                <Label>Pause (min)</Label>
                <Input type="number" className="mt-1" min={0} step={5} value={timeForm.break_minutes}
                  onChange={e => setTimeForm(f => ({ ...f, break_minutes: parseInt(e.target.value) || 0 }))} />
              </div>
            </div>
            <div>
              <Label>Tätigkeitsbeschreibung</Label>
              <Textarea className="mt-1" rows={3} placeholder="Was wurde gemacht?"
                value={timeForm.description}
                onChange={e => setTimeForm(f => ({ ...f, description: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
            <Button onClick={handleSaveTimeEntry} disabled={timeFormSaving || !timeForm.project_id}>
              {timeFormSaving ? 'Speichern...' : 'Speichern & weiter'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lieferschein erstellen? Prompt */}
      <Dialog open={lieferscheinPromptOpen} onOpenChange={setLieferscheinPromptOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              Zeit gespeichert
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            Möchtest du direkt einen Lieferschein für diese Zeit erstellen?
            Du kannst dort noch Materialien und Fotos hinzufügen.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setLieferscheinPromptOpen(false)}>
              Nein, später
            </Button>
            <Button onClick={handleCreateLieferscheinFromTime}>
              <ClipboardList className="h-4 w-4 mr-2" />
              Lieferschein erstellen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lieferschein-Formular (aus Zeit vorausgefüllt) */}
      <DeliveryNoteForm
        projectId={selectedProjectId}
        prefillData={deliveryNotePrefill}
        open={deliveryNoteFormOpen}
        onOpenChange={setDeliveryNoteFormOpen}
        onSuccess={() => {
          setDeliveryNoteFormOpen(false);
          setDeliveryNotePrefill(undefined);
          onSaved?.();
        }}
      />
    </>
  );
}

export default TimeEntryDialog;
