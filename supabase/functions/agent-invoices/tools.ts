import type Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.27.0';
import type { SupabaseClient } from '../_shared/supabase.ts';

export const TOOL_SCHEMAS: Anthropic.Tool[] = [
  {
    name: 'get_open_invoices',
    description: 'Liste offener oder überfälliger Rechnungen abrufen. Optional nach Kunde filtern oder nur überfällige.',
    input_schema: {
      type: 'object',
      properties: {
        customerName: {
          type: 'string',
          description: 'Optional: Kundenname (sucht in snapshot_customer_name oder via customer_id+ilike)',
        },
        overdueOnly: {
          type: 'boolean',
          description: 'Wenn true: nur Rechnungen mit due_date < heute (Standard: false, alle offenen)',
        },
      },
    },
  },
  {
    name: 'get_invoice',
    description: 'Eine spezifische Rechnung anhand der Rechnungsnummer oder ID abrufen.',
    input_schema: {
      type: 'object',
      properties: {
        invoiceNumber: { type: 'string', description: 'Rechnungsnummer (z.B. "2026-0042")' },
        invoiceId: { type: 'string', description: 'Rechnungs-UUID (alternativ zu invoiceNumber)' },
      },
    },
  },
  {
    name: 'send_reminder',
    description: 'Mahnung für eine Rechnung vorbereiten. Erhöht reminder_level, setzt last_reminder_sent_at und reminder_count. WICHTIG: echter E-Mail-Versand erfolgt erst nach User-Freigabe (Phase 4) — aktuell wird nur die DB-Markierung gesetzt.',
    input_schema: {
      type: 'object',
      properties: {
        invoiceId: { type: 'string' },
        level: {
          type: 'integer',
          minimum: 1,
          maximum: 3,
          description: 'Mahnstufe 1/2/3. Standard: aktuelles reminder_level + 1.',
        },
      },
      required: ['invoiceId'],
    },
  },
  {
    name: 'mark_paid',
    description: 'Eine Rechnung als bezahlt markieren (status=paid).',
    input_schema: {
      type: 'object',
      properties: {
        invoiceId: { type: 'string' },
        paidAt: { type: 'string', description: 'ISO-Datum, optional. Standard: heute.' },
      },
      required: ['invoiceId'],
    },
  },
  {
    name: 'request_approval',
    description: 'Freigabe beim Elektromeister anfragen. Setzt agent_tasks.status auf awaiting_approval mit Preview. Pflicht bei Mutationen (send_reminder, mark_paid).',
    input_schema: {
      type: 'object',
      properties: {
        taskId: { type: 'string' },
        action: { type: 'string', description: 'z.B. "send_reminder", "mark_paid"' },
        preview: {
          type: 'object',
          description: 'Vorschau für den User: customer, invoiceNumber, amount, what-action, etc.',
        },
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
    case 'get_open_invoices':
      return await getOpenInvoices(supabase, companyId, input);
    case 'get_invoice':
      return await getInvoice(supabase, companyId, input);
    case 'send_reminder':
      return await sendReminder(supabase, companyId, input);
    case 'mark_paid':
      return await markPaid(supabase, companyId, input);
    case 'request_approval':
      return await requestApproval(supabase, taskId, input);
    default:
      return { error: `Unbekanntes Tool: ${name}` };
  }
}

const INVOICE_COLUMNS =
  'id, invoice_number, customer_id, snapshot_customer_name, status, gross_amount, net_amount, due_date, invoice_date, reminder_level, reminder_count, last_reminder_sent_at';

async function getOpenInvoices(
  supabase: SupabaseClient,
  companyId: string,
  input: Record<string, unknown>,
) {
  const customerName = typeof input.customerName === 'string' ? input.customerName : undefined;
  const overdueOnly = input.overdueOnly === true;

  // deno-lint-ignore no-explicit-any
  let q: any = supabase
    .from('invoices')
    .select(INVOICE_COLUMNS)
    .eq('company_id', companyId)
    .in('status', ['sent', 'overdue']);

  if (customerName) {
    q = q.ilike('snapshot_customer_name', `%${customerName}%`);
  }
  if (overdueOnly) {
    const today = new Date().toISOString().slice(0, 10);
    q = q.lt('due_date', today);
  }

  q = q.order('due_date', { ascending: true }).limit(50);

  const { data, error } = await q;
  if (error) return { error: error.message };
  return { invoices: data ?? [] };
}

async function getInvoice(
  supabase: SupabaseClient,
  companyId: string,
  input: Record<string, unknown>,
) {
  const invoiceNumber = typeof input.invoiceNumber === 'string' ? input.invoiceNumber : undefined;
  const invoiceId = typeof input.invoiceId === 'string' ? input.invoiceId : undefined;
  if (!invoiceNumber && !invoiceId) {
    return { error: 'invoiceNumber oder invoiceId erforderlich' };
  }

  // deno-lint-ignore no-explicit-any
  let q: any = supabase
    .from('invoices')
    .select(INVOICE_COLUMNS)
    .eq('company_id', companyId);

  if (invoiceId) {
    q = q.eq('id', invoiceId);
  } else if (invoiceNumber) {
    q = q.eq('invoice_number', invoiceNumber);
  }

  const { data, error } = await q.maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: 'Rechnung nicht gefunden' };
  return data;
}

async function sendReminder(
  supabase: SupabaseClient,
  companyId: string,
  input: Record<string, unknown>,
) {
  const invoiceId = String(input.invoiceId ?? '');
  if (!invoiceId) return { error: 'invoiceId erforderlich' };

  // deno-lint-ignore no-explicit-any
  const current: any = await supabase
    .from('invoices')
    .select('reminder_level, reminder_count')
    .eq('company_id', companyId)
    .eq('id', invoiceId)
    .maybeSingle();

  const explicitLevel = typeof input.level === 'number' ? input.level : undefined;
  const currentLevel = (current?.data?.reminder_level as number | undefined) ?? 0;
  const currentCount = (current?.data?.reminder_count as number | undefined) ?? 0;
  const newLevel = explicitLevel ?? Math.min(currentLevel + 1, 3);

  const { error } = await supabase
    .from('invoices')
    .update({
      reminder_level: newLevel,
      last_reminder_sent_at: new Date().toISOString(),
      reminder_count: currentCount + 1,
    })
    .eq('id', invoiceId);

  if (error) return { error: error.message };
  return {
    success: true,
    invoiceId,
    newLevel,
    note: 'Mahnstufe in DB markiert. Echter E-Mail-Versand kommt mit Phase 4 (agent-approve Edge Function).',
  };
}

async function markPaid(
  supabase: SupabaseClient,
  companyId: string,
  input: Record<string, unknown>,
) {
  const invoiceId = String(input.invoiceId ?? '');
  if (!invoiceId) return { error: 'invoiceId erforderlich' };
  const paidAt = typeof input.paidAt === 'string' ? input.paidAt : new Date().toISOString().slice(0, 10);

  const { error } = await supabase
    .from('invoices')
    .update({
      status: 'paid',
    })
    .eq('id', invoiceId);

  if (error) return { error: error.message };
  return { success: true, invoiceId, paidAt };
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
      output: {
        action: input.action,
        preview: input.preview,
      },
    })
    .eq('id', taskId);
  if (error) return { error: error.message };
  return { success: true, message: 'Freigabe angefragt' };
}
