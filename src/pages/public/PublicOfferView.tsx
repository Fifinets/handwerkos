import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Check, X, Download, Building2, Calendar, FileText, Loader2, CheckCircle2 } from 'lucide-react';
import { PaymentButton } from '@/components/billing/PaymentButton';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

interface PublicOffer {
  id: string;
  offer_number: string;
  offer_date: string;
  valid_until: string | null;
  status: string;
  customer_name: string;
  customer_address: string | null;
  contact_person: string | null;
  project_name: string;
  intro_text: string | null;
  final_text: string | null;
  payment_terms: string | null;
  execution_period_text: string | null;
  warranty_text: string | null;
  is_reverse_charge: boolean;
  snapshot_subtotal_net: number | null;
  snapshot_discount_percent: number | null;
  snapshot_discount_amount: number | null;
  snapshot_net_total: number | null;
  snapshot_vat_rate: number | null;
  snapshot_vat_amount: number | null;
  snapshot_gross_total: number | null;
  items: Array<{
    position_number: number;
    description: string;
    quantity: number;
    unit: string;
    unit_price_net: number;
    vat_rate: number;
    item_type: string;
    is_optional: boolean;
  }>;
  company: {
    name: string;
    address: string | null;
    phone: string | null;
    email: string | null;
    tax_number: string | null;
    logo_url: string | null;
  };
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount);

const formatDate = (dateStr: string) => {
  try {
    return format(new Date(dateStr), 'dd.MM.yyyy', { locale: de });
  } catch {
    return dateStr;
  }
};

