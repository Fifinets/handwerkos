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
  {
    name: 'load_email_for_quote',
    description: 'Lädt eine eingehende Anfrage-E-Mail mit allen relevanten Feldern für die Angebots-Erstellung. Nutzt emailId aus dem Task-Input.',
    input_schema: {
      type: 'object',
      properties: { emailId: { type: 'string' } },
      required: ['emailId'],
    },
  },
  {
    name: 'find_similar_projects',
    description: 'Sucht ähnliche vergangene Angebote und Projekte via RAG (Vector-Similarity) basierend auf dem Email-Inhalt. WICHTIG: gibt source_quote_id / source_project_id pro Treffer zurück — diese MÜSSEN in der Position-Skizze zitiert werden.',
    input_schema: {
      type: 'object',
      properties: {
        queryText: { type: 'string', description: 'Der zu durchsuchende Text (typisch: Email-Content + Subject)' },
        limit: { type: 'integer', minimum: 1, maximum: 10, description: 'Max Anzahl Treffer (Standard: 5)' },
      },
      required: ['queryText'],
    },
  },
  {
    name: 'match_customer',
    description: 'Findet einen bestehenden Kunden anhand Email-Adresse oder Name.',
    input_schema: {
      type: 'object',
      properties: {
        senderEmail: { type: 'string' },
        senderName: { type: 'string' },
      },
      required: ['senderEmail'],
    },
  },
  {
    name: 'save_quote_draft',
    description: 'Speichert den finalen Antwort-Entwurf + Position-Skizze in agent_tasks.output und setzt status=awaiting_approval. Aufrufen nach allen anderen Schritten. NIEMALS Preise erfinden — nur Werte aus find_similar_projects-Resultaten übernehmen.',
    input_schema: {
      type: 'object',
      properties: {
        taskId: { type: 'string' },
        reply_draft: { type: 'string', description: 'Höflicher deutscher Antwort-Entwurf an den Kunden.' },
        positions_sketch: {
          type: 'array',
          description: 'Vorgeschlagene Positionen. JEDE muss eine source_quote_id oder source_project_id haben.',
          items: {
            type: 'object',
            properties: {
              description: { type: 'string' },
              suggested_qty: { type: 'number' },
              source_quote_id: { type: 'string' },
              source_project_id: { type: 'string' },
              source_price_note: { type: 'string', description: 'Z.B. "letztes Projekt: 45€/Stk"' },
            },
            required: ['description', 'suggested_qty'],
          },
        },
        customer_match: {
          type: 'object',
          properties: {
            customer_id: { type: 'string' },
            confidence: { type: 'number' },
          },
        },
        missing_info: {
          type: 'array',
          items: { type: 'string' },
          description: 'Offene Fragen die der Elektromeister selbst beantworten muss.',
        },
      },
      required: ['taskId', 'reply_draft', 'positions_sketch'],
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
    case 'load_email_for_quote':
      return await loadEmailForQuote(supabase, companyId, input);
    case 'find_similar_projects':
      return await findSimilarProjects(supabase, companyId, input);
    case 'match_customer':
      return await matchCustomer(supabase, companyId, input);
    case 'save_quote_draft':
      return await saveQuoteDraft(supabase, taskId, input);
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

async function loadEmailForQuote(
  supabase: SupabaseClient,
  companyId: string,
  input: Record<string, unknown>,
) {
  const emailId = String(input.emailId ?? '');
  if (!emailId) return { error: 'emailId required' };
  const { data, error } = await supabase
    .from('emails')
    .select('id, subject, sender_email, sender_name, content, ai_extracted_data, ai_summary')
    .eq('id', emailId)
    .eq('company_id', companyId)
    .maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: 'email not found or not in this company' };
  return data;
}

async function findSimilarProjects(
  supabase: SupabaseClient,
  companyId: string,
  input: Record<string, unknown>,
) {
  const queryText = String(input.queryText ?? '');
  const limit = typeof input.limit === 'number' ? input.limit : 5;
  if (!queryText) return { error: 'queryText required' };

  // Generate embedding for the query (same model as process-ai-queue).
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) return { error: 'OPENAI_API_KEY not configured' };

  const embResp = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: queryText.substring(0, 30000),
      dimensions: 1536,
    }),
  });
  if (!embResp.ok) return { error: `embedding API ${embResp.status}` };
  const embJson = await embResp.json();
  const queryEmbedding = embJson.data?.[0]?.embedding as number[] | undefined;
  if (!queryEmbedding) return { error: 'no embedding in response' };

  // Call the existing search_ai_index RPC (defined in migration 20250813120002).
  const { data, error } = await supabase.rpc('search_ai_index', {
    query_embedding: `[${queryEmbedding.join(',')}]`,
    ref_types: ['quotes', 'projects'],
    company_id_filter: companyId,
    limit_results: limit,
  });
  if (error) return { error: error.message };
  return { results: data ?? [] };
}

