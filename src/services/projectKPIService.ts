import { supabase } from '@/integrations/supabase/client';
import { z } from 'zod';
import { apiCall, validateInput, ApiError, API_ERROR_CODES } from './common';
import { eventBus } from './eventBus';

export type PostCalculationStatus = 'profit' | 'risk' | 'loss' | 'incomplete';

export interface ProjectPostCalculation {
  project_id: string;
  project_name: string;
  project_status: string;
  planned: {
    revenueNet: number;
    revenueGross: number;
    hours: number;
    laborCosts: number;
    materialCosts: number;
    otherCosts: number;
    totalCosts: number;
    profit: number;
    marginPercent: number;
  };
  actual: {
    revenueNet: number;
    revenueGross: number;
    hours: number;
    laborCosts: number;
    materialCosts: number;
    expenses: number;
    totalCosts: number;
    profit: number;
    marginPercent: number;
  };
  variance: {
    hours: number;
    laborCosts: number;
    materialCosts: number;
    totalCosts: number;
    profit: number;
  };
  result: {
    profit: number;
    marginPercent: number;
    budgetUtilizationPercent: number;
    status: PostCalculationStatus;
  };
  counts: {
    offers: number;
    invoices: number;
    completedTimeEntries: number;
    materials: number;
    expenses: number;
  };
  missingData: string[];
  openTimeEntries: number;
  calculated_at: string;
}

// Types for Project KPIs
export interface ProjectKPIs {
  project_id: string;
  project_name: string;
  budget: number;
  actual_costs: {
    labor: number;
    materials: number;
    expenses: number;
    total: number;
  };
  utilization: number; // 0.0 to 1.0 (0% to 100%)
  utilization_percentage: number; // 0 to 100
  status: 'healthy' | 'warning' | 'critical' | 'over_budget';
  hours_logged: number;
  materials_used: number;
  expenses_incurred: number;
  profitability: number;
  completion_percentage: number;
  estimated_completion_date: string | null;
  calculated_at: string;
}

export interface ProjectKPIsSummary {
  total_projects: number;
  healthy_projects: number;
  warning_projects: number; // 70-89% utilization
  critical_projects: number; // 90%+ utilization
  over_budget_projects: number;
  total_budget: number;
  total_actual_costs: number;
  overall_utilization: number;
  profit_margin: number;
}

const ProjectKPIsSchema = z.object({
  project_id: z.string(),
  budget: z.number().optional(),
  date_range: z.object({
    from: z.string().optional(),
    to: z.string().optional(),
  }).optional(),
});

const activeOfferStatuses = new Set(['draft', 'sent', 'accepted']);
const cancelledInvoiceStatuses = new Set(['storniert', 'storniert', 'cancelled', 'canceled']);

