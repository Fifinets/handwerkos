import React from 'react';
import {
  CreditCard,
  ExternalLink,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Crown,
  FileText,
  FolderOpen,
  Users,
  HardDrive,
  Zap,
} from 'lucide-react';
import {
  useSubscription,
  usePortalSession,
  useIsSubscribed,
  useUsageStats,
} from '@/hooks/useSubscription';
import { SUBSCRIPTION_STATUS_LABELS, PLAN_DISPLAY, PLAN_LIMITS } from '@/types/subscription';
import { Button } from '@/components/ui/button';
import { PricingTable } from './PricingTable';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

function UsageBar({ label, icon: Icon, used, max, unit }: {
  label: string;
  icon: React.ElementType;
  used: number;
  max: number | null;
  unit?: string;
}) {
  const isUnlimited = max === null;
  const percentage = isUnlimited ? 0 : max > 0 ? Math.min(100, Math.round((used / max) * 100)) : 0;
  const isHigh = percentage >= 80;

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="flex items-center gap-1.5 text-sm text-slate-600">
          <Icon className="h-3.5 w-3.5" />
          {label}
        </span>
        <span className={`text-sm font-semibold ${isHigh ? 'text-amber-600' : 'text-slate-800'}`}>
          {used}{unit ? ` ${unit}` : ''} / {isUnlimited ? <span className="text-emerald-600">Unbegrenzt</span> : `${max}${unit ? ` ${unit}` : ''}`}
        </span>
      </div>
      {!isUnlimited && (
        <div className="w-full bg-slate-100 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${
              isHigh ? 'bg-amber-500' : 'bg-emerald-500'
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      )}
    </div>
  );
}

export function SubscriptionManager() {
  const { data: subscription, isLoading } = useSubscription();
  const { isSubscribed, isTrialing, daysRemaining } = useIsSubscribed();
  const { data: usage } = useUsageStats();
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
  const limits = PLAN_LIMITS[planSlug] || PLAN_LIMITS.free;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Plan & Kontingent Card */}
      <div className="bg-white rounded-2xl p-6 border shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${
            planSlug === 'enterprise' ? 'bg-purple-100 text-purple-700' :
            planSlug === 'pro' ? 'bg-emerald-100 text-emerald-700' :
            planSlug === 'basic' ? 'bg-blue-100 text-blue-700' :
            'bg-slate-100 text-slate-600'
          }`}>
            {display.name}
          </span>
          {isTrialing && daysRemaining !== null ? (
            <span className="text-xs text-emerald-600">
              Verlaengert sich in {daysRemaining} Tagen
            </span>
          ) : subscription?.current_period_end ? (
            <span className="text-xs text-slate-500">
              Verlaengert sich am {format(new Date(subscription.current_period_end), 'dd.MM.yyyy')}
            </span>
          ) : null}
        </div>

        <h2 className="text-lg font-bold text-slate-900 mb-4">Plan & Kontingent</h2>

        <div className="space-y-3">
          <UsageBar icon={FileText} label="Monatliche Angebote" used={usage?.offers_this_month ?? 0} max={limits.max_offers_month} />
          <UsageBar icon={FolderOpen} label="Aktive Projekte" used={usage?.active_projects ?? 0} max={limits.max_projects} />
          <UsageBar icon={Users} label="Mitarbeiter" used={usage?.active_employees ?? 0} max={limits.max_employees} />
          <UsageBar icon={HardDrive} label="Speicherplatz" used={usage?.storage_used_gb ?? 0} max={limits.storage_gb} unit="GB" />
        </div>

        {/* Upgrade hint */}
        {planSlug !== 'enterprise' && (
          <div className="mt-5 pt-4 border-t border-slate-200">
            <p className="text-sm font-semibold text-slate-800 flex items-center gap-1.5 mb-2">
              <Zap className="h-4 w-4 text-amber-500" />
              Upgrade auf {planSlug === 'free' || planSlug === 'basic' ? 'Handwerker' : 'Meisterbetrieb'}
            </p>
            <ul className="space-y-1.5">
              {planSlug === 'free' || planSlug === 'basic' ? (
                <>
                  <li className="flex items-center gap-2 text-xs text-slate-600">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    Unbegrenzte Angebote & Projekte
                  </li>
                  <li className="flex items-center gap-2 text-xs text-slate-600">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    KI-Angebotsassistent & Baustellendoku
                  </li>
                </>
              ) : (
                <>
                  <li className="flex items-center gap-2 text-xs text-slate-600">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    Unbegrenzte Mitarbeiter & 50 GB Speicher
                  </li>
                  <li className="flex items-center gap-2 text-xs text-slate-600">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    DATEV-Export & VDE-Pruefprotokolle
                  </li>
                </>
              )}
            </ul>
          </div>
        )}
      </div>

      {/* Status Banners */}
      {isTrialing && daysRemaining !== null && daysRemaining <= 3 && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-sm text-amber-700">
            <AlertTriangle className="h-4 w-4 inline mr-1" />
            Nur noch <strong>{daysRemaining} Tage</strong> in der Testphase. Jetzt upgraden!
          </p>
        </div>
      )}

      {subscription?.status === 'past_due' && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-sm text-amber-700">
            <AlertTriangle className="h-4 w-4 inline mr-1" />
            Zahlung fehlgeschlagen. Bitte aktualisieren Sie Ihre Zahlungsmethode.
          </p>
        </div>
      )}

      {/* Manage / Portal Button */}
      {isSubscribed && (
        <div className="flex gap-3">
          <Button
            variant="outline"
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
        </div>
      )}

      {/* Pricing Table - always show for plan comparison */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 text-center mb-6">
          {isSubscribed ? 'Plan vergleichen' : 'Plan waehlen'}
        </h2>
        <PricingTable />
      </div>
    </div>
  );
}
