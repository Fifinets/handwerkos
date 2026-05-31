import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';

const mockFromChain = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  is: vi.fn().mockReturnThis(),
  in: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
};

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => mockFromChain),
  },
}));

import { useAgentSuggestions } from './useAgentSuggestions';

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useAgentSuggestions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFromChain.order.mockResolvedValue({ data: [], error: null });
  });

  it('queries agent_tasks filtered to awaiting_approval and approved_at IS NULL', async () => {
    const { result } = renderHook(() => useAgentSuggestions('email-123'), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockFromChain.select).toHaveBeenCalled();
    expect(mockFromChain.eq).toHaveBeenCalledWith('status', 'awaiting_approval');
    expect(mockFromChain.is).toHaveBeenCalledWith('approved_at', null);
  });

  it('returns the suggestions array filtered to the emailId', async () => {
    const fake = [
      { id: 'task-1', agent_type: 'offers', status: 'awaiting_approval',
        output: { action: 'draft_quote_from_email', preview: {} },
        input: { emailId: 'email-123' }, created_at: '2026-05-11T16:00:00Z' },
      { id: 'task-2', agent_type: 'offers', status: 'awaiting_approval',
        output: { action: 'draft_quote_from_email', preview: {} },
        input: { emailId: 'email-OTHER' }, created_at: '2026-05-11T16:01:00Z' },
    ];
    mockFromChain.order.mockResolvedValueOnce({ data: fake, error: null });
    const { result } = renderHook(() => useAgentSuggestions('email-123'), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.suggestions).toHaveLength(1);
    expect(result.current.suggestions[0].id).toBe('task-1');
  });

  it('returns empty array on error', async () => {
    mockFromChain.order.mockResolvedValueOnce({ data: null, error: { message: 'db err' } });
    const { result } = renderHook(() => useAgentSuggestions('email-123'), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.suggestions).toEqual([]);
  });

  it('returns empty array when emailId is undefined', async () => {
    const { result } = renderHook(() => useAgentSuggestions(undefined), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.suggestions).toEqual([]);
  });
});
