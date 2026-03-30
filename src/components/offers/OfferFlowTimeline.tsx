import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Offer } from '@/types/offer';
import { Check, ArrowRight, FileText, FolderKanban, Receipt, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

interface OfferFlowTimelineProps {
  offer: Offer;
}

interface FlowStep {
  label: string;
  icon: React.ReactNode;
  date?: string;
  status: 'completed' | 'active' | 'future' | 'error';
  documentName?: string;
  linkTo?: string;
}

export function OfferFlowTimeline({ offer }: OfferFlowTimelineProps) {
  const projectId = offer.project_id;

  // Load linked project
  const { data: project } = useQuery({
    queryKey: ['offer-flow-project', projectId],
    queryFn: async () => {
      if (!projectId) return null;
      const { data, error } = await supabase
        .from('projects')
        .select('id, name, status, workflow_target_type, workflow_target_id, created_at')
        .eq('id', projectId)
        .single();
      if (error) return null;
      return data;
    },
    enabled: !!projectId,
    staleTime: 30_000,
  });

  // Load linked invoice (if project has one)
  const invoiceId = project?.workflow_target_type === 'invoice' ? project.workflow_target_id : null;
  const { data: invoice } = useQuery({
    queryKey: ['offer-flow-invoice', invoiceId],
    queryFn: async () => {
      if (!invoiceId) return null;
      const { data, error } = await supabase
        .from('invoices')
        .select('id, invoice_number, status, created_at')
        .eq('id', invoiceId)
        .single();
      if (error) return null;
      return data;
    },
    enabled: !!invoiceId,
    staleTime: 30_000,
  });

  // Only show for accepted offers
  if (offer.status !== 'accepted') return null;

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return undefined;
    try {
      return format(new Date(dateStr), 'dd.MM.yy', { locale: de });
    } catch {
      return undefined;
    }
  };

  // Build steps
  const steps: FlowStep[] = [
    {
      label: 'Angebot',
      icon: <FileText className="h-4 w-4" />,
      date: formatDate(offer.accepted_at || offer.updated_at),
      status: 'completed',
      documentName: offer.offer_number,
    },
  ];

  if (!projectId) {
    steps.push({
      label: 'Projekt',
      icon: <AlertCircle className="h-4 w-4" />,
      status: 'error',
      documentName: 'Nicht verknüpft',
    });
  } else if (project) {
    const projectCompleted = project.status === 'abgeschlossen';
    steps.push({
      label: 'Projekt',
      icon: <FolderKanban className="h-4 w-4" />,
      date: formatDate(project.created_at),
      status: projectCompleted ? 'completed' : 'active',
      documentName: project.name,
    });

    if (invoice) {
      steps.push({
        label: 'Rechnung',
        icon: <Receipt className="h-4 w-4" />,
        date: formatDate(invoice.created_at),
        status: invoice.status === 'paid' ? 'completed' : 'active',
        documentName: invoice.invoice_number,
      });
    } else {
      steps.push({
        label: 'Rechnung',
        icon: <Receipt className="h-4 w-4" />,
        status: 'future',
      });
    }
  } else {
    // Project ID exists but hasn't loaded yet - show loading state
    steps.push(
      { label: 'Projekt', icon: <FolderKanban className="h-4 w-4" />, status: 'future' },
      { label: 'Rechnung', icon: <Receipt className="h-4 w-4" />, status: 'future' }
    );
  }

  const STEP_STYLES = {
    completed: 'bg-emerald-100 border-emerald-300 text-emerald-700',
    active: 'bg-blue-100 border-blue-300 text-blue-700',
    future: 'bg-slate-50 border-slate-200 text-slate-400',
    error: 'bg-amber-50 border-amber-200 text-amber-600',
  };

  return (
    <div className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg mb-4">
      <span className="text-xs font-medium text-slate-500 mr-2">Flow:</span>
      {steps.map((step, index) => (
        <div key={step.label} className="flex items-center">
          <div className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded-md border text-sm',
            STEP_STYLES[step.status]
          )}>
            {step.status === 'completed' ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              step.icon
            )}
            <div className="flex flex-col">
              <span className="font-medium text-xs">{step.label}</span>
              {step.documentName && (
                <span className="text-[10px] opacity-75">{step.documentName}</span>
              )}
            </div>
            {step.date && (
              <span className="text-[10px] opacity-60 ml-1">{step.date}</span>
            )}
          </div>
          {index < steps.length - 1 && (
            <ArrowRight className="h-4 w-4 text-slate-300 mx-1 flex-shrink-0" />
          )}
        </div>
      ))}
    </div>
  );
}

export default OfferFlowTimeline;
