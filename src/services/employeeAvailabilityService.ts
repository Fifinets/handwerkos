import { supabase } from '@/integrations/supabase/client';

export interface EmployeeAvailability {
  employee_id: string;
  employee_name: string;
  status: 'available' | 'busy' | 'overloaded' | 'blocked';
  statusColor: 'green' | 'yellow' | 'red' | 'gray';
  statusIcon: string;
  current_projects: number;
  weekly_hours: number;
  conflicts: ProjectConflict[];
  recommendations: string[];
  canAssign: boolean;
}

export interface ProjectConflict {
  project_id: string;
  project_name: string;
  start_date: string;
  end_date: string;
  overlap_days: number;
  conflict_type: 'date_overlap' | 'capacity_exceeded';
}

export class EmployeeAvailabilityService {
  // Maximale Stunden pro Woche pro Mitarbeiter
  private readonly MAX_HOURS_PER_WEEK = 40;
  private readonly WARNING_HOURS_PER_WEEK = 35;
  private readonly MAX_CONCURRENT_PROJECTS = 3;

  /**
   * Prüft die Verfügbarkeit eines Mitarbeiters für ein neues Projekt
   */
  async checkAvailability(
    employeeId: string,
    newProjectId: string,
    newProjectStartDate?: string,
    newProjectEndDate?: string
  ): Promise<EmployeeAvailability> {
    try {
      // 1. Mitarbeiter-Daten abrufen
      const { data: employee } = await supabase
        .from('employees')
        .select('id, first_name, last_name, email')
        .eq('id', employeeId)
        .single();

      if (!employee) {
        throw new Error('Mitarbeiter nicht gefunden');
      }

      const employeeName = `${employee.first_name} ${employee.last_name}`;

      // 2. Aktuelle Projekte des Mitarbeiters abrufen
      const { data: currentAssignments } = await supabase
        .from('project_team_members')
        .select(`
          project_id,
          projects (
            id,
            name,
            start_date,
            end_date,
            status
          )
        `)
        .eq('employee_id', employeeId);

      const currentProjects = currentAssignments?.filter(
        a => a.projects && a.projects.status !== 'abgeschlossen'
      ) || [];

      // 3. Prüfe Projekt-Überschneidungen
      const conflicts: ProjectConflict[] = [];
      
      if (newProjectStartDate && newProjectEndDate) {
        for (const assignment of currentProjects) {
          const project = assignment.projects;
          if (project && project.start_date && project.end_date) {
            const overlap = this.calculateDateOverlap(
              newProjectStartDate,
              newProjectEndDate,
              project.start_date,
              project.end_date
            );

            if (overlap > 0) {
              conflicts.push({
                project_id: project.id,
                project_name: project.name,
                start_date: project.start_date,
                end_date: project.end_date,
                overlap_days: overlap,
                conflict_type: 'date_overlap'
              });
            }
          }
        }
      }

      // 4. Berechne wöchentliche Arbeitsstunden (letzte 7 Tage)
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);

      const { data: timeEntries } = await supabase
        .from('time_entries')
        .select('hours_worked')
        .eq('employee_id', employeeId)
        .gte('entry_date', weekAgo.toISOString());

      const weeklyHours = timeEntries?.reduce(
        (sum, entry) => sum + (entry.hours_worked || 0), 
        0
      ) || 0;

      // 5. Bestimme Verfügbarkeitsstatus
      let status: EmployeeAvailability['status'];
      let statusColor: EmployeeAvailability['statusColor'];
      let statusIcon: string;
      let canAssign = true;
      const recommendations: string[] = [];

      if (conflicts.length > 0) {
        status = 'blocked';
        statusColor = 'gray';
        statusIcon = '⚫';
        canAssign = false;
        
        // Finde das späteste Ende-Datum der Konflikte
        const latestEndDate = conflicts.reduce((latest, conflict) => {
          const conflictEnd = new Date(conflict.end_date);
          return conflictEnd > latest ? conflictEnd : latest;
        }, new Date(0));
        
        const formattedDate = latestEndDate.toLocaleDateString('de-DE', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        });
        
        recommendations.push(
          `Nicht verfügbar bis ${formattedDate}`
        );
      } else if (currentProjects.length >= this.MAX_CONCURRENT_PROJECTS) {
        status = 'overloaded';
        statusColor = 'red';
        statusIcon = '🔴';
        canAssign = false;
        recommendations.push(
          `Mitarbeiter arbeitet bereits an ${currentProjects.length} Projekten`
        );
      } else if (weeklyHours >= this.MAX_HOURS_PER_WEEK) {
        status = 'overloaded';
        statusColor = 'red';
        statusIcon = '🔴';
        canAssign = false;
        recommendations.push(
          `Mitarbeiter hat bereits ${weeklyHours}h diese Woche gearbeitet`
        );
      } else if (
        weeklyHours >= this.WARNING_HOURS_PER_WEEK ||
        currentProjects.length >= 2
      ) {
        status = 'busy';
        statusColor = 'yellow';
        statusIcon = '🟡';
        canAssign = true;
        recommendations.push(
          'Mitarbeiter ist ausgelastet, Zuweisung aber möglich'
        );
      } else {
        status = 'available';
        statusColor = 'green';
        statusIcon = '🟢';
        canAssign = true;
        recommendations.push('Mitarbeiter ist verfügbar');
      }

