import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createServiceRoleClient } from '../_shared/supabase.ts';
import { createAnthropicClient, ANTHROPIC_MODEL } from '../_shared/anthropic.ts';
import { parseIntentResponse } from '../_shared/intent.ts';
import type {
  RouterRequest,
  AgentType,
  TriggerType,
  IntentClassification,
} from '../_shared/types.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const INTENT_SYSTEM_PROMPT = `Du bist ein Intent-Classifier für eine deutsche Handwerker-Software (HandwerkOS, Elektrobetriebe).
Klassifiziere die Nachricht des Elektromeisters in eine von vier Domänen.

Antworte ausschließlich mit einem JSON-Objekt in diesem Format (keine Markdown-Fences, kein Begleittext):
{
  "agent": "offers" | "invoices" | "planning" | "materials",
  "action": string,
  "entities": object
}

Beispiele:
- "Erstelle Angebot für Müller, Zählertausch + 3 Steckdosen" -> {"agent":"offers","action":"create","entities":{"customer":"Müller","items":["Zählertausch","3 Steckdosen"]}}
- "Schick die Mahnung an Schmidt raus" -> {"agent":"invoices","action":"send_reminder","entities":{"customer":"Schmidt"}}
- "Was hab ich morgen?" -> {"agent":"planning","action":"daily_briefing","entities":{"date":"tomorrow"}}
- "Bestell Kabel NYM 3x1.5 für Baustelle Hauptstraße" -> {"agent":"materials","action":"order","entities":{"item":"NYM 3x1.5","project":"Hauptstraße"}}`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    const body = (await req.json()) as RouterRequest;
    const supabase = createServiceRoleClient();

    if (body.trigger === 'heartbeat') {
      const result = await dispatchAgent(
        supabase,
        body.agent,
        body.action,
        body.payload ?? {},
        body.companyId,
        'heartbeat',
        null,
      );
      return jsonResponse(result, 200);
    }

    // User trigger
    const intent = await classifyIntent(body.message);
    const payload = {
      originalMessage: body.message,
      entities: intent.entities,
      userId: body.userId,
    };
    const result = await dispatchAgent(
      supabase,
      intent.agent,
      intent.action,
      payload,
      body.companyId,
      'user',
      intent,
    );
    return jsonResponse(result, 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('agent-router error:', message);
    return jsonResponse({ error: message }, 500);
  }
});

async function classifyIntent(message: string): Promise<IntentClassification> {
  const anthropic = createAnthropicClient();
  const response = await anthropic.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 500,
    system: INTENT_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: message }],
  });
  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Anthropic response contained no text block');
  }
  return parseIntentResponse(textBlock.text);
}

async function dispatchAgent(
  supabase: ReturnType<typeof createServiceRoleClient>,
  agentType: AgentType,
  action: string,
  payload: Record<string, unknown>,
  companyId: string,
  triggerType: TriggerType,
  intent: IntentClassification | null,
) {
  const { data: task, error } = await supabase
    .from('agent_tasks')
    .insert({
      company_id: companyId,
      agent_type: agentType,
      trigger_type: triggerType,
      status: 'running',
      input: { action, ...payload },
      intent,
    })
    .select('id')
    .single();

  if (error || !task) {
    throw new Error(`Could not create agent_task: ${error?.message ?? 'no row returned'}`);
  }

  // Fire-and-forget invoke des Spezialagenten.
  // Fehler im Agenten landen in agent_tasks.error (vom Agenten selbst gesetzt).
  await supabase.functions.invoke(`agent-${agentType}`, {
    body: { taskId: task.id, action, payload },
  });

  return { taskId: task.id, agent: agentType, action };
}

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}
