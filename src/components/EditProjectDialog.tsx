
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

interface Project {
  id: string;
  name: string;
  customer: string;
  status: string;
  progress: number;
  startDate: string;
  endDate: string;
  budget: string;
  team: string[];
  location: string;
}

interface EditProjectDialogProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project | null;
  onProjectUpdated: (project: Project) => void;
  onProjectDeleted?: (projectId: string) => void;
}

const EditProjectDialog = ({ isOpen, onClose, project, onProjectUpdated, onProjectDeleted }: EditProjectDialogProps) => {
  const { toast } = useToast();
  const [customers, setCustomers] = useState<Tables<'customers'>[]>([]);
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteProgress, setDeleteProgress] = useState(0);
  const [deleteTimer, setDeleteTimer] = useState<NodeJS.Timeout | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    customer: '',
    status: 'Planung',
    progress: 0,
    startDate: '',
    endDate: '',
    budget: '',
    location: ''
  });

  // Update form data when project changes
  useEffect(() => {
    if (project) {
      console.log('EditProjectDialog: Updating form with project data:', project);
      
      // Map database status to display status
      const statusMapping = {
        'anfrage': 'Anfrage',
        'besichtigung': 'Termin ausmachen', 
        'geplant': 'Planung',
        'in_bearbeitung': 'In Arbeit',
        'abgeschlossen': 'Abgeschlossen'
      };

      setFormData({
        name: project.name || '',
        customer: project.customers?.company_name || project.customer || '',
        status: statusMapping[project.status] || project.status || 'Planung',
        progress: project.progress || 0,
        startDate: project.start_date || project.startDate || '',
        endDate: project.end_date || project.endDate || '',
        budget: project.budget?.toString() || '',
        location: project.location || project.description || ''
      });

      // Set date range if dates are available
      const startDate = project.start_date || project.startDate;
      const endDate = project.end_date || project.endDate;
      
      if (startDate && endDate) {
        setDateRange({
          from: new Date(startDate),
          to: new Date(endDate)
        });
      } else {
        setDateRange(undefined);
      }
    }
  }, [project]);

  // Load customers
  useEffect(() => {
    const loadCustomers = async () => {
      const { data } = await supabase
        .from('customers')
        .select('*')
        .eq('status', 'Aktiv')
        .order('company_name');
      
      if (data) {
        setCustomers(data);
      }
    };

    if (isOpen) {
      loadCustomers();
    }
  }, [isOpen]);

  useEffect(() => {
    if (project) {
      setFormData({
        name: project.name,
        customer: project.customer,
        status: project.status,
        progress: project.progress,
        startDate: project.startDate,
        endDate: project.endDate,
        budget: project.budget,
        location: project.location
      });

      // Set date range from project dates
      if (project.startDate && project.endDate) {
        const startDate = new Date(project.startDate);
        const endDate = new Date(project.endDate);
        
        if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
          setDateRange({
            from: startDate,
            to: endDate
          });
        }
      } else if (project.startDate) {
        const startDate = new Date(project.startDate);
        
        if (!isNaN(startDate.getTime())) {
          setDateRange({
            from: startDate,
            to: undefined
          });
        }
      }
    }
  }, [project]);

  // Update form data when date range changes
  useEffect(() => {
    if (dateRange?.from) {
      handleInputChange('startDate', format(dateRange.from, 'yyyy-MM-dd'));
    }
    if (dateRange?.to) {
      handleInputChange('endDate', format(dateRange.to, 'yyyy-MM-dd'));
    }
  }, [dateRange]);

  // Cleanup delete timer when component unmounts or dialog closes
  useEffect(() => {
    if (!isOpen) {
      stopDelete();
    }
    
    return () => {
      if (deleteTimer) {
        clearInterval(deleteTimer);
      }
    };
  }, [isOpen, deleteTimer]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!project) return;

    const updatedProject = {
      ...project,
      ...formData
    };

    onProjectUpdated(updatedProject);
    onClose();
  };

  const handleInputChange = (field: string, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const startDelete = () => {
    console.log('🚀 startDelete called - beginning delete sequence');
    setIsDeleting(true);
    setDeleteProgress(0);
    
    const interval = setInterval(() => {
      setDeleteProgress(prev => {
        const newProgress = prev + (100 / 25); // 2,5 Sekunden = 25 Updates à 100ms
        console.log('⏰ Delete progress:', Math.round(newProgress) + '%');
        
        if (newProgress >= 100) {
          clearInterval(interval);
          console.log('✅ Delete timer completed, calling handleDelete');
          handleDelete();
          return 100;
        }
        return newProgress;
      });
    }, 100);
    
    setDeleteTimer(interval);
  };

  const stopDelete = () => {
    console.log('⏹️ stopDelete called - canceling delete sequence');
    if (deleteTimer) {
      clearInterval(deleteTimer);
      setDeleteTimer(null);
    }
    setIsDeleting(false);
    setDeleteProgress(0);
  };

  const handleDelete = async () => {
    if (!project || !onProjectDeleted) {
      console.log('❌ handleDelete aborted - missing project or callback');
      return;
    }
    
    console.log('🗑️ Starting deletion of project:', project.id, project.name);
    
    try {
      // First, check if we can access the project
      const { data: checkData, error: checkError } = await supabase
        .from('projects')
        .select('id, name')
        .eq('id', project.id)
        .single();
      
      console.log('🔍 Project check before delete:', { checkData, checkError });
      
      if (checkError) {
        console.error('❌ Cannot access project for deletion:', checkError);
        throw new Error('Projekt nicht gefunden oder keine Berechtigung');
      }

      // Now attempt to delete
      const { data, error, count } = await supabase
        .from('projects')
        .delete()
        .eq('id', project.id)
        .select('*'); // Return deleted rows for confirmation

      console.log('🗑️ Delete result:', { data, error, count, deletedRows: data?.length || 0 });

      if (error) {
        console.error('❌ Database delete error:', error);
        console.error('❌ Error details:', { 
          message: error.message, 
          code: error.code, 
          details: error.details,
          hint: error.hint 
        });
        throw error;
      }

      if (!data || data.length === 0) {
        console.warn('⚠️ No rows were deleted - project may not exist or access denied');
        throw new Error('Projekt konnte nicht gelöscht werden - möglicherweise keine Berechtigung');
      }

      console.log('✅ Project successfully deleted from database:', data[0]);

      toast({
        title: "Projekt gelöscht",
        description: "Das Projekt wurde erfolgreich gelöscht."
      });

      // Call the callback to update parent component
      onProjectDeleted(project.id);
      
      // Close dialog
      onClose();
      
      console.log('✅ Delete operation completed');
    } catch (error) {
      console.error('💥 Error deleting project:', error);
      toast({
        title: "Fehler",
        description: "Projekt konnte nicht gelöscht werden: " + (error.message || 'Unbekannter Fehler'),
        variant: "destructive"
      });
    } finally {
      stopDelete();
    }
  };

  if (!project) return null;

  console.log('🎯 EditProjectDialog render - onProjectDeleted available:', !!onProjectDeleted);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Projekt bearbeiten</DialogTitle>
          <DialogDescription>
            Bearbeiten Sie die Informationen für das Projekt.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Projektname</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              required
            />
          </div>

          <div>
            <Label htmlFor="customer">Kunde</Label>
            <Select value={formData.customer} onValueChange={(value) => handleInputChange('customer', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Kunde auswählen" />
              </SelectTrigger>
              <SelectContent>
                {customers.map((customer) => (
                  <SelectItem key={customer.id} value={customer.company_name}>
                    {customer.company_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="location">Standort</Label>
            <Input
              id="location"
              value={formData.location}
              onChange={(e) => handleInputChange('location', e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="budget">Budget</Label>
            <Input
              id="budget"
              value={formData.budget}
              onChange={(e) => handleInputChange('budget', e.target.value)}
              required
            />
          </div>

          <div>
            <Label>Projektzeitraum</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !dateRange && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange?.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, "dd.MM.yyyy")} -{" "}
                        {format(dateRange.to, "dd.MM.yyyy")}
                      </>
                    ) : (
                      format(dateRange.from, "dd.MM.yyyy")
                    )
                  ) : (
                    <span>Zeitraum auswählen</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={dateRange?.from}
                  selected={dateRange}
                  onSelect={setDateRange}
                  numberOfMonths={2}
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div>
            <Label htmlFor="status">Status</Label>
            <Select value={formData.status} onValueChange={(value) => handleInputChange('status', value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Anfrage">Anfrage</SelectItem>
                <SelectItem value="Besichtigung">Besichtigung</SelectItem>
                <SelectItem value="Planung">Planung</SelectItem>
                <SelectItem value="In Bearbeitung">In Bearbeitung</SelectItem>
                <SelectItem value="Abgeschlossen">Abgeschlossen</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="progress">Fortschritt (%)</Label>
            <Input
              id="progress"
              type="number"
              min="0"
              max="100"
              value={formData.progress}
              onChange={(e) => handleInputChange('progress', parseInt(e.target.value))}
            />
          </div>

          <div className="flex gap-2 pt-4">
            <div className="flex-1">
              <div className="relative">
                <Button 
                  type="button" 
                  variant="destructive" 
                  className="w-full relative overflow-hidden"
                  onClick={() => console.log('🖱️ Delete button clicked!')}
                  onMouseDown={onProjectDeleted ? startDelete : undefined}
                  onMouseUp={onProjectDeleted ? stopDelete : undefined}
                  onMouseLeave={onProjectDeleted ? stopDelete : undefined}
                  onTouchStart={onProjectDeleted ? startDelete : undefined}
                  onTouchEnd={onProjectDeleted ? stopDelete : undefined}
                  disabled={!onProjectDeleted}
                >
                  {/* Heller Film von links nach rechts */}
                  {isDeleting && (
                    <div 
                      className="absolute inset-0 bg-white/30 transition-all duration-100 ease-linear"
                      style={{
                        width: `${deleteProgress}%`,
                        left: 0,
                      }}
                    />
                  )}
                  <Trash2 className="h-4 w-4 mr-2 relative z-10" />
                  <span className="relative z-10">
                    {isDeleting ? 'Löschen...' : 'Projekt löschen'}
                  </span>
                </Button>
              </div>
            </div>
            <Button type="button" variant="outline" onClick={onClose}>
              Abbrechen
            </Button>
            <Button type="submit">
              Speichern
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditProjectDialog;
