import { describe, expect, it } from 'vitest';
import { createReminderOfferUpdate, createSentOfferUpdate } from '../../supabase/functions/send-offer-email/status';

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

describe('createReminderOfferUpdate', () => {
  it('setzt nur Nachfass-Felder, ohne Versandstatus zu berühren', () => {
    const now = '2026-06-01T10:30:00.000Z';

    const result = createReminderOfferUpdate(2, now);

    expect(result).toEqual({
      last_followup_at: now,
      followup_count: 3,
    });
    expect(result).not.toHaveProperty('status');
    expect(result).not.toHaveProperty('sent_at');
    expect(result).not.toHaveProperty('share_token_created_at');
  });
});
