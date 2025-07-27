import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/use-toast';

interface EmailLinkerProps {
  emailId: string;
}

interface ProjectOption {
  id: string;
  title: string;
}

interface CustomerOption {
  id: string;
  company_name: string;
}

/**
 * EmailLinker provides dropdowns to link an email to a project and/or customer.
 * Changing a selection updates the corresponding fields in the `emails` table.
 */
const EmailLinker: React.FC<EmailLinkerProps> = ({ emailId }) => {
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        // Determine the company of the current user
        const { data: profile } = await supabase
          .from('profiles')
          .select('company_id')
          .single();
        const companyId = profile?.company_id;
        if (!companyId) return;

        // Fetch projects
        const { data: projectData } = await supabase
          .from('projects')
          .select('id, title')
          .eq('company_id', companyId);
        setProjects((projectData as ProjectOption[]) || []);

        // Fetch customers
        const { data: customerData } = await supabase
          .from('customers')
          .select('id, company_name')
          .eq('company_id', companyId);
        setCustomers((customerData as CustomerOption[]) || []);

        // Fetch current email links
        const { data: emailData } = await supabase
          .from('emails')
          .select('project_id, customer_id')
          .eq('id', emailId)
          .single();
        setSelectedProject(emailData?.project_id ?? null);
        setSelectedCustomer(emailData?.customer_id ?? null);
      } catch (err) {
        console.error(err);
      }
    };

    fetchOptions();
  }, [emailId]);

  const updateEmailLink = async (
    type: 'project' | 'customer',
    value: string | null,
  ) => {
    try {
      const updateData: Record<string, string | null> = {};
      if (type === 'project') updateData.project_id = value;
      else updateData.customer_id = value;

      const { error } = await supabase
        .from('emails')
        .update(updateData)
        .eq('id', emailId);
      if (error) throw error;

      toast({
        title: 'Verknüpfung gespeichert',
        description: 'E-Mail wurde aktualisiert.',
      });
    } catch (error) {
      console.error(error);
      const message =
        error && typeof error === 'object' && 'message' in error
          ? String((error as { message?: string }).message)
          : 'Unbekannter Fehler';
      toast({ title: 'Fehler', description: message });
    }
  };

  return (
    <div className="space-y-2">
      <div>
        <label className="block text-sm font-medium">Projekt zuordnen</label>
        <select
          className="border p-2 w-full"
          value={selectedProject ?? ''}
          onChange={(e) => {
            const val = e.target.value || null;
            setSelectedProject(val);
            updateEmailLink('project', val);
          }}
        >
          <option value="">– Kein Projekt –</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium">Kunde zuordnen</label>
        <select
          className="border p-2 w-full"
          value={selectedCustomer ?? ''}
          onChange={(e) => {
            const val = e.target.value || null;
            setSelectedCustomer(val);
            updateEmailLink('customer', val);
          }}
        >
          <option value="">– Kein Kunde –</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.company_name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

export default EmailLinker;
