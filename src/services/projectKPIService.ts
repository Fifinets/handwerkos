import { supabase } from '@/integrations/supabase/client';
import { z } from 'zod';
import { apiCall, createQuery, validateInput, getCurrentUserProfile, ApiError, API_ERROR_CODES } from './common';
import { eventBus } from './eventBus';

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

// Zod schemas for validation
const ProjectKPIsSchema = z.object({
  project_id: z.string(),
  budget: z.number().optional(),
  date_range: z.object({
    from: z.string().optional(),
    to: z.string().optional(),
  }).optional(),
});

export class ProjectKPIService {
  /**
   * Calculate KPIs for a specific project
   * KPI formula:
   * - labor = Σ(timesheets.hours * employee.hourlyRate)
   * - material = Σ(projectMaterials.cost)
   * - expenses = Σ(expense.amount)
   * - total = labor + material + expenses
   * - utilization = budget > 0 ? total/budget : 0
   */
  static async getProjectKPIs(projectId: string, dateRange?: { from?: string; to?: string }): Promise<ProjectKPIs> {
    return apiCall(async () => {
      // Validate input
      const validatedData = validateInput(ProjectKPIsSchema, {
        project_id: projectId,
        date_range: dateRange,
      });

      // Get project details
      const projectQuery = supabase
        .from('projects')
        .select('id, name, budget, status, start_date, end_date')
        .eq('id', projectId)
        .single();

      const project = await createQuery(projectQuery).executeSingle();

      // Get timesheet data for labor costs
      let timesheetQuery = supabase
        .from('time_entries')
        .select(`
          hours_worked,
          hourly_rate,
          employee_id,
          employees (
            first_name,
            last_name,
            hourly_rate
          )
        `)
        .eq('project_id', projectId)
        .not('end_time', 'is', null); // Only completed time entries

      if (dateRange?.from) {
        timesheetQuery = timesheetQuery.gte('start_time', dateRange.from);
      }
      if (dateRange?.to) {
        timesheetQuery = timesheetQuery.lte('start_time', dateRange.to);
      }

      const timesheets = await createQuery(timesheetQuery).execute();

      // Get material costs
      let materialQuery = supabase
        .from('project_materials')
        .select(`
          quantity,
          unit_cost,
          total_cost,
          materials (
            name,
            unit
          )
        `)
        .eq('project_id', projectId);

      const projectMaterials = await createQuery(materialQuery).execute();

      // Get project expenses
      let expenseQuery = supabase
        .from('expenses')
        .select('amount, description, expense_date')
        .eq('project_id', projectId)
        .not('approved_at', 'is', null); // Only approved expenses

      if (dateRange?.from) {
        expenseQuery = expenseQuery.gte('expense_date', dateRange.from);
      }
      if (dateRange?.to) {
        expenseQuery = expenseQuery.lte('expense_date', dateRange.to);
      }

      const expenses = await createQuery(expenseQuery).execute();

      // Calculate costs
      const laborCost = timesheets.reduce((total, entry) => {
        const hourlyRate = entry.hourly_rate || entry.employees?.hourly_rate || 50; // Default rate
        const hours = entry.hours_worked || 0;
        return total + (hours * hourlyRate);
      }, 0);

      const materialCost = projectMaterials.reduce((total, material) => {
        return total + (material.total_cost || (material.quantity * material.unit_cost) || 0);
      }, 0);

      const expenseCost = expenses.reduce((total, expense) => {
        return total + (expense.amount || 0);
      }, 0);

      const totalActualCosts = laborCost + materialCost + expenseCost;
      const budget = project.budget || 0;
      const utilization = budget > 0 ? totalActualCosts / budget : 0;
      const utilizationPercentage = Math.round(utilization * 100);

      // Determine status
      let status: 'healthy' | 'warning' | 'critical' | 'over_budget';
      if (utilization >= 1.0) {
        status = 'over_budget';
      } else if (utilization >= 0.9) {
        status = 'critical';
      } else if (utilization >= 0.7) {
        status = 'warning';
      } else {
        status = 'healthy';
      }

      // Calculate additional metrics
      const totalHours = timesheets.reduce((total, entry) => total + (entry.hours_worked || 0), 0);
      const profitability = budget - totalActualCosts;
      
      // Simple completion percentage based on status
      const completionMap = {
        'neu': 0,
        'geplant': 10,
        'in_bearbeitung': 50,
        'fast_fertig': 80,
        'abgeschlossen': 100,
      };
      const completionPercentage = completionMap[project.status as keyof typeof completionMap] || 0;

      // Estimate completion date (simple heuristic)
      let estimatedCompletionDate: string | null = null;
      if (project.end_date) {
        estimatedCompletionDate = project.end_date;
      } else if (completionPercentage > 0 && completionPercentage < 100 && totalHours > 0) {
        // Rough estimation based on current progress
        const estimatedTotalHours = totalHours / (completionPercentage / 100);
        const remainingHours = estimatedTotalHours - totalHours;
        const daysToComplete = Math.ceil(remainingHours / 8); // Assuming 8 hours per day
        const estimatedDate = new Date();
        estimatedDate.setDate(estimatedDate.getDate() + daysToComplete);
        estimatedCompletionDate = estimatedDate.toISOString().split('T')[0];
      }

      const kpis: ProjectKPIs = {
        project_id: projectId,
        project_name: project.name,
        budget,
        actual_costs: {
          labor: laborCost,
          materials: materialCost,
          expenses: expenseCost,
          total: totalActualCosts,
        },
        utilization,
        utilization_percentage: utilizationPercentage,
        status,
        hours_logged: totalHours,
        materials_used: projectMaterials.length,
        expenses_incurred: expenses.length,
        profitability,
        completion_percentage: completionPercentage,
        estimated_completion_date: estimatedCompletionDate,
        calculated_at: new Date().toISOString(),
      };

      // Emit event if critical utilization reached
      if (utilization >= 0.9) {
        eventBus.emit('PROJECT_BUDGET_CRITICAL', {
          project_id: projectId,
          project_name: project.name,
          utilization_percentage: utilizationPercentage,
          budget,
          actual_costs: totalActualCosts,
          user_id: (await supabase.auth.getUser()).data.user?.id,
        });
      }

      return kpis;
    }, 'Calculate project KPIs');
  }

