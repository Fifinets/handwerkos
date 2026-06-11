import { PROJECT_STATUS_CONFIG } from "@/types/project";

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

export const getStatusConfig = (status: string) => {
  return PROJECT_STATUS_CONFIG[status as keyof typeof PROJECT_STATUS_CONFIG] || PROJECT_STATUS_CONFIG.geplant;
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
