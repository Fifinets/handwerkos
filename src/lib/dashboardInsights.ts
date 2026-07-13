import { isOpenAddendum, type ProjectAddendumStatus } from './projectAddendums';

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

export type DashboardOfferTarget = {
  planned_hours_total: number | null;
  planned_material_cost_total: number | null;
  planned_other_cost: number | null;
  snapshot_target_cost: number | null;
  snapshot_target_margin: number | null;
  snapshot_target_revenue: number | null;
};

export type DashboardAcceptedOffer = {
  id: string;
  project_id: string | null;
  snapshot_net_total: number | null;
  targets?: DashboardOfferTarget | DashboardOfferTarget[] | null;
};

export type DashboardMaterialUsage = {
  project_id: string | null;
  quantity_used: number | null;
  unit_price: number | null;
};

export type DashboardProjectAddendum = {
  id: string;
  project_id: string | null;
  status: ProjectAddendumStatus;
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
  acceptedOffers?: DashboardAcceptedOffer[];
  materialUsage?: DashboardMaterialUsage[];
  projectAddendums?: DashboardProjectAddendum[];
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

const firstTarget = (targets: DashboardAcceptedOffer['targets']) => {
  if (!targets) return null;
  return Array.isArray(targets) ? targets[0] || null : targets;
};

const getOfferBaseline = (projectId: string, acceptedOffers: DashboardAcceptedOffer[]) => {
  const offer = acceptedOffers.find((item) => item.project_id === projectId);
  if (!offer) {
    return {
      plannedHours: null,
      budget: null,
    };
  }

  const target = firstTarget(offer.targets);

  return {
    plannedHours: target?.planned_hours_total ?? null,
    budget: offer.snapshot_net_total ?? target?.snapshot_target_revenue ?? null,
  };
};

const getProjectMaterialUsageCost = (projectId: string, materialUsage: DashboardMaterialUsage[]) => {
  return materialUsage
    .filter((usage) => usage.project_id === projectId)
    .reduce((sum, usage) => {
      const quantity = Number(usage.quantity_used || 0);
      const unitPrice = Number(usage.unit_price || 0);
      return sum + quantity * unitPrice;
    }, 0);
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
  acceptedOffers = [],
  materialUsage = [],
  projectAddendums = [],
}: DashboardInsightsInput): DashboardInsights => {
  const openAddendums = projectAddendums.filter((addendum) => isOpenAddendum(addendum));
  const projectsWithOpenAddendums = new Set(openAddendums.map((addendum) => addendum.project_id).filter(Boolean));
  let detectedAddendumProjectCount = 0;
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
      const offerBaseline = getOfferBaseline(project.id, acceptedOffers);
      const plannedHours = offerBaseline.plannedHours ?? parsePlannedHours(project.description);
      const actualHours =
        projectWorkHours.reduce((sum, hour) => sum + Number(hour.hours_worked || 0), 0) +
        projectTimeEntries.reduce((sum, entry) => sum + getTimeEntryHours(entry), 0);
      const budget = offerBaseline.budget ?? project.budget;
      const actualCost =
        Number(project.labor_costs || 0) +
        Number(project.material_costs || 0) +
        getProjectMaterialUsageCost(project.id, materialUsage);
      const deadline = getProjectDeadline(project);
      const isOverdue = deadline ? new Date(deadline) < today : false;
      const hasAddendumSignal =
        projectWorkHours.some((hour) => includesAddendumSignal(hour.work_description)) ||
        projectTimeEntries.some((entry) => includesAddendumSignal(entry.description));
      const hasPersistedOpenAddendum = projectsWithOpenAddendums.has(project.id);
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

      if (hasPersistedOpenAddendum) {
        signals.push('Nachtrag offen');
      }

      if (hasAddendumSignal) {
        if (!hasPersistedOpenAddendum) {
          detectedAddendumProjectCount += 1;
        }
        signals.push(hasPersistedOpenAddendum ? 'Zusatzarbeit dokumentiert' : 'Moeglicher Nachtrag');
      }

      if (budget === null || plannedHours === null) {
        signals.push('Kalkulation fehlt');
        missingCalculationCount += 1;
      }

      const isCritical =
        isOverdue ||
        (budget !== null && actualCost > budget) ||
        (plannedHours !== null && actualHours > plannedHours);
      const hasAddendumWork = hasPersistedOpenAddendum || hasAddendumSignal;
      const riskLevel: DashboardRiskLevel = isCritical ? 'critical' : hasAddendumWork ? 'warning' : 'info';
      const recommendedAction = hasAddendumWork
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
    openAddendumCount: openAddendums.length + detectedAddendumProjectCount,
    invoiceReadyCount,
    missingCalculationCount,
  };
};
