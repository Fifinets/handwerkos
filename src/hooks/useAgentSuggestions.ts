import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AgentSuggestion {
  id: string;
  agent_type: string;
  status: string;
  output: {
    action: string;
    preview: Record<string, unknown>;
  } | null;
  created_at: string;
}

export function useAgentSuggestions(emailId: string | undefined) {
  const query = useQuery({
    queryKey: ['agent-suggestions', emailId],
    enabled: !!emailId,
    queryFn: async (): Promise<AgentSuggestion[]> => {
      if (!emailId) return [];
      const { data, error } = await supabase
        .from('agent_tasks')
        .select('id, agent_type, status, output, created_at, input')
        .eq('status', 'awaiting_approval')
        .is('approved_at', null)
        .order('created_at', { ascending: false });
      if (error) {
        console.error('useAgentSuggestions error:', error);
        return [];
      }
      // Filter client-side for emailId (JSONB input.emailId).
      return (data ?? []).filter((t: { input?: { emailId?: string } | null }) => {
        const input = t.input as { emailId?: string } | null;
        return input?.emailId === emailId;
      });
    },
  });

  return {
    suggestions: query.data ?? [],
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}
