import React, { useState, useMemo, useEffect } from 'react';
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
  onProjectAdded?: (project: { id: string; name: string; status: string }) => void;
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
    customer_id: '',
    project_site_id: '',
    budget: '',
    team: [] as string[],
    status: 'planned'
  });
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [projectSites, setProjectSites] = useState<{ id: string; name: string | null; address: string; city: string; }[]>([]);

  // Fetch project sites for the selected customer
  useEffect(() => {
    const fetchSites = async () => {
      if (!formData.customer_id) {
        setProjectSites([]);
        return;
      }
      try {
        const { supabase } = await import('@/integrations/supabase/client');
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

  // Verfügbarkeitsprüfung für Teammitglieder
  const getAvailabilityStatus = (member: TeamMember, dateRange: DateRange | undefined) => {
    if (!dateRange?.from || !dateRange?.to) return 'unknown';

    // Check if member has projects array
    if (!member.projects || !Array.isArray(member.projects)) {
      return 'available'; // If no projects, member is available
    }

    const startDate = new Date(dateRange.from);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(dateRange.to);
    endDate.setHours(23, 59, 59, 999);

    let conflictDays = 0;
    // Inclusive day count
    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) || 1;

    member.projects.forEach(project => {
      if (!project.startDate || !project.endDate) return;

      const memberProjectStart = new Date(project.startDate.split('.').reverse().join('-'));
      memberProjectStart.setHours(0, 0, 0, 0);
      const memberProjectEnd = new Date(project.endDate.split('.').reverse().join('-'));
      memberProjectEnd.setHours(23, 59, 59, 999);

      if (startDate <= memberProjectEnd && endDate >= memberProjectStart) {
        const overlapStart = new Date(Math.max(startDate.getTime(), memberProjectStart.getTime()));
        const overlapEnd = new Date(Math.min(endDate.getTime(), memberProjectEnd.getTime()));
        // Inclusive overlap days
        const overlapDays = Math.ceil((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24)) || 1;
        conflictDays += overlapDays;
      }
    });

    if (conflictDays === 0) return 'available';
    if (conflictDays >= totalDays * 0.5) return 'unavailable'; // 50% overlap is enough to be "unavailable"
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
    if (!formData.name || !formData.customer_id) {
      toast({
        title: "Fehler",
        description: "Bitte füllen Sie alle Pflichtfelder aus.",
        variant: "destructive"
      });
      return;
    }

    // Find customer by ID
    const selectedCustomer = customers.find(customer => customer.id === formData.customer_id);

    if (!selectedCustomer) {
      toast({
        title: "Fehler",
        description: "Bitte wählen Sie einen gültigen Kunden aus.",
        variant: "destructive"
      });
      return;
    }

    // Get team member IDs
    const teamMemberIds = formData.team
      .map(memberName => {
        const member = teamMembers.find(m =>
          m.name === memberName ||
          `${m.first_name || ''} ${m.last_name || ''}`.trim() === memberName
        );
        return member?.id;
      })
      .filter(id => id !== undefined);

    // Prepare project data for API
    const projectData = {
      name: formData.name,
      customer_id: selectedCustomer.id,
      project_site_id: formData.project_site_id || undefined,
      status: formData.status as 'planned' | 'active' | 'completed' | 'cancelled',
      budget: parseFloat(formData.budget.replace(/[^0-9.]/g, '')) || 0,
      start_date: dateRange?.from ? format(dateRange?.from, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
      end_date: dateRange?.to ? format(dateRange.to, 'yyyy-MM-dd') : undefined,
      // Remove assigned_employees for now - will be handled separately
      // assigned_employees: teamMemberIds
    };

    try {
      // Create project in database
      const newProject = await createProjectMutation.mutateAsync(projectData);

      // Add team members to the project if any were selected
      if (teamMemberIds.length > 0 && newProject) {
        console.log('Adding team members to project:', {
          projectId: newProject.id,
          teamMemberIds,
          teamMemberInserts: teamMemberIds.map(id => ({ project_id: newProject.id, employee_id: id }))
        });

        // Import supabase here to add team members
        const { supabase } = await import('@/integrations/supabase/client');

        const teamMemberInserts = teamMemberIds.map(employeeId => ({
          project_id: newProject.id,
          employee_id: employeeId
        }));

        const { error: teamError } = await supabase
          .from('project_team_assignments')
          .insert(teamMemberInserts);

        if (teamError) {
          console.error('Error adding team members:', teamError);
          toast({
            title: "Warnung",
            description: "Projekt wurde erstellt, aber Team-Mitglieder konnten nicht zugewiesen werden: " + teamError.message,
            variant: "destructive"
          });
        } else {
          console.log('Team members successfully added to project');
          toast({
            title: "Erfolg",
            description: `Projekt erstellt und ${teamMemberIds.length} Team-Mitglieder zugewiesen.`,
          });
        }
      }

      // Close dialog and show success message
      toast({
        title: "Projekt erstellt",
        description: `${formData.name} wurde erfolgreich erstellt.`,
      });

      // Reset form
      setFormData({
        name: '',
        customer_id: '',
        project_site_id: '',
        budget: '',
        team: [],
        status: 'planned'
      });
      setDateRange(undefined);

      onClose();
    } catch (error) {
      console.error('Error creating project:', error);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleCustomerChange = (customerId: string) => {
    setFormData(prev => ({
      ...prev,
      customer_id: customerId,
      // Optional: automatically select primary site if available later
      project_site_id: ''
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
            <Label htmlFor="customer_id">Kunde *</Label>
            <Select value={formData.customer_id} onValueChange={handleCustomerChange}>
              <SelectTrigger>
                <SelectValue placeholder="Kunde auswählen" />
              </SelectTrigger>
              <SelectContent>
                {customers.map((customer) => (
                  <SelectItem key={customer.id} value={customer.id}>
                    {customer.company_name || customer.name || 'Unbekannt'}
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
                <SelectItem value="planned">Planung</SelectItem>
                <SelectItem value="active">In Bearbeitung</SelectItem>
                <SelectItem value="completed">Abgeschlossen</SelectItem>
                <SelectItem value="cancelled">Storniert</SelectItem>
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
