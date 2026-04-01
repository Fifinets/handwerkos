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
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Zap className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-800">
                {unplannedProjects.length} Projekt{unplannedProjects.length > 1 ? 'e' : ''} mit Team aber ohne Planer-Zeitraum
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {unplannedProjects.map(p => {
                  const unplannedCount = p.project_team_assignments?.filter(a => a.is_active && !a.start_date).length || 0;
                  return (
                    <Button key={p.id} variant="outline" size="sm"
                      className="bg-white border-amber-300 text-amber-800 hover:bg-amber-100 text-xs h-7"
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

      {unstaffedProjects.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Briefcase className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-blue-800">
                {unstaffedProjects.length} Projekt{unstaffedProjects.length > 1 ? 'e' : ''} ohne Mitarbeiter
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {unstaffedProjects.map(p => (
                  <Button key={p.id} variant="outline" size="sm"
                    className="bg-white border-blue-300 text-blue-800 hover:bg-blue-100 text-xs h-7"
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

      {idleEmployees.length > 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Users className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-emerald-800">
                {idleEmployees.length} Mitarbeiter ohne Einsatz diese Woche
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {idleEmployees.map(emp => (
                  <Button key={emp.id} variant="outline" size="sm"
                    className="bg-white border-emerald-300 text-emerald-800 hover:bg-emerald-100 text-xs h-7"
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