const toNumber = (value: unknown): number => {
  const numberValue = typeof value === 'number' ? value : Number(value ?? 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
};

const roundMoney = (value: number): number => Math.round(value * 100) / 100;
const roundHours = (value: number): number => Math.round(value * 100) / 100;

const sum = <T>(items: T[], selector: (item: T) => number): number =>
  items.reduce((total, item) => total + selector(item), 0);

const hasPositiveValue = (value: number): boolean => value > 0;

const calculateWorkedHours = (entry: any): number => {
  if (!entry.start_time || !entry.end_time) return 0;

  const start = new Date(entry.start_time).getTime();
  const end = new Date(entry.end_time).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;

  const breakMs = toNumber(entry.break_duration) * 60 * 1000;
  return Math.max(0, (end - start - breakMs) / (1000 * 60 * 60));
};

const isActiveOffer = (offer: any): boolean => {
  const status = String(offer.status || '').toLowerCase();
  return !status || activeOfferStatuses.has(status);
};

const isBillableInvoice = (invoice: any): boolean => {
  const status = String(invoice.status || '').toLowerCase();
  return !cancelledInvoiceStatuses.has(status);
};

async function runQuery<T>(query: any, operationName: string): Promise<T> {
  const { data, error } = await query;

  if (error) {
    throw new ApiError(
      'Database query failed',
      API_ERROR_CODES.INTERNAL_ERROR,
      `${operationName}: ${error.message || 'Unbekannter Datenbankfehler'}`,
    );
  }

  return data as T;
}

function getCompletionPercentage(status: string): number {
  const completionMap: Record<string, number> = {
    neu: 0,
    geplant: 0,
    anfrage: 0,
    besichtigung: 10,
    angebot: 20,
    beauftragt: 35,
    in_bearbeitung: 60,
    fast_fertig: 85,
    abgeschlossen: 100,
  };

  return completionMap[String(status || '').toLowerCase()] ?? 0;
}

export class ProjectKPIService {
  static async getProjectPostCalculation(projectId: string, dateRange?: { from?: string; to?: string }): Promise<ProjectPostCalculation> {
    return apiCall(async () => {
      validateInput(ProjectKPIsSchema, {
        project_id: projectId,
        date_range: dateRange,
      });

      const project = await runQuery<any>(
        supabase
          .from('projects')
          .select('id, name, budget, status, start_date, end_date')
          .eq('id', projectId)
          .single(),
        'Projekt laden',
      );

      const offers = (await runQuery<any[]>(
        supabase
          .from('offers')
          .select('id, offer_number, status, snapshot_net_total, snapshot_gross_total')
          .eq('project_id', projectId),
        'Angebote laden',
      ) || []).filter(isActiveOffer);

      const offerIds = offers.map((offer) => offer.id).filter(Boolean);

      const offerTargets = offerIds.length > 0
        ? await runQuery<any[]>(
          supabase
            .from('offer_targets')
            .select('offer_id, planned_hours_total, internal_hourly_rate, billable_hourly_rate, planned_material_cost_total, planned_other_cost, snapshot_target_cost, snapshot_target_margin, snapshot_target_revenue')
            .in('offer_id', offerIds),
          'Angebotsziele laden',
        )
        : [];

      const offerItems = offerIds.length > 0
        ? await runQuery<any[]>(
          supabase
            .from('offer_items')
            .select('offer_id, quantity, unit_price_net, planned_hours_item, material_purchase_cost')
            .in('offer_id', offerIds),
          'Angebotspositionen laden',
        )
        : [];

      let timeQuery = supabase
        .from('time_entries')
        .select('id, employee_id, start_time, end_time, break_duration, status')
        .eq('project_id', projectId);

      if (dateRange?.from) timeQuery = timeQuery.gte('start_time', dateRange.from);
      if (dateRange?.to) timeQuery = timeQuery.lte('start_time', dateRange.to);

      const timeEntries = await runQuery<any[]>(timeQuery, 'Zeiteinträge laden') || [];
      const completedTimeEntries = timeEntries.filter((entry) => Boolean(entry.end_time));
      const openTimeEntries = timeEntries.length - completedTimeEntries.length;

      const employeeIds = [...new Set(completedTimeEntries.map((entry) => entry.employee_id).filter(Boolean))];
      const employees = employeeIds.length > 0
        ? await runQuery<any[]>(
          supabase
            .from('employees')
            .select('id, first_name, last_name, hourly_wage, hourly_rate')
            .in('id', employeeIds),
          'Mitarbeiter laden',
        )
        : [];
      const employeeRateById = new Map(
        employees.map((employee) => [
          employee.id,
          toNumber(employee.hourly_wage || employee.hourly_rate),
        ]),
      );

      const projectMaterials = await runQuery<any[]>(
        supabase
          .from('project_materials')
          .select('id, name, quantity, unit_price, total_price, status')
          .eq('project_id', projectId),
        'Projektmaterial laden',
      ) || [];

      let expenseQuery = supabase
        .from('expenses')
        .select('id, amount, category, description, expense_date, approved_at')
        .eq('project_id', projectId)
        .not('approved_at', 'is', null);

      if (dateRange?.from) expenseQuery = expenseQuery.gte('expense_date', dateRange.from);
      if (dateRange?.to) expenseQuery = expenseQuery.lte('expense_date', dateRange.to);

      const expenses = await runQuery<any[]>(expenseQuery, 'Projektkosten laden') || [];

      const invoices = (await runQuery<any[]>(
        supabase
          .from('invoices')
          .select('id, invoice_number, status, net_amount, gross_amount, amount')
          .eq('project_id', projectId),
        'Rechnungen laden',
      ) || []).filter(isBillableInvoice);

      const offerItemsByOfferId = offerItems.reduce<Record<string, any[]>>((grouped, item) => {
        if (!grouped[item.offer_id]) grouped[item.offer_id] = [];
        grouped[item.offer_id].push(item);
        return grouped;
      }, {});

      const plannedRevenueNet = roundMoney(sum(offers, (offer) => {
        const snapshot = toNumber(offer.snapshot_net_total);
        if (snapshot > 0) return snapshot;
        return sum(offerItemsByOfferId[offer.id] || [], (item) => toNumber(item.quantity) * toNumber(item.unit_price_net));
      }));

      const plannedRevenueGross = roundMoney(sum(offers, (offer) => {
        const gross = toNumber(offer.snapshot_gross_total);
        if (gross > 0) return gross;
        const net = toNumber(offer.snapshot_net_total);
        return net > 0 ? net * 1.19 : sum(offerItemsByOfferId[offer.id] || [], (item) => toNumber(item.quantity) * toNumber(item.unit_price_net) * 1.19);
      }));

      const targetHours = sum(offerTargets, (target) => toNumber(target.planned_hours_total));
      const itemHours = sum(offerItems, (item) => toNumber(item.planned_hours_item));
      const plannedHours = roundHours(hasPositiveValue(targetHours) ? targetHours : itemHours);

      const targetMaterialCosts = sum(offerTargets, (target) => toNumber(target.planned_material_cost_total));
      const itemMaterialCosts = sum(offerItems, (item) => toNumber(item.material_purchase_cost));
      const plannedMaterialCosts = roundMoney(hasPositiveValue(targetMaterialCosts) ? targetMaterialCosts : itemMaterialCosts);

      const plannedOtherCosts = roundMoney(sum(offerTargets, (target) => toNumber(target.planned_other_cost)));
      const averageInternalRate = (() => {
        const rates = offerTargets
          .map((target) => toNumber(target.internal_hourly_rate))
          .filter((rate) => rate > 0);
        return rates.length > 0 ? sum(rates, (rate) => rate) / rates.length : 0;
      })();
      const plannedLaborCosts = roundMoney(plannedHours * averageInternalRate);
      const plannedTotalCosts = roundMoney(plannedLaborCosts + plannedMaterialCosts + plannedOtherCosts);
      const plannedProfit = roundMoney(plannedRevenueNet - plannedTotalCosts);
      const plannedMarginPercent = plannedRevenueNet > 0 ? roundMoney((plannedProfit / plannedRevenueNet) * 100) : 0;

      const actualHours = roundHours(sum(completedTimeEntries, calculateWorkedHours));
      const actualLaborCosts = roundMoney(sum(completedTimeEntries, (entry) => {
        const hours = calculateWorkedHours(entry);
        return hours * (employeeRateById.get(entry.employee_id) || 0);
      }));
      const actualMaterialCosts = roundMoney(sum(projectMaterials, (material) => {
        const totalPrice = toNumber(material.total_price);
        return totalPrice > 0 ? totalPrice : toNumber(material.quantity) * toNumber(material.unit_price);
      }));
      const actualExpenses = roundMoney(sum(expenses, (expense) => toNumber(expense.amount)));
      const actualTotalCosts = roundMoney(actualLaborCosts + actualMaterialCosts + actualExpenses);

      const invoiceRevenueNet = roundMoney(sum(invoices, (invoice) => toNumber(invoice.net_amount || invoice.amount)));
      const invoiceRevenueGross = roundMoney(sum(invoices, (invoice) => toNumber(invoice.gross_amount || invoice.amount)));
      const actualRevenueNet = invoiceRevenueNet > 0 ? invoiceRevenueNet : plannedRevenueNet;
      const actualRevenueGross = invoiceRevenueGross > 0 ? invoiceRevenueGross : plannedRevenueGross;
      const actualProfit = roundMoney(actualRevenueNet - actualTotalCosts);
      const actualMarginPercent = actualRevenueNet > 0 ? roundMoney((actualProfit / actualRevenueNet) * 100) : 0;

      const budgetBase = plannedTotalCosts > 0 ? plannedTotalCosts : toNumber(project.budget);
      const budgetUtilizationPercent = budgetBase > 0 ? roundMoney((actualTotalCosts / budgetBase) * 100) : 0;
      const missingData = [
        offers.length === 0 ? 'Kein verknüpftes Angebot' : null,
        completedTimeEntries.length === 0 ? 'Keine abgeschlossenen Zeiten' : null,
        projectMaterials.length === 0 ? 'Keine Materialkosten erfasst' : null,
      ].filter(Boolean) as string[];

      const status: PostCalculationStatus = (() => {
        if (offers.length === 0 || plannedRevenueNet <= 0) return 'incomplete';
        if (actualProfit < 0) return 'loss';
        if (budgetUtilizationPercent >= 90 || actualMarginPercent < 10) return 'risk';
        return 'profit';
      })();

      return {
        project_id: projectId,
        project_name: project.name,
        project_status: project.status,
        planned: {
          revenueNet: plannedRevenueNet,
          revenueGross: plannedRevenueGross,
          hours: plannedHours,
          laborCosts: plannedLaborCosts,
          materialCosts: plannedMaterialCosts,
          otherCosts: plannedOtherCosts,
          totalCosts: plannedTotalCosts,
          profit: plannedProfit,
          marginPercent: plannedMarginPercent,
        },
        actual: {
          revenueNet: actualRevenueNet,
          revenueGross: actualRevenueGross,
          hours: actualHours,
          laborCosts: actualLaborCosts,
          materialCosts: actualMaterialCosts,
          expenses: actualExpenses,
          totalCosts: actualTotalCosts,
          profit: actualProfit,
          marginPercent: actualMarginPercent,
        },
        variance: {
          hours: roundHours(actualHours - plannedHours),
          laborCosts: roundMoney(actualLaborCosts - plannedLaborCosts),
          materialCosts: roundMoney(actualMaterialCosts - plannedMaterialCosts),
          totalCosts: roundMoney(actualTotalCosts - plannedTotalCosts),
          profit: roundMoney(actualProfit - plannedProfit),
        },
        result: {
          profit: actualProfit,
          marginPercent: actualMarginPercent,
          budgetUtilizationPercent,
          status,
        },
        counts: {
          offers: offers.length,
          invoices: invoices.length,
          completedTimeEntries: completedTimeEntries.length,
          materials: projectMaterials.length,
          expenses: expenses.length,
        },
        missingData,
        openTimeEntries,
        calculated_at: new Date().toISOString(),
      };
    }, 'Nachkalkulation berechnen');
  }

  static async getProjectKPIs(projectId: string, dateRange?: { from?: string; to?: string }): Promise<ProjectKPIs> {
    const calculation = await this.getProjectPostCalculation(projectId, dateRange);

    const budget = calculation.planned.revenueNet || calculation.actual.revenueNet;
    const utilization = budget > 0 ? calculation.actual.totalCosts / budget : 0;
    const kpiStatus: ProjectKPIs['status'] =
      calculation.result.status === 'loss' ? 'over_budget' :
        calculation.result.status === 'risk' ? 'critical' :
          calculation.result.status === 'incomplete' ? 'warning' :
            'healthy';

    const kpis: ProjectKPIs = {
      project_id: projectId,
      project_name: calculation.project_name,
      budget,
      actual_costs: {
        labor: calculation.actual.laborCosts,
        materials: calculation.actual.materialCosts,
        expenses: calculation.actual.expenses,
        total: calculation.actual.totalCosts,
      },
      utilization,
      utilization_percentage: Math.round(utilization * 100),
      status: kpiStatus,
      hours_logged: calculation.actual.hours,
      materials_used: calculation.counts.materials,
      expenses_incurred: calculation.counts.expenses,
      profitability: calculation.result.profit,
      completion_percentage: getCompletionPercentage(calculation.project_status),
      estimated_completion_date: null,
      calculated_at: calculation.calculated_at,
    };

    if (utilization >= 0.9) {
      eventBus.emit('PROJECT_BUDGET_CRITICAL', {
        project_id: projectId,
        project_name: calculation.project_name,
        utilization_percentage: kpis.utilization_percentage,
        budget,
        actual_costs: calculation.actual.totalCosts,
        user_id: (await supabase.auth.getUser()).data.user?.id,
      });
    }

    return kpis;
  }

  static async getProjectKPIsSummary(dateRange?: { from?: string; to?: string }): Promise<ProjectKPIsSummary> {
    return apiCall(async () => {
      const projects = await runQuery<any[]>(
        supabase
          .from('projects')
          .select('id, name, budget, status')
          .neq('status', 'cancelled'),
        'Projektliste laden',
      ) || [];

      const projectKPIs = await Promise.all(
        projects.map((project) => this.getProjectKPIs(project.id, dateRange)),
      );

      const totalBudget = sum(projectKPIs, (kpi) => kpi.budget);
      const totalActualCosts = sum(projectKPIs, (kpi) => kpi.actual_costs.total);

      return {
        total_projects: projects.length,
        healthy_projects: projectKPIs.filter((kpi) => kpi.status === 'healthy').length,
        warning_projects: projectKPIs.filter((kpi) => kpi.status === 'warning').length,
        critical_projects: projectKPIs.filter((kpi) => kpi.status === 'critical').length,
        over_budget_projects: projectKPIs.filter((kpi) => kpi.status === 'over_budget').length,
        total_budget: totalBudget,
        total_actual_costs: totalActualCosts,
        overall_utilization: totalBudget > 0 ? totalActualCosts / totalBudget : 0,
        profit_margin: totalBudget > 0 ? ((totalBudget - totalActualCosts) / totalBudget) * 100 : 0,
      };
    }, 'Projekt-KPIs zusammenfassen');
  }

  static async getCriticalBudgetProjects(): Promise<ProjectKPIs[]> {
    return apiCall(async () => {
      const projects = await runQuery<any[]>(
        supabase
          .from('projects')
          .select('id')
          .neq('status', 'cancelled')
          .neq('status', 'abgeschlossen'),
        'Kritische Projekte laden',
      ) || [];

      const allKPIs = await Promise.all(
        projects.map((project) => this.getProjectKPIs(project.id)),
      );

      return allKPIs.filter((kpi) => kpi.utilization >= 0.9);
    }, 'Kritische Projektbudgets laden');
  }
}

export const projectKPIService = new ProjectKPIService();
