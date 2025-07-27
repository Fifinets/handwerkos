import React from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/use-toast';

interface Quote {
  id: string;
  title: string;
  description?: string | null;
  customer_id?: string | null;
}

interface QuoteActionsProps {
  quote: Quote;
  onRefresh?: () => void;
}

const QuoteActions: React.FC<QuoteActionsProps> = ({ quote, onRefresh }) => {
  const handleConvert = async () => {
    try {
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
        title: 'Angebot umgewandelt',
        description: `Das Angebot "${quote.title}" wurde in ein neues Projekt umgewandelt.`,
      });
      onRefresh?.();
    } catch (err: any) {
      console.error(err);
      toast({ title: 'Fehler', description: err.message ?? 'Die Umwandlung ist fehlgeschlagen.' });
    }
  };

  return (
    <div className="flex space-x-2">
      <Button size="sm" variant="outline" onClick={handleConvert}>
        In Auftrag umwandeln
      </Button>
    </div>
  );
};

export default QuoteActions;
