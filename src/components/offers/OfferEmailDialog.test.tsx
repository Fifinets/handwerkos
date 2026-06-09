import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { OfferEmailDialog } from './OfferEmailDialog';
import type { OfferWithRelations } from '@/types/offer';

const invokeMock = vi.hoisted(() => vi.fn());

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: invokeMock,
    },
  },
}));

const baseOffer = (overrides: Partial<OfferWithRelations> = {}): OfferWithRelations => ({
  id: '11111111-1111-4111-8111-111111111111',
  company_id: '22222222-2222-4222-8222-222222222222',
  offer_number: 'ANG-1',
  offer_date: '2026-06-01',
  valid_until: '2026-06-15',
  customer_id: '33333333-3333-4333-8333-333333333333',
  customer_name: 'Bauer GmbH',
  customer_address: null,
  contact_person: null,
  customer_reference: null,
  project_name: 'Bad',
  project_location: null,
  execution_period_text: null,
  execution_notes: null,
  payment_terms: null,
  skonto_percent: null,
  skonto_days: null,
  warranty_text: null,
  notes: null,
  intro_text: null,
  final_text: null,
  is_reverse_charge: false,
  show_labor_share: true,
  snapshot_subtotal_net: null,
  snapshot_discount_percent: null,
  snapshot_discount_amount: null,
  snapshot_net_total: null,
  snapshot_vat_rate: null,
  snapshot_vat_amount: null,
  snapshot_gross_total: null,
  snapshot_created_at: null,
  status: 'draft',
  is_locked: false,
  accepted_at: null,
  accepted_by: null,
  acceptance_note: null,
  version: 1,
  created_at: '2026-06-01T00:00:00Z',
  updated_at: '2026-06-01T00:00:00Z',
  created_by: null,
  ...overrides,
});

const renderDialog = (ui: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  );
};

describe('OfferEmailDialog', () => {
  beforeAll(() => {
    global.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });

  afterEach(() => {
    cleanup();
    invokeMock.mockReset();
  });

  it('deaktiviert Senden und zeigt einen Hinweis, wenn keine Empfängeradresse vorhanden ist', () => {
    renderDialog(
      <OfferEmailDialog
        open
        onOpenChange={vi.fn()}
        offer={baseOffer()}
      />
    );

    expect(screen.getByRole('button', { name: /senden/i })).toBeDisabled();
    expect(screen.getByText('Bitte tragen Sie eine Empfängeradresse ein.')).toBeInTheDocument();
  });

  it('sendet Angebotsmails über die Edge Function und überlässt den Status der Function', async () => {
    invokeMock.mockResolvedValueOnce({ data: { success: true }, error: null });
    const onSent = vi.fn().mockResolvedValue(undefined);

    renderDialog(
      <OfferEmailDialog
        open
        onOpenChange={vi.fn()}
        offer={baseOffer({
          customer: {
            id: '33333333-3333-4333-8333-333333333333',
            company_name: 'Bauer GmbH',
            contact_person: null,
            email: 'kunde@example.com',
          },
        })}
        onSent={onSent}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /senden/i }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith('send-offer-email', expect.objectContaining({
        body: expect.objectContaining({
          offerId: '11111111-1111-4111-8111-111111111111',
          recipientEmail: 'kunde@example.com',
          attachPdf: true,
        }),
      }));
      expect(onSent).toHaveBeenCalled();
    });
  });
});
