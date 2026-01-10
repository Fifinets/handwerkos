import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, TrendingDown, TrendingUp, DollarSign, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface ProjectCost {
  project_id: string;
  project_name: string;
  budget: number;
  actual_cost: number;
  labor_hours: number;
  labor_cost: number;
  status: string;
  start_date: string;
  end_date: string | null;
}

interface ProjectCostAnalysisProps {
  projectId?: string; // Optional: show single project or all projects
}

export function ProjectCostAnalysis({ projectId }: ProjectCostAnalysisProps) {
  const [projectCosts, setProjectCosts] = useState<ProjectCost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProjectCosts();
  }, [projectId]);

  const loadProjectCosts = async () => {
    setLoading(true);
    try {
      // Build query
      let query = supabase
        .from('projects')
        .select(`
          id,
          name,
          budget,
          status,
          start_date,
          end_date,
          time_entries (
            id,
            start_time,
            end_time,
            break_duration,
            employee_id,
            employees (
              hourly_rate
            )
          )
        `)
        .neq('status', 'abgeschlossen');

      if (projectId) {
        query = query.eq('id', projectId);
      }

      const { data: projects, error } = await query;

      if (error) throw error;

      // Calculate costs for each project
      const costs: ProjectCost[] = (projects || []).map((project: any) => {
        let totalHours = 0;
        let totalLaborCost = 0;

        // Calculate from time entries
        (project.time_entries || []).forEach((entry: any) => {
          if (!entry.end_time) return; // Skip active entries

          const start = new Date(entry.start_time);
          const end = new Date(entry.end_time);
          const breakMinutes = entry.break_duration || 0;

          // Calculate hours worked
          const totalMinutes = (end.getTime() - start.getTime()) / (1000 * 60) - breakMinutes;
          const hours = totalMinutes / 60;

          // Get employee hourly rate
          const hourlyRate = entry.employees?.hourly_rate || 0;

          totalHours += hours;
          totalLaborCost += hours * hourlyRate;
        });

        return {
          project_id: project.id,
          project_name: project.name,
          budget: project.budget || 0,
          actual_cost: totalLaborCost,
          labor_hours: totalHours,
          labor_cost: totalLaborCost,
          status: project.status,
          start_date: project.start_date,
          end_date: project.end_date
        };
      });

      setProjectCosts(costs);
    } catch (error) {
      console.error('Error loading project costs:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  const formatHours = (hours: number) => {
    return `${hours.toFixed(1)}h`;
  };

  const getDifferenceColor = (difference: number) => {
    if (difference > 0) return 'text-green-600';
    if (difference < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  const getDifferenceIcon = (difference: number) => {
    if (difference > 0) return <TrendingUp className="h-4 w-4" />;
    if (difference < 0) return <TrendingDown className="h-4 w-4" />;
    return null;
  };

  const getLossRiskBadge = (budget: number, actualCost: number) => {
    if (budget === 0) return <Badge variant="outline">Kein Budget</Badge>;

    const usedPercentage = (actualCost / budget) * 100;

    if (usedPercentage >= 100) {
      return <Badge className="bg-red-600">Verlust</Badge>;
    }
    if (usedPercentage >= 80) {
      return <Badge className="bg-orange-500">Risiko</Badge>;
    }
    if (usedPercentage >= 60) {
      return <Badge className="bg-yellow-500">Warnung</Badge>;
    }
    return <Badge className="bg-green-600">OK</Badge>;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-muted-foreground">Lade Kostenanalyse...</div>
        </CardContent>
      </Card>
    );
  }

  const totalBudget = projectCosts.reduce((sum, p) => sum + p.budget, 0);
  const totalActualCost = projectCosts.reduce((sum, p) => sum + p.actual_cost, 0);
  const totalDifference = totalBudget - totalActualCost;

  return (
    <div className="space-y-4">
      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Kosten-Übersicht
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="text-sm text-muted-foreground">Budget (Soll)</div>
              <div className="text-2xl font-bold">{formatCurrency(totalBudget)}</div>
            </div>
            <div className="text-center p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
              <div className="text-sm text-muted-foreground">Ist-Kosten</div>
              <div className="text-2xl font-bold">{formatCurrency(totalActualCost)}</div>
            </div>
            <div className={`text-center p-4 rounded-lg ${
              totalDifference >= 0
                ? 'bg-green-50 dark:bg-green-900/20'
                : 'bg-red-50 dark:bg-red-900/20'
            }`}>
              <div className="text-sm text-muted-foreground">Differenz</div>
              <div className={`text-2xl font-bold flex items-center justify-center gap-2 ${getDifferenceColor(totalDifference)}`}>
                {getDifferenceIcon(totalDifference)}
                {formatCurrency(Math.abs(totalDifference))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Project Details */}
      <Card>
        <CardHeader>
          <CardTitle>Projekt-Details</CardTitle>
        </CardHeader>
        <CardContent>
          {projectCosts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Keine aktiven Projekte gefunden
            </div>
          ) : (
            <div className="space-y-4">
              {projectCosts.map((project) => {
                const difference = project.budget - project.actual_cost;
                const usedPercentage = project.budget > 0
                  ? (project.actual_cost / project.budget) * 100
                  : 0;

                return (
                  <div
                    key={project.project_id}
                    className="border rounded-lg p-4 space-y-3"
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-semibold">{project.project_name}</h4>
                        <div className="text-sm text-muted-foreground">
                          Status: {project.status}
                        </div>
                      </div>
                      {getLossRiskBadge(project.budget, project.actual_cost)}
                    </div>

                    {/* Metrics */}
                    <div className="grid grid-cols-4 gap-3 text-sm">
                      <div>
                        <div className="text-muted-foreground">Budget</div>
                        <div className="font-medium">{formatCurrency(project.budget)}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Ist-Kosten</div>
                        <div className="font-medium">{formatCurrency(project.actual_cost)}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Arbeitsstunden</div>
                        <div className="font-medium flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatHours(project.labor_hours)}
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Differenz</div>
                        <div className={`font-medium flex items-center gap-1 ${getDifferenceColor(difference)}`}>
                          {getDifferenceIcon(difference)}
                          {formatCurrency(Math.abs(difference))}
                        </div>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Budget-Verbrauch</span>
                        <span>{usedPercentage.toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            usedPercentage >= 100 ? 'bg-red-600' :
                            usedPercentage >= 80 ? 'bg-orange-500' :
                            usedPercentage >= 60 ? 'bg-yellow-500' :
                            'bg-green-600'
                          }`}
                          style={{ width: `${Math.min(usedPercentage, 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* Warning if over budget */}
                    {difference < 0 && (
                      <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 p-2 rounded">
                        <AlertTriangle className="h-4 w-4" />
                        <span>Budget überschritten: {formatCurrency(Math.abs(difference))}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
