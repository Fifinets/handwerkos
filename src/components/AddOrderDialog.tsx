import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from '@/integrations/supabase/client';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';

const getEmployeeAvailability = (emp: any) => {
  const activeProjects = (emp.project_team_assignments || [])
    .filter((a: any) => a.is_active && a.projects && a.projects.status !== 'abgeschlossen' && a.projects.status !== 'storniert');
  if (activeProjects.length === 0) return { label: 'Verfügbar', color: 'bg-emerald-100 text-emerald-700', projects: [] };
  if (activeProjects.length >= 3) return { label: 'Ausgelastet', color: 'bg-red-100 text-red-700', projects: activeProjects };
  return { label: `${activeProjects.length} Projekt${activeProjects.length > 1 ? 'e' : ''}`, color: 'bg-amber-100 text-amber-700', projects: activeProjects };
};

interface AddOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOrderAdded: () => void;
}

const AddOrderDialog = ({ open, onOpenChange, onOrderAdded }: AddOrderDialogProps) => {
  const { toast } = useToast();
  const { companyId } = useSupabaseAuth();

  const [customers, setCustomers] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [projectSites, setProjectSites] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    customer_id: '',
    employee_id: '',
    project_site_id: '',
    work_date: '',
    description: '',
  });

  useEffect(() => {
    if (!companyId || !open) return;
    Promise.all([
      supabase.from('customers').select('id, company_name, contact_person').eq('company_id', companyId),
      supabase.from('employees')
        .select('id, first_name, last_name, position, project_team_assignments(is_active, projects(name, status, start_date, end_date))')
        .eq('company_id', companyId)
        .not('status', 'in', '("Inaktiv","Gekündigt")'),
    ]).then(([custRes, empRes]) => {
      setCustomers(custRes.data || []);
      setEmployees(empRes.data || []);
    });
  }, [companyId, open]);

  useEffect(() => {
    if (!formData.customer_id) {
      setProjectSites([]);
      return;
    }
    supabase
      .from('project_sites')
      .select('id, name, address, city')
      .eq('customer_id', formData.customer_id)
      .then(({ data }) => {
        setProjectSites(data || []);
        if (data && data.length === 1) {
          setFormData(prev => ({ ...prev, project_site_id: data[0].id }));
        }
      });
  }, [formData.customer_id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.customer_id) {
      toast({ title: "Fehler", description: "Bitte Auftragsname und Kunde ausfüllen.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: project, error } = await supabase
        .from('projects')
        .insert({
          name: formData.name,
          customer_id: formData.customer_id,
          company_id: companyId,
          project_site_id: formData.project_site_id || null,
          project_type: 'kleinauftrag',
          status: formData.work_date ? 'beauftragt' : 'anfrage',
          start_date: formData.work_date || null,
          end_date: formData.work_date || null,
          description: formData.description || null,
        })
        .select()
        .single();

      if (error) throw error;

      if (formData.employee_id && project) {
        await supabase.from('project_team_assignments').insert({
          project_id: project.id,
          employee_id: formData.employee_id,
        });
      }

      toast({ title: "Auftrag erstellt", description: `${formData.name} wurde als Kleinauftrag angelegt.` });
      setFormData({ name: '', customer_id: '', employee_id: '', project_site_id: '', work_date: '', description: '' });
      onOrderAdded();
      onOpenChange(false);
    } catch (error: any) {
      toast({ title: "Fehler", description: error.message || "Auftrag konnte nicht erstellt werden.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const set = (field: string, value: string) => setFormData(prev => ({ ...prev, [field]: value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Neuer Kleinauftrag</DialogTitle>
          <DialogDescription>
            Schnellauftrag für Reparaturen, Installationen oder kurzfristige Einsätze.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Auftragsname *</Label>
            <Input
              value={formData.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="z.B. Wasserhahn Reparatur, Steckdose installieren"
              required
            />
          </div>

          <div>
            <Label>Kunde *</Label>
            <Select value={formData.customer_id} onValueChange={(v) => setFormData(prev => ({ ...prev, customer_id: v, project_site_id: '' }))}>
              <SelectTrigger>
                <SelectValue placeholder="Kunde auswählen" />
              </SelectTrigger>
              <SelectContent>
                {customers.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.company_name || 'Unbekannt'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Standort</Label>
            <Select
              value={formData.project_site_id}
              onValueChange={(v) => set('project_site_id', v)}
              disabled={!formData.customer_id}
            >
              <SelectTrigger>
                <SelectValue placeholder={
                  !formData.customer_id ? "Bitte zuerst Kunde wählen"
                    : projectSites.length === 0 ? "Keine Standorte hinterlegt"
                      : "Standort auswählen..."
                } />
              </SelectTrigger>
              <SelectContent>
                {projectSites.map(site => (
                  <SelectItem key={site.id} value={site.id}>
                    {site.name ? `${site.name} - ` : ''}{site.address}, {site.city}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Mitarbeiter</Label>
            <Select value={formData.employee_id} onValueChange={(v) => set('employee_id', v)}>
              <SelectTrigger>
                <SelectValue placeholder="Mitarbeiter zuweisen" />
              </SelectTrigger>
              <SelectContent>
                {employees.map(emp => {
                  const avail = getEmployeeAvailability(emp);
                  return (
                    <SelectItem key={emp.id} value={emp.id}>
                      <div className="flex items-center justify-between w-full gap-2">
                        <span>{emp.first_name} {emp.last_name} {emp.position ? `(${emp.position})` : ''}</span>
                        <Badge className={`text-[10px] ml-2 ${avail.color}`}>{avail.label}</Badge>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Termin</Label>
            <Input
              type="date"
              value={formData.work_date}
              onChange={(e) => set('work_date', e.target.value)}
            />
            <p className="text-xs text-slate-500 mt-1">Optional — ohne Datum wird der Auftrag als "Anfrage" angelegt.</p>
          </div>

          <div>
            <Label>Beschreibung</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="Was muss gemacht werden?"
              rows={3}
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Abbrechen
            </Button>
            <Button type="submit" className="flex-1" disabled={isSubmitting}>
              {isSubmitting ? 'Wird erstellt...' : 'Auftrag erstellen'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddOrderDialog;
