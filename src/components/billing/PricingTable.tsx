import React from 'react';
import { Check, Loader2, Zap, Crown, Building, Users, FileText, HardDrive, FolderOpen } from 'lucide-react';
import { useSubscriptionPlans, useCheckout, useSubscription } from '@/hooks/useSubscription';
import { PLAN_DISPLAY, PLAN_LIMITS } from '@/types/subscription';
import { Button } from '@/components/ui/button';

const PLAN_ICONS: Record<string, React.ReactNode> = {
  basic: <Zap className="h-6 w-6" />,
  pro: <Crown className="h-6 w-6" />,
  enterprise: <Building className="h-6 w-6" />,
};

const FEATURE_LABELS: Record<string, string> = {
  offers: 'Angebote erstellen',
  invoices: 'Rechnungen & Mahnungen',
  projects: 'Projektverwaltung',
  customers: 'Kundenverwaltung',
  time_tracking: 'Zeiterfassung',
  materials: 'Materialverwaltung',
  ai_estimation: 'KI-Angebotsassistent',
  document_ocr: 'Dokumenten-OCR',
  delivery_notes: 'Lieferscheine',
  site_documentation: 'Baustellendoku',
  employee_management: 'Mitarbeiterverwaltung',
  vde_protocols: 'VDE-Pruefprotokolle',
  datev_export: 'DATEV-Export',
  api_access: 'API-Zugang',
  priority_support: 'Prioritaets-Support',
  custom_branding: 'Eigenes Branding',
};

export function PricingTable() {
  const { data: plans, isLoading: plansLoading } = useSubscriptionPlans();
  const { data: subscription } = useSubscription();
  const checkout = useCheckout();

  if (plansLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  const currentSlug = subscription?.plan_slug || 'free';

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
      {plans?.map((plan) => {
        const display = PLAN_DISPLAY[plan.slug] || PLAN_DISPLAY.basic;
        const limits = PLAN_LIMITS[plan.slug] || PLAN_LIMITS.basic;
        const isCurrent = currentSlug === plan.slug;
        const isPopular = plan.slug === 'pro';

        return (
          <div
            key={plan.id}
            className={`relative bg-white rounded-xl border-2 p-6 flex flex-col ${
              isPopular
                ? 'border-emerald-400 shadow-lg shadow-emerald-100'
                : 'border-slate-200'
            }`}
          >
            {isPopular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                Beliebt
              </div>
            )}

            {/* Header */}
            <div className="text-center mb-4">
              <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl mb-3 ${
                plan.slug === 'basic' ? 'bg-blue-100 text-blue-600' :
                plan.slug === 'pro' ? 'bg-emerald-100 text-emerald-600' :
                'bg-purple-100 text-purple-600'
              }`}>
                {PLAN_ICONS[plan.slug]}
              </div>
              <h3 className="text-xl font-bold text-slate-900">{display.name}</h3>
              <p className="text-sm text-slate-500 mt-1">{display.description}</p>
            </div>

            {/* Price */}
            <div className="text-center mb-5">
              <span className="text-4xl font-bold text-slate-900">
                {(plan.price_cents / 100).toFixed(0)}
              </span>
              <span className="text-slate-500 ml-1">EUR/Monat</span>
              {plan.trial_days > 0 && (
                <p className="text-xs text-emerald-600 mt-1">
                  {plan.trial_days} Tage kostenlos testen
                </p>
              )}
            </div>

            {/* Kontingente */}
            <div className="bg-slate-50 rounded-lg p-3 mb-5 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5 text-slate-600">
                  <FileText className="h-3.5 w-3.5" />
                  Angebote/Monat
                </span>
                <span className="font-semibold text-slate-800">
                  {limits.max_offers_month ?? 'Unbegrenzt'}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5 text-slate-600">
                  <FolderOpen className="h-3.5 w-3.5" />
                  Projekte
                </span>
                <span className="font-semibold text-slate-800">
                  {limits.max_projects ?? 'Unbegrenzt'}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5 text-slate-600">
                  <Users className="h-3.5 w-3.5" />
                  Mitarbeiter
                </span>
                <span className="font-semibold text-slate-800">
                  {limits.max_employees ?? 'Unbegrenzt'}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5 text-slate-600">
                  <HardDrive className="h-3.5 w-3.5" />
                  Speicher
                </span>
                <span className="font-semibold text-slate-800">
                  {limits.storage_gb} GB
                </span>
              </div>
            </div>

            {/* Features */}
            <ul className="space-y-2 mb-6 flex-1">
              {(plan.features as string[]).map((feature) => (
                <li key={feature} className="flex items-start gap-2 text-sm">
                  <Check className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <span className="text-slate-700">
                    {FEATURE_LABELS[feature] || feature}
                  </span>
                </li>
              ))}
            </ul>

            {/* CTA */}
            <Button
              onClick={() => checkout.mutate(plan.stripe_price_id)}
              disabled={isCurrent || checkout.isPending}
              variant={isPopular ? 'default' : 'outline'}
              className={`w-full ${isPopular ? 'bg-emerald-600 hover:bg-emerald-700' : ''}`}
            >
              {checkout.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              {isCurrent
                ? 'Aktueller Plan'
                : subscription?.is_active
                  ? 'Plan wechseln'
                  : 'Jetzt starten'}
            </Button>
          </div>
        );
      })}
    </div>
  );
}
