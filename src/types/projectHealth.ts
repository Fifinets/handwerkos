/**
 * Project Health Types für das Project Cockpit
 *
 * WICHTIG: Master-Signal wird NICHT persistiert, sondern immer berechnet
 * um Drift zwischen Daten und Anzeige zu vermeiden.
 */

export type TrafficLight = "green" | "yellow" | "red";

export type HealthReasonCode =
  | "MISSING_TARGETS"
  | "NO_TIME_ENTRIES"
  | "NO_PROJECT_MANAGER"
  | "TIME_OVER_PLANNED"
  | "COST_OVER_TARGET"
  | "DEADLINE_RISK"
  | "MISSING_INVOICE";

export interface HealthReason {
  code: HealthReasonCode;
  severity: "yellow" | "red";
  title: string;
  detail: string;
}

export type NextActionKey =
  | "SET_TARGETS"
  | "BOOK_FIRST_TIME"
  | "ASSIGN_MANAGER"
  | "REVIEW_DEADLINE"
  | "CREATE_INVOICE"
  | "ADD_MATERIAL";

export interface NextAction {
  key: NextActionKey;
  title: string;
  description: string;
  ctaLabel: string;
  ctaRoute: string;
}

export interface EconomySummary {
  targetRevenue: number | null;
  actualCosts: number;
  grossProfit: number | null;
  grossMarginPct: number | null;
}

export interface ProjectHealth {
  status: TrafficLight;
  reasons: HealthReason[];
  nextAction: NextAction | null;
  economy: EconomySummary;
  computedAtISO: string;
}

/**
 * Erweiterte Projektdaten mit Soll-Werten
 */
export interface ProjectWithTargets {
  id: string;
  status: string;
  planned_hours: number | null;
  target_revenue: number | null;
  end_date: string | null;
  project_manager_id: string | null;
  budget: number | null;
}

/**
 * Aggregierte Daten aus time_entries und material_entries
 */
export interface ProjectAggregates {
  actualHours: number;
  actualCosts: number;
  hasInvoice: boolean;
}
