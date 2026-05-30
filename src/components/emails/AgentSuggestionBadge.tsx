import { Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useAgentSuggestions } from '@/hooks/useAgentSuggestions';

interface Props {
  emailId: string;
  onClick: () => void;
}

export function AgentSuggestionBadge({ emailId, onClick }: Props) {
  const { suggestions, isLoading } = useAgentSuggestions(emailId);
  if (isLoading || suggestions.length === 0) return null;

  return (
    <Badge
      variant="secondary"
      className="cursor-pointer hover:bg-primary/10 gap-1"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <Sparkles className="h-3 w-3" />
      {suggestions.length === 1 ? 'Vorschlag' : `${suggestions.length} Vorschläge`}
    </Badge>
  );
}
