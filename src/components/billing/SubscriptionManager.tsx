import React from 'react';
import {
  CreditCard,
  ExternalLink,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import {
  useSubscription,
  usePortalSession,
  useIsSubscribed,
} from '@/hooks/useSubscription';
import { SUBSCRIPTION_STATUS_LABELS, PLAN_DISPLAY } from '@/types/subscription';
import { Button } from '@/components/ui/button';
import { PricingTable } from './PricingTable';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

export function SubscriptionManager() {
  const { data: subscription, isLoading } = useSubscription();
  const { isSubscribed, isTrialing, daysRemaining } = useIsSubscribed();
  const portalSession = usePortalSession();

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  const planSlug = subscription?.plan_slug || 'free';
  const display = PLAN_DISPLAY[planSlug] || PLAN_DISPLAY.free;

  return (
    <div className="space-y-8">
      {/* Current Plan Card */}
      <div className="bg-white rounded-xl border shadow-sm p-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-slate-500" />
              Aktuelles Abonnement
            </h2>
            <div className="mt-2 flex items-center gap-3">
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                display.badge_color === 'blue' ? 'bg-blue-100 text-blue-700' :
                display.badge_color === 'emerald' ? 'bg-emerald-100 text-emerald-700' :
                display.badge_color === 'purple' ? 'bg-purple-100 text-purple-700' :
                'bg-slate-100 text-slate-700'
              }`}>
                {display.name}
              </span>
              <span className="text-sm text-slate-500">
                {SUBSCRIPTION_STATUS_LABELS[subscription?.status || 'none']}
              </span>
            </div>
          </div>

          {/* Status indicator */}
          <div className="flex items-center gap-2">
            {isSubscribed ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            ) : subscription?.status === 'past_due' ? (
              <AlertTriangle className="h-5 w-5 text-amber-500" />
            ) : (
              <Clock className="h-5 w-5 text-slate-400" />
            )}
          </div>
        </div>

        {/* Trial Banner */}
        {isTrialing && daysRemaining !== null && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-700">
              <Clock className="h-4 w-4 inline mr-1" />
              Testphase: Noch <strong>{daysRemaining} Tage</strong> kostenlos.
              {daysRemaining <= 3 && ' Jetzt upgraden, um den Zugang zu behalten!'}
            </p>
          </div>
        )}

        {/* Past Due Banner */}
        {subscription?.status === 'past_due' && (
          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm text-amber-700">
              <AlertTriangle className="h-4 w-4 inline mr-1" />
              Zahlung fehlgeschlagen. Bitte aktualisieren Sie Ihre Zahlungsmethode.
            </p>
          </div>
        )}

        {/* Period Info */}
        {subscription?.current_period_end && (
          <p className="mt-3 text-sm text-slate-500">
            Naechste Abrechnung: {format(new Date(subscription.current_period_end), 'dd. MMMM yyyy', { locale: de })}
            {subscription.cancel_at_period_end && (
              <span className="text-red-500 ml-2">(wird zum Ende des Zeitraums gekuendigt)</span>
            )}
          </p>
        )}

        {/* Manage Button */}
        {isSubscribed && (
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => portalSession.mutate()}
            disabled={portalSession.isPending}
          >
            {portalSession.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <ExternalLink className="h-4 w-4 mr-2" />
            )}
            Abo verwalten
          </Button>
        )}
      </div>

      {/* Pricing Table */}
      {!isSubscribed && (
        <>
          <h2 className="text-xl font-bold text-slate-900 text-center">Plan waehlen</h2>
          <PricingTable />
        </>
      )}
    </div>
  );
}
