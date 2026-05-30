import { assertEquals, assertExists } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { executeTool, TOOL_SCHEMAS } from './tools.ts';

function createFakeSupabase(opts?: {
  eventsResult?: { data: unknown; error: unknown };
  employeeLookup?: { data: unknown; error: unknown };
}) {
  const calls: Array<{ table: string; op: string; args: unknown }> = [];
  const eventsResult = opts?.eventsResult ?? {
    data: [
      {
        id: 'ev-1',
        title: 'Müller Zählertausch',
        start_date: '2026-05-02',
        start_time: '09:00:00',
        end_time: '11:00:00',
        location: 'Hauptstr. 12',
        type: 'appointment',
      },
    ],
    error: null,
  };
  const employeeResult = opts?.employeeLookup ?? {
    data: { id: 'emp-1', user_id: 'usr-1', first_name: 'Hans', last_name: 'Schmidt' },
    error: null,
  };
  return {
    calls,
    from(table: string) {
      return {
        select(_cols?: string) {
          const eqCall = (col: string, val: unknown) => {
            calls.push({ table, op: 'select_eq', args: { col, val } });
            return chainAfterFilter;
          };
          const gteCall = (_col: string, val: unknown) => {
            calls.push({ table, op: 'select_gte', args: val });
            return chainAfterFilter;
          };
          const lteCall = (_col: string, val: unknown) => {
            calls.push({ table, op: 'select_lte', args: val });
            return chainAfterFilter;
          };
          const orderCall = () => chainAfterFilter;
          const limitCall = () => chainAfterFilter;
          const chainAfterFilter = {
            eq: eqCall,
            gte: gteCall,
            lte: lteCall,
            order: orderCall,
            limit: limitCall,
            single: () => Promise.resolve(table === 'employees' ? employeeResult : { data: null, error: null }),
            maybeSingle: () => Promise.resolve(table === 'employees' ? employeeResult : { data: null, error: null }),
            then: (resolve: (r: { data: unknown; error: unknown }) => void) => resolve(eventsResult),
          };
          return chainAfterFilter;
        },
        insert(args: Record<string, unknown>) {
          calls.push({ table, op: 'insert', args });
          return {
            select() {
              return {
                single: () => Promise.resolve({
                  data: { id: `${table}-new-id` },
                  error: null,
                }),
              };
            },
          };
        },
        update(args: Record<string, unknown>) {
          calls.push({ table, op: 'update', args });
          return {
            eq: () => Promise.resolve({ error: null }),
          };
        },
      };
    },
  };
}

Deno.test('TOOL_SCHEMAS exposes all four tools', () => {
  const names = TOOL_SCHEMAS.map((t) => t.name);
  assertEquals(
    names.sort(),
    ['create_appointment', 'daily_briefing', 'get_calendar', 'request_approval'],
  );
});

Deno.test('executeTool: get_calendar filters by company_id', async () => {
  const fake = createFakeSupabase();
  // deno-lint-ignore no-explicit-any
  const result = await executeTool('get_calendar', {}, fake as any, 'task-1', 'comp-1');
  const eqCalls = fake.calls.filter((c) => c.op === 'select_eq');
  // deno-lint-ignore no-explicit-any
  assertEquals((eqCalls[0]?.args as any).col, 'company_id');
  // deno-lint-ignore no-explicit-any
  assertEquals((eqCalls[0]?.args as any).val, 'comp-1');
  // deno-lint-ignore no-explicit-any
  assertExists((result as any).events);
});

Deno.test('executeTool: get_calendar applies date range when provided', async () => {
  const fake = createFakeSupabase();
  // deno-lint-ignore no-explicit-any
  await executeTool(
    'get_calendar',
    { dateFrom: '2026-05-01', dateTo: '2026-05-31' },
    fake as any,
    'task-1',
    'comp-1',
  );
  assertEquals(fake.calls.filter((c) => c.op === 'select_gte').length, 1);
  assertEquals(fake.calls.filter((c) => c.op === 'select_lte').length, 1);
});

Deno.test('executeTool: daily_briefing defaults to today', async () => {
  const fake = createFakeSupabase();
  // deno-lint-ignore no-explicit-any
  const result = await executeTool('daily_briefing', {}, fake as any, 'task-1', 'comp-1');
  // deno-lint-ignore no-explicit-any
  const r = result as any;
  assertExists(r.date);
  assertExists(r.events);
});

Deno.test('executeTool: daily_briefing accepts "tomorrow"', async () => {
  const fake = createFakeSupabase();
  // deno-lint-ignore no-explicit-any
  const result = await executeTool('daily_briefing', { when: 'tomorrow' }, fake as any, 'task-1', 'comp-1');
  // deno-lint-ignore no-explicit-any
  const r = result as any;
  // Date should be ahead of today by ~1 day — just check it returned something
  assertExists(r.date);
});

Deno.test('executeTool: create_appointment inserts into calendar_events with company_id and assigned_employees', async () => {
  const fake = createFakeSupabase();
  // deno-lint-ignore no-explicit-any
  const result = await executeTool(
    'create_appointment',
    {
      title: 'Termin Müller',
      date: '2026-05-15',
      startTime: '09:00',
      endTime: '11:00',
      location: 'Hauptstr. 12',
    },
    fake as any,
    'task-1',
    'comp-1',
  );
  const inserts = fake.calls.filter((c) => c.op === 'insert');
  assertEquals(inserts.length, 1);
  assertEquals(inserts[0].table, 'calendar_events');
  // deno-lint-ignore no-explicit-any
  const args = inserts[0].args as any;
  assertEquals(args.company_id, 'comp-1');
  assertEquals(args.title, 'Termin Müller');
  assertEquals(args.start_date, '2026-05-15');
  assertEquals(args.start_time, '09:00');
  // Default-Mitarbeiter wurde zugewiesen
  assertEquals(args.assigned_employees, ['emp-1']);
  assertEquals(args.created_by, 'usr-1');
  // deno-lint-ignore no-explicit-any
  const r = result as any;
  assertEquals(r.eventId, 'calendar_events-new-id');
  assertEquals(r.assignedEmployee, 'Hans Schmidt');
});

Deno.test('executeTool: create_appointment defaults to is_full_day=true when no time given', async () => {
  const fake = createFakeSupabase();
  // deno-lint-ignore no-explicit-any
  await executeTool(
    'create_appointment',
    { title: 'Ganztägig', date: '2026-05-15' },
    fake as any,
    'task-1',
    'comp-1',
  );
  const inserts = fake.calls.filter((c) => c.op === 'insert');
  // deno-lint-ignore no-explicit-any
  assertEquals((inserts[0].args as any).is_full_day, true);
});

Deno.test('executeTool: request_approval updates agent_tasks status', async () => {
  const fake = createFakeSupabase();
  // deno-lint-ignore no-explicit-any
  const result = await executeTool(
    'request_approval',
    { taskId: 'task-1', action: 'create_appointment', preview: { title: 'X', date: 'Y' } },
    fake as any,
    'task-1',
    'comp-1',
  );
  const updates = fake.calls.filter((c) => c.op === 'update');
  assertEquals(updates.length, 1);
  assertEquals(updates[0].table, 'agent_tasks');
  // deno-lint-ignore no-explicit-any
  assertEquals((result as any).success, true);
});

Deno.test('executeTool: unknown tool returns error', async () => {
  const fake = createFakeSupabase();
  // deno-lint-ignore no-explicit-any
  const result = await executeTool('does_not_exist', {}, fake as any, 'task-1', 'comp-1');
  // deno-lint-ignore no-explicit-any
  assertExists((result as any).error);
});
