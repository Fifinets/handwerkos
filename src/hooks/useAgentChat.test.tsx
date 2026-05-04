import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAgentChat } from './useAgentChat';

let capturedRealtimeCallback: ((payload: { new: Record<string, unknown> }) => void) | null = null;
const updateCalls: Array<{ table: string; args: Record<string, unknown> }> = [];

vi.mock('@/integrations/supabase/client', () => {
  const mockChannel = {
    on: vi.fn((_event: string, _config: unknown, cb: typeof capturedRealtimeCallback) => {
      capturedRealtimeCallback = cb;
      return mockChannel;
    }),
    subscribe: vi.fn().mockReturnThis(),
  };
  return {
    supabase: {
      channel: vi.fn(() => mockChannel),
      removeChannel: vi.fn(),
      functions: {
        invoke: vi.fn().mockResolvedValue({
          data: { taskId: 'task-1', agent: 'offers', action: 'create' },
          error: null,
        }),
      },
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1' } },
          error: null,
        }),
        getSession: vi.fn().mockResolvedValue({
          data: { session: { access_token: 'mock-token' } },
          error: null,
        }),
      },
      from: vi.fn((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { company_id: 'comp-1' },
                  error: null,
                }),
              }),
            }),
          };
        }
        return {
          update: vi.fn((args: Record<string, unknown>) => {
            updateCalls.push({ table, args });
            return {
              eq: vi.fn().mockResolvedValue({ error: null }),
            };
          }),
        };
      }),
    },
  };
});

describe('useAgentChat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedRealtimeCallback = null;
    updateCalls.length = 0;
  });

  it('starts with empty messages and isLoading=false', () => {
    const { result } = renderHook(() => useAgentChat());
    expect(result.current.messages).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });

  it('sendMessage adds a user message and an agent placeholder', async () => {
    const { result } = renderHook(() => useAgentChat());
    await act(async () => {
      await result.current.sendMessage('Erstelle Angebot für Müller');
    });

    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[0]).toMatchObject({
      role: 'user',
      content: 'Erstelle Angebot für Müller',
    });
    expect(result.current.messages[1]).toMatchObject({
      role: 'agent',
      taskId: 'task-1',
      status: 'running',
    });
  });

  it('sendMessage invokes agent-router with the message', async () => {
    const { supabase } = await import('@/integrations/supabase/client');
    const { result } = renderHook(() => useAgentChat());
    await act(async () => {
      await result.current.sendMessage('Test-Nachricht');
    });

    expect(supabase.functions.invoke).toHaveBeenCalledWith('agent-router', {
      body: { message: 'Test-Nachricht' },
    });
  });

  it('sendMessage on router error marks the agent message as failed', async () => {
    const { supabase } = await import('@/integrations/supabase/client');
    vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
      data: null,
      error: { message: 'router down' } as { message: string },
    });
    const { result } = renderHook(() => useAgentChat());
    await act(async () => {
      await result.current.sendMessage('Test');
    });

    expect(result.current.messages[1]).toMatchObject({
      role: 'agent',
      status: 'failed',
    });
  });

  it('sendMessage with empty string is a no-op', async () => {
    const { result } = renderHook(() => useAgentChat());
    await act(async () => {
      await result.current.sendMessage('   ');
    });
    expect(result.current.messages).toHaveLength(0);
  });

  it('subscribes to agent_tasks updates filtered by company_id on mount', async () => {
    const { supabase } = await import('@/integrations/supabase/client');
    renderHook(() => useAgentChat());
    await waitFor(() => {
      expect(supabase.channel).toHaveBeenCalled();
    });
    const channelMockResult = vi.mocked(supabase.channel).mock.results[0].value;
    const onCall = channelMockResult.on.mock.calls[0];
    expect(onCall[1]).toMatchObject({
      event: 'UPDATE',
      schema: 'public',
      table: 'agent_tasks',
      filter: 'company_id=eq.comp-1',
    });
  });

  it('updates the agent message status from a realtime event', async () => {
    const { result } = renderHook(() => useAgentChat());
    await waitFor(() => expect(capturedRealtimeCallback).not.toBeNull());

    await act(async () => {
      await result.current.sendMessage('Test');
    });

    await act(async () => {
      capturedRealtimeCallback!({
        new: {
          id: 'task-1',
          status: 'awaiting_approval',
          output: { offerId: 'offer-1', preview: { customer: 'Müller' }, agentMessage: 'Fertig.' },
        },
      });
    });

    const agentMsg = result.current.messages.find((m) => m.taskId === 'task-1');
    expect(agentMsg?.status).toBe('awaiting_approval');
    expect(agentMsg?.preview).toEqual({ customer: 'Müller' });
    expect(agentMsg?.agentMessage).toBe('Fertig.');
  });

  it('cleans up the realtime channel on unmount', async () => {
    const { supabase } = await import('@/integrations/supabase/client');
    const { unmount } = renderHook(() => useAgentChat());
    await waitFor(() => expect(supabase.channel).toHaveBeenCalled());
    unmount();
    expect(supabase.removeChannel).toHaveBeenCalled();
  });

  it('approve updates agent_tasks status to done with approved_at and approved_by', async () => {
    const { result } = renderHook(() => useAgentChat());
    await act(async () => {
      await result.current.approve('task-1');
    });

    const agentTasksUpdate = updateCalls.find((c) => c.table === 'agent_tasks');
    expect(agentTasksUpdate).toBeDefined();
    expect(agentTasksUpdate!.args).toMatchObject({
      status: 'done',
      approved_by: 'user-1',
    });
    expect(agentTasksUpdate!.args.approved_at).toBeTruthy();
  });

  it('approve marks the matching message as done in local state', async () => {
    const { result } = renderHook(() => useAgentChat());
    await waitFor(() => expect(capturedRealtimeCallback).not.toBeNull());

    await act(async () => {
      await result.current.sendMessage('Test');
    });
    await act(async () => {
      capturedRealtimeCallback!({
        new: { id: 'task-1', status: 'awaiting_approval' },
      });
    });
    expect(result.current.messages.find((m) => m.taskId === 'task-1')?.status).toBe('awaiting_approval');

    await act(async () => {
      await result.current.approve('task-1');
    });
    expect(result.current.messages.find((m) => m.taskId === 'task-1')?.status).toBe('done');
  });
});
