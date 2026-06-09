import { describe, expect, it } from 'vitest';
import { calculateUtilization, getEmployeeDayAssignments } from './capacityUtils';
import { PROJECT_SHIFT_EVENT_TYPE } from './shiftUtils';
import type { CalendarEvent, PlannerProject } from '../types';

const holidays = new Map<string, string>();

describe('capacityUtils', () => {
  it('does not treat team membership without assignment dates as a calendar booking', () => {
    const projects: PlannerProject[] = [
      {
        id: 'project-1',
        name: 'Dachsanierung',
        status: 'beauftragt',
        start_date: '2026-06-08',
        end_date: '2026-06-12',
        location: null,
        work_start_date: null,
        work_end_date: null,
        project_team_assignments: [
          { employee_id: 'emp-1', is_active: true, start_date: null, end_date: null, role: 'team_member' },
        ],
      },
    ];

    expect(getEmployeeDayAssignments(projects, 'emp-1', new Date('2026-06-08'))).toEqual([]);
  });

  it('calculates utilization from planned shift minutes', () => {
    const shifts: CalendarEvent[] = [
      {
        id: 'shift-1',
        title: 'Dachsanierung',
        description: 'planner_shift_break_minutes=0',
        start_date: '2026-06-08',
        end_date: '2026-06-08',
        start_time: '08:00',
        end_time: '12:00',
        type: PROJECT_SHIFT_EVENT_TYPE,
        project_id: 'project-1',
        assigned_employees: ['emp-1'],
      },
    ];

    expect(calculateUtilization([], [], 'emp-1', [new Date('2026-06-08')], holidays, shifts)).toBe(50);
  });
});
