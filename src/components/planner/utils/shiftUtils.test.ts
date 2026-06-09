import { describe, expect, it } from 'vitest';
import {
  buildProjectShiftEventRows,
  calculateShiftMinutes,
  formatMinutesAsHours,
  getProjectShiftMinutesForDay,
  getShiftConflictsForRange,
  PROJECT_SHIFT_EVENT_TYPE,
} from './shiftUtils';
import type { CalendarEvent } from '../types';

describe('shiftUtils', () => {
  it('calculates planned minutes from start, end and break time', () => {
    expect(calculateShiftMinutes('08:00', '17:00', 60)).toBe(480);
    expect(formatMinutesAsHours(450)).toBe('7h 30m');
  });

  it('creates one project shift event per weekday in a range', () => {
    const rows = buildProjectShiftEventRows({
      companyId: 'company-1',
      employeeId: 'emp-1',
      project: { id: 'project-1', name: 'Dachsanierung', location: 'Baustelle' },
      startDate: '2026-06-12',
      endDate: '2026-06-15',
      startTime: '08:00',
      endTime: '12:00',
      breakMinutes: 0,
    });

    expect(rows.map((row) => row.start_date)).toEqual(['2026-06-12', '2026-06-15']);
    expect(rows[0]).toMatchObject({
      assigned_employees: ['emp-1'],
      project_id: 'project-1',
      type: PROJECT_SHIFT_EVENT_TYPE,
      start_time: '08:00',
      end_time: '12:00',
    });
  });

  it('sums shift minutes per employee and day', () => {
    const events: CalendarEvent[] = [
      {
        id: 'shift-1',
        title: 'Dachsanierung',
        description: 'planner_shift_break_minutes=30',
        start_date: '2026-06-08',
        end_date: '2026-06-08',
        start_time: '08:00',
        end_time: '12:30',
        type: PROJECT_SHIFT_EVENT_TYPE,
        project_id: 'project-1',
        assigned_employees: ['emp-1'],
      },
    ];

    expect(getProjectShiftMinutesForDay(events, 'emp-1', new Date('2026-06-08'))).toBe(240);
  });

  it('reports overlapping project shifts as conflicts', () => {
    const events: CalendarEvent[] = [
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

    expect(getShiftConflictsForRange(events, 'emp-1', '2026-06-08', '2026-06-08', '11:00', '14:00')).toEqual([
      '08.06.: 08:00-12:00 Dachsanierung',
    ]);
    expect(getShiftConflictsForRange(events, 'emp-1', '2026-06-08', '2026-06-08', '12:00', '14:00')).toEqual([]);
  });
});
