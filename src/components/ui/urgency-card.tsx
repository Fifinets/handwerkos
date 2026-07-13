import * as React from 'react';
import { cn } from '@/lib/utils';

// Spec Regel 2: Dringlichkeit ausschließlich über getönte Hintergründe.
// Farbige Ränder sind bewusst nicht vorgesehen.
const URGENCY_CLASSES = {
  critical: 'bg-rose-50 dark:bg-rose-950/40 border-transparent',
  warning: 'bg-amber-50 dark:bg-amber-950/40 border-transparent',
  none: 'bg-card border-border',
} as const;

interface UrgencyCardProps extends React.HTMLAttributes<HTMLDivElement> {
  urgency: keyof typeof URGENCY_CLASSES;
  /** Erledigt/inaktiv: Karte tritt zurück (Spec Regel 4). */
  done?: boolean;
  /** Aktions-Slot rechts (Button, Betrag+Chip, ...). */
  action?: React.ReactNode;
  children: React.ReactNode;
}

export function UrgencyCard({
  urgency,
  done = false,
  action,
  className,
  children,
  ...props
}: UrgencyCardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border p-3 sm:px-4 flex items-center justify-between gap-3',
        URGENCY_CLASSES[urgency],
        done && 'opacity-60',
        className
      )}
      {...props}
    >
      <div className="min-w-0 flex-1">{children}</div>
      {action && <div className="shrink-0 flex items-center gap-2">{action}</div>}
    </div>
  );
}
