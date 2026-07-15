import { Button } from "@/components/ui/button";
import { Zap, Briefcase, Users, Plus } from "lucide-react";
import type { PlannerProject, PlannerEmployee } from './types';

interface PlannerBannersProps {
  unplannedProjects: PlannerProject[];
  unstaffedProjects: PlannerProject[];
  idleEmployees: PlannerEmployee[];
  onAutoAssign: (project: PlannerProject) => void;
  onAssignForProject: (projectId: string) => void;
  onAssignEmployee: (employeeId: string) => void;
}

export function PlannerBanners({
  unplannedProjects,
  unstaffedProjects,
  idleEmployees,
  onAutoAssign,
  onAssignForProject,
  onAssignEmployee,
}: PlannerBannersProps) {
  return (
    <>
      {unplannedProjects.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-transparent rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Zap className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                {unplannedProjects.length} Projekt{unplannedProjects.length > 1 ? 'e' : ''} mit Team aber ohne Planer-Zeitraum
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {unplannedProjects.map(p => {
                  const unplannedCount = p.project_team_assignments?.filter(a => a.is_active && !a.start_date).length || 0;
                  return (
                    <Button key={p.id} variant="outline" size="sm"
                      className="bg-white dark:bg-slate-900 border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40 text-xs h-7"
                      onClick={() => onAutoAssign(p)}>
                      <Zap className="h-3 w-3 mr-1" />
                      {p.name} ({unplannedCount} MA)
                    </Button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Planungslücke wie oben: Projekt ohne Mitarbeiter wartet ebenfalls auf eine Aktion -> gleiche Amber-Semantik statt ursprünglichem Blau. */}
      {unstaffedProjects.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-transparent rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Briefcase className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                {unstaffedProjects.length} Projekt{unstaffedProjects.length > 1 ? 'e' : ''} ohne Mitarbeiter
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {unstaffedProjects.map(p => (
                  <Button key={p.id} variant="outline" size="sm"
                    className="bg-white dark:bg-slate-900 border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40 text-xs h-7"
                    onClick={() => onAssignForProject(p.id)}>
                    <Plus className="h-3 w-3 mr-1" />
                    {p.name}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Freie Mitarbeiter = verfügbare Ressource -> positiv/teal statt ursprünglichem Grün. */}
      {idleEmployees.length > 0 && (
        <div className="bg-teal-50 dark:bg-teal-950/40 border border-transparent rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Users className="h-5 w-5 text-teal-600 dark:text-teal-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-teal-800 dark:text-teal-300">
                {idleEmployees.length} Mitarbeiter ohne Einsatz diese Woche
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {idleEmployees.map(emp => (
                  <Button key={emp.id} variant="outline" size="sm"
                    className="bg-white dark:bg-slate-900 border-teal-300 dark:border-teal-800 text-teal-800 dark:text-teal-300 hover:bg-teal-100 dark:hover:bg-teal-900/40 text-xs h-7"
                    onClick={() => onAssignEmployee(emp.id)}>
                    <Plus className="h-3 w-3 mr-1" />
                    {emp.first_name} {emp.last_name}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
