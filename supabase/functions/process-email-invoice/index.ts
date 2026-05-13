// supabase/functions/process-email-invoice/index.ts
//
// Wrapper for inbound invoice emails. Invoked by agent-router when an
// email is classified as 'Rechnung'. Loads the first PDF/image attachment,
// converts to base64, delegates extraction to process-invoice-ocr, then
// does deterministic supplier+material_order matching. Writes the suggestion
// to agent_tasks.output for human review.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface InvokeBody {
  taskId: string;
  action: string;
  payload: {
    emailId: string;
    category?: string;
    extractedData?: Record<string, unknown>;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) {
    return jsonResponse({ error: 'missing authorization' }, 401);
  }
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!serviceRoleKey || auth.substring(7) !== serviceRoleKey) {
    return jsonResponse({ error: 'service-role required' }, 403);
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    serviceRoleKey,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  let taskId = '';
  let emailId = '';
  try {
    const body = (await req.json()) as InvokeBody;
    if (typeof body.taskId !== 'string' || body.taskId.length === 0) {
      return jsonResponse({ error: 'taskId required' }, 400);
    }
    taskId = body.taskId;
    const payloadEmailId = body.payload?.emailId;
    if (typeof payloadEmailId !== 'string' || payloadEmailId.length === 0) {
      throw new Error('payload.emailId required');
    }
    emailId = payloadEmailId;

    const result = await processInboundInvoice(supabase, emailId);
    await markCompleted(supabase, taskId, result, emailId);
    return jsonResponse({ ok: true, taskId }, 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown';
    console.error('process-email-invoice error:', message);
    // emailId may be unset if the error happened before parsing — fall back to
    // recovering it from the task input inside markFailed.
    if (taskId) await markFailed(supabase, taskId, message, emailId || undefined);
    return jsonResponse({ ok: false, error: message }, 500);
  }
});

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function markCompleted(
  supabase: SupabaseClient,
  taskId: string,
  preview: Record<string, unknown>,
  emailId: string,
) {
  await supabase.from('agent_tasks').update({
    status: 'awaiting_approval',
    output: { action: 'process_inbound_invoice_email', preview },
  }).eq('id', taskId);
  await supabase.from('emails').update({
    processing_status: 'awaiting_approval',
  }).eq('id', emailId);
}

async function markFailed(
  supabase: SupabaseClient,
  taskId: string,
  error: string,
  emailId?: string,
) {
  await supabase.from('agent_tasks').update({ status: 'failed', error }).eq('id', taskId);

  // Bump emails.processing_status. Use the caller-provided emailId when available;
  // otherwise recover it from the task input (covers errors thrown before parsing).
  let resolvedEmailId = emailId;
  if (!resolvedEmailId) {
    const { data: task } = await supabase
      .from('agent_tasks').select('input').eq('id', taskId).maybeSingle();
    const recovered = (task?.input as Record<string, unknown> | null)?.emailId;
    if (typeof recovered === 'string') resolvedEmailId = recovered;
  }
  if (resolvedEmailId) {
    await supabase.from('emails').update({
      processing_status: 'needs_review',
    }).eq('id', resolvedEmailId);
  }
}

async function processInboundInvoice(supabase: SupabaseClient, emailId: string) {
  // 1. Load first PDF/image attachment for this email.
  const { data: attachments, error: attError } = await supabase
    .from('email_attachments')
    .select('*')
    .eq('email_id', emailId)
    .order('created_at', { ascending: true });

  if (attError) throw new Error(`load attachments failed: ${attError.message}`);

  const eligible = (attachments ?? []).find((a) => {
    const ct = (a.content_type as string | undefined) ?? '';
    return ct === 'application/pdf' || ct.startsWith('image/');
  });

  if (!eligible) {
    throw new Error('Rechnung ohne Anhang — kein PDF oder Bild gefunden');
  }

  // 2. Get attachment binary as base64.
  const base64Image = await loadAttachmentBase64(eligible);

  // 3. Delegate OCR.
  const { data: ocrData, error: ocrErr } = await supabase.functions.invoke(
    'process-invoice-ocr',
    { body: { base64Image } },
  );
  if (ocrErr) throw new Error(`OCR failed: ${ocrErr.message}`);
  if (!ocrData || typeof ocrData !== 'object') throw new Error('OCR returned no data');
  if ((ocrData as Record<string, unknown>).error) {
    throw new Error(`OCR error: ${(ocrData as Record<string, unknown>).error}`);
  }

  // 4. Supplier matching (best-effort, deterministic).
  const supplierMatch = await matchSupplier(supabase, ocrData as Record<string, unknown>);

  // 5. Material-order matching (best-effort, requires supplier match).
  const orderMatch = supplierMatch.id
    ? await matchMaterialOrder(supabase, supplierMatch.id, ocrData as Record<string, unknown>)
    : { id: null, confidence: 0 };

  return {
    ocr_data: ocrData,
    supplier_match: supplierMatch,
    order_match: orderMatch,
    suggested_action: 'create_supplier_invoice',
  };
}