      return {
        employee_id: employeeId,
        employee_name: employeeName,
        status,
        statusColor,
        statusIcon,
        current_projects: currentProjects.length,
        weekly_hours: weeklyHours,
        conflicts,
        recommendations,
        canAssign
      };
    } catch (error) {
      console.error('Error checking employee availability:', error);
      throw error;
    }
  }

  /**
   * Prüft die Verfügbarkeit aller Mitarbeiter für ein Projekt
   */
  async checkMultipleAvailabilities(
    employeeIds: string[],
    projectId: string,
    projectStartDate?: string,
    projectEndDate?: string
  ): Promise<EmployeeAvailability[]> {
    const availabilities = await Promise.all(
      employeeIds.map(id =>
        this.checkAvailability(id, projectId, projectStartDate, projectEndDate)
      )
    );
    
    // Sortiere nach Verfügbarkeit (verfügbar zuerst)
    return availabilities.sort((a, b) => {
      const statusOrder = { available: 0, busy: 1, overloaded: 2, blocked: 3 };
      return statusOrder[a.status] - statusOrder[b.status];
    });
  }

  /**
   * Berechnet die Überschneidung zweier Zeiträume in Tagen
   */
  private calculateDateOverlap(
    start1: string,
    end1: string,
    start2: string,
    end2: string
  ): number {
    const s1 = new Date(start1).getTime();
    const e1 = new Date(end1).getTime();
    const s2 = new Date(start2).getTime();
    const e2 = new Date(end2).getTime();

    // Keine Überschneidung
    if (e1 < s2 || e2 < s1) {
      return 0;
    }

    // Berechne Überschneidung
    const overlapStart = Math.max(s1, s2);
    const overlapEnd = Math.min(e1, e2);
    const overlapMs = overlapEnd - overlapStart;
    
    // Konvertiere zu Tagen (gerundet)
    return Math.ceil(overlapMs / (1000 * 60 * 60 * 24));
  }

  /**
   * Gibt eine Zusammenfassung der Team-Verfügbarkeit
   */
  async getTeamAvailabilitySummary(
    employeeIds: string[]
  ): Promise<{
    available: number;
    busy: number;
    overloaded: number;
    blocked: number;
    total: number;
  }> {
    const availabilities = await Promise.all(
      employeeIds.map(id => this.checkAvailability(id, '', undefined, undefined))
    );

    return {
      available: availabilities.filter(a => a.status === 'available').length,
      busy: availabilities.filter(a => a.status === 'busy').length,
      overloaded: availabilities.filter(a => a.status === 'overloaded').length,
      blocked: availabilities.filter(a => a.status === 'blocked').length,
      total: availabilities.length
    };
  }
}

// Singleton Instance
export const employeeAvailabilityService = new EmployeeAvailabilityService();