/**
 * Kanonisches Statusmodell für Projekte.
 *
 * Zwei orthogonale Achsen (siehe Migration 20260720210000):
 *   status         — Lebenszyklus, für Filter, Kennzahlen und Automation
 *   workflow_stage — operative Stufe innerhalb des Lebenszyklus, für das Workflow-Board
 *
 * Backend und Datenbank kennen ausschließlich die englischen Werte; beide Sets
 * sind per CHECK-Constraint erzwungen. Deutsch existiert nur als Anzeigetext in
 * diesem Modul — nirgends sonst.
 */

export const PROJECT_STATUSES = ['planned', 'active', 'completed', 'cancelled'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

/** In fachlicher Reihenfolge — das Workflow-Board rendert sie genau so. */
export const WORKFLOW_STAGES = [
  'inquiry',
  'site_visit',
  'quoted',
  'ordered',
  'in_progress',
  'acceptance',
  'done',
] as const;
export type WorkflowStage = (typeof WORKFLOW_STAGES)[number];

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  planned: 'Geplant',
  active: 'In Arbeit',
  completed: 'Abgeschlossen',
  cancelled: 'Storniert',
};

export const WORKFLOW_STAGE_LABELS: Record<WorkflowStage, string> = {
  inquiry: 'Anfrage',
  site_visit: 'Besichtigung',
  quoted: 'Angebot',
  ordered: 'Beauftragt',
  in_progress: 'In Bearbeitung',
  acceptance: 'Abnahme',
  done: 'Abgeschlossen',
};

/** Welcher Lebenszyklus-Status zu einer Stufe gehört. */
const STAGE_TO_STATUS: Record<WorkflowStage, ProjectStatus> = {
  inquiry: 'planned',
  site_visit: 'planned',
  quoted: 'planned',
  ordered: 'planned',
  in_progress: 'active',
  acceptance: 'active',
  done: 'completed',
};

export const statusForStage = (stage: WorkflowStage): ProjectStatus => STAGE_TO_STATUS[stage];

export const isProjectStatus = (value: unknown): value is ProjectStatus =>
  typeof value === 'string' && (PROJECT_STATUSES as readonly string[]).includes(value);

export const isWorkflowStage = (value: unknown): value is WorkflowStage =>
  typeof value === 'string' && (WORKFLOW_STAGES as readonly string[]).includes(value);

/**
 * Altbestand aus der Zeit vor der Migration.
 *
 * Die Datenbank ist bereinigt und lässt deutsche Werte nicht mehr zu. Diese
 * Abbildung bleibt trotzdem, weil ältere Caches, gespeicherte Filter und
 * URL-Parameter die alten Werte noch enthalten können — dort abzustürzen wäre
 * schlechter, als sie beim Lesen zu übersetzen.
 */
const LEGACY_STATUS_MAP: Record<string, { status: ProjectStatus; stage: WorkflowStage | null }> = {
  anfrage: { status: 'planned', stage: 'inquiry' },
  besichtigung: { status: 'planned', stage: 'site_visit' },
  angebot: { status: 'planned', stage: 'quoted' },
  angebot_versendet: { status: 'planned', stage: 'quoted' },
  beauftragt: { status: 'planned', stage: 'ordered' },
  in_planung: { status: 'planned', stage: 'ordered' },
  geplant: { status: 'planned', stage: 'ordered' },
  in_bearbeitung: { status: 'active', stage: 'in_progress' },
  abnahme: { status: 'active', stage: 'acceptance' },
  blocked: { status: 'active', stage: 'in_progress' },
  abgeschlossen: { status: 'completed', stage: 'done' },
  fertig: { status: 'completed', stage: 'done' },
  abgerechnet: { status: 'completed', stage: 'done' },
  archiviert: { status: 'completed', stage: 'done' },
  storniert: { status: 'cancelled', stage: null },
};

/**
 * Übersetzt einen beliebigen gelesenen Wert in das kanonische Paar.
 * Kanonische Werte gehen unverändert durch.
 */
export const normalizeProjectStatus = (
  rawStatus: string | null | undefined,
  rawStage?: string | null,
): { status: ProjectStatus; workflow_stage: WorkflowStage | null } => {
  if (isProjectStatus(rawStatus)) {
    if (rawStatus === 'cancelled') {
      return { status: 'cancelled', workflow_stage: null };
    }
    if (isWorkflowStage(rawStage)) {
      return { status: rawStatus, workflow_stage: rawStage };
    }
    // Status kanonisch, Stufe fehlt oder unbekannt: plausible Stufe ableiten.
    const fallback: Record<Exclude<ProjectStatus, 'cancelled'>, WorkflowStage> = {
      planned: 'ordered',
      active: 'in_progress',
      completed: 'done',
    };
    return { status: rawStatus, workflow_stage: fallback[rawStatus] };
  }

  const legacy = rawStatus ? LEGACY_STATUS_MAP[rawStatus] : undefined;
  if (legacy) {
    return { status: legacy.status, workflow_stage: legacy.stage };
  }

  return { status: 'planned', workflow_stage: 'inquiry' };
};

/** Anzeigetext für die Stufe, mit Rückfall auf den Lebenszyklus. */
export const projectStageLabel = (
  status: string | null | undefined,
  stage?: string | null,
): string => {
  const normalized = normalizeProjectStatus(status, stage);
  return normalized.workflow_stage
    ? WORKFLOW_STAGE_LABELS[normalized.workflow_stage]
    : PROJECT_STATUS_LABELS[normalized.status];
};

/** Tailwind-Klassen je Stufe; storniert kommt über den Lebenszyklus. */
const STAGE_STYLES: Record<WorkflowStage, string> = {
  inquiry: 'bg-slate-100 text-slate-700 border-slate-200',
  site_visit: 'bg-blue-50 text-blue-700 border-blue-200',
  quoted: 'bg-orange-50 text-orange-700 border-orange-200',
  ordered: 'bg-purple-50 text-purple-700 border-purple-200',
  in_progress: 'bg-amber-50 text-amber-700 border-amber-200',
  acceptance: 'bg-teal-50 text-teal-700 border-teal-200',
  done: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

export const projectStageStyle = (
  status: string | null | undefined,
  stage?: string | null,
): string => {
  const normalized = normalizeProjectStatus(status, stage);
  if (normalized.status === 'cancelled') {
    return 'bg-red-50 text-red-700 border-red-200';
  }
  return normalized.workflow_stage
    ? STAGE_STYLES[normalized.workflow_stage]
    : 'bg-gray-50 text-gray-700 border-gray-200';
};

/** Ein Projekt gilt als offen, solange es weder abgeschlossen noch storniert ist. */
export const isOpenProject = (status: string | null | undefined): boolean => {
  const { status: normalized } = normalizeProjectStatus(status);
  return normalized === 'planned' || normalized === 'active';
};
