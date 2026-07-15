import { describe, expect, it } from 'vitest';
import type { Offer } from '@/types/offer';
import {
  getOfferStatusCounts,
  filterOffersForOverview,
  isOfferExpiredByDate,
  getNachfassInfo,
} from './offerModuleUtils';

const baseOffer = (overrides: Partial<Offer>): Offer => ({
  id: crypto.randomUUID(),
  company_id: 'company-1',
  offer_number: 'ANG-1',
  customer_id: 'customer-1',
  customer_name: 'Bauer',
  project_name: 'Badsanierung',
  offer_date: '2026-05-01',
  valid_until: null,
  status: 'draft',
  snapshot_gross_total: 0,
  snapshot_net_total: 0,
  snapshot_subtotal_net: 0,
  snapshot_vat_amount: 0,
  snapshot_vat_rate: 19,
  created_at: '2026-05-01T00:00:00Z',
  updated_at: '2026-05-01T00:00:00Z',
  ...overrides,
} as Offer);

describe('offerModuleUtils', () => {
  const now = new Date('2026-06-01T12:00:00Z');

  it('berechnet globale Status-Zähler unabhängig vom aktiven Tab', () => {
    const offers = [
      baseOffer({ status: 'draft' }),
      baseOffer({ status: 'sent', valid_until: '2026-05-15' }),
      baseOffer({ status: 'accepted' }),
    ];

    const counts = getOfferStatusCounts(offers, now);
    const draftRows = filterOffersForOverview(offers, { statusFilter: 'draft', now });

    expect(counts).toEqual({
      all: 3,
      draft: 1,
      sent: 1,
      accepted: 1,
      rejected: 0,
      expired: 1,
    });
    expect(draftRows).toHaveLength(1);
  });

  it('behandelt überfällige Entwürfe und versendete Angebote als abgelaufen', () => {
    const expiredDraft = baseOffer({ status: 'draft', valid_until: '2026-05-01' });
    const expiredSent = baseOffer({ status: 'sent', valid_until: '2026-05-01' });
    const acceptedPast = baseOffer({ status: 'accepted', valid_until: '2026-05-01' });

    expect(isOfferExpiredByDate(expiredDraft, now)).toBe(true);
    expect(isOfferExpiredByDate(expiredSent, now)).toBe(true);
    expect(isOfferExpiredByDate(acceptedPast, now)).toBe(false);
  });

  it('filtert Suche, Nachfassen und erweiterte Filter clientseitig', () => {
    const offers = [
      baseOffer({
        status: 'sent',
        customer_name: 'Müller GmbH',
        project_name: 'Zählertausch',
        sent_at: '2026-05-01T00:00:00Z',
        snapshot_gross_total: 499,
      }),
      baseOffer({
        status: 'draft',
        customer_name: 'Bauer',
        project_name: 'Bad',
        snapshot_gross_total: 1200,
      }),
    ];

    expect(filterOffersForOverview(offers, {
      searchTerm: 'müller',
      now,
    })).toHaveLength(1);

    expect(filterOffersForOverview(offers, {
      nachfassenOnly: true,
      now,
    })).toHaveLength(1);

    expect(filterOffersForOverview(offers, {
      advancedFilters: { minAmount: '1000' },
      now,
    })).toHaveLength(1);
  });
});

describe('getNachfassInfo mit Nachfass-Merker', () => {
  const base = { status: 'sent' as const, sent_at: '2026-06-01T10:00:00Z', valid_until: null };
  const now = new Date('2026-07-15T10:00:00Z');

  it('rechnet ab last_followup_at, wenn es jünger als sent_at ist', () => {
    const info = getNachfassInfo({ ...base, last_followup_at: '2026-07-10T10:00:00Z', followup_count: 1 }, now);
    expect(info).toBeNull(); // erst 5 Tage seit letztem Kontakt
  });

  it('wird nach 7 Tagen seit letztem Nachfassen wieder fällig — als nächste Stufe', () => {
    const info = getNachfassInfo({ ...base, last_followup_at: '2026-07-01T10:00:00Z', followup_count: 1 }, now);
    expect(info).toEqual({ days: 14, severity: 'high', followupNumber: 2 });
  });

  it('ohne Merker: followupNumber ist 1, Verhalten wie bisher', () => {
    const info = getNachfassInfo(base, now);
    expect(info?.followupNumber).toBe(1);
    expect(info?.days).toBe(44);
  });

  it('wird bei genau 7 Tagen seit letztem Nachfassen fällig (medium)', () => {
    const info = getNachfassInfo({ ...base, last_followup_at: '2026-07-08T10:00:00Z', followup_count: 1 }, now);
    expect(info).toEqual({ days: 7, severity: 'medium', followupNumber: 2 });
  });

  it('ignoriert last_followup_at, das älter als sent_at ist', () => {
    const info = getNachfassInfo({ ...base, sent_at: '2026-07-12T10:00:00Z', last_followup_at: '2026-07-01T10:00:00Z', followup_count: 1 }, now);
    expect(info).toBeNull(); // 3 Tage seit Versand
  });
});
