import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/use-toast';
import { workflowService } from '@/services/WorkflowService';
import { ArrowRight, Building2 } from 'lucide-react';

interface Quote {
  id: string;
  title: string;
  description?: string | null;
  customer_id?: string | null;
  status: string;
  quote_number?: string;
}

interface QuoteActionsProps {
  quote: Quote;
  onRefresh?: () => void;
}

const QuoteActions: React.FC<QuoteActionsProps> = ({ quote, onRefresh }) => {
  const [converting, setConverting] = useState(false);
  
  const handleCreateOrder = async () => {
    setConverting(true);
    try {
      const orderId = await workflowService.createOrderFromQuote(quote.id);
      if (orderId) {
        toast({
          title: 'Auftrag erstellt',
          description: `Aus Angebot ${quote.quote_number || quote.title} wurde erfolgreich ein Auftrag erstellt.`,
        });
        onRefresh?.();
      }
    } catch (err: any) {
      console.error('Error creating order:', err);
      toast({ 
        title: 'Fehler', 
        description: err.message ?? 'Auftrag konnte nicht erstellt werden.',
        variant: 'destructive'
      });
    } finally {
      setConverting(false);
    }
  };

  const handleDirectProjectConvert = async () => {
    setConverting(true);
    try {
      // Legacy direct conversion to project (fallback)
      const { data: newProject, error: insertError } = await supabase
        .from('projects')
        .insert({
          name: quote.title,
          description: quote.description,
          customer_id: quote.customer_id,
          status: 'neu',
          start_date: new Date().toISOString().split('T')[0],
        })
        .select()
        .single();
      if (insertError) throw insertError;

      const { error: updateError } = await supabase
        .from('quotes')
        .update({ status: 'converted', project_id: newProject.id })
        .eq('id', quote.id);
      if (updateError) throw updateError;

      toast({
        title: 'Projekt erstellt',
        description: `Das Angebot "${quote.title}" wurde direkt in ein Projekt umgewandelt.`,
      });
      onRefresh?.();
    } catch (err: any) {
      console.error(err);
      toast({ 
        title: 'Fehler', 
        description: err.message ?? 'Die Umwandlung ist fehlgeschlagen.',
        variant: 'destructive'
      });
    } finally {
      setConverting(false);
    }
  };

  // Show workflow buttons only for accepted/sent quotes
  const canCreateOrder = quote.status === 'accepted' || quote.status === 'sent' || quote.status === 'versendet';
  
  return (
    <div className="flex space-x-1">
      {canCreateOrder && (
        <Button 
          size="sm" 
          variant="default" 
          onClick={handleCreateOrder}
          disabled={converting}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          <ArrowRight className="h-3 w-3 mr-1" />
          Auftrag erstellen
        </Button>
      )}
      <Button 
        size="sm" 
        variant="outline" 
        onClick={handleDirectProjectConvert}
        disabled={converting}
        title="Legacy: Direkt zu Projekt (überspringt Auftrag)"
      >
        <Building2 className="h-3 w-3 mr-1" />
        Zu Projekt
      </Button>
    </div>
  );
};

export default QuoteActions;
