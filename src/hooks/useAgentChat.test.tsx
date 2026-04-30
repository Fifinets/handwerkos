import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAgentChat } from './useAgentChat';

vi.mock('@/integrations/supabase/client', () => {
  const mockChannel = {
    on: vi.fn().mockReturnThis(),
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
      },
      from: vi.fn(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { company_id: 'comp-1' },
              error: null,
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      })),
    },
  };
});

describe('useAgentChat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});