async function matchCustomer(
  supabase: SupabaseClient,
  companyId: string,
  input: Record<string, unknown>,
) {
  const email = typeof input.senderEmail === 'string' ? input.senderEmail : '';
  const name = typeof input.senderName === 'string' ? input.senderName : '';
  if (!email && !name) return { error: 'senderEmail or senderName required' };

  // Try email first (highest confidence).
  if (email) {
    const { data } = await supabase
      .from('customers')
      .select('id, company_name, contact_person, email')
      .eq('company_id', companyId)
      .eq('email', email)
      .maybeSingle();
    if (data?.id) {
      return {
        customer_id: data.id,
        name: data.company_name ?? data.contact_person ?? null,
        confidence: 0.95,
      };
    }
  }
  if (name) {
    // Escape pgsql ilike wildcards (%, _, and the escape char itself).
    const safeName = name.replace(/[\\%_]/g, '\\$&');
    // Try company_name first, then contact_person.
    const byCompany = await supabase
      .from('customers')
      .select('id, company_name, contact_person, email')
      .eq('company_id', companyId)
      .ilike('company_name', `%${safeName}%`)
      .limit(1)
      .maybeSingle();
    if (byCompany.data?.id) {
      return {
        customer_id: byCompany.data.id,
        name: byCompany.data.company_name ?? byCompany.data.contact_person ?? null,
        confidence: 0.6,
      };
    }
    const byContact = await supabase
      .from('customers')
      .select('id, company_name, contact_person, email')
      .eq('company_id', companyId)
      .ilike('contact_person', `%${safeName}%`)
      .limit(1)
      .maybeSingle();
    if (byContact.data?.id) {
      return {
        customer_id: byContact.data.id,
        name: byContact.data.company_name ?? byContact.data.contact_person ?? null,
        confidence: 0.6,
      };
    }
  }
  return { customer_id: null, confidence: 0 };
}

async function saveQuoteDraft(
  supabase: SupabaseClient,
  taskId: string,
  input: Record<string, unknown>,
) {
  const reply_draft = String(input.reply_draft ?? '');
  const positions_sketch = Array.isArray(input.positions_sketch) ? input.positions_sketch : [];
  if (!reply_draft) return { error: 'reply_draft required' };

  // Guardrail: every position must reference a source.
  const unsourced = positions_sketch.filter((p: Record<string, unknown>) =>
    !p.source_quote_id && !p.source_project_id
  );
  if (unsourced.length > 0) {
    return {
      error: `${unsourced.length} position(s) without source_quote_id/source_project_id — refusing to save invented prices`,
    };
  }

  const { error } = await supabase.from('agent_tasks').update({
    status: 'awaiting_approval',
    output: {
      action: 'draft_quote_from_email',
      preview: {
        reply_draft,
        positions_sketch,
        customer_match: input.customer_match ?? null,
        missing_info: input.missing_info ?? [],
      },
    },
  }).eq('id', taskId);

  if (error) return { error: error.message };

  // Find the email and bump its status too.
  const { data: task } = await supabase
    .from('agent_tasks').select('input').eq('id', taskId).maybeSingle();
  const emailId = (task?.input as Record<string, unknown> | null)?.emailId;
  if (typeof emailId === 'string') {
    await supabase.from('emails').update({
      processing_status: 'awaiting_approval',
    }).eq('id', emailId);
  }
  return { success: true };
}
