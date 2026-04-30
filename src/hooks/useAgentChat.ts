import { useCallback, useState } from 'react';
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

export function useAgentChat(): UseAgentChatResult {
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

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

  // Approve will be added in Task 4
  const approve = useCallback(async (_taskId: string) => {
    throw new Error('approve not implemented yet — see Task 4');
  }, []);

  return { messages, isLoading, sendMessage, approve };
}
