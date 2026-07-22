import { WORKFLOW_STAGE_CONFIG } from "@/types/project";
import { normalizeProjectStatus } from "@/lib/projectStatus";

export const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR'
  }).format(amount);
};

export const formatHours = (hours: number) => {
  return new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  }).format(hours);
};

export const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('de-DE');
};

export const formatDateTime = (dateString: string) => {
  return new Date(dateString).toLocaleString('de-DE');
};

/**
 * Anzeigekonfiguration für die Workflow-Stufe eines Projekts.
 *
 * Vorher wurde auf `PROJECT_STATUS_CONFIG.geplant` zurückgefallen — einen
 * Schlüssel, den es nie gab. Bei unbekanntem Status kam also `undefined`
 * zurück und der Aufrufer lief in einen Zugriffsfehler. Jetzt normalisiert
 * `normalizeProjectStatus` erst auf eine gültige Stufe; stornierte Projekte
 * haben keine Stufe und bekommen die Endstufe zur Anzeige.
 */
export const getStatusConfig = (status: string, workflowStage?: string | null) => {
  const { workflow_stage } = normalizeProjectStatus(status, workflowStage);
  return WORKFLOW_STAGE_CONFIG[workflow_stage ?? 'done'];
};

export const generateShortId = (fullId: string) => {
  const hash = fullId.split('-').join('');
  return `P${hash.substring(0, 6).toUpperCase()}`;
};

export interface ProfitabilityOffer {
  status?: string | null;
  snapshot_net_total?: number | null;
  snapshot_gross_total?: number | null;
}

export const calculateProfitability = (offers: ProfitabilityOffer[], internalCost: number) => {
  const accepted = offers.filter(o => o.status === 'accepted');
  // Altbestand ohne snapshot_net_total: Netto näherungsweise aus Brutto mit 19 % USt
  const revenueNet = accepted.reduce(
    (sum, o) => sum + (o.snapshot_net_total ?? (o.snapshot_gross_total ? o.snapshot_gross_total / 1.19 : 0)),
    0
  );
  return {
    acceptedCount: accepted.length,
    revenueNet,
    margin: revenueNet - internalCost,
  };
};

export const formatFileSize = (bytes: number) => {
  if (!bytes) return '–';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};
