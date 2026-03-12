import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Clock, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { TimeEntryFormData } from "@/types/project";
import { useToast } from "@/hooks/use-toast";

interface TeamMember {
  id: string;
  name: string;
  email?: string;
}

interface TimeEntryFormProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  teamMembers?: TeamMember[];
  onTimeEntryAdded: (entry: TimeEntryFormData) => void;
}

// ArbZG: Mindestpause berechnen
const getMinBreak = (grossHours: number): number => {
  if (grossHours > 9) return 45;
  if (grossHours > 6) return 30;
  return 0;
};

const TimeEntryForm: React.FC<TimeEntryFormProps> = ({
  isOpen,
  onClose,
  projectId,
  teamMembers = [],
  onTimeEntryAdded
}) => {
  const { toast } = useToast();
  const [formData, setFormData] = useState<TimeEntryFormData>({
    work_date: new Date().toISOString().split('T')[0],
    start_time: '08:00',
    end_time: '17:00',
    break_duration_min: 30,
    task_description: '',
  });
  const [workDate, setWorkDate] = useState<Date>(new Date());
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  // Brutto-Stunden (ohne Pause)
  const calculateGrossHours = () => {
    if (!formData.start_time || !formData.end_time) return 0;
    const startTime = new Date(`${formData.work_date}T${formData.start_time}`);
    const endTime = new Date(`${formData.work_date}T${formData.end_time}`);
    if (endTime <= startTime) return 0;
    return (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
  };

  // Netto-Stunden (mit Pause)
  const calculateNetHours = () => {
    const gross = calculateGrossHours();
    if (gross <= 0) return 0;
    const breakHours = (formData.break_duration_min || 0) / 60;
    return Math.max(0, gross - breakHours);
  };

  const grossHours = calculateGrossHours();
  const netHours = calculateNetHours();
  const minBreak = getMinBreak(grossHours);

  // Warnungen berechnen
  const warnings: string[] = [];
  if (netHours > 10) {
    warnings.push('Tägliche Arbeitszeit über 10 Stunden (§3 ArbZG)');
  }
  if (grossHours > 6 && formData.break_duration_min < minBreak) {
    warnings.push(`Mindestpause: ${minBreak} Min. bei ${grossHours > 9 ? '>9h' : '>6h'} Arbeitszeit (§4 ArbZG)`);
  }

  // Auto-Pause vorschlagen wenn sich Zeiten ändern
  useEffect(() => {
    const gross = calculateGrossHours();
    const suggested = getMinBreak(gross);
    // Nur auto-setzen wenn aktuelle Pause unter dem Minimum liegt
    if (formData.break_duration_min < suggested) {
      setFormData(prev => ({ ...prev, break_duration_min: suggested }));
    }
  }, [formData.start_time, formData.end_time]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedEmployeeId) {
      toast({
        title: "Fehler",
        description: "Bitte wählen Sie einen Mitarbeiter aus.",
        variant: "destructive"
      });
      return;
    }

    if (!formData.task_description.trim()) {
      toast({
        title: "Fehler",
        description: "Bitte geben Sie eine Tätigkeitsbeschreibung ein.",
        variant: "destructive"
      });
      return;
    }

    if (formData.start_time >= formData.end_time) {
      toast({
        title: "Fehler",
        description: "Die Endzeit muss nach der Startzeit liegen.",
        variant: "destructive"
      });
      return;
    }

    if (grossHours > 6 && formData.break_duration_min < minBreak) {
      toast({
        title: "Warnung",
        description: `Gesetzliche Mindestpause von ${minBreak} Min. nicht eingehalten. Bitte Pausenzeit korrigieren.`,
        variant: "destructive"
      });
      return;
    }

    setSubmitting(true);

    try {
      const timeEntry: TimeEntryFormData = {
        ...formData,
        work_date: format(workDate, 'yyyy-MM-dd'),
        employee_id: selectedEmployeeId
      };

      onTimeEntryAdded(timeEntry);

      toast({
        title: "Erfolg",
        description: `Arbeitszeit von ${netHours.toFixed(1)} Stunden erfasst.`
      });

      // Reset form
      setFormData({
        work_date: new Date().toISOString().split('T')[0],
        start_time: '08:00',
        end_time: '17:00',
        break_duration_min: 30,
        task_description: '',
      });
      setWorkDate(new Date());
      setSelectedEmployeeId('');

      onClose();
    } catch (error) {
      toast({
        title: "Fehler",
        description: "Arbeitszeit konnte nicht erfasst werden.",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleInputChange = (field: keyof TimeEntryFormData, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Arbeitszeit erfassen
          </DialogTitle>
          <DialogDescription>
            Erfassen Sie Arbeitszeiten für dieses Projekt.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Mitarbeiter *</Label>
            <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
              <SelectTrigger>
                <SelectValue placeholder="Mitarbeiter auswählen..." />
              </SelectTrigger>
              <SelectContent>
                {teamMembers.map(member => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {teamMembers.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">Keine Teammitglieder zugewiesen. Bitte erst Team zuweisen.</p>
            )}
          </div>

          <div>
            <Label htmlFor="work_date">Arbeitsdatum *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(workDate, "dd.MM.yyyy", { locale: de })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={workDate}
                  onSelect={(date) => {
                    if (date) {
                      setWorkDate(date);
                      handleInputChange('work_date', format(date, 'yyyy-MM-dd'));
                    }
                  }}
                  initialFocus
                  locale={de}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="start_time">Von *</Label>
              <Input
                id="start_time"
                type="time"
                value={formData.start_time}
                onChange={(e) => handleInputChange('start_time', e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="end_time">Bis *</Label>
              <Input
                id="end_time"
                type="time"
                value={formData.end_time}
                onChange={(e) => handleInputChange('end_time', e.target.value)}
                required
              />
            </div>
          </div>

          {/* Pause */}
          <div>
            <Label htmlFor="break_duration">Pause (Minuten)</Label>
            <Input
              id="break_duration"
              type="number"
              min={0}
              max={120}
              step={5}
              value={formData.break_duration_min}
              onChange={(e) => handleInputChange('break_duration_min', parseInt(e.target.value) || 0)}
            />
            {minBreak > 0 && (
              <p className="text-xs text-slate-500 mt-1">
                Gesetzl. Minimum: {minBreak} Min. bei {grossHours > 9 ? '>9' : '>6'}h Arbeitszeit
              </p>
            )}
          </div>

          {/* Stunden-Übersicht */}
          <div className="bg-gray-50 p-3 rounded-lg space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500">Brutto:</span>
              <span className="text-sm text-slate-500">{grossHours.toFixed(1)}h</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500">Pause:</span>
              <span className="text-sm text-slate-500">−{formData.break_duration_min} Min.</span>
            </div>
            <div className="flex items-center justify-between border-t border-slate-200 pt-1">
              <span className="text-sm font-medium">Netto-Arbeitszeit:</span>
              <span className="text-lg font-bold text-blue-600">
                {netHours.toFixed(1)}h
              </span>
            </div>
          </div>

          {/* ArbZG-Warnungen */}
          {warnings.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              {warnings.map((w, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-amber-800">
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                  <span>{w}</span>
                </div>
              ))}
            </div>
          )}

          <div>
            <Label htmlFor="task_description">Tätigkeitsbeschreibung *</Label>
            <Textarea
              id="task_description"
              placeholder="Beschreiben Sie die durchgeführten Arbeiten..."
              value={formData.task_description}
              onChange={(e) => handleInputChange('task_description', e.target.value)}
              rows={3}
              required
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
              disabled={submitting}
            >
              Abbrechen
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={submitting || netHours <= 0 || !selectedEmployeeId}
            >
              {submitting ? 'Speichern...' : 'Zeit erfassen'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default TimeEntryForm;
