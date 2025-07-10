import React, { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface TimeEntry {
  id: string;
  employee_id: string;
  project_id?: string;
  start_time: string;
  end_time?: string;
  break_duration: number;
  description?: string;
  status: string;
  employee?: {
    first_name: string;
    last_name: string;
  };
  project?: {
    name: string;
    color: string;
  };
}

interface Project {
  id: string;
  name: string;
  color: string;
  status: string;
}

interface EditTimeEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  timeEntry: TimeEntry | null;
  projects: Project[];
  onSave: () => void;
}

const EditTimeEntryDialog: React.FC<EditTimeEntryDialogProps> = ({
  open,
  onOpenChange,
  timeEntry,
  projects,
  onSave
}) => {
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('');
  const [breakDuration, setBreakDuration] = useState(0);
  const [selectedProject, setSelectedProject] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);
  
  const { toast } = useToast();

  useEffect(() => {
    if (timeEntry) {
      const startDateTime = parseISO(timeEntry.start_time);
      setStartDate(format(startDateTime, 'yyyy-MM-dd'));
      setStartTime(format(startDateTime, 'HH:mm'));
      
      if (timeEntry.end_time) {
        const endDateTime = parseISO(timeEntry.end_time);
        setEndDate(format(endDateTime, 'yyyy-MM-dd'));
        setEndTime(format(endDateTime, 'HH:mm'));
      } else {
        setEndDate('');
        setEndTime('');
      }
      
      setBreakDuration(timeEntry.break_duration || 0);
      setSelectedProject(timeEntry.project_id || '');
      setDescription(timeEntry.description || '');
      setStatus(timeEntry.status);
    }
  }, [timeEntry]);

  const handleSave = async () => {
    if (!timeEntry) return;

    setSaving(true);
    try {
      const startDateTime = new Date(`${startDate}T${startTime}`).toISOString();
      let endDateTime = null;
      
      if (endDate && endTime) {
        endDateTime = new Date(`${endDate}T${endTime}`).toISOString();
      }

      const updateData = {
        start_time: startDateTime,
        end_time: endDateTime,
        break_duration: breakDuration,
        project_id: selectedProject || null,
        description: description || null,
        status: status
      };

      const { error } = await supabase
        .from('time_entries')
        .update(updateData)
        .eq('id', timeEntry.id);

      if (error) throw error;

      toast({
        title: "Zeiteintrag aktualisiert",
        description: "Die Änderungen wurden erfolgreich gespeichert."
      });

      onSave();
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating time entry:', error);
      toast({
        title: "Fehler beim Speichern",
        description: "Die Änderungen konnten nicht gespeichert werden.",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  if (!timeEntry) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Zeiteintrag bearbeiten - {timeEntry.employee?.first_name} {timeEntry.employee?.last_name}
          </DialogTitle>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start-date">Startdatum</Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="start-time">Startzeit</Label>
              <Input
                id="start-time"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="end-date">Enddatum</Label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end-time">Endzeit</Label>
              <Input
                id="end-time"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="break-duration">Pausenzeit (Minuten)</Label>
              <Input
                id="break-duration"
                type="number"
                min="0"
                value={breakDuration}
                onChange={(e) => setBreakDuration(parseInt(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="aktiv">Aktiv</SelectItem>
                  <SelectItem value="pausiert">Pausiert</SelectItem>
                  <SelectItem value="beendet">Beendet</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="project">Projekt</Label>
            <Select value={selectedProject} onValueChange={setSelectedProject}>
              <SelectTrigger>
                <SelectValue placeholder="Projekt auswählen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Kein Projekt</SelectItem>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Beschreibung</Label>
            <Textarea
              id="description"
              placeholder="Beschreibung der Tätigkeit..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Speichere..." : "Speichern"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EditTimeEntryDialog;