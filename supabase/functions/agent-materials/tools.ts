import type Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.27.0';
import type { SupabaseClient } from '../_shared/supabase.ts';

export const TOOL_SCHEMAS: Anthropic.Tool[] = [
  {
    name: 'check_stock',
    description: 'Materialien nach Name suchen und aktuellen Lagerbestand abrufen.',
    input_schema: {
      type: 'object',
      properties: {
        itemName: { type: 'string', description: 'Name oder Teil-Name des Materials' },
      },
    },
  },
  {
    name: 'get_low_stock',
    description: 'Alle Materialien anzeigen die unter Mindestbestand sind (current_stock < min_stock).',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_suppliers',
    description: 'Aktive Lieferanten der Firma auflisten.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'create_material_order',
    description: 'Bestellung bei Lieferant anlegen. Erzeugt material_orders + N material_order_items.',
    input_schema: {
      type: 'object',
      properties: {
        supplierId: { type: 'string' },
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              materialId: { type: 'string' },
              quantity: { type: 'number' },
              unitPrice: { type: 'number', description: 'Optional, sonst aus materials.unit_price' },
            },
            required: ['materialId', 'quantity'],
          },
        },
        expectedDelivery: { type: 'string', description: 'ISO-Datum, optional' },
        notes: { type: 'string' },
      },
      required: ['supplierId', 'items'],
    },
  },
  {
    name: 'request_approval',
    description: 'Freigabe beim Elektromeister anfragen. Pflicht bei create_material_order.',
    input_schema: {
      type: 'object',
      properties: {
        taskId: { type: 'string' },
        action: { type: 'string' },
        preview: { type: 'object' },
      },
      required: ['taskId', 'action', 'preview'],
    },
  },
];

export async function executeTool(
  name: string,
  input: Record<string, unknown>,
  supabase: SupabaseClient,
  taskId: string,
  companyId: string,
): Promise<unknown> {
  switch (name) {
    case 'check_stock':
      return await checkStock(supabase, companyId, input);
    case 'get_low_stock':
      return await getLowStock(supabase, companyId);
    case 'get_suppliers':
      return await getSuppliers(supabase, companyId);
    case 'create_material_order':
      return await createMaterialOrder(supabase, companyId, input);
    case 'request_approval':
      return await requestApproval(supabase, taskId, input);
    default:
      return { error: `Unbekanntes Tool: ${name}` };
  }
}

const MATERIAL_COLUMNS =
  'id, name, description, category, unit, current_stock, min_stock, unit_price, supplier, supplier_id, sku, storage_location';

async function checkStock(
  supabase: SupabaseClient,
  companyId: string,
  input: Record<string, unknown>,
) {
  const itemName = typeof input.itemName === 'string' ? input.itemName : undefined;

  // deno-lint-ignore no-explicit-any
  let q: any = supabase
    .from('materials')
    .select(MATERIAL_COLUMNS)
    .eq('company_id', companyId)
    .eq('is_active', true);
  if (itemName) {
    q = q.ilike('name', `%${itemName}%`);
  }
  q = q.order('name', { ascending: true }).limit(50);

  const { data, error } = await q;
  if (error) return { error: error.message };
  return { materials: data ?? [] };
}

async function getLowStock(supabase: SupabaseClient, companyId: string) {
  // Postgrest can't compare two columns directly; use a Postgres RPC ideally.
  // For MVP: fetch all active and filter in code.
  // deno-lint-ignore no-explicit-any
  const q: any = supabase
    .from('materials')
    .select(MATERIAL_COLUMNS)
    .eq('company_id', companyId)
    .eq('is_active', true)
    .order('name', { ascending: true })
    .limit(200);

  const { data, error } = await q;
  if (error) return { error: error.message };
  // deno-lint-ignore no-explicit-any
  const lowStock = (data ?? []).filter((m: any) =>
    typeof m.current_stock === 'number' &&
    typeof m.min_stock === 'number' &&
    m.current_stock < m.min_stock
  );
  return { materials: lowStock };
}

async function getSuppliers(supabase: SupabaseClient, companyId: string) {
  // deno-lint-ignore no-explicit-any
  const q: any = supabase
    .from('suppliers')
    .select('id, name, contact_person, email, phone, payment_terms')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .order('name', { ascending: true })
    .limit(50);

  const { data, error } = await q;
  if (error) return { error: error.message };
  return { suppliers: data ?? [] };
}

async function createMaterialOrder(
  supabase: SupabaseClient,
  companyId: string,
  input: Record<string, unknown>,
) {
  type Item = { materialId: string; quantity: number; unitPrice?: number };
  const supplierId = typeof input.supplierId === 'string' ? input.supplierId : null;
  const items = (input.items as Item[]) ?? [];
  if (!supplierId || items.length === 0) {
    return { error: 'supplierId und items sind erforderlich' };
  }

  const totalAmount = items.reduce(
    (sum, it) => sum + it.quantity * (it.unitPrice ?? 0),
    0,
  );
  const orderNumber = `KI-MAT-${Date.now()}-${crypto.randomUUID().slice(0, 4)}`;

  const { data: order, error: orderErr } = await supabase
    .from('material_orders')
    .insert({
      company_id: companyId,
      order_number: orderNumber,
      supplier_id: supplierId,
      order_date: new Date().toISOString().slice(0, 10),
      expected_delivery_date: typeof input.expectedDelivery === 'string'
        ? input.expectedDelivery
        : null,
      status: 'draft',
      total_amount: totalAmount,
      notes: typeof input.notes === 'string' ? input.notes : null,
    })
    .select('id')
    .single();

  if (orderErr || !order) {
    return { error: `create_material_order failed: ${orderErr?.message ?? 'no row returned'}` };
  }

  // Order Items
  for (const it of items) {
    const total = it.quantity * (it.unitPrice ?? 0);
    const { error: itemErr } = await supabase
      .from('material_order_items')
      .insert({
        order_id: order.id,
        material_id: it.materialId,
        quantity_ordered: it.quantity,
        unit_price: it.unitPrice ?? null,
        total_price: total,
      })
      .select('id')
      .single();
    if (itemErr) {
      return { error: `material_order_items insert failed: ${itemErr.message}` };
    }
  }

  return { orderId: order.id, orderNumber, totalAmount, itemCount: items.length };
}

async function requestApproval(
  supabase: SupabaseClient,
  taskId: string,
  input: Record<string, unknown>,
) {
  const { error } = await supabase
    .from('agent_tasks')
    .update({
      status: 'awaiting_approval',
      output: { action: input.action, preview: input.preview },
    })
    .eq('id', taskId);
  if (error) return { error: error.message };
  return { success: true, message: 'Freigabe angefragt' };
}
