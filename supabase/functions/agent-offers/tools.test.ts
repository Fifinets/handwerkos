import { assertEquals, assertExists } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { executeTool, TOOL_SCHEMAS } from './tools.ts';

// Minimaler Fake-Client der alle Methoden chainable supported und pro Tabelle
// einen festen "single result" zurückliefert. Kompositionen die wir testen:
//   .from(t).select().eq()...?.ilike()?.order?.limit?.maybeSingle()
//   .from(t).insert(args).select().single()
//   .from(t).update(args).eq() => Promise<{error: null}>
type LookupResult = { data: unknown; error: unknown };

function createFakeSupabase(opts?: {
  // Customer-Queries (primary + fallback) pro Aufruf
  customerLookups?: LookupResult[];
  // Employees-Query (getFirstActiveEmployee) — default: ein Mitarbeiter
  employeeLookup?: LookupResult;
}) {
  const calls: Array<{ table: string; op: string; args: unknown }> = [];
  const customerQueue = [...(opts?.customerLookups ?? [
    { data: { id: 'cust-1', company_name: 'Müller GmbH', email: 'm@m.de' }, error: null },
  ])];
  const employeeResult = opts?.employeeLookup ?? {
    data: { id: 'emp-1', user_id: 'usr-1', first_name: 'Hans', last_name: 'Schmidt' },
    error: null,
  };

  return {
    calls,
    from(table: string) {
      return {
        select(_cols?: string) {
          const chain = {
            eq: (col: string, val: unknown) => {
              calls.push({ table, op: 'select_eq', args: { col, val } });
              return chain;
            },
            ilike: (_col: string, val: string) => {
              calls.push({ table, op: 'select_ilike', args: val });
              return chain;
            },
            order: () => chain,
            limit: () => chain,
            single: () => Promise.resolve(
              table === 'employees' ? employeeResult : customerQueue.shift() ?? { data: null, error: null },
            ),
            maybeSingle: () => Promise.resolve(
              table === 'employees' ? employeeResult : customerQueue.shift() ?? { data: null, error: null },
            ),
          };
          return chain;
        },
        insert(args: unknown) {
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
        update(args: unknown) {
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
  assertEquals(names.sort(), ['create_offer', 'get_customer', 'get_wuerth_prices', 'request_approval']);
});

Deno.test('executeTool: get_customer queries customers and returns row', async () => {
  const fake = createFakeSupabase();
  // deno-lint-ignore no-explicit-any
  const result = await executeTool('get_customer', { name: 'Müller' }, fake as any, 'task-1', 'comp-1');
  // deno-lint-ignore no-explicit-any
  assertEquals((result as any).id, 'cust-1');
  // Erste Operation muss ein eq('company_id', ...) sein — sonst wäre der
  // Multi-Tenant-Filter nicht aktiv (Cross-Tenant-Leak via service_role).
  assertEquals(fake.calls[0].table, 'customers');
  assertEquals(fake.calls[0].op, 'select_eq');
  // deno-lint-ignore no-explicit-any
  assertEquals((fake.calls[0].args as any).col, 'company_id');
  // deno-lint-ignore no-explicit-any
  assertEquals((fake.calls[0].args as any).val, 'comp-1');
  assertEquals(fake.calls[1].op, 'select_ilike');
});

Deno.test('executeTool: get_customer falls back to contact_person when company_name misses', async () => {
  const fake = createFakeSupabase({
    customerLookups: [
      { data: null, error: null }, // primary (company_name) miss
      { data: { id: 'cust-2', contact_person: 'Hans Schmidt' }, error: null }, // fallback hit
    ],
  });
  // deno-lint-ignore no-explicit-any
  const result = await executeTool('get_customer', { name: 'Schmidt' }, fake as any, 'task-1', 'comp-1');
  // deno-lint-ignore no-explicit-any
  assertEquals((result as any).id, 'cust-2');
  // Beide Queries hatten company_id Filter:
  const eqCalls = fake.calls.filter((c) => c.op === 'select_eq');
  assertEquals(eqCalls.length, 2);
});

Deno.test('executeTool: get_customer returns error when both queries miss', async () => {
  const fake = createFakeSupabase({
    customerLookups: [
      { data: null, error: null },
      { data: null, error: null },
    ],
  });
  // deno-lint-ignore no-explicit-any
  const result = await executeTool('get_customer', { name: 'Nobody' }, fake as any, 'task-1', 'comp-1');
  // deno-lint-ignore no-explicit-any
  assertExists((result as any).error);
});

Deno.test('executeTool: get_wuerth_prices returns mock prices for each item', async () => {
  const fake = createFakeSupabase();
  // deno-lint-ignore no-explicit-any
  const result = await executeTool(
    'get_wuerth_prices',
    { items: ['NYM 3x1.5', 'Steckdose'] },
    fake as any,
    'task-1',
    'comp-1',
  );
  // deno-lint-ignore no-explicit-any
  const prices = result as any[];
  assertEquals(prices.length, 2);
  assertExists(prices[0].preis);
  assertEquals(prices[0].einheit, 'Stk');
});

Deno.test('executeTool: create_offer inserts into offers and offer_items', async () => {
  const fake = createFakeSupabase();
  // deno-lint-ignore no-explicit-any
  const result = await executeTool(
    'create_offer',
    {
      customerId: 'cust-1',
      customerName: 'Müller GmbH',
      projectName: 'Zählertausch',
      positionen: [
        { beschreibung: 'Zählertausch', menge: 1, einheit: 'Pauschal', einzelpreis: 450 },
        { beschreibung: 'Steckdose', menge: 3, einheit: 'Stk', einzelpreis: 35 },
      ],
    },
    fake as any,
    'task-1',
    'comp-1',
  );
  // deno-lint-ignore no-explicit-any
  const r = result as any;
  assertEquals(r.offerId, 'offers-new-id');
  assertEquals(r.gesamtNetto, 450 + 3 * 35);
  // 1 offers insert + 2 offer_items inserts
  const inserts = fake.calls.filter((c) => c.op === 'insert');
  assertEquals(inserts.length, 3);
  assertEquals(inserts[0].table, 'offers');
  assertEquals(inserts[1].table, 'offer_items');
  assertEquals(inserts[2].table, 'offer_items');
  // Default-Mitarbeiter wurde zugewiesen (created_by = employee.user_id)
  // deno-lint-ignore no-explicit-any
  const offerInsert = inserts[0].args as any;
  assertEquals(offerInsert.created_by, 'usr-1');
  assertEquals(r.assignedEmployee, 'Hans Schmidt');
});

Deno.test('executeTool: create_offer when no active employee exists — created_by stays null', async () => {
  const fake = createFakeSupabase({
    employeeLookup: { data: null, error: null },
  });
  // deno-lint-ignore no-explicit-any
  const result = await executeTool(
    'create_offer',
    {
      customerId: 'cust-1',
      customerName: 'Müller GmbH',
      projectName: 'X',
      positionen: [{ beschreibung: 'X', menge: 1, einheit: 'Stk', einzelpreis: 10 }],
    },
    fake as any,
    'task-1',
    'comp-1',
  );
  const inserts = fake.calls.filter((c) => c.op === 'insert');
  // deno-lint-ignore no-explicit-any
  const offerInsert = inserts[0].args as any;
  assertEquals(offerInsert.created_by, null);
  // deno-lint-ignore no-explicit-any
  assertEquals((result as any).assignedEmployee, null);
});

Deno.test('executeTool: request_approval updates agent_tasks status', async () => {
  const fake = createFakeSupabase();
  // deno-lint-ignore no-explicit-any
  const result = await executeTool(
    'request_approval',
    {
      taskId: 'task-1',
      offerId: 'offers-new-id',
      preview: { customer: 'Müller GmbH', total: 555 },
    },
    fake as any,
    'task-1',
    'comp-1',
  );
  // deno-lint-ignore no-explicit-any
  assertEquals((result as any).success, true);
  const updates = fake.calls.filter((c) => c.op === 'update');
  assertEquals(updates.length, 1);
  assertEquals(updates[0].table, 'agent_tasks');
});

Deno.test('executeTool: unknown tool returns error object', async () => {
  const fake = createFakeSupabase();
  // deno-lint-ignore no-explicit-any
  const result = await executeTool('does_not_exist', {}, fake as any, 'task-1', 'comp-1');
  // deno-lint-ignore no-explicit-any
  assertExists((result as any).error);
});
