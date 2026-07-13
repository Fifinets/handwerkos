import { describe, expect, it } from 'vitest';
import { createSentOfferUpdate } from '../../supabase/functions/send-offer-email/status';

describe('createSentOfferUpdate', () => {
  it('setzt Angebotsstatus und Zeitstempel konsistent auf versendet', () => {
    const now = '2026-06-01T10:30:00.000Z';

    expect(createSentOfferUpdate(now)).toEqual({
      status: 'sent',
      sent_at: now,
      share_token_created_at: now,
    });
  });
});
