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

const VALID_AGENTS = new Set<AgentType>(['offers', 'invoices', 'planning', 'materials']);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return jsonResponse({ error: 'missing or invalid authorization header' }, 401);
    }
    const jwt = authHeader.substring(7);

    const supabase = createServiceRoleClient();
    const body = (await req.json()) as RouterRequest;

    if (body.trigger === 'heartbeat') {
      // Heartbeat: caller must be service-role (i.e. pg_cron / internal trigger)
      const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      if (!serviceRoleKey || jwt !== serviceRoleKey) {
        return jsonResponse({ error: 'heartbeat requires service-role authorization' }, 403);
      }
      // Validate heartbeat body
      if (!isValidHeartbeatBody(body)) {
        return jsonResponse({ error: 'invalid heartbeat body' }, 400);
      }
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

    // User trigger: derive companyId from authenticated user
    const { data: userData, error: userErr } = await supabase.auth.getUser(jwt);
    if (userErr || !userData?.user) {
      return jsonResponse({ error: 'invalid token' }, 401);
    }
    const userId = userData.user.id;

    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', userId)
      .single();
    if (profileErr || !profile?.company_id) {
      return jsonResponse({ error: 'no company associated with this user' }, 403);
    }
    const companyId = profile.company_id as string;

    // Validate user body
    if (!isValidUserBody(body)) {
      return jsonResponse({ error: 'invalid user body — message required' }, 400);
    }

    const intent = await classifyIntent(body.message);
    const payload = {
      originalMessage: body.message,
      entities: intent.entities,
      userId,
    };
    const result = await dispatchAgent(
      supabase,
      intent.agent,
      intent.action,
      payload,
      companyId,
      'user',
      intent,
    );
    return jsonResponse(result, 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown';
    const stack = err instanceof Error ? err.stack : undefined;
    console.error('agent-router error:', message, stack);
    // Generic message to caller — full detail in Edge Function logs only.
    return jsonResponse({ error: 'internal error' }, 500);
  }
});

function isValidHeartbeatBody(body: unknown): body is { trigger: 'heartbeat'; agent: AgentType; action: string; payload?: Record<string, unknown>; companyId: string } {
  if (!body || typeof body !== 'object') return false;
  const b = body as Record<string, unknown>;
  if (b.trigger !== 'heartbeat') return false;
  if (typeof b.agent !== 'string' || !VALID_AGENTS.has(b.agent as AgentType)) return false;
  if (typeof b.action !== 'string' || b.action.length === 0) return false;
  if (typeof b.companyId !== 'string' || b.companyId.length === 0) return false;
  return true;
}

function isValidUserBody(body: unknown): body is { trigger?: 'user'; message: string } {
  if (!body || typeof body !== 'object') return false;
  const b = body as Record<string, unknown>;
  if (b.trigger !== undefined && b.trigger !== 'user') return false;
  if (typeof b.message !== 'string' || b.message.length === 0) return false;
  return true;
}

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

  const taskId = task.id as string;

  // Dispatch the specialist agent. We await to capture invoke errors —
  // if the function itself can't be reached, mark the task as failed so
  // the realtime subscriber sees the failure instead of a stuck 'running'.
  const { error: invokeErr } = await supabase.functions.invoke(`agent-${agentType}`, {
    body: { taskId, action, payload },
  });

  if (invokeErr) {
    await supabase
      .from('agent_tasks')
      .update({
        status: 'failed',
        error: `dispatch to agent-${agentType} failed: ${invokeErr.message ?? 'unknown'}`,
      })
      .eq('id', taskId);
    console.error(`agent-router: dispatch to agent-${agentType} failed for task ${taskId}:`, invokeErr.message);
  }

  // Always observable: who dispatched what.
  console.log(`agent-router: dispatched`, { taskId, agent: agentType, action, triggerType, companyId });

  return { taskId, agent: agentType, action };
}

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}
