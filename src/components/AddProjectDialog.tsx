
import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { DateRange } from "react-day-picker";
import { useToast } from "@/hooks/use-toast";
import { useCreateProject } from "@/hooks/useApi";
import { supabase } from "@/integrations/supabase/client";

interface Customer {
  id: string;
  name?: string;
  company_name?: string;
  contact?: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  address?: string;
  projects?: number;
  revenue?: string;
  status?: string;
}

interface TeamMember {
  id: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  role?: string;
  position?: string;
  email?: string;
  phone?: string;
  projects?: Array<{
    name: string;
    startDate: string;
    endDate: string;
  }>;
}

interface AddProjectDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onProjectAdded: (project: { id: string; name: string; status: string }) => void;
  customers: Customer[];
  teamMembers: TeamMember[];
}

const AddProjectDialog = ({ isOpen, onClose, onProjectAdded, customers, teamMembers }: AddProjectDialogProps) => {
  const { toast } = useToast();
  const createProjectMutation = useCreateProject();
  
  // Debug logging
  console.log('AddProjectDialog - customers:', customers);
  console.log('AddProjectDialog - teamMembers:', teamMembers);
  const [formData, setFormData] = useState({
    name: '',
    customer: '',
    location: '',
    budget: '',
    team: [] as string[],
    status: 'geplant'
  });
  const [dateRange, setDateRange] = useState<DateRange | undefined>();

  // Verfügbarkeitsprüfung für Teammitglieder
  const getAvailabilityStatus = (member: TeamMember, dateRange: DateRange | undefined) => {
    if (!dateRange?.from || !dateRange?.to) return 'unknown';
    
    const startDate = dateRange.from;
    const endDate = dateRange.to;
    
    let conflictDays = 0;
    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    
    member.projects.forEach(project => {
      const memberProjectStart = new Date(project.startDate.split('.').reverse().join('-'));
      const memberProjectEnd = new Date(project.endDate.split('.').reverse().join('-'));
      
      if (startDate <= memberProjectEnd && endDate >= memberProjectStart) {
        const overlapStart = new Date(Math.max(startDate.getTime(), memberProjectStart.getTime()));
        const overlapEnd = new Date(Math.min(endDate.getTime(), memberProjectEnd.getTime()));
        const overlapDays = Math.ceil((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24));
        conflictDays += overlapDays;
      }
    });
    
    if (conflictDays === 0) return 'available';
    if (conflictDays >= totalDays * 0.8) return 'unavailable';
    return 'partial';
  };

  const teamMembersWithAvailability = useMemo(() => {
    return teamMembers.map(member => ({
      ...member,
      availability: getAvailabilityStatus(member, dateRange)
    }));
  }, [teamMembers, dateRange]);

  const getAvailabilityBadge = (availability: string) => {
    switch (availability) {
      case 'available':
        return <Badge className="bg-green-100 text-green-800 text-xs">Verfügbar</Badge>;
      case 'partial':
        return <Badge className="bg-orange-100 text-orange-800 text-xs">Teilweise</Badge>;
      case 'unavailable':
        return <Badge className="bg-red-100 text-red-800 text-xs">Nicht verfügbar</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">Unbekannt</Badge>;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validierung
    if (!formData.name || !formData.customer || !formData.budget) {
      toast({
        title: "Fehler",
        description: "Bitte füllen Sie alle Pflichtfelder aus.",
        variant: "destructive"
      });
      return;
    }

    // Finde den ausgewählten Kunden
    const selectedCustomer = customers.find(customer =>
      (customer.name === formData.customer) || (customer.company_name === formData.customer)
    );

    if (!selectedCustomer) {
      toast({
        title: "Fehler",
        description: "Kunde nicht gefunden.",
        variant: "destructive"
      });
      return;
    }

    // Projekt-Daten für Supabase vorbereiten
    const projectData = {
      name: formData.name,
      customer_id: selectedCustomer.id,
      status: formData.status as "active" | "planned" | "blocked" | "completed" | "cancelled",
      location: formData.location || selectedCustomer.address || 'Nicht angegeben',
      budget: parseFloat(formData.budget.replace('€', '').replace(',', '.')) || 0,
      start_date: dateRange?.from ? dateRange.from.toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      end_date: dateRange?.to ? dateRange.to.toISOString().split('T')[0] : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      description: `Team: ${formData.team.length > 0 ? formData.team.join(', ') : 'Nicht zugewiesen'}`,
      // Team assignments will be handled separately
      team_assignments: formData.team
    };

    try {
      // Erst das Projekt erstellen
      const createdProject = await createProjectMutation.mutateAsync(projectData);

      // Dann Team-Zuweisungen in der project_assignments Tabelle speichern
      if (formData.team.length > 0) {
        const assignments = await Promise.all(
          formData.team.map(async (memberName) => {
            // Finde die Mitarbeiter-ID über den Namen
            const { data: employee } = await supabase
              .from('employees')
              .select('id')
              .or(`first_name.eq.${memberName.split(' ')[0]},last_name.eq.${memberName.split(' ').slice(1).join(' ')},name.eq.${memberName}`)
              .single();

            if (employee) {
              return supabase
                .from('project_assignments')
                .insert({
                  project_id: createdProject.id,
                  employee_id: employee.id,
                  start_date: dateRange?.from ? dateRange.from.toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
                  end_date: dateRange?.to ? dateRange.to.toISOString().split('T')[0] : null,
                  role: 'mitarbeiter',
                  hours_per_day: 8.0
                });
            }
          })
        );

        const successfulAssignments = assignments.filter(Boolean);
        console.log('Team assignments created:', successfulAssignments.length);
      }

      // Erfolgsmeldung für Team-Zuweisungen
      if (formData.team.length > 0) {
        toast({
          title: "Projekt erstellt",
          description: `Projekt "${formData.name}" wurde erstellt und ${formData.team.length} Mitarbeiter zugewiesen.`
        });
      } else {
        toast({
          title: "Projekt erstellt",
          description: `Projekt "${formData.name}" wurde erfolgreich erstellt.`
        });
      }

      onProjectAdded({
        id: createdProject.id,
        name: createdProject.name,
        status: createdProject.status || 'geplant'
      });

      // Formular zurücksetzen
      setFormData({
        name: '',
        customer: '',
        location: '',
        budget: '',
        team: [],
        status: 'geplant'
      });
      setDateRange(undefined);

      onClose();
    } catch (error) {
      console.error('Error creating project:', error);
      toast({
        title: "Fehler",
        description: "Projekt konnte nicht erstellt werden.",
        variant: "destructive"
      });
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleCustomerChange = (customerName: string) => {
    const selectedCustomer = customers.find(customer => 
      (customer.name === customerName) || (customer.company_name === customerName)
    );
    
    setFormData(prev => ({
      ...prev,
      customer: customerName,
      location: selectedCustomer ? selectedCustomer.address : ''
    }));
  };

  const handleTeamMemberToggle = (memberName: string, checked: boolean) => {
    // Get the actual name to use for the member
    const member = teamMembers.find(m => 
      m.name === memberName || 
      `${m.first_name || ''} ${m.last_name || ''}`.trim() === memberName
    );
    const nameToUse = member?.name || `${member?.first_name || ''} ${member?.last_name || ''}`.trim() || memberName;
    
    setFormData(prev => ({
      ...prev,
      team: checked 
        ? [...prev.team, nameToUse]
        : prev.team.filter(name => name !== nameToUse)
    }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Neues Projekt erstellen</DialogTitle>
          <DialogDescription>
            Geben Sie die Informationen für das neue Projekt ein.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Projektname *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              placeholder="z.B. Büroerweiterung Müller GmbH"
              required
            />
          </div>

          <div>
            <Label htmlFor="customer">Kunde *</Label>
            <Select value={formData.customer} onValueChange={handleCustomerChange}>
              <SelectTrigger>
                <SelectValue placeholder="Kunde auswählen" />
              </SelectTrigger>
              <SelectContent>
                {customers.map((customer) => (
                  <SelectItem key={customer.id} value={customer.name || customer.company_name || 'Unbekannt'}>
                    {customer.name || customer.company_name || 'Unbekannt'}
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
              placeholder="Wird automatisch aus Kundendaten übernommen"
              readOnly
              className="bg-gray-50"
            />
          </div>

          <div>
            <Label htmlFor="budget">Budget *</Label>
            <Input
              id="budget"
              value={formData.budget}
              onChange={(e) => handleInputChange('budget', e.target.value)}
              placeholder="z.B. 15000 oder €15.000"
              required
            />
          </div>

          <div>
            <Label>Projektzeitraum</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange?.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, "dd.MM.yyyy", { locale: de })} -{" "}
                        {format(dateRange.to, "dd.MM.yyyy", { locale: de })}
                      </>
                    ) : (
                      format(dateRange.from, "dd.MM.yyyy", { locale: de })
                    )
                  ) : (
                    <span>Start- und Enddatum auswählen</span>
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
                  locale={de}
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          <div>
            <Label>Team auswählen</Label>
            <div className="mt-2 space-y-2 max-h-48 overflow-y-auto border rounded-md p-3">
              {teamMembersWithAvailability.map((member) => (
                <div key={member.id} className="flex items-center justify-between space-x-2 p-2 rounded-lg hover:bg-gray-50">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id={`team-${member.id}`}
                      checked={formData.team.includes(member.name || `${member.first_name || ''} ${member.last_name || ''}`.trim())}
                      onCheckedChange={(checked) => handleTeamMemberToggle(member.name || `${member.first_name || ''} ${member.last_name || ''}`.trim(), checked as boolean)}
                    />
                    <div>
                      <label htmlFor={`team-${member.id}`} className="text-sm font-medium cursor-pointer">
                        {member.name || `${member.first_name || ''} ${member.last_name || ''}`.trim() || 'Unbekannt'}
                      </label>
                      <p className="text-xs text-gray-500">{member.role || member.position || 'Mitarbeiter'}</p>
                    </div>
                  </div>
                  {getAvailabilityBadge(member.availability)}
                </div>
              ))}
            </div>
          </div>

          <div>
            <Label htmlFor="status">Status</Label>
            <Select value={formData.status} onValueChange={(value) => handleInputChange('status', value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="anfrage">Anfrage</SelectItem>
                <SelectItem value="besichtigung">Besichtigung</SelectItem>
                <SelectItem value="geplant">Planung</SelectItem>
                <SelectItem value="in_bearbeitung">In Bearbeitung</SelectItem>
                <SelectItem value="abgeschlossen">Abgeschlossen</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Abbrechen
            </Button>
            <Button type="submit" className="flex-1">
              Projekt erstellen
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddProjectDialog;
