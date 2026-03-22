import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Receipt, ChevronRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import CreateInvoiceFromProjectDialog from './CreateInvoiceFromProjectDialog';

interface Customer {
  id: string;
  company_name: string;
  contact_person: string;
}

interface Project {
  id: string;
  name: string;
  customer_id: string;
}

interface AddInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInvoiceCreated?: (invoiceId: string) => void;
}

export function AddInvoiceDialog({ open, onOpenChange, onInvoiceCreated }: AddInvoiceDialogProps) {
  const [customerId, setCustomerId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [showWizard, setShowWizard] = useState(false);

  const { data: customers = [] } = useQuery({
    queryKey: ['customers-for-invoice'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('id, company_name, contact_person')
        .order('company_name');

      if (error) throw error;
      return data as Customer[];
    }
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects-for-invoice', customerId],
    enabled: !!customerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name, customer_id')
        .eq('customer_id', customerId)
        .not('status', 'in', '("abgeschlossen","storniert")')
        .order('name');

      if (error) throw error;
      return data as Project[];
    }
  });

  const selectedProject = projects.find(p => p.id === projectId);

  const handleClose = () => {
    setCustomerId('');
    setProjectId('');
    setShowWizard(false);
    onOpenChange(false);
  };

  const handleContinue = () => {
    if (customerId && projectId) {
      onOpenChange(false);
      setShowWizard(true);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-50">
                <Receipt className="h-5 w-5 text-emerald-600" />
              </div>
              <DialogTitle>Neue Rechnung erstellen</DialogTitle>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Kunde *</Label>
              <Select value={customerId} onValueChange={(val) => {
                setCustomerId(val);
                setProjectId('');
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Kunde auswählen" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.company_name} {customer.contact_person ? `(${customer.contact_person})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Projekt / Auftrag *</Label>
              <Select
                value={projectId}
                onValueChange={setProjectId}
                disabled={!customerId}
              >
                <SelectTrigger>
                  <SelectValue placeholder={
                    !customerId ? "Bitte zuerst Kunde wählen" :
                    projects.length === 0 ? "Keine Projekte vorhanden" :
                    "Projekt auswählen"
                  } />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {customerId && projectId && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-700">
                Im nächsten Schritt werden automatisch Angebote, Lieferscheine, Zeiteinträge und Material für dieses Projekt geladen.
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={handleClose}>
              Abbrechen
            </Button>
            <Button
              onClick={handleContinue}
              disabled={!customerId || !projectId}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              Weiter
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {showWizard && selectedProject && (
        <CreateInvoiceFromProjectDialog
          isOpen={showWizard}
          onClose={handleClose}
          projectId={projectId}
          projectName={selectedProject.name}
          customerId={customerId}
          onInvoiceCreated={(invoiceId) => {
            handleClose();
            onInvoiceCreated?.(invoiceId);
          }}
        />
      )}
    </>
  );
}
