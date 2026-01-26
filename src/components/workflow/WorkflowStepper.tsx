// Workflow Stepper - Visual progress indicator for the business workflow
// Angebot → Auftrag → Projekt → Lieferscheine → Rechnung

import { cn } from '@/lib/utils';
import {
  FileText,
  HandshakeIcon,
  FolderKanban,
  ClipboardList,
  Receipt,
  Check,
  Circle,
  ChevronRight,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export type WorkflowStep =
  | 'offer'
  | 'order'
  | 'project'
  | 'delivery_notes'
  | 'invoice';

interface WorkflowStepConfig {
  id: WorkflowStep;
  label: string;
  description: string;
  icon: React.ElementType;
}

const WORKFLOW_STEPS: WorkflowStepConfig[] = [
  {
    id: 'offer',
    label: 'Angebot',
    description: 'Angebot erstellen und versenden',
    icon: FileText,
  },
  {
    id: 'order',
    label: 'Auftrag',
    description: 'Angebot angenommen, Auftrag erstellt',
    icon: HandshakeIcon,
  },
  {
    id: 'project',
    label: 'Projekt',
    description: 'Projekt in Bearbeitung',
    icon: FolderKanban,
  },
  {
    id: 'delivery_notes',
    label: 'Lieferscheine',
    description: 'Arbeiten und Material dokumentiert',
    icon: ClipboardList,
  },
  {
    id: 'invoice',
    label: 'Rechnung',
    description: 'Rechnung erstellt und versendet',
    icon: Receipt,
  },
];

interface WorkflowStepperProps {
  currentStep: WorkflowStep;
  completedSteps?: WorkflowStep[];
  onStepClick?: (step: WorkflowStep) => void;
  className?: string;
  variant?: 'horizontal' | 'vertical';
  size?: 'sm' | 'md' | 'lg';
}

export function WorkflowStepper({
  currentStep,
  completedSteps = [],
  onStepClick,
  className,
  variant = 'horizontal',
  size = 'md',
}: WorkflowStepperProps) {
  const currentIndex = WORKFLOW_STEPS.findIndex((s) => s.id === currentStep);

  const getStepStatus = (step: WorkflowStepConfig, index: number) => {
    if (completedSteps.includes(step.id)) return 'completed';
    if (index === currentIndex) return 'current';
    if (index < currentIndex) return 'completed';
    return 'upcoming';
  };

  const sizeClasses = {
    sm: {
      icon: 'h-6 w-6',
      iconWrapper: 'h-8 w-8',
      text: 'text-xs',
      connector: variant === 'horizontal' ? 'h-0.5 w-8' : 'w-0.5 h-6',
    },
    md: {
      icon: 'h-5 w-5',
      iconWrapper: 'h-10 w-10',
      text: 'text-sm',
      connector: variant === 'horizontal' ? 'h-0.5 w-12' : 'w-0.5 h-8',
    },
    lg: {
      icon: 'h-6 w-6',
      iconWrapper: 'h-12 w-12',
      text: 'text-base',
      connector: variant === 'horizontal' ? 'h-1 w-16' : 'w-1 h-10',
    },
  };

  const sizes = sizeClasses[size];

  if (variant === 'vertical') {
    return (
      <div className={cn('flex flex-col', className)}>
        {WORKFLOW_STEPS.map((step, index) => {
          const status = getStepStatus(step, index);
          const Icon = step.icon;
          const isLast = index === WORKFLOW_STEPS.length - 1;
          const isClickable = onStepClick && (status === 'completed' || status === 'current');

          return (
            <div key={step.id} className="flex">
              <div className="flex flex-col items-center">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => isClickable && onStepClick(step.id)}
                        disabled={!isClickable}
                        className={cn(
                          'flex items-center justify-center rounded-full border-2 transition-all',
                          sizes.iconWrapper,
                          status === 'completed' && 'bg-primary border-primary text-primary-foreground',
                          status === 'current' && 'border-primary bg-primary/10 text-primary',
                          status === 'upcoming' && 'border-muted-foreground/30 text-muted-foreground/50',
                          isClickable && 'cursor-pointer hover:scale-105'
                        )}
                      >
                        {status === 'completed' ? (
                          <Check className={sizes.icon} />
                        ) : (
                          <Icon className={sizes.icon} />
                        )}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <p className="font-medium">{step.label}</p>
                      <p className="text-muted-foreground">{step.description}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                {!isLast && (
                  <div
                    className={cn(
                      'my-1',
                      sizes.connector,
                      status === 'completed' || (status === 'current' && index < currentIndex)
                        ? 'bg-primary'
                        : 'bg-muted-foreground/30'
                    )}
                  />
                )}
              </div>

              <div className="ml-3 pb-8">
                <p
                  className={cn(
                    'font-medium',
                    sizes.text,
                    status === 'current' && 'text-primary',
                    status === 'upcoming' && 'text-muted-foreground'
                  )}
                >
                  {step.label}
                </p>
                <p className={cn('text-muted-foreground', sizes.text === 'text-xs' ? 'text-xs' : 'text-sm')}>
                  {step.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // Horizontal variant
  return (
    <div className={cn('flex items-center justify-between', className)}>
      {WORKFLOW_STEPS.map((step, index) => {
        const status = getStepStatus(step, index);
        const Icon = step.icon;
        const isLast = index === WORKFLOW_STEPS.length - 1;
        const isClickable = onStepClick && (status === 'completed' || status === 'current');

        return (
          <div key={step.id} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => isClickable && onStepClick(step.id)}
                      disabled={!isClickable}
                      className={cn(
                        'flex items-center justify-center rounded-full border-2 transition-all',
                        sizes.iconWrapper,
                        status === 'completed' && 'bg-primary border-primary text-primary-foreground',
                        status === 'current' && 'border-primary bg-primary/10 text-primary',
                        status === 'upcoming' && 'border-muted-foreground/30 text-muted-foreground/50',
                        isClickable && 'cursor-pointer hover:scale-105'
                      )}
                    >
                      {status === 'completed' ? (
                        <Check className={sizes.icon} />
                      ) : (
                        <Icon className={sizes.icon} />
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="font-medium">{step.label}</p>
                    <p className="text-muted-foreground">{step.description}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <p
                className={cn(
                  'mt-2 font-medium whitespace-nowrap',
                  sizes.text,
                  status === 'current' && 'text-primary',
                  status === 'upcoming' && 'text-muted-foreground'
                )}
              >
                {step.label}
              </p>
            </div>

            {!isLast && (
              <div className="flex-1 mx-2 flex items-center justify-center">
                <div
                  className={cn(
                    'flex-1 max-w-24',
                    sizes.connector,
                    status === 'completed' ? 'bg-primary' : 'bg-muted-foreground/30'
                  )}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Mini version for cards/lists
interface WorkflowBadgeProps {
  currentStep: WorkflowStep;
  className?: string;
}

export function WorkflowBadge({ currentStep, className }: WorkflowBadgeProps) {
  const step = WORKFLOW_STEPS.find((s) => s.id === currentStep);
  if (!step) return null;

  const Icon = step.icon;
  const stepIndex = WORKFLOW_STEPS.findIndex((s) => s.id === currentStep);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              'inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium',
              'bg-primary/10 text-primary border border-primary/20',
              className
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            <span>{step.label}</span>
            <span className="text-primary/60">
              ({stepIndex + 1}/{WORKFLOW_STEPS.length})
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{step.description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Progress dots for compact display
interface WorkflowDotsProps {
  currentStep: WorkflowStep;
  completedSteps?: WorkflowStep[];
  className?: string;
}

export function WorkflowDots({
  currentStep,
  completedSteps = [],
  className,
}: WorkflowDotsProps) {
  const currentIndex = WORKFLOW_STEPS.findIndex((s) => s.id === currentStep);

  return (
    <div className={cn('flex items-center gap-1', className)}>
      {WORKFLOW_STEPS.map((step, index) => {
        const isCompleted = completedSteps.includes(step.id) || index < currentIndex;
        const isCurrent = index === currentIndex;

        return (
          <TooltipProvider key={step.id}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className={cn(
                    'rounded-full transition-all',
                    isCurrent ? 'h-2.5 w-2.5' : 'h-2 w-2',
                    isCompleted && 'bg-primary',
                    isCurrent && 'bg-primary ring-2 ring-primary/30',
                    !isCompleted && !isCurrent && 'bg-muted-foreground/30'
                  )}
                />
              </TooltipTrigger>
              <TooltipContent>
                <p className="font-medium">{step.label}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      })}
    </div>
  );
}
