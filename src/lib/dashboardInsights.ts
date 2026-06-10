export type DashboardProject = {
  id: string;
  name: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  work_end_date: string | null;
  completed_at: string | null;
  description: string | null;
  budget: number | null;
  labor_costs: number | null;
  material_costs: number | null;
};

export type DashboardWorkHour = {
  project_id: string;
  hours_worked: number;
  work_description: string | null;
};

export type DashboardTimeEntry = {
  project_id: string | null;
  description: string | null;
  start_time: string;
  end_time: string | null;
  break_duration: number | null;
};

export type DashboardInvoice = {
  id: string;
  project_id?: string | null;
  status: string;
};

export type DashboardRiskLevel = 'critical' | 'warning' | 'info';

export type DashboardProjectRisk = {
  projectId: string;
  projectName: string;
  riskLevel: DashboardRiskLevel;
  signals: string[];
  recommendedAction: string;
  plannedHours: number | null;
  actualHours: number;
  budget: number | null;
  actualCost: number;
};

export type DashboardInsights = {
  riskyProjects: DashboardProjectRisk[];
  criticalCount: number;
  openAddendumCount: number;
  invoiceReadyCount: number;
  missingCalculationCount: number;
};

type DashboardInsightsInput = {
  today?: Date;
  projects: DashboardProject[];
  workHours: DashboardWorkHour[];
  timeEntries: DashboardTimeEntry[];
  invoices: DashboardInvoice[];
};

const ADDENDUM_WORDS = [
  'zusatz',
  'zusaetz',
  'zusätzlich',
  'zusaetzlich',
  'extra',
  'spontan',
  'mehrarbeit',
  'nachtrag',
  'nicht im angebot',
];

const normalizeStatus = (status: string) => status.trim().toLowerCase().replace(/\s+/g, '_');

const isClosedStatus = (status: string) => {
  const normalized = normalizeStatus(status);
  return ['abgeschlossen', 'completed', 'done', 'bezahlt', 'storniert'].includes(normalized);
};

const isActiveStatus = (status: string) => {
  const normalized = normalizeStatus(status);
  return ['active', 'in_bearbeitung', 'beauftragt', 'planned', 'planung', 'angebot'].includes(normalized);
};

const parsePlannedHours = (description: string | null) => {
  if (!description) return null;

  const match = description.match(/(?:planned_hours|planstunden|geplante_stunden)\s*:\s*(\d+(?:[.,]\d+)?)/i);
  if (!match) return null;

  return Number(match[1].replace(',', '.'));
};

const getTimeEntryHours = (entry: DashboardTimeEntry) => {
  if (!entry.end_time) return 0;

  const start = new Date(entry.start_time).getTime();
  const end = new Date(entry.end_time).getTime();
  const breakMinutes = entry.break_duration ?? 0;
  const hours = (end - start) / 36e5 - breakMinutes / 60;

  return Number.isFinite(hours) && hours > 0 ? hours : 0;
};

const includesAddendumSignal = (text: string | null) => {
  if (!text) return false;
  const lowerText = text.toLowerCase();
  return ADDENDUM_WORDS.some((word) => lowerText.includes(word));
};

const getProjectDeadline = (project: DashboardProject) => project.work_end_date || project.end_date;

const compareByRisk = (a: DashboardProjectRisk, b: DashboardProjectRisk) => {
  const order: Record<DashboardRiskLevel, number> = {
    critical: 0,
    warning: 1,
    info: 2,
  };

  return order[a.riskLevel] - order[b.riskLevel];
};

export const createDashboardInsights = ({
  today = new Date(),
  projects,
  workHours,
  timeEntries,
  invoices,
}: DashboardInsightsInput): DashboardInsights => {
  let openAddendumCount = 0;
  let missingCalculationCount = 0;

  const invoiceReadyCount = projects.filter((project) => {
    if (!isClosedStatus(project.status) && !project.completed_at) return false;
    return !invoices.some((invoice) => {
      if (invoice.status.toLowerCase() === 'storniert') return false;
      return invoice.project_id ? invoice.project_id === project.id : false;
    });
  }).length;

  const riskyProjects = projects
    .filter((project) => isActiveStatus(project.status))
    .map((project) => {
      const projectWorkHours = workHours.filter((hour) => hour.project_id === project.id);
      const projectTimeEntries = timeEntries.filter((entry) => entry.project_id === project.id);
      const plannedHours = parsePlannedHours(project.description);
      const actualHours =
        projectWorkHours.reduce((sum, hour) => sum + Number(hour.hours_worked || 0), 0) +
        projectTimeEntries.reduce((sum, entry) => sum + getTimeEntryHours(entry), 0);
      const budget = project.budget;
      const actualCost = Number(project.labor_costs || 0) + Number(project.material_costs || 0);
      const deadline = getProjectDeadline(project);
      const isOverdue = deadline ? new Date(deadline) < today : false;
      const hasAddendumSignal =
        projectWorkHours.some((hour) => includesAddendumSignal(hour.work_description)) ||
        projectTimeEntries.some((entry) => includesAddendumSignal(entry.description));
      const signals: string[] = [];

      if (budget !== null && actualCost > budget) {
        signals.push(`${Math.round(actualCost - budget)} EUR ueber Budget`);
      }

      if (plannedHours !== null && actualHours > plannedHours) {
        signals.push(`${Math.round(actualHours - plannedHours)} h ueber Plan`);
      }

      if (isOverdue) {
        signals.push('Termin ueberfaellig');
      }

      if (hasAddendumSignal) {
        signals.push('Moeglicher Nachtrag');
        openAddendumCount += 1;
      }

      if (budget === null || plannedHours === null) {
        signals.push('Kalkulation fehlt');
        missingCalculationCount += 1;
      }

      const isCritical =
        isOverdue ||
        (budget !== null && actualCost > budget) ||
        (plannedHours !== null && actualHours > plannedHours);
      const riskLevel: DashboardRiskLevel = isCritical ? 'critical' : hasAddendumSignal ? 'warning' : 'info';
      const recommendedAction = hasAddendumSignal
        ? 'Nachtrag pruefen'
        : isCritical
          ? 'Projekt pruefen'
          : budget === null || plannedHours === null
            ? 'Kalkulation ergaenzen'
            : 'Im Blick behalten';

      return {
        projectId: project.id,
        projectName: project.name,
        riskLevel,
        signals,
        recommendedAction,
        plannedHours,
        actualHours,
        budget,
        actualCost,
      };
    })
    .filter((project) => project.signals.length > 0)
    .sort(compareByRisk)
    .slice(0, 6);

  return {
    riskyProjects,
    criticalCount: riskyProjects.filter((project) => project.riskLevel === 'critical').length,
    openAddendumCount,
    invoiceReadyCount,
    missingCalculationCount,
  };
};
