import type Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.27.0';
import type { SupabaseClient } from '../_shared/supabase.ts';
import { getFirstActiveEmployee } from '../_shared/employees.ts';

export const TOOL_SCHEMAS: Anthropic.Tool[] = [
  { name: 'get_calendar', description: 'Termine in Datumsbereich abrufen.', input_schema: { type: 'object', properties: { dateFrom: { type: 'string' }, dateTo: { type: 'string' } } } },
  { name: 'daily_briefing', description: 'Tagesübersicht heute oder morgen.', input_schema: { type: 'object', properties: { when: { type: 'string', enum: ['today', 'tomorrow'] } } } },
  { name: 'create_appointment', description: 'Neuen Termin im Kalender anlegen.', input_schema: { type: 'object', properties: { title: { type: 'string' }, date: { type: 'string' }, endDate: { type: 'string' }, startTime: { type: 'string' }, endTime: { type: 'string' }, location: { type: 'string' }, description: { type: 'string' }, type: { type: 'string', enum: ['appointment', 'meeting', 'site_visit', 'other'] } }, required: ['title', 'date'] } },
  { name: 'request_approval', description: 'Freigabe anfragen.', input_schema: { type: 'object', properties: { taskId: { type: 'string' }, action: { type: 'string' }, preview: { type: 'object' } }, required: ['taskId', 'action', 'preview'] } },
];

export async function executeTool(name: string, input: Record<string, unknown>, supabase: SupabaseClient, taskId: string, companyId: string): Promise<unknown> {
  switch (name) {
    case 'get_calendar': return await getCalendar(supabase, companyId, input);
    case 'daily_briefing': return await dailyBriefing(supabase, companyId, input);
    case 'create_appointment': return await createAppointment(supabase, companyId, taskId, input);
    case 'request_approval': return await requestApproval(supabase, taskId, input);
    default: return { error: `Unbekanntes Tool: ${name}` };
  }
}

const EVENT_COLUMNS = 'id, title, description, start_date, end_date, start_time, end_time, is_full_day, location, type';

function isoDateOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

async function getCalendar(supabase: SupabaseClient, companyId: string, input: Record<string, unknown>) {
  const dateFrom = typeof input.dateFrom === 'string' ? input.dateFrom : isoDateOffset(0);
  const dateTo = typeof input.dateTo === 'string' ? input.dateTo : isoDateOffset(14);
  // deno-lint-ignore no-explicit-any
  const q: any = supabase.from('calendar_events').select(EVENT_COLUMNS).eq('company_id', companyId).gte('start_date', dateFrom).lte('start_date', dateTo).order('start_date', { ascending: true }).limit(100);
  const { data, error } = await q;
  if (error) return { error: error.message };
  return { dateFrom, dateTo, events: data ?? [] };
}

async function dailyBriefing(supabase: SupabaseClient, companyId: string, input: Record<string, unknown>) {
  const when = input.when === 'tomorrow' ? 'tomorrow' : 'today';
  const targetDate = isoDateOffset(when === 'tomorrow' ? 1 : 0);
  // deno-lint-ignore no-explicit-any
  const q: any = supabase.from('calendar_events').select(EVENT_COLUMNS).eq('company_id', companyId).eq('start_date', targetDate).order('start_time', { ascending: true }).limit(50);
  const { data, error } = await q;
  if (error) return { error: error.message };
  return { when, date: targetDate, eventCount: (data ?? []).length, events: data ?? [] };
}

async function createAppointment(supabase: SupabaseClient, companyId: string, _taskId: string, input: Record<string, unknown>) {
  const title = String(input.title ?? '');
  const date = String(input.date ?? '');
  if (!title || !date) return { error: 'title und date sind erforderlich' };
  const startTime = typeof input.startTime === 'string' ? input.startTime : null;
  const isFullDay = !startTime;
  const employee = await getFirstActiveEmployee(supabase, companyId);
  const assignedEmployees = employee ? [employee.id] : null;
  const { data, error } = await supabase.from('calendar_events').insert({
    company_id: companyId, title,
    description: typeof input.description === 'string' ? input.description : null,
    start_date: date, end_date: typeof input.endDate === 'string' ? input.endDate : date,
    start_time: startTime, end_time: typeof input.endTime === 'string' ? input.endTime : null,
    is_full_day: isFullDay, location: typeof input.location === 'string' ? input.location : null,
    type: typeof input.type === 'string' ? input.type : 'appointment',
    assigned_employees: assignedEmployees, created_by: employee?.user_id ?? null,
  }).select('id').single();
  if (error || !data) return { error: `create_appointment failed: ${error?.message ?? 'no row'}` };
  return {
    eventId: data.id, title, date, startTime,
    assignedEmployee: employee ? `${employee.first_name ?? ''} ${employee.last_name ?? ''}`.trim() || 'unbenannt' : null,
  };
}

async function requestApproval(supabase: SupabaseClient, taskId: string, input: Record<string, unknown>) {
  const { error } = await supabase.from('agent_tasks').update({ status: 'awaiting_approval', output: { action: input.action, preview: input.preview } }).eq('id', taskId);
  if (error) return { error: error.message };
  return { success: true, message: 'Freigabe angefragt' };
}
