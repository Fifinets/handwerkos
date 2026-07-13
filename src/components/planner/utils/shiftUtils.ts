import { addDays, format } from 'date-fns';
import type { CalendarEvent, PlannerProject } from '../types';

export const PROJECT_SHIFT_EVENT_TYPE = 'project_shift';
export const DEFAULT_SHIFT_START = '08:00';
export const DEFAULT_SHIFT_END = '17:00';
export const DEFAULT_SHIFT_BREAK_MINUTES = 60;
export const DEFAULT_WORKDAY_MINUTES = 8 * 60;

const BREAK_TOKEN = 'planner_shift_break_minutes=';

export function normalizeTime(value: string | null | undefined): string {
  return (value || '').slice(0, 5);
}

export function timeToMinutes(value: string | null | undefined): number | null {
  const time = normalizeTime(value);
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

export function calculateShiftMinutes(
  startTime: string | null | undefined,
  endTime: string | null | undefined,
  breakMinutes = 0,
): number {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  if (start === null || end === null || end <= start) return 0;
  return Math.max(0, end - start - Math.max(0, breakMinutes || 0));
}

export function formatMinutesAsHours(minutes: number): string {
  const safeMinutes = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safeMinutes / 60);
  const rest = safeMinutes % 60;
  if (rest === 0) return `${hours}h`;
  if (hours === 0) return `${rest}m`;
  return `${hours}h ${rest}m`;
}

export function createShiftDescription(breakMinutes: number): string {
  return `${BREAK_TOKEN}${Math.max(0, Math.round(breakMinutes || 0))}`;
}

export function getShiftBreakMinutes(event: CalendarEvent): number {
  const description = event.description || '';
  const match = description.match(/planner_shift_break_minutes=(\d+)/);
  return match ? Number(match[1]) : 0;
}

export function isProjectShiftEvent(event: CalendarEvent): boolean {
  return event.type === PROJECT_SHIFT_EVENT_TYPE;
}

export function eventIncludesEmployee(event: CalendarEvent, employeeId: string): boolean {
  return event.assigned_employees?.includes(employeeId) ?? false;
}

export function getWorkDates(startDate: string, endDate?: string | null): string[] {
  if (!startDate) return [];
  const start = new Date(startDate);
  const end = new Date(endDate || startDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return [];

  const dates: string[] = [];
  for (let day = start; day <= end; day = addDays(day, 1)) {
    const dow = day.getDay();
    if (dow === 0 || dow === 6) continue;
    dates.push(format(day, 'yyyy-MM-dd'));
  }
  return dates;
}

export function getProjectShiftEventsForDay(
  calendarEvents: CalendarEvent[],
  employeeId: string,
  day: Date,
): CalendarEvent[] {
  const dayStr = format(day, 'yyyy-MM-dd');
  return calendarEvents.filter((event) => (
    isProjectShiftEvent(event) &&
    eventIncludesEmployee(event, employeeId) &&
    dayStr >= event.start_date &&
    dayStr <= event.end_date
  ));
}

export function getNonShiftCalendarEventsForDay(
  calendarEvents: CalendarEvent[],
  employeeId: string,
  day: Date,
): CalendarEvent[] {
  const dayStr = format(day, 'yyyy-MM-dd');
  return calendarEvents.filter((event) => (
    !isProjectShiftEvent(event) &&
    eventIncludesEmployee(event, employeeId) &&
    dayStr >= event.start_date &&
    dayStr <= event.end_date
  ));
}

export function getProjectShiftMinutesForDay(
  calendarEvents: CalendarEvent[],
  employeeId: string,
  day: Date,
): number {
  return getProjectShiftEventsForDay(calendarEvents, employeeId, day).reduce((sum, event) => (
    sum + calculateShiftMinutes(event.start_time, event.end_time, getShiftBreakMinutes(event))
  ), 0);
}

export function timeRangesOverlap(
  startA: string | null | undefined,
  endA: string | null | undefined,
  startB: string | null | undefined,
  endB: string | null | undefined,
): boolean {
  const aStart = timeToMinutes(startA);
  const aEnd = timeToMinutes(endA);
  const bStart = timeToMinutes(startB);
  const bEnd = timeToMinutes(endB);
  if (aStart === null || aEnd === null || bStart === null || bEnd === null) return false;
  return aStart < bEnd && bStart < aEnd;
}

export function hasOverlappingProjectShifts(events: CalendarEvent[]): boolean {
  const shifts = events
    .filter(isProjectShiftEvent)
    .slice()
    .sort((a, b) => normalizeTime(a.start_time).localeCompare(normalizeTime(b.start_time)));

  for (let i = 1; i < shifts.length; i++) {
    if (timeRangesOverlap(shifts[i - 1].start_time, shifts[i - 1].end_time, shifts[i].start_time, shifts[i].end_time)) {
      return true;
    }
  }
  return false;
}

export function getShiftConflictsForRange(
  calendarEvents: CalendarEvent[],
  employeeId: string,
  startDate: string,
  endDate: string | null | undefined,
  startTime: string,
  endTime: string,
  ignoreProjectId?: string,
): string[] {
  const conflicts: string[] = [];
  for (const workDate of getWorkDates(startDate, endDate)) {
    const day = new Date(workDate);
    const overlapping = getProjectShiftEventsForDay(calendarEvents, employeeId, day)
      .filter((event) => event.project_id !== ignoreProjectId)
      .filter((event) => timeRangesOverlap(startTime, endTime, event.start_time, event.end_time));

    overlapping.forEach((event) => {
      conflicts.push(`${format(day, 'dd.MM.')}: ${normalizeTime(event.start_time)}-${normalizeTime(event.end_time)} ${event.title}`);
    });
  }
  return conflicts;
}

export function buildProjectShiftEventRows({
  companyId,
  employeeId,
  project,
  startDate,
  endDate,
  startTime,
  endTime,
  breakMinutes,
}: {
  companyId: string;
  employeeId: string;
  project: Pick<PlannerProject, 'id' | 'name' | 'location'>;
  startDate: string;
  endDate?: string | null;
  startTime: string;
  endTime: string;
  breakMinutes: number;
}) {
  return getWorkDates(startDate, endDate).map((workDate) => ({
    company_id: companyId,
    project_id: project.id,
    assigned_employees: [employeeId],
    title: project.name,
    location: project.location,
    start_date: workDate,
    end_date: workDate,
    start_time: normalizeTime(startTime),
    end_time: normalizeTime(endTime),
    is_full_day: false,
    type: PROJECT_SHIFT_EVENT_TYPE,
    description: createShiftDescription(breakMinutes),
  }));
}
