import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type AgentMessageStatus =
  | 'pending'
  | 'running'
  | 'awaiting_approval'
  | 'done'
  | 'failed';

export interface AgentMessage {
  id: string;
  role: 'user' | 'agent';
  content: string;
  taskId?: string;
  status?: AgentMessageStatus;
  preview?: Record<string, unknown> | null;
  agentMessage?: string;
}

export interface UseAgentChatResult {
  messages: AgentMessage[];
  isLoading: boolean;
  sendMessage: (text: string) => Promise<void>;
  approve: (taskId: string) => Promise<void>;
}

interface AgentTaskRowMinimal {
  id: string;
  status?: AgentMessageStatus;
  output?: { preview?: Record<string, unknown>; agentMessage?: string; offerId?: string } | null;
  error?: string | null;
}

export function useAgentChat(): UseAgentChatResult {
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);

  // Load companyId from profiles on mount (single source of truth, matches Phase 1 router auth)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) return;
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', userData.user.id)
        .single();
      if (!cancelled && profile?.company_id) {
        setCompanyId(profile.company_id as string);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Realtime subscription on agent_tasks UPDATE for our company
  useEffect(() => {
    if (!companyId) return;
    const channel = supabase
      .channel(`agent-tasks-${companyId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'agent_tasks',
          filter: `company_id=eq.${companyId}`,
        },
        (payload: { new: AgentTaskRowMinimal }) => {
          const row = payload.new;
          setMessages((prev) =>
            prev.map((m) => {
              if (m.taskId !== row.id) return m;
              return {
                ...m,
                status: row.status ?? m.status,
                preview: row.output?.preview ?? m.preview ?? null,
                agentMessage: row.output?.agentMessage ?? m.agentMessage,
                content:
                  row.error
                    ? `Fehler: ${row.error}`
                    : row.output?.agentMessage ?? m.content,
              };
            }),
          );
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId]);

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (trimmed.length === 0) return;

    const userMsg: AgentMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: trimmed,
    };
    const agentPlaceholderId = crypto.randomUUID();
    const agentPlaceholder: AgentMessage = {
      id: agentPlaceholderId,
      role: 'agent',
      content: 'Analysiere…',
      status: 'running',
    };
    setMessages((prev) => [...prev, userMsg, agentPlaceholder]);
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('agent-router', {
        body: { message: trimmed },
      });
      if (error || !data?.taskId) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === agentPlaceholderId
              ? { ...m, status: 'failed', content: error?.message ?? 'Router-Fehler' }
              : m,
          ),
        );
        return;
      }
      setMessages((prev) =>
        prev.map((m) =>
          m.id === agentPlaceholderId ? { ...m, taskId: data.taskId as string } : m,
        ),
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  const approve = useCallback(async (_taskId: string) => {
    throw new Error('approve not implemented yet — see Task 4');
  }, []);

  return { messages, isLoading, sendMessage, approve };
}
