import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const { updateChain, invokeMock } = vi.hoisted(() => ({
  updateChain: { eq: vi.fn() },
  invokeMock: vi.fn().mockResolvedValue({ data: { ok: true }, error: null }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({ update: vi.fn(() => updateChain) })),
    functions: { invoke: invokeMock },
  },
}));

import { AgentSuggestionReviewDialog } from './AgentSuggestionReviewDialog';

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

const sampleAnfrage = {
  id: 'task-1',
  agent_type: 'offers',
  status: 'awaiting_approval',
  created_at: '2026-05-11T16:00:00Z',
  output: {
    action: 'draft_quote_from_email',
    preview: {
      reply_draft: 'Sehr geehrter Herr Müller, vielen Dank für Ihre Anfrage.',
      positions_sketch: [
        { description: 'Steckdose installieren', suggested_qty: 3, source_quote_id: 'q-1', source_price_note: 'letztes Projekt: 45€/Stk' },
      ],
      customer_match: { customer_id: 'c-1', confidence: 0.9 },
      missing_info: ['Bestandsinstallation vorhanden?'],
    },
  },
};

describe('AgentSuggestionReviewDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateChain.eq.mockResolvedValue({ data: null, error: null });
  });

  it('renders reply_draft and positions for an Anfrage suggestion', () => {
    render(<AgentSuggestionReviewDialog suggestion={sampleAnfrage as any} open={true} onClose={() => {}} emailId="e-1" />);
    expect(screen.getByText(/Sehr geehrter Herr Müller/)).toBeInTheDocument();
    expect(screen.getByText(/Steckdose installieren/)).toBeInTheDocument();
    expect(screen.getByText(/Bestandsinstallation vorhanden/)).toBeInTheDocument();
  });

  it('on "Senden" click: invokes send-email-reply then marks task done', async () => {
    const onClose = vi.fn();
    render(<AgentSuggestionReviewDialog suggestion={sampleAnfrage as any} open={true} onClose={onClose} emailId="e-1" />);
    fireEvent.click(screen.getByRole('button', { name: /senden/i }));
    await waitFor(() => expect(invokeMock).toHaveBeenCalledWith('send-email-reply', expect.any(Object)));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('on "Verwerfen" click: marks task done without invoking send', async () => {
    const onClose = vi.fn();
    render(<AgentSuggestionReviewDialog suggestion={sampleAnfrage as any} open={true} onClose={onClose} emailId="e-1" />);
    fireEvent.click(screen.getByRole('button', { name: /verwerfen/i }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(invokeMock).not.toHaveBeenCalled();
  });
});
