import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AgentBadgeProps {
  className?: string;
}

export function AgentBadge({ className }: AgentBadgeProps) {
  return (
    <span
      aria-label="KI-erstellt"
      className={cn(
        'inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-800',
        className,
      )}
    >
      <Sparkles className="h-3 w-3" aria-hidden="true" />
      KI
    </span>
  );
}