async function loadAttachmentBase64(
  attachment: Record<string, unknown>,
): Promise<string> {
  // email_attachments schema: file_url (text). Treat as fetchable URL.
  const url = attachment.file_url as string | undefined;
  if (!url || url.length === 0) {
    throw new Error('email_attachment.file_url is empty — cannot load attachment');
  }
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`fetch attachment URL failed: ${resp.status} ${resp.statusText}`);
  }
  const buffer = await resp.arrayBuffer();
  return base64FromArrayBuffer(buffer);
}

function base64FromArrayBuffer(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

interface MatchResult { id: string | null; confidence: number; }

async function matchSupplier(
  supabase: SupabaseClient,
  ocrData: Record<string, unknown>,
): Promise<MatchResult> {
  // OCR returns supplierName, supplierTaxNumber (Steuernummer), supplierVatId (USt-IdNr).
  // suppliers schema has only `tax_number`. Try both VAT-ID and Steuernummer against it.
  const name = typeof ocrData.supplierName === 'string' ? ocrData.supplierName : null;
  const vatId = typeof ocrData.supplierVatId === 'string' ? ocrData.supplierVatId : null;
  const taxNumber = typeof ocrData.supplierTaxNumber === 'string' ? ocrData.supplierTaxNumber : null;

  for (const candidate of [vatId, taxNumber]) {
    if (!candidate) continue;
    const { data } = await supabase
      .from('suppliers').select('id').eq('tax_number', candidate).maybeSingle();
    if (data?.id) return { id: data.id, confidence: 0.99 };
  }
  if (name) {
    // Escape pgsql ilike wildcards so e.g. "100% Strom GmbH" doesn't match every
    // supplier whose name starts with "100".
    const safeName = name.replace(/[\\%_]/g, '\\$&');
    const { data } = await supabase
      .from('suppliers').select('id').ilike('name', `%${safeName}%`).maybeSingle();
    if (data?.id) return { id: data.id, confidence: 0.75 };
  }
  return { id: null, confidence: 0 };
}

async function matchMaterialOrder(
  supabase: SupabaseClient,
  supplierId: string,
  ocrData: Record<string, unknown>,
): Promise<MatchResult> {
  // First, try exact match by order_number if the OCR found one.
  const orderNumber = typeof ocrData.orderNumber === 'string' ? ocrData.orderNumber : null;
  if (orderNumber) {
    const { data } = await supabase
      .from('material_orders')
      .select('id')
      .eq('supplier_id', supplierId)
      .eq('order_number', orderNumber)
      .maybeSingle();
    if (data?.id) return { id: data.id, confidence: 0.95 };
  }

  // Fallback: amount within 5% tolerance band.
  const total = typeof ocrData.totalAmount === 'number' ? ocrData.totalAmount : null;
  if (total === null) return { id: null, confidence: 0 };
  const min = total * 0.95;
  const max = total * 1.05;
  const { data } = await supabase
    .from('material_orders')
    .select('id, total_amount')
    .eq('supplier_id', supplierId)
    .gte('total_amount', min)
    .lte('total_amount', max)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (data?.id) return { id: data.id, confidence: 0.8 };
  return { id: null, confidence: 0 };
}