  /**
   * Get KPIs summary for all projects
   */
  static async getProjectKPIsSummary(dateRange?: { from?: string; to?: string }): Promise<ProjectKPIsSummary> {
    return apiCall(async () => {
      // Get all active projects
      const projectsQuery = supabase
        .from('projects')
        .select('id, name, budget, status')
        .neq('status', 'cancelled');

      const projects = await createQuery(projectsQuery).execute();

      let healthyProjects = 0;
      let warningProjects = 0;
      let criticalProjects = 0;
      let overBudgetProjects = 0;
      let totalBudget = 0;
      let totalActualCosts = 0;

      // Calculate KPIs for each project
      const projectKPIs = await Promise.all(
        projects.map(project => this.getProjectKPIs(project.id, dateRange))
      );

      for (const kpi of projectKPIs) {
        totalBudget += kpi.budget;
        totalActualCosts += kpi.actual_costs.total;

        switch (kpi.status) {
          case 'healthy':
            healthyProjects++;
            break;
          case 'warning':
            warningProjects++;
            break;
          case 'critical':
            criticalProjects++;
            break;
          case 'over_budget':
            overBudgetProjects++;
            break;
        }
      }

      const overallUtilization = totalBudget > 0 ? totalActualCosts / totalBudget : 0;
      const profitMargin = totalBudget > 0 ? ((totalBudget - totalActualCosts) / totalBudget) * 100 : 0;

      return {
        total_projects: projects.length,
        healthy_projects: healthyProjects,
        warning_projects: warningProjects,
        critical_projects: criticalProjects,
        over_budget_projects: overBudgetProjects,
        total_budget: totalBudget,
        total_actual_costs: totalActualCosts,
        overall_utilization: overallUtilization,
        profit_margin: profitMargin,
      };
    }, 'Calculate project KPIs summary');
  }

  /**
   * Get projects with critical budget utilization (≥90%)
   */
  static async getCriticalBudgetProjects(): Promise<ProjectKPIs[]> {
    return apiCall(async () => {
      // Get all active projects
      const projectsQuery = supabase
        .from('projects')
        .select('id')
        .neq('status', 'cancelled')
        .neq('status', 'abgeschlossen');

      const projects = await createQuery(projectsQuery).execute();

      // Get KPIs for each project and filter critical ones
      const allKPIs = await Promise.all(
        projects.map(project => this.getProjectKPIs(project.id))
      );

      return allKPIs.filter(kpi => kpi.utilization >= 0.9);
    }, 'Get critical budget projects');
  }
}

export const projectKPIService = new ProjectKPIService();