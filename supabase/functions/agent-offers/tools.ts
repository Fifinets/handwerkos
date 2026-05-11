import type Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.27.0';
import type { SupabaseClient } from '../_shared/supabase.ts';
import { getFirstActiveEmployee } from '../_shared/employees.ts';

export const TOOL_SCHEMAS: Anthropic.Tool[] = [
  {
    name: 'get_customer',
    description: 'Kundendaten aus der Datenbank abrufen. Sucht in company_name und contact_person.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Name oder Teil des Namens (Firma oder Ansprechpartner)' },
      },
      required: ['name'],
    },
  },
  {
    name: 'get_wuerth_prices',
    description: 'Aktuelle Materialpreise von Würth abrufen (aktuell Mock).',
    input_schema: {
      type: 'object',
      properties: {
        items: { type: 'array', items: { type: 'string' } },
      },
      required: ['items'],
    },
  },
  {
    name: 'create_offer',
    description: 'Angebot als Entwurf anlegen. Wird IMMER mit status=draft erstellt.',
    input_schema: {
      type: 'object',
      properties: {
        customerId: { type: 'string' },
        customerName: { type: 'string' },
        projectName: { type: 'string' },
        projectLocation: { type: 'string' },
        positionen: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              beschreibung: { type: 'string' },
              menge: { type: 'number' },
              einheit: { type: 'string' },
              einzelpreis: { type: 'number' },
              itemType: { type: 'string', enum: ['labor', 'material', 'lump_sum', 'other'] },
            },
            required: ['beschreibung', 'menge', 'einheit', 'einzelpreis'],
          },
        },
        gueltigBis: { type: 'string' },
      },
      required: ['customerId', 'customerName', 'projectName', 'positionen'],
    },
  },
  {
    name: 'request_approval',
    description: 'Freigabe beim Elektromeister anfragen.',
    input_schema: {
      type: 'object',
      properties: {
        taskId: { type: 'string' },
        offerId: { type: 'string' },
        preview: { type: 'object' },
      },
      required: ['taskId', 'offerId', 'preview'],
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
    case 'get_customer':
      return await getCustomer(supabase, companyId, String(input.name));
    case 'get_wuerth_prices':
      return getWuerthPrices(input.items as string[]);
    case 'create_offer':
      return await createOffer(supabase, companyId, taskId, input);
    case 'request_approval':
      return await requestApproval(supabase, taskId, input);
    default:
      return { error: `Unbekanntes Tool: ${name}` };
  }
}

async function getCustomer(supabase: SupabaseClient, companyId: string, name: string) {
  const customerColumns = 'id, company_name, contact_person, email, phone, address, city, postal_code';
  const primary = await supabase
    .from('customers')
    .select(customerColumns)
    .eq('company_id', companyId)
    .ilike('company_name', `%${name}%`)
    .limit(1)
    .maybeSingle();
  if (primary.data) return primary.data;

  const fallback = await supabase
    .from('customers')
    .select(customerColumns)
    .eq('company_id', companyId)
    .ilike('contact_person', `%${name}%`)
    .limit(1)
    .maybeSingle();
  if (fallback.data) return fallback.data;
  return {
    error: primary.error?.message ?? fallback.error?.message ?? `Kein Kunde gefunden für "${name}"`,
  };
}

function getWuerthPrices(items: string[]) {
  return items.map((item) => ({
    bezeichnung: item,
    preis: Math.round(Math.random() * 50 + 10),
    einheit: 'Stk',
  }));
}

const DEFAULT_VAT_RATE = 19.0;

async function createOffer(
  supabase: SupabaseClient,
  companyId: string,
  taskId: string,
  input: Record<string, unknown>,
) {
  type Position = {
    beschreibung: string;
    menge: number;
    einheit: string;
    einzelpreis: number;
    itemType?: 'labor' | 'material' | 'lump_sum' | 'other';
  };
  const positionen = (input.positionen as Position[]) ?? [];
  const gesamtNetto = positionen.reduce((sum, p) => sum + p.menge * p.einzelpreis, 0);
  const vatRate = DEFAULT_VAT_RATE;
  const offerNumber = `KI-${Date.now()}-${crypto.randomUUID().slice(0, 4)}`;

  const employee = await getFirstActiveEmployee(supabase, companyId);
  const createdByUserId = employee?.user_id ?? null;

  const { data: offer, error: offerErr } = await supabase
    .from('offers')
    .insert({
      company_id: companyId,
      offer_number: offerNumber,
      offer_date: new Date().toISOString().slice(0, 10),
      valid_until: input.gueltigBis ?? null,
      customer_id: input.customerId,
      customer_name: input.customerName,
      project_name: input.projectName,
      project_location: input.projectLocation ?? null,
      status: 'draft',
      created_by: createdByUserId,
      created_by_agent: true,
      agent_task_id: taskId,
      snapshot_subtotal_net: gesamtNetto,
      snapshot_net_total: gesamtNetto,
      snapshot_vat_rate: vatRate,
      snapshot_vat_amount: gesamtNetto * (vatRate / 100),
      snapshot_gross_total: gesamtNetto * (1 + vatRate / 100),
    })
    .select('id')
    .single();

  if (offerErr || !offer) {
    return { error: `create_offer failed: ${offerErr?.message ?? 'no row returned'}` };
  }

  for (let i = 0; i < positionen.length; i++) {
    const p = positionen[i];
    const { error: itemErr } = await supabase
      .from('offer_items')
      .insert({
        offer_id: offer.id,
        position_number: i + 1,
        description: p.beschreibung,
        quantity: p.menge,
        unit: p.einheit,
        unit_price_net: p.einzelpreis,
        vat_rate: vatRate,
        item_type: p.itemType ?? 'labor',
      })
      .select('id')
      .single();
    if (itemErr) {
      return { error: `offer_items insert failed at position ${i + 1}: ${itemErr.message}` };
    }
  }

  return {
    offerId: offer.id,
    offerNumber,
    gesamtNetto,
    gesamtBrutto: gesamtNetto * (1 + vatRate / 100),
    assignedEmployee: employee
      ? `${employee.first_name ?? ''} ${employee.last_name ?? ''}`.trim() || 'unbenannt'
      : null,
  };
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
      output: { offerId: input.offerId, preview: input.preview },
    })
    .eq('id', taskId);
  if (error) return { error: error.message };
  return { success: true, message: 'Freigabe angefragt' };
}
