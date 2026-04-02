import { useMemo } from 'react';
import { format } from 'date-fns';
import type { PlannerEmployee, PlannerProject, VacationRequest } from '../types';
import { getEmployeeDayAssignments, getAbsence } from '../utils/capacityUtils';

export function useConflicts(
  employees: PlannerEmployee[],
  projects: PlannerProject[],
  vacations: VacationRequest[],
  displayDays: Date[],
) {
  const conflicts = useMemo(() => {
    const result = new Map<string, Set<string>>();
    for (const emp of employees) {
      const empConflicts = new Set<string>();
      for (const day of displayDays) {
        const ds = format(day, 'yyyy-MM-dd');
        const assignments = getEmployeeDayAssignments(projects, emp.id, day);
        const absence = getAbsence(vacations, emp.id, day);
        if (assignments.length > 1 || (assignments.length > 0 && absence)) {
          empConflicts.add(ds);
        }
      }
      if (empConflicts.size > 0) result.set(emp.id, empConflicts);
    }
    return result;
  }, [employees, projects, vacations, displayDays]);

  const totalCount = useMemo(() => {
    let c = 0;
    conflicts.forEach(dates => c += dates.size);
    return c;
  }, [conflicts]);

  return { conflicts, totalCount };
}
