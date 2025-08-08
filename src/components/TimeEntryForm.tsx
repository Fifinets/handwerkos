import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Clock } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { TimeEntryFormData } from "@/types/project";
import { useToast } from "@/hooks/use-toast";

interface TimeEntryFormProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  onTimeEntryAdded: (entry: TimeEntryFormData) => void;
}

const TimeEntryForm: React.FC<TimeEntryFormProps> = ({ 
  isOpen, 
  onClose, 
  projectId, 
  onTimeEntryAdded 
}) => {
  const { toast } = useToast();
  const [formData, setFormData] = useState<TimeEntryFormData>({
    work_date: new Date().toISOString().split('T')[0],
    start_time: '08:00',
    end_time: '17:00',
    task_description: '',
    category: 'ausfuehrung'
  });
  const [workDate, setWorkDate] = useState<Date>(new Date());
  const [isOvertime, setIsOvertime] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
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

    setSubmitting(true);
    
    try {
      const startTime = new Date(`${formData.work_date}T${formData.start_time}`);
      const endTime = new Date(`${formData.work_date}T${formData.end_time}`);
      const totalHours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);

      const timeEntry: TimeEntryFormData = {
        ...formData,
        work_date: format(workDate, 'yyyy-MM-dd')
      };

      onTimeEntryAdded(timeEntry);
      
      toast({
        title: "Erfolg",
        description: `Arbeitszeit von ${totalHours.toFixed(1)} Stunden erfasst.`
      });

      // Reset form
      setFormData({
        work_date: new Date().toISOString().split('T')[0],
        start_time: '08:00',
        end_time: '17:00',
        task_description: '',
        category: 'ausfuehrung'
      });
      setWorkDate(new Date());
      setIsOvertime(false);
      
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

  const handleInputChange = (field: keyof TimeEntryFormData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const calculateHours = () => {
    if (!formData.start_time || !formData.end_time) return 0;
    
    const startTime = new Date(`${formData.work_date}T${formData.start_time}`);
    const endTime = new Date(`${formData.work_date}T${formData.end_time}`);
    
    if (endTime <= startTime) return 0;
    
    return (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
  };

  const totalHours = calculateHours();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Arbeitszeit erfassen
          </DialogTitle>
          <DialogDescription>
            Erfassen Sie Ihre Arbeitszeiten für dieses Projekt.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
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

          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Gesamtstunden:</span>
              <span className="text-lg font-bold text-blue-600">
                {totalHours.toFixed(1)}h
              </span>
            </div>
            {totalHours > 8 && (
              <div className="flex items-center gap-2 mt-2">
                <Checkbox 
                  id="overtime"
                  checked={isOvertime}
                  onCheckedChange={(checked) => setIsOvertime(checked as boolean)}
                />
                <label htmlFor="overtime" className="text-sm text-orange-600 cursor-pointer">
                  Überstunden ({(totalHours - 8).toFixed(1)}h)
                </label>
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="category">Kategorie *</Label>
            <Select 
              value={formData.category} 
              onValueChange={(value) => handleInputChange('category', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="planung">Planung</SelectItem>
                <SelectItem value="ausfuehrung">Ausführung</SelectItem>
                <SelectItem value="nacharbeit">Nacharbeit</SelectItem>
                <SelectItem value="dokumentation">Dokumentation</SelectItem>
                <SelectItem value="sonstiges">Sonstiges</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="task_description">Tätigkeitsbeschreibung *</Label>
            <Textarea
              id="task_description"
              placeholder="Beschreiben Sie Ihre durchgeführten Arbeiten..."
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
              disabled={submitting || totalHours === 0}
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