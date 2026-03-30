import React from 'react';
import { CreditCard, Loader2, CheckCircle2, ExternalLink } from 'lucide-react';
import { useOfferPaymentStatus } from '@/hooks/useSubscription';

interface PaymentButtonProps {
  offerId: string;
  offerStatus: string;
  grossTotal: number;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount);

export function PaymentButton({ offerId, offerStatus, grossTotal }: PaymentButtonProps) {
  const { data: payment, isLoading } = useOfferPaymentStatus(offerId);

  if (offerStatus !== 'accepted') return null;

  if (isLoading) {
    return (
      <div className="flex justify-center py-4">
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
      </div>
    );
  }

  if (payment?.status === 'paid') {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 text-center">
        <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-emerald-800">Zahlung eingegangen</h3>
        <p className="text-emerald-600 mt-1">
          {formatCurrency(grossTotal)} wurden erfolgreich bezahlt.
        </p>
      </div>
    );
  }

  if (payment?.has_payment_link && payment.payment_link_url) {
    return (
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-slate-800 mb-2 text-center">
          Angebot bezahlen
        </h3>
        <p className="text-sm text-slate-500 text-center mb-4">
          Betrag: <strong>{formatCurrency(grossTotal)}</strong>
        </p>
        <div className="flex justify-center">
          <a
            href={payment.payment_link_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors text-lg"
          >
            <CreditCard className="h-5 w-5" />
            Jetzt bezahlen
            <ExternalLink className="h-4 w-4 ml-1" />
          </a>
        </div>
        <p className="text-xs text-slate-400 text-center mt-3">
          Sichere Zahlung ueber Stripe. Karte &amp; SEPA-Lastschrift moeglich.
        </p>
      </div>
    );
  }

  return null;
}
