import React from 'react';
import { Button } from '@/components/ui/button';
import { ArrowRight, Building2 } from 'lucide-react';
import { Quote } from '@/types';
import { 
  useAcceptQuote,
  useCreateProject 
} from '@/hooks/useApi';

interface QuoteActionsProps {
  quote: Quote;
  onRefresh?: () => void;
}

const QuoteActions: React.FC<QuoteActionsProps> = ({ quote, onRefresh }) => {
  // React Query mutations
  const acceptQuoteMutation = useAcceptQuote();
  const createProjectMutation = useCreateProject();
  
  const handleCreateOrder = () => {
    acceptQuoteMutation.mutate(quote.id, {
      onSuccess: () => {
        onRefresh?.();
      }
    });
  };

  const handleDirectProjectConvert = () => {
    createProjectMutation.mutate({
      name: quote.title,
      description: quote.description,
      customer_id: quote.customer_id,
      status: 'neu',
      start_date: new Date().toISOString().split('T')[0],
      quote_id: quote.id
    }, {
      onSuccess: () => {
        onRefresh?.();
      }
    });
  };

  // Check loading states
  const isLoading = acceptQuoteMutation.isPending || createProjectMutation.isPending;
  
  // Show workflow buttons only for accepted/sent quotes
  const canCreateOrder = quote.status === 'accepted' || quote.status === 'sent' || quote.status === 'versendet';
  
  return (
    <div className="flex space-x-1">
      {canCreateOrder && (
        <Button 
          size="sm" 
          variant="default" 
          onClick={handleCreateOrder}
          disabled={isLoading}
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
        disabled={isLoading}
        title="Direkt zu Projekt (überspringt Auftrag)"
      >
        <Building2 className="h-3 w-3 mr-1" />
        Zu Projekt
      </Button>
    </div>
  );
};

export default QuoteActions;
