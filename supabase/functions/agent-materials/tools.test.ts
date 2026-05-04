import { assertEquals, assertExists } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { executeTool, TOOL_SCHEMAS } from './tools.ts';

function createFakeSupabase(opts?: {
  materialsResult?: { data: unknown; error: unknown };
  suppliersResult?: { data: unknown; error: unknown };
}) {
  const calls: Array<{ table: string; op: string; args: unknown }> = [];
  const materialsResult = opts?.materialsResult ?? {
    data: [
      { id: 'mat-1', name: 'NYM 3x1.5', current_stock: 50, min_stock: 100, unit: 'm', unit_price: 0.85, supplier: 'Würth' },
      { id: 'mat-2', name: 'Steckdose Schuko', current_stock: 200, min_stock: 50, unit: 'Stk', unit_price: 4.5, supplier: 'Sonepar' },
    ],
    error: null,
  };
  const suppliersResult = opts?.suppliersResult ?? {
    data: [
      { id: 'sup-1', name: 'Würth', contact_person: 'Hr. Klein', email: 'klein@wuerth.de', is_active: true },
    ],
    error: null,
  };
  return {
    calls,
    from(table: string) {
      const result = table === 'suppliers' ? suppliersResult : materialsResult;
      return {
        select(_cols?: string) {
          const eqCall = (col: string, val: unknown) => {
            calls.push({ table, op: 'select_eq', args: { col, val } });
            return chainAfterFilter;
          };
          const ilikeCall = (_col: string, val: string) => {
            calls.push({ table, op: 'select_ilike', args: val });
            return chainAfterFilter;
          };
          const ltCall = (col: string, val: unknown) => {
            calls.push({ table, op: 'select_lt', args: { col, val } });
            return chainAfterFilter;
          };
          const orderCall = () => chainAfterFilter;
          const limitCall = () => chainAfterFilter;
          const chainAfterFilter = {
            eq: eqCall,
            ilike: ilikeCall,
            lt: ltCall,
            order: orderCall,
            limit: limitCall,
            then: (resolve: (r: { data: unknown; error: unknown }) => void) => resolve(result),
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

Deno.test('TOOL_SCHEMAS exposes all five tools', () => {
  const names = TOOL_SCHEMAS.map((t) => t.name);
  assertEquals(
    names.sort(),
    ['check_stock', 'create_material_order', 'get_low_stock', 'get_suppliers', 'request_approval'],
  );
});

Deno.test('executeTool: check_stock filters by company_id and ilike', async () => {
  const fake = createFakeSupabase();
  // deno-lint-ignore no-explicit-any
  const result = await executeTool('check_stock', { itemName: 'NYM' }, fake as any, 'task-1', 'comp-1');
  const eqCalls = fake.calls.filter((c) => c.op === 'select_eq');
  // deno-lint-ignore no-explicit-any
  assertEquals((eqCalls[0]?.args as any).col, 'company_id');
  // deno-lint-ignore no-explicit-any
  assertEquals((eqCalls[0]?.args as any).val, 'comp-1');
  assertEquals(fake.calls.filter((c) => c.op === 'select_ilike').length, 1);
  // deno-lint-ignore no-explicit-any
  assertExists((result as any).materials);
});

Deno.test('executeTool: get_low_stock filters where current_stock < min_stock (no extra args needed)', async () => {
  const fake = createFakeSupabase();
  // deno-lint-ignore no-explicit-any
  const result = await executeTool('get_low_stock', {}, fake as any, 'task-1', 'comp-1');
  const eqCalls = fake.calls.filter((c) => c.op === 'select_eq');
  // deno-lint-ignore no-explicit-any
  assertEquals((eqCalls[0]?.args as any).col, 'company_id');
  // deno-lint-ignore no-explicit-any
  assertExists((result as any).materials);
});

Deno.test('executeTool: get_suppliers returns active suppliers for the company', async () => {
  const fake = createFakeSupabase();
  // deno-lint-ignore no-explicit-any
  const result = await executeTool('get_suppliers', {}, fake as any, 'task-1', 'comp-1');
  const eqCalls = fake.calls.filter((c) => c.op === 'select_eq');
  // deno-lint-ignore no-explicit-any
  const cols = eqCalls.map((c) => (c.args as any).col);
  assertEquals(cols.includes('company_id'), true);
  assertEquals(cols.includes('is_active'), true);
  // deno-lint-ignore no-explicit-any
  assertExists((result as any).suppliers);
});

Deno.test('executeTool: create_material_order inserts order header + items', async () => {
  const fake = createFakeSupabase();
  // deno-lint-ignore no-explicit-any
  const result = await executeTool(
    'create_material_order',
    {
      supplierId: 'sup-1',
      items: [
        { materialId: 'mat-1', quantity: 100, unitPrice: 0.85 },
        { materialId: 'mat-2', quantity: 50, unitPrice: 4.5 },
      ],
      expectedDelivery: '2026-05-15',
    },
    fake as any,
    'task-1',
    'comp-1',
  );
  const inserts = fake.calls.filter((c) => c.op === 'insert');
  // 1 order + 2 items = 3 inserts
  assertEquals(inserts.length, 3);
  assertEquals(inserts[0].table, 'material_orders');
  assertEquals(inserts[1].table, 'material_order_items');
  assertEquals(inserts[2].table, 'material_order_items');
  // deno-lint-ignore no-explicit-any
  const orderArgs = inserts[0].args as any;
  assertEquals(orderArgs.company_id, 'comp-1');
  assertEquals(orderArgs.supplier_id, 'sup-1');
  assertEquals(orderArgs.expected_delivery_date, '2026-05-15');
  // deno-lint-ignore no-explicit-any
  const r = result as any;
  assertEquals(r.orderId, 'material_orders-new-id');
  assertEquals(r.totalAmount, 100 * 0.85 + 50 * 4.5);
});

Deno.test('executeTool: request_approval updates agent_tasks status', async () => {
  const fake = createFakeSupabase();
  // deno-lint-ignore no-explicit-any
  const result = await executeTool(
    'request_approval',
    { taskId: 'task-1', action: 'create_material_order', preview: { items: 2, total: 310 } },
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
