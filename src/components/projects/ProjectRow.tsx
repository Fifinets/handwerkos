import React from "react";
import { Button } from "@/components/ui/button";
import { MoreVertical } from "lucide-react";
import { StatusChip } from "@/components/ui/status-chip";
import type { ProjectStatus, WorkflowStage } from "@/types/project";
import { normalizeProjectStatus } from "@/lib/projectStatus";

type Props = {
  id: string;
  project_number?: string;
  name: string;
  status: ProjectStatus;
  workflow_stage?: WorkflowStage | null;
  budget: number;
  start?: string;
  end?: string;
  progress?: number;
  onOpen?: () => void;
  onEdit?: () => void;
};

// Generate a consistent project number from UUID (until DB field exists)
const generateProjectNumber = (id: string): string => {
  const currentYear = new Date().getFullYear();
  const hash = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const number = ((hash % 9999) + 1).toString().padStart(4, '0');
  return `P-${currentYear}-${number}`;
};

export default function ProjectRow(p: Props) {
  const { status: lifecycle, workflow_stage } = normalizeProjectStatus(p.status, p.workflow_stage);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
  };

  // Calculate real progress based on date range
  const calculateRealProgress = () => {
    if (!p.start || !p.end) return 0;

    const startDate = new Date(p.start);
    const endDate = new Date(p.end);
    const today = new Date();

    // If project hasn't started yet
    if (today < startDate) return 0;

    // If project is finished
    if (today >= endDate || lifecycle === 'completed') return 100;

    // Calculate progress based on elapsed days
    const totalDays = Math.max(1, (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const elapsedDays = (today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);

    return Math.min(100, Math.max(0, (elapsedDays / totalDays) * 100));
  };

  // Calculate days remaining until end date
  const getDaysRemaining = () => {
    if (!p.end) return null;
    const endDate = new Date(p.end);
    const today = new Date();
    // Reset time to compare just dates
    endDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    const diffTime = endDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  // Get progress bar color based on days remaining (Palette: teal = im Plan,
  // amber = knapp, rose = überfällig — Dringlichkeit nur über Füllfarbe, keine Ränder)
  const getProgressBarColor = () => {
    if (lifecycle === 'completed') return 'bg-teal-600';
    const daysRemaining = getDaysRemaining();
    if (daysRemaining === null) return 'bg-teal-600';
    if (daysRemaining <= 0) return 'bg-rose-500'; // Ende erreicht oder überschritten
    if (daysRemaining === 1) return 'bg-amber-500'; // 1 Tag vor Ende
    return 'bg-teal-600'; // Normal
  };

  const realProgress = calculateRealProgress();
  const progressBarColor = getProgressBarColor();

  return (
    <div 
      className="flex flex-col gap-2 py-2 cursor-pointer" 
      onDoubleClick={p.onOpen}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          {/* Titel */}
          <strong className="mr-1 truncate min-w-0 text-slate-900 dark:text-slate-100">{p.name}</strong>

          {/* Project Number Pill */}
          <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs tabular-nums bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
            {p.project_number || generateProjectNumber(p.id)}
          </span>
        </div>

        {/* Status + Menu - top right */}
        <div className="flex items-center gap-2 shrink-0">
          <StatusChip status={workflow_stage ?? lifecycle} />
          {p.onEdit && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                p.onEdit?.();
              }}
              className="h-7 w-7 flex items-center justify-center rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className="text-sm text-muted-foreground">
        {p.start ? `${formatDate(p.start)}${p.end ? ` • ${formatDate(p.end)}` : ''}` : null}
      </div>

      {/* Progressbar: based on real time progress */}
      {(p.start && p.end) && (
        <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
          <div
            className={`h-full rounded-full ${progressBarColor} transition-all`}
            style={{ width: `${realProgress}%` }}
            aria-valuenow={realProgress}
            aria-valuemin={0}
            aria-valuemax={100}
            role="progressbar"
            title={`${Math.round(realProgress)}% der Projektdauer vergangen`}
          />
        </div>
      )}

    </div>
  );
}