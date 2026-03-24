import { Check, X, Clock, Minus } from 'lucide-react';
import { OfferStatus } from '@/types/offer';
import { cn } from '@/lib/utils';

interface OfferWorkflowDotsProps {
  status: OfferStatus;
}

// Steps: Entwurf → Versendet → Angenommen/Abgelehnt
const STEPS = ['draft', 'sent', 'accepted'] as const;

function getStepState(stepIndex: number, status: OfferStatus) {
  const statusIndex = STEPS.indexOf(status as typeof STEPS[number]);

  if (status === 'rejected') {
    if (stepIndex < 2) return 'completed';
    if (stepIndex === 2) return 'rejected';
  }
  if (status === 'expired') {
    if (stepIndex < 1) return 'completed';
    if (stepIndex === 1) return 'expired';
    return 'future';
  }
  if (status === 'cancelled') {
    return stepIndex === 0 ? 'cancelled' : 'future';
  }
  if (stepIndex < statusIndex) return 'completed';
  if (stepIndex === statusIndex) return 'current';
  return 'future';
}

const DOT_STYLES = {
  completed: 'bg-emerald-500 text-white',
  current: 'bg-blue-500 text-white ring-2 ring-blue-200',
  future: 'bg-slate-200 text-slate-400',
  rejected: 'bg-red-500 text-white',
  expired: 'bg-orange-500 text-white',
  cancelled: 'bg-slate-400 text-white',
};

const STEP_LABELS = ['Entwurf', 'Versendet', 'Angenommen'];

export function OfferWorkflowDots({ status }: OfferWorkflowDotsProps) {
  return (
    <div className="flex items-center gap-1">
      {STEPS.map((step, index) => {
        const state = getStepState(index, status);
        return (
          <div key={step} className="flex items-center">
            <div
              className={cn(
                'w-5 h-5 rounded-full flex items-center justify-center',
                DOT_STYLES[state]
              )}
              title={
                state === 'rejected' ? 'Abgelehnt' :
                state === 'expired' ? 'Abgelaufen' :
                state === 'cancelled' ? 'Storniert' :
                STEP_LABELS[index]
              }
            >
              {state === 'completed' && <Check className="h-3 w-3" />}
              {state === 'current' && <span className="w-2 h-2 bg-white rounded-full" />}
              {state === 'rejected' && <X className="h-3 w-3" />}
              {state === 'expired' && <Clock className="h-3 w-3" />}
              {state === 'cancelled' && <Minus className="h-3 w-3" />}
            </div>
            {index < STEPS.length - 1 && (
              <div className={cn(
                'w-3 h-0.5 mx-0.5',
                state === 'completed' ? 'bg-emerald-400' : 'bg-slate-200'
              )} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default OfferWorkflowDots;
