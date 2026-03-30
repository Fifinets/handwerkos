import React from 'react';
import { Lock, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCheckout, useSubscriptionPlans } from '@/hooks/useSubscription';
import { PLAN_DISPLAY } from '@/types/subscription';

interface UpgradePromptProps {
  feature: string;
  requiredPlan: string;
}

export function UpgradePrompt({ feature, requiredPlan }: UpgradePromptProps) {
  const { data: plans } = useSubscriptionPlans();
  const checkout = useCheckout();

  const display = PLAN_DISPLAY[requiredPlan] || PLAN_DISPLAY.pro;
  const plan = plans?.find((p) => p.slug === requiredPlan);

  return (
    <div className="flex flex-col items-center justify-center py-16 px-6">
      <div className="bg-slate-100 rounded-full p-4 mb-4">
        <Lock className="h-8 w-8 text-slate-400" />
      </div>
      <h3 className="text-lg font-bold text-slate-900 mb-1">
        {feature}
      </h3>
      <p className="text-sm text-slate-500 mb-6 text-center max-w-sm">
        Diese Funktion ist ab dem <strong>{display.name}</strong>-Plan verfuegbar.
      </p>
      {plan && (
        <Button
          onClick={() => checkout.mutate(plan.stripe_price_id)}
          disabled={checkout.isPending}
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          <Zap className="h-4 w-4 mr-2" />
          Upgrade auf {display.name} — {(plan.price_cents / 100).toFixed(0)} EUR/Monat
        </Button>
      )}
    </div>
  );
}
