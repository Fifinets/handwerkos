import type { Offer, OfferStatus } from '@/types/offer';

export type OfferStatusFilter = OfferStatus | 'all';

export interface OfferAdvancedFilters {
  fromDate?: string;
  toDate?: string;
  minAmount?: string;
  maxAmount?: string;
}

interface FilterOptions {
  statusFilter?: OfferStatusFilter;
  searchTerm?: string;
  nachfassenOnly?: boolean;
  advancedFilters?: OfferAdvancedFilters;
  now?: Date;
}

export const isOfferExpiredByDate = (offer: Pick<Offer, 'status' | 'valid_until'>, now = new Date()) => {
  if (!offer.valid_until || (offer.status !== 'draft' && offer.status !== 'sent')) return false;

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const validUntil = new Date(offer.valid_until);
  validUntil.setHours(0, 0, 0, 0);

  return validUntil < today;
};

export const getNachfassInfo = (
  offer: Pick<Offer, 'status' | 'sent_at' | 'valid_until'> &
    Partial<Pick<Offer, 'last_followup_at' | 'followup_count'>>,
  now = new Date()
) => {
  if (offer.status !== 'sent' || !offer.sent_at || isOfferExpiredByDate(offer, now)) return null;

  // Referenz = letzter Kontakt: jüngeres von sent_at und last_followup_at
  const lastContact =
    offer.last_followup_at && new Date(offer.last_followup_at) > new Date(offer.sent_at)
      ? offer.last_followup_at
      : offer.sent_at;

  const days = Math.floor((now.getTime() - new Date(lastContact).getTime()) / (1000 * 60 * 60 * 24));
  if (days < 7) return null;

  return {
    days,
    severity: days >= 14 ? ('high' as const) : ('medium' as const),
    followupNumber: (offer.followup_count ?? 0) + 1,
  };
};

export const getOfferStatusCounts = (offers: Offer[], now = new Date()) => ({
  all: offers.length,
  draft: offers.filter((offer) => offer.status === 'draft').length,
  sent: offers.filter((offer) => offer.status === 'sent').length,
  accepted: offers.filter((offer) => offer.status === 'accepted').length,
  rejected: offers.filter((offer) => offer.status === 'rejected').length,
  expired: offers.filter((offer) => offer.status === 'expired' || isOfferExpiredByDate(offer, now)).length,
});

export const hasActiveAdvancedFilters = (filters: OfferAdvancedFilters) =>
  Boolean(filters.fromDate || filters.toDate || filters.minAmount || filters.maxAmount);

export const filterOffersForOverview = (offers: Offer[], options: FilterOptions = {}) => {
  const {
    statusFilter = 'all',
    searchTerm = '',
    nachfassenOnly = false,
    advancedFilters = {},
    now = new Date(),
  } = options;

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const minAmount = Number.parseFloat(advancedFilters.minAmount || '');
  const maxAmount = Number.parseFloat(advancedFilters.maxAmount || '');

  return offers.filter((offer) => {
    if (statusFilter === 'expired') {
      if (offer.status !== 'expired' && !isOfferExpiredByDate(offer, now)) return false;
    } else if (statusFilter !== 'all' && offer.status !== statusFilter) {
      return false;
    }

    if (nachfassenOnly && !getNachfassInfo(offer, now)) return false;

    if (normalizedSearch) {
      const haystack = [
        offer.offer_number,
        offer.customer_name,
        offer.project_name,
      ].filter(Boolean).join(' ').toLowerCase();

      if (!haystack.includes(normalizedSearch)) return false;
    }

    if (advancedFilters.fromDate && offer.offer_date < advancedFilters.fromDate) return false;
    if (advancedFilters.toDate && offer.offer_date > advancedFilters.toDate) return false;

    const amount = offer.snapshot_gross_total || 0;
    if (!Number.isNaN(minAmount) && amount < minAmount) return false;
    if (!Number.isNaN(maxAmount) && amount > maxAmount) return false;

    return true;
  });
};