export default function PublicOfferView() {
  const { token } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const paymentSuccess = searchParams.get('payment') === 'success';
  const [offer, setOffer] = useState<PublicOffer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionDone, setActionDone] = useState<'accepted' | 'rejected' | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectDialog, setShowRejectDialog] = useState(false);

  useEffect(() => {
    loadOffer();
  }, [token]);

  const loadOffer = async () => {
    if (!token) { setError('Kein gültiger Link'); setLoading(false); return; }
    try {
      // @ts-ignore
      const { data, error: rpcError } = await supabase.rpc('get_public_offer', { p_token: token });
      if (rpcError) throw rpcError;
      setOffer(data as PublicOffer);
    } catch (err: any) {
      console.error('PublicOfferView error:', err);
      setError(err.message?.includes('nicht gefunden')
        ? 'Dieses Angebot ist nicht verfügbar oder wurde noch nicht freigegeben.'
        : `Fehler beim Laden des Angebots: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!token) return;
    setActionLoading(true);
    try {
      // @ts-ignore
      const { error: rpcError } = await supabase.rpc('accept_public_offer', { p_token: token });
      if (rpcError) throw rpcError;
      setActionDone('accepted');
      setOffer(prev => prev ? { ...prev, status: 'accepted' } : null);
    } catch (err: any) {
      alert(err.message || 'Fehler beim Annehmen');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!token) return;
    setActionLoading(true);
    try {
      // @ts-ignore
      const { error: rpcError } = await supabase.rpc('reject_public_offer', {
        p_token: token,
        p_reason: rejectReason || null
      });
      if (rpcError) throw rpcError;
      setActionDone('rejected');
      setShowRejectDialog(false);
      setOffer(prev => prev ? { ...prev, status: 'rejected' } : null);
    } catch (err: any) {
      alert(err.message || 'Fehler beim Ablehnen');
    } finally {
      setActionLoading(false);
    }
  };

  const isExpired = offer?.valid_until && new Date(offer.valid_until) < new Date();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error || !offer) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-sm border p-8 max-w-md text-center">
          <FileText className="h-12 w-12 text-slate-300 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-slate-800 mb-2">Angebot nicht verfügbar</h1>
          <p className="text-slate-500">{error || 'Das Angebot konnte nicht geladen werden.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Building2 className="h-5 w-5 text-slate-600" />
            <span className="font-semibold text-slate-800">{offer.company.name}</span>
          </div>
          <span className="text-sm text-slate-500">{offer.offer_number}</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Payment Success Banner */}
        {paymentSuccess && (
          <div className="mb-6 bg-emerald-50 border border-emerald-200 rounded-xl p-6 text-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-3" />
            <h2 className="text-xl font-semibold text-emerald-800">Zahlung erfolgreich!</h2>
            <p className="text-emerald-600 mt-1">Vielen Dank fuer Ihre Zahlung. Sie erhalten in Kuerze eine Bestaetigung.</p>
          </div>
        )}

        {/* Success/Status Banners */}
        {actionDone === 'accepted' && (
          <div className="mb-6 bg-emerald-50 border border-emerald-200 rounded-xl p-6 text-center">
            <Check className="h-10 w-10 text-emerald-500 mx-auto mb-3" />
            <h2 className="text-xl font-semibold text-emerald-800">Angebot angenommen!</h2>
            <p className="text-emerald-600 mt-1">Vielen Dank. Wir werden uns in Kürze bei Ihnen melden.</p>
          </div>
        )}
        {actionDone === 'rejected' && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-6 text-center">
            <X className="h-10 w-10 text-red-500 mx-auto mb-3" />
            <h2 className="text-xl font-semibold text-red-800">Angebot abgelehnt</h2>
            <p className="text-red-600 mt-1">Vielen Dank für Ihre Rückmeldung.</p>
          </div>
        )}
        {offer.status === 'accepted' && !actionDone && (
          <div className="mb-6 bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
            <p className="text-emerald-700 font-medium">Dieses Angebot wurde bereits angenommen.</p>
          </div>
        )}
        {offer.status === 'rejected' && !actionDone && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 text-center">
            <p className="text-red-700 font-medium">Dieses Angebot wurde bereits abgelehnt.</p>
          </div>
        )}
        {isExpired && offer.status === 'sent' && (
          <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
            <p className="text-amber-700 font-medium">Dieses Angebot ist am {formatDate(offer.valid_until!)} abgelaufen.</p>
          </div>
        )}

        {/* Document */}
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          {/* Doc Header */}
          <div className="p-6 sm:p-8 border-b bg-slate-50">
            <div className="flex flex-col sm:flex-row justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Angebot</h1>
                <p className="text-slate-500 mt-1">{offer.offer_number}</p>
              </div>
              <div className="text-sm text-slate-600 sm:text-right space-y-1">
                <div className="flex items-center gap-2 sm:justify-end">
                  <Calendar className="h-4 w-4 text-slate-400" />
                  <span>Datum: {formatDate(offer.offer_date)}</span>
                </div>
                {offer.valid_until && (
                  <p className={isExpired ? 'text-red-500 font-medium' : ''}>
                    Gültig bis: {formatDate(offer.valid_until)}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Addresses */}
          <div className="p-6 sm:p-8 grid grid-cols-1 sm:grid-cols-2 gap-6 border-b">
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Absender</p>
              <p className="font-semibold text-slate-800">{offer.company.name}</p>
              {offer.company.address && <p className="text-sm text-slate-600 whitespace-pre-line">{offer.company.address}</p>}
              {offer.company.phone && <p className="text-sm text-slate-500 mt-1">Tel: {offer.company.phone}</p>}
              {offer.company.email && <p className="text-sm text-slate-500">{offer.company.email}</p>}
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Empfänger</p>
              <p className="font-semibold text-slate-800">{offer.customer_name}</p>
              {offer.customer_address && <p className="text-sm text-slate-600 whitespace-pre-line">{offer.customer_address}</p>}
              {offer.contact_person && <p className="text-sm text-slate-500 mt-1">z.Hd. {offer.contact_person}</p>}
            </div>
          </div>

          {/* Project Name + Intro */}
          <div className="p-6 sm:p-8 border-b">
            <h2 className="text-lg font-semibold text-slate-800">Angebot: {offer.project_name}</h2>
            {offer.intro_text && <p className="text-sm text-slate-600 mt-3 whitespace-pre-line">{offer.intro_text}</p>}
          </div>

          {/* Items Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b">
                  <th className="px-6 py-3 text-left font-medium text-slate-500">Pos.</th>
                  <th className="px-6 py-3 text-left font-medium text-slate-500">Beschreibung</th>
                  <th className="px-6 py-3 text-right font-medium text-slate-500">Menge</th>
                  <th className="px-6 py-3 text-left font-medium text-slate-500">Einheit</th>
                  <th className="px-6 py-3 text-right font-medium text-slate-500">Einzelpreis</th>
                  <th className="px-6 py-3 text-right font-medium text-slate-500">Gesamt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {offer.items.map((item, i) => (
                  <tr key={i} className={item.is_optional ? 'bg-amber-50/50' : ''}>
                    <td className="px-6 py-3 text-slate-500">{item.position_number}</td>
                    <td className="px-6 py-3 text-slate-800">
                      {item.description}
                      {item.is_optional && <span className="ml-2 text-xs text-amber-600 font-medium">(Optional)</span>}
                    </td>
                    <td className="px-6 py-3 text-right text-slate-700">{item.quantity}</td>
                    <td className="px-6 py-3 text-slate-500">{item.unit}</td>
                    <td className="px-6 py-3 text-right text-slate-700">{formatCurrency(item.unit_price_net)}</td>
                    <td className="px-6 py-3 text-right font-medium text-slate-800">{formatCurrency(item.quantity * item.unit_price_net)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="p-6 sm:p-8 border-t bg-slate-50">
            <div className="max-w-xs ml-auto space-y-2 text-sm">
              {offer.snapshot_subtotal_net != null && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Zwischensumme (netto)</span>
                  <span className="text-slate-700">{formatCurrency(offer.snapshot_subtotal_net)}</span>
                </div>
              )}
              {(offer.snapshot_discount_amount ?? 0) > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Rabatt ({offer.snapshot_discount_percent}%)</span>
                  <span>-{formatCurrency(offer.snapshot_discount_amount!)}</span>
                </div>
              )}
              {offer.snapshot_net_total != null && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Nettobetrag</span>
                  <span className="text-slate-700">{formatCurrency(offer.snapshot_net_total)}</span>
                </div>
              )}
              {offer.snapshot_vat_amount != null && (
                <div className="flex justify-between">
                  <span className="text-slate-500">MwSt. {offer.snapshot_vat_rate || 19}%</span>
                  <span className="text-slate-700">{formatCurrency(offer.snapshot_vat_amount)}</span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t border-slate-200">
                <span className="font-semibold text-slate-800">Gesamtbetrag</span>
                <span className="font-bold text-lg text-slate-900">{formatCurrency(offer.snapshot_gross_total || 0)}</span>
              </div>
            </div>
          </div>

          {/* Final Text / Terms */}
          {(offer.final_text || offer.payment_terms) && (
            <div className="p-6 sm:p-8 border-t text-sm text-slate-600 space-y-3">
              {offer.final_text && <p className="whitespace-pre-line">{offer.final_text}</p>}
              {offer.payment_terms && <p><strong>Zahlungsbedingungen:</strong> {offer.payment_terms}</p>}
              {offer.execution_period_text && <p><strong>Ausführungszeitraum:</strong> {offer.execution_period_text}</p>}
              {offer.warranty_text && <p><strong>Gewährleistung:</strong> {offer.warranty_text}</p>}
            </div>
          )}
        </div>

        {/* Action Buttons - only for sent offers */}
        {offer.status === 'sent' && !isExpired && !actionDone && (
          <div className="mt-8 bg-white rounded-xl shadow-sm border p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-4 text-center">Möchten Sie dieses Angebot annehmen?</h3>
            <div className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
              <button
                onClick={handleAccept}
                disabled={actionLoading}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Angebot annehmen
              </button>
              <button
                onClick={() => setShowRejectDialog(true)}
                disabled={actionLoading}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-white border-2 border-slate-200 hover:border-red-300 hover:bg-red-50 text-slate-700 hover:text-red-700 rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                <X className="h-4 w-4" />
                Ablehnen
              </button>
            </div>
          </div>
        )}

        {/* Payment Button - for accepted offers with payment links */}
        {offer.status === 'accepted' && (
          <div className="mt-8">
            <PaymentButton
              offerId={offer.id}
              offerStatus={offer.status}
              grossTotal={offer.snapshot_gross_total || 0}
            />
          </div>
        )}

        {/* Reject Dialog */}
        {showRejectDialog && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
              <h3 className="text-lg font-semibold text-slate-800 mb-2">Angebot ablehnen</h3>
              <p className="text-sm text-slate-500 mb-4">Möchten Sie uns einen Grund mitteilen? (optional)</p>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="z.B. Preis zu hoch, anderes Angebot gewählt..."
                className="w-full border border-slate-200 rounded-lg p-3 text-sm resize-none h-24 focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-300"
              />
              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => setShowRejectDialog(false)}
                  className="flex-1 px-4 py-2.5 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  Abbrechen
                </button>
                <button
                  onClick={handleReject}
                  disabled={actionLoading}
                  className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Ablehnen
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-slate-400 mt-8 mb-4">
          Erstellt mit HandwerkOS
        </p>
      </main>
    </div>
  );
}
