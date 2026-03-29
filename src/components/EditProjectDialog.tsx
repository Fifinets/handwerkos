
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
import { eventBus } from "@/services/eventBus";

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
  project_site_id?: string;
  customer_id?: string;
  start_date?: string;
  end_date?: string;
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
    customer_id: '',
    status: 'anfrage',
    startDate: '',
    endDate: '',
    project_site_id: ''
  });
  const [projectSites, setProjectSites] = useState<{ id: string; name: string | null; address: string; city: string; }[]>([]);

  // Fetch project sites for the selected customer
  useEffect(() => {
    const fetchSites = async () => {
      if (!formData.customer_id) {
        setProjectSites([]);
        return;
      }
      try {
        const { data, error } = await supabase
          .from('project_sites')
          .select('id, name, address, city')
          .eq('customer_id', formData.customer_id);

        if (error) throw error;

        if (data) {
          setProjectSites(data);
          // If customer has exactly one site and we don't have one selected, auto-select it
          if (data.length === 1 && !formData.project_site_id) {
            setFormData(prev => ({ ...prev, project_site_id: data[0].id }));
          } else if (data.length === 0) {
            setFormData(prev => ({ ...prev, project_site_id: '' }));
          }
        }
      } catch (err) {
        console.error('Error fetching project sites:', err);
      }
    };
    fetchSites();
  }, [formData.customer_id]);

  // Update form data when project changes
  useEffect(() => {
    if (project) {

      setFormData({
        name: project.name || '',
        customer_id: project.customer_id || '',
        status: (project.status as any) || 'anfrage',
        startDate: (project as any).start_date || project.startDate || '',
        endDate: (project as any).end_date || project.endDate || '',
        project_site_id: project.project_site_id || ''
      });

      // Set date range if dates are available
      const startDate = (project as any).start_date || project.startDate;
      const endDate = (project as any).end_date || project.endDate;

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
        customer_id: project.customer_id || '',
        status: project.status,
        startDate: project.startDate,
        endDate: project.endDate,
        project_site_id: project.project_site_id || ''
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
    setIsDeleting(true);
    setDeleteProgress(0);

    const interval = setInterval(() => {
      setDeleteProgress(prev => {
        const newProgress = prev + (100 / 25); // 2,5 Sekunden = 25 Updates à 100ms

        if (newProgress >= 100) {
          clearInterval(interval);
          handleDelete();
          return 100;
        }
        return newProgress;
      });
    }, 100);

    setDeleteTimer(interval);
  };

  const stopDelete = () => {
    if (deleteTimer) {
      clearInterval(deleteTimer);
      setDeleteTimer(null);
    }
    setIsDeleting(false);
    setDeleteProgress(0);
  };

  const handleDelete = async () => {
    if (!project || !onProjectDeleted) return;

    try {
      const id = project.id;

      // Delete all child records first to satisfy FK constraints
      const childTables = [
        'delivery_notes', 'calendar_events', 'time_entries', 'timesheets',
        'project_team_assignments', 'project_assignments', 'project_comments',
        'project_documents', 'project_materials', 'project_material_assignments',
        'project_milestones', 'expenses', 'invoices', 'orders', 'offers',
        'emails', 'employee_material_usage', 'material_stock_movements',
        'stock_movements', 'workflow_chains', 'ai_suggestions', 'ai_training_data',
      ] as const;

      for (const table of childTables) {
        await supabase.from(table as any).delete().eq('project_id', id);
      }

      // Now delete the project itself
      const { error } = await supabase.from('projects').delete().eq('id', id);
      if (error) throw error;

      toast({ title: 'Projekt gelöscht', description: 'Das Projekt wurde erfolgreich gelöscht.' });
      eventBus.emit('PROJECT_DELETED' as any, { id });
      onProjectDeleted(id);
      onClose();
    } catch (error: any) {
      console.error('Error deleting project:', error);
      toast({
        title: 'Fehler',
        description: 'Projekt konnte nicht gelöscht werden: ' + (error.message || 'Unbekannter Fehler'),
        variant: 'destructive'
      });
    } finally {
      stopDelete();
    }
  };

  if (!project) return null;


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
            <Label htmlFor="customer_id">Kunde</Label>
            <Select value={formData.customer_id} onValueChange={(value) => handleInputChange('customer_id', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Kunde auswählen" />
              </SelectTrigger>
              <SelectContent>
                {customers.map((customer) => (
                  <SelectItem key={customer.id} value={customer.id}>
                    {(customer as any).company_name || (customer as any).name || 'Unbekannt'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="project_site_id">Standort (Baustelle)</Label>
            <Select
              value={formData.project_site_id}
              onValueChange={(value) => handleInputChange('project_site_id', value)}
              disabled={!formData.customer_id}
            >
              <SelectTrigger>
                <SelectValue placeholder={
                  !formData.customer_id
                    ? "Bitte zuerst Kunde wählen"
                    : projectSites.length === 0
                      ? "Keine Baustellen hinterlegt"
                      : "Standort auswählen..."
                } />
              </SelectTrigger>
              <SelectContent>
                {projectSites.map((site) => (
                  <SelectItem key={site.id} value={site.id}>
                    {site.name ? `${site.name} - ` : ''}{site.address}, {site.city}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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


          <div className="flex gap-2 pt-4">
            <div className="flex-1">
              <div className="relative">
                <Button
                  type="button"
                  variant="destructive"
                  className="w-full relative overflow-hidden"
                  onClick={() => {}}
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
