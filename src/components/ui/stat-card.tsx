import * as React from 'react';
import { cn } from '@/lib/utils';

const VALUE_TONES = {
  default: 'text-slate-900 dark:text-slate-100',
  critical: 'text-rose-600 dark:text-rose-400',
  warning: 'text-amber-600 dark:text-amber-400',
  positive: 'text-teal-700 dark:text-teal-400',
} as const;

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  /** Dezente Zusatzinfo unter dem Wert (Spec: Meta tritt zurück). */
  hint?: React.ReactNode;
  /** Trend-Chip; positive = Teal mit ▲, sonst Rose mit ▼. */
  trend?: { text: string; positive: boolean };
  /** hero = wichtigste Kennzahl des Screens: größte Zahl, mehr Flex-Gewicht. */
  emphasis?: 'hero' | 'default';
  tone?: keyof typeof VALUE_TONES;
  className?: string;
  onClick?: () => void;
}

export function StatCard({
  label,
  value,
  hint,
  trend,
  emphasis = 'default',
  tone = 'default',
  className,
  onClick,
}: StatCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-card border border-border rounded-xl p-4 shadow-[0_1px_2px_rgba(15,23,42,0.05)]',
        emphasis === 'hero' ? 'flex-[1.4]' : 'flex-1',
        onClick && 'cursor-pointer hover:shadow-md transition-shadow',
        className
      )}
    >
      <div className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
        {label}
      </div>
      <div
        className={cn(
          'font-bold tracking-tight tabular-nums mt-1',
          emphasis === 'hero' ? 'text-3xl lg:text-4xl' : 'text-2xl',
          VALUE_TONES[tone]
        )}
      >
        {value}
      </div>
      {trend && (
        <span
          className={cn(
            'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold mt-1.5',
            trend.positive
              ? 'bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300'
              : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
          )}
        >
          {trend.positive ? '▲' : '▼'} {trend.text}
        </span>
      )}
      {hint && !trend && (
        <div className="text-xs text-slate-400 dark:text-slate-500 mt-1.5">{hint}</div>
      )}
    </div>
  );
}
