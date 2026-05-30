import { assertEquals, assertExists } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { executeTool, TOOL_SCHEMAS } from './tools.ts';

// Records every Supabase call so tests can assert what the tool sent
function createFakeSupabase(opts?: {
  invoiceLookups?: Array<{ data: unknown; error: unknown }>;
  openInvoicesResult?: { data: unknown; error: unknown };
}) {
  const calls: Array<{ table: string; op: string; args: unknown }> = [];
  const invoiceQueue = [...(opts?.invoiceLookups ?? [
    {
      data: {
        id: 'inv-1',
        invoice_number: '2026-0042',
        customer_id: 'cust-1',
        status: 'sent',
        gross_amount: 1190,
        net_amount: 1000,
        due_date: '2026-04-15',
        reminder_level: 0,
      },
      error: null,
    },
  ])];
  const openInvoicesResult = opts?.openInvoicesResult ?? {
    data: [
      {
        id: 'inv-1',
        invoice_number: '2026-0042',
        snapshot_customer_name: 'Schmidt',
        gross_amount: 1190,
        due_date: '2026-04-15',
        reminder_level: 0,
        status: 'sent',
      },
    ],
    error: null,
  };
  return {
    calls,
    from(table: string) {
      return {
        select(_cols?: string) {
          const eqCall = (col: string, val: unknown) => {
            calls.push({ table, op: 'select_eq', args: { col, val } });
            return chainAfterEq;
          };
          const ilikeCall = (_col: string, val: string) => {
            calls.push({ table, op: 'select_ilike', args: val });
            return chainAfterFilter;
          };
          const inCall = (_col: string, vals: unknown[]) => {
            calls.push({ table, op: 'select_in', args: vals });
            return chainAfterFilter;
          };
          const ltCall = (_col: string, val: unknown) => {
            calls.push({ table, op: 'select_lt', args: val });
            return chainAfterFilter;
          };
          const orderCall = () => chainAfterFilter;
          const limitCall = () => chainAfterFilter;
          const chainAfterFilter = {
            eq: eqCall,
            ilike: ilikeCall,
            in: inCall,
            lt: ltCall,
            order: orderCall,
            limit: limitCall,
            single: () => Promise.resolve(invoiceQueue.shift() ?? { data: null, error: null }),
            maybeSingle: () => Promise.resolve(invoiceQueue.shift() ?? { data: null, error: null }),
            then: (resolve: (r: { data: unknown; error: unknown }) => void) => resolve(openInvoicesResult),
          };
          const chainAfterEq = chainAfterFilter;
          return {
            eq: eqCall,
            ilike: ilikeCall,
            in: inCall,
            lt: ltCall,
            order: orderCall,
            limit: limitCall,
            then: (resolve: (r: { data: unknown; error: unknown }) => void) => resolve(openInvoicesResult),
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

Deno.test('TOOL_SCHEMAS exposes all five tools', () => {
  const names = TOOL_SCHEMAS.map((t) => t.name);
  assertEquals(
    names.sort(),
    ['get_invoice', 'get_open_invoices', 'mark_paid', 'request_approval', 'send_reminder'],
  );
});

Deno.test('executeTool: get_open_invoices filters by company_id', async () => {
  const fake = createFakeSupabase();
  // deno-lint-ignore no-explicit-any
  const result = await executeTool('get_open_invoices', {}, fake as any, 'task-1', 'comp-1');
  // Must filter by company_id (multi-tenant isolation)
  const eqCalls = fake.calls.filter((c) => c.op === 'select_eq');
  // deno-lint-ignore no-explicit-any
  assertEquals((eqCalls[0]?.args as any).col, 'company_id');
  // deno-lint-ignore no-explicit-any
  assertEquals((eqCalls[0]?.args as any).val, 'comp-1');
  assertExists(result);
});

Deno.test('executeTool: get_open_invoices applies overdue filter when requested', async () => {
  const fake = createFakeSupabase();
  // deno-lint-ignore no-explicit-any
  await executeTool('get_open_invoices', { overdueOnly: true }, fake as any, 'task-1', 'comp-1');
  const ltCalls = fake.calls.filter((c) => c.op === 'select_lt');
  assertEquals(ltCalls.length, 1);
});

Deno.test('executeTool: get_invoice queries by invoice_number with company filter', async () => {
  const fake = createFakeSupabase();
  // deno-lint-ignore no-explicit-any
  const result = await executeTool('get_invoice', { invoiceNumber: '2026-0042' }, fake as any, 'task-1', 'comp-1');
  const eqCalls = fake.calls.filter((c) => c.op === 'select_eq');
  // deno-lint-ignore no-explicit-any
  const cols = eqCalls.map((c) => (c.args as any).col);
  // Must filter by both company_id and invoice_number
  assertEquals(cols.includes('company_id'), true);
  assertEquals(cols.includes('invoice_number'), true);
  // deno-lint-ignore no-explicit-any
  assertEquals((result as any).id, 'inv-1');
});

Deno.test('executeTool: send_reminder increments reminder_level and sets timestamp', async () => {
  const fake = createFakeSupabase();
  // deno-lint-ignore no-explicit-any
  const result = await executeTool('send_reminder', { invoiceId: 'inv-1' }, fake as any, 'task-1', 'comp-1');
  const updates = fake.calls.filter((c) => c.op === 'update');
  assertEquals(updates.length, 1);
  assertEquals(updates[0].table, 'invoices');
  // deno-lint-ignore no-explicit-any
  const updateArgs = updates[0].args as any;
  assertEquals(updateArgs.reminder_level, 1);
  assertExists(updateArgs.last_reminder_sent_at);
  assertEquals(updateArgs.reminder_count, 1);
  // deno-lint-ignore no-explicit-any
  assertEquals((result as any).success, true);
});

Deno.test('executeTool: send_reminder respects explicit level', async () => {
  const fake = createFakeSupabase();
  // deno-lint-ignore no-explicit-any
  await executeTool('send_reminder', { invoiceId: 'inv-1', level: 3 }, fake as any, 'task-1', 'comp-1');
  const updates = fake.calls.filter((c) => c.op === 'update');
  // deno-lint-ignore no-explicit-any
  assertEquals((updates[0].args as any).reminder_level, 3);
});

Deno.test('executeTool: mark_paid sets status=paid', async () => {
  const fake = createFakeSupabase();
  // deno-lint-ignore no-explicit-any
  const result = await executeTool('mark_paid', { invoiceId: 'inv-1' }, fake as any, 'task-1', 'comp-1');
  const updates = fake.calls.filter((c) => c.op === 'update');
  assertEquals(updates.length, 1);
  assertEquals(updates[0].table, 'invoices');
  // deno-lint-ignore no-explicit-any
  assertEquals((updates[0].args as any).status, 'paid');
  // deno-lint-ignore no-explicit-any
  assertEquals((result as any).success, true);
});

Deno.test('executeTool: request_approval updates agent_tasks status', async () => {
  const fake = createFakeSupabase();
  // deno-lint-ignore no-explicit-any
  const result = await executeTool(
    'request_approval',
    { taskId: 'task-1', action: 'send_reminder', preview: { customer: 'Schmidt' } },
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
