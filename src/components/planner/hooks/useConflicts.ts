import { useMemo } from 'react';
import { format } from 'date-fns';
import type { CalendarEvent, PlannerEmployee, PlannerProject, VacationRequest } from '../types';
import { getEmployeeDayAssignments, getAbsence } from '../utils/capacityUtils';
import { getProjectShiftEventsForDay, hasOverlappingProjectShifts } from '../utils/shiftUtils';

export function useConflicts(
  employees: PlannerEmployee[],
  projects: PlannerProject[],
  vacations: VacationRequest[],
  displayDays: Date[],
  calendarEvents: CalendarEvent[] = [],
) {
  const conflicts = useMemo(() => {
    const result = new Map<string, Set<string>>();
    for (const emp of employees) {
      const empConflicts = new Set<string>();
      for (const day of displayDays) {
        const ds = format(day, 'yyyy-MM-dd');
        const assignments = getEmployeeDayAssignments(projects, emp.id, day);
        const shifts = getProjectShiftEventsForDay(calendarEvents, emp.id, day);
        const absence = getAbsence(vacations, emp.id, day);
        const shiftProjectIds = new Set(shifts.map((shift) => shift.project_id).filter(Boolean));
        const legacyAssignments = assignments.filter(({ project }) => !shiftProjectIds.has(project.id));
        if (
          legacyAssignments.length > 1 ||
          hasOverlappingProjectShifts(shifts) ||
          ((legacyAssignments.length > 0 || shifts.length > 0) && absence) ||
          (legacyAssignments.length > 0 && shifts.length > 0)
        ) {
          empConflicts.add(ds);
        }
      }
      if (empConflicts.size > 0) result.set(emp.id, empConflicts);
    }
    return result;
  }, [employees, projects, vacations, displayDays, calendarEvents]);

  const totalCount = useMemo(() => {
    let c = 0;
    conflicts.forEach(dates => c += dates.size);
    return c;
  }, [conflicts]);

  return { conflicts, totalCount };
}
