import { format, addDays } from 'date-fns';
import type { PlannerProject, PlannerEmployee, VacationRequest, CalendarEvent, Assignment } from '../types';
import {
  DEFAULT_WORKDAY_MINUTES,
  getProjectShiftEventsForDay,
  getProjectShiftMinutesForDay,
} from './shiftUtils';

export function getEmployeeDayAssignments(
  projects: PlannerProject[],
  employeeId: string,
  day: Date,
): { project: PlannerProject; assignment: Assignment }[] {
  const dow = day.getDay();
  if (dow === 0 || dow === 6) return [];

  const dayStr = format(day, 'yyyy-MM-dd');
  const result: { project: PlannerProject; assignment: Assignment }[] = [];

  for (const project of projects) {
    const assignments = project.project_team_assignments?.filter(
      (a) => a.employee_id === employeeId && a.is_active,
    ) || [];

    for (const assignment of assignments) {
      const sDate = assignment.start_date;
      const eDate = assignment.end_date;
      if (!sDate) continue;
      if (sDate && dayStr < sDate) continue;
      if (eDate && dayStr > eDate) continue;
      result.push({ project, assignment });
    }
  }
  return result;
}

export function getAbsence(
  vacations: VacationRequest[],
  employeeId: string,
  day: Date,
): 'vacation' | 'sick' | null {
  const dayStr = format(day, 'yyyy-MM-dd');
  const match = vacations.find(
    (v) => v.employee_id === employeeId && dayStr >= v.start_date && dayStr <= v.end_date,
  );
  if (!match) return null;
  return match.absence_type === 'sick' ? 'sick' : 'vacation';
}

export function calculateUtilization(
  projects: PlannerProject[],
  vacations: VacationRequest[],
  employeeId: string,
  displayDays: Date[],
  holidays: Map<string, string>,
  calendarEvents: CalendarEvent[] = [],
  defaultWorkdayMinutes = DEFAULT_WORKDAY_MINUTES,
): number {
  let availableMinutes = 0;
  let plannedMinutes = 0;
  for (const day of displayDays) {
    if (day.getDay() === 0 || day.getDay() === 6) continue;
    const ds = format(day, 'yyyy-MM-dd');
    if (holidays.has(ds)) continue;
    if (getAbsence(vacations, employeeId, day)) continue;

    availableMinutes += defaultWorkdayMinutes;

    const shiftMinutes = getProjectShiftMinutesForDay(calendarEvents, employeeId, day);
    if (shiftMinutes > 0) {
      plannedMinutes += shiftMinutes;
      continue;
    }

    if (getEmployeeDayAssignments(projects, employeeId, day).length > 0) {
      plannedMinutes += defaultWorkdayMinutes;
    }
  }
  return availableMinutes > 0 ? Math.round((plannedMinutes / availableMinutes) * 100) : 0;
}

export function getAvailableEmployees(
  employees: PlannerEmployee[],
  projects: PlannerProject[],
  vacations: VacationRequest[],
  startDate: string,
  endDate: string,
  holidays: Map<string, string>,
  calendarEvents: CalendarEvent[] = [],
): { employee: PlannerEmployee; availablePercent: number; currentProject: string | null }[] {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const results: { employee: PlannerEmployee; availablePercent: number; currentProject: string | null }[] = [];

  for (const emp of employees) {
    let availableMinutes = 0;
    let freeMinutes = 0;
    let currentProject: string | null = null;

    let current = new Date(start);
    while (current <= end) {
      if (current.getDay() !== 0 && current.getDay() !== 6) {
        const ds = format(current, 'yyyy-MM-dd');
        if (!holidays.has(ds)) {
          const assignments = getEmployeeDayAssignments(projects, emp.id, current);
          const absence = getAbsence(vacations, emp.id, current);
          if (!absence) {
            availableMinutes += DEFAULT_WORKDAY_MINUTES;
            const shifts = getProjectShiftEventsForDay(calendarEvents, emp.id, current);
            const shiftMinutes = getProjectShiftMinutesForDay(calendarEvents, emp.id, current);
            const plannedMinutes = shiftMinutes > 0
              ? shiftMinutes
              : assignments.length > 0
                ? DEFAULT_WORKDAY_MINUTES
                : 0;
            freeMinutes += Math.max(0, DEFAULT_WORKDAY_MINUTES - plannedMinutes);
            if (shifts.length > 0 && !currentProject) {
              currentProject = shifts[0].title;
            } else if (assignments.length > 0 && !currentProject) {
              currentProject = assignments[0].project.name;
            }
          }
        }
      }
      current = addDays(current, 1);
    }

    results.push({
      employee: emp,
      availablePercent: availableMinutes > 0 ? Math.round((freeMinutes / availableMinutes) * 100) : 100,
      currentProject,
    });
  }

  return results.sort((a, b) => b.availablePercent - a.availablePercent);
}

export function getCalendarEventsForDay(
  calendarEvents: CalendarEvent[],
  employeeId: string,
  day: Date,
): CalendarEvent[] {
  const ds = format(day, 'yyyy-MM-dd');
  return calendarEvents.filter(ev => {
    if (ds < ev.start_date || ds > ev.end_date) return false;
    return ev.assigned_employees?.includes(employeeId) ?? false;
  });
}

export function getEmployeeConflictsForRange(
  projects: PlannerProject[],
  vacations: VacationRequest[],
  employeeId: string,
  startDate: string,
  endDate: string,
): string[] {
  const conflicts: string[] = [];
  let current = new Date(startDate);
  const end = new Date(endDate);
  while (current <= end) {
    if (current.getDay() !== 0 && current.getDay() !== 6) {
      const assignments = getEmployeeDayAssignments(projects, employeeId, current);
      const absence = getAbsence(vacations, employeeId, current);
      if (assignments.length > 0) {
        conflicts.push(`${format(current, 'dd.MM.')}: ${assignments.map(a => a.project.name).join(', ')}`);
      }
      if (absence) {
        conflicts.push(`${format(current, 'dd.MM.')}: ${absence === 'sick' ? 'Krank' : 'Urlaub'}`);
      }
    }
    current = addDays(current, 1);
  }
  return conflicts;
}
