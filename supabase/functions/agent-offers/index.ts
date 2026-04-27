import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createServiceRoleClient, type SupabaseClient } from '../_shared/supabase.ts';
import { createAnthropicClient, ANTHROPIC_MODEL, type Anthropic } from '../_shared/anthropic.ts';
import { TOOL_SCHEMAS, executeTool } from './tools.ts';
import type { ToolCallLog } from '../_shared/types.ts';

const MAX_ITERATIONS = 10;

const SYSTEM_PROMPT = `Du bist der Angebots-Agent für HandwerkOS, eine Software für Elektrobetriebe in Deutschland.
Du hilfst dem Elektromeister beim Erstellen von Angeboten als Entwurf.

Wichtige Regeln:
- Berechne Preise immer NETTO (ohne MwSt). MwSt (19%) wird automatisch ergänzt.
- Standardstundensatz Elektriker: 95€/h. Materialpreise via get_wuerth_prices.
- Erstelle das Angebot IMMER nur als Entwurf (status='draft'). Niemals direkt versenden.
- Rufe IMMER request_approval auf bevor du fertig bist — der Elektromeister prüft und gibt frei.
- Antworte auf Deutsch, kurz und sachlich. Keine Floskeln.

Workflow:
1. get_customer um den Kunden zu finden (per Namen aus dem User-Input)
2. Falls Materialien genannt: get_wuerth_prices für Preise
3. create_offer mit allen Positionen — Arbeitszeit + Material getrennt als Positionen
4. request_approval mit einer Preview (customer, projectName, positionsAnzahl, gesamtNetto)
5. Kurze Bestätigung an den User: was wurde erstellt`;

interface AgentRequest {
  taskId: string;
  action: string;
  payload: {
    originalMessage?: string;
    entities?: Record<string, unknown>;
    userId?: string;
    [k: string]: unknown;
  };
}

serve(async (req) => {
  // Auth: nur der Router (service-role) darf den Agenten direkt invoken.
  // Verhindert dass authentifizierte User-Calls am Router vorbei direkt
  // hier landen und Tasks fremder Tenants ausführen.
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return jsonResponse({ error: 'missing authorization' }, 401);
  }
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!serviceRoleKey || authHeader.substring(7) !== serviceRoleKey) {
    return jsonResponse({ error: 'service-role required' }, 403);
  }

  let taskId: string | null = null;
  let supabase: SupabaseClient | null = null;

  try {
    const body = (await req.json()) as AgentRequest;
    if (typeof body.taskId !== 'string' || body.taskId.length === 0) {
      return jsonResponse({ error: 'invalid body — taskId required' }, 400);
    }
    taskId = body.taskId;
    const { action, payload } = body;
    supabase = createServiceRoleClient();

    // companyId aus dem Task laden — Source of Truth ist die DB-Zeile,
    // nicht das Payload (Defense in depth: selbst wenn ein Caller den
    // Payload manipuliert, schreibt der Agent in die richtige Tenant-Scope).
    const { data: taskRow, error: taskErr } = await supabase
      .from('agent_tasks')
      .select('company_id')
      .eq('id', taskId)
      .single();
    if (taskErr || !taskRow) {
      throw new Error(`Task ${taskId} nicht gefunden: ${taskErr?.message ?? 'no row'}`);
    }
    const companyId = taskRow.company_id as string;

    const anthropic = createAnthropicClient();
    const toolCallLog: ToolCallLog[] = [];

    const userInput = payload.originalMessage
      ?? `Aktion: ${action}. Details: ${JSON.stringify(payload.entities ?? {})}`;

    const messages: Anthropic.MessageParam[] = [
      { role: 'user', content: `${userInput}\n\n[System: taskId=${taskId}]` },
    ];

    let finalText: string | null = null;

    for (let i = 0; i < MAX_ITERATIONS; i++) {
      const response = await anthropic.messages.create({
        model: ANTHROPIC_MODEL,
        max_tokens: 2000,
        system: SYSTEM_PROMPT,
        tools: TOOL_SCHEMAS,
        messages,
      });

      if (response.stop_reason !== 'tool_use') {
        const textBlock = response.content.find((b) => b.type === 'text');
        finalText = textBlock && textBlock.type === 'text' ? textBlock.text : '';
        break;
      }

      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const block of response.content) {
        if (block.type !== 'tool_use') continue;
        const result = await executeTool(
          block.name,
          block.input as Record<string, unknown>,
          supabase,
          taskId,
          companyId,
        );
        toolCallLog.push({
          tool: block.name,
          input: block.input as Record<string, unknown>,
          output: result,
          ts: new Date().toISOString(),
        });
        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: JSON.stringify(result),
        });
      }

      messages.push({ role: 'assistant', content: response.content });
      messages.push({ role: 'user', content: toolResults });
    }

    if (finalText === null) {
      // Loop limit erreicht — Agent ist in einer Schleife oder halluziniert
      await supabase.from('agent_tasks').update({
        status: 'failed',
        error: `MAX_ITERATIONS (${MAX_ITERATIONS}) erreicht ohne final response`,
        tool_calls: toolCallLog,
      }).eq('id', taskId);
      return jsonResponse({ ok: false, taskId }, 500);
    }

    // request_approval setzt status auf 'awaiting_approval'. Falls der Agent
    // das vergessen hat, erzwingen wir es hier mit Warning, damit der UI-Flow
    // nicht in 'running' hängen bleibt.
    const { data: currentTask } = await supabase
      .from('agent_tasks')
      .select('status, output')
      .eq('id', taskId)
      .single();

    const needsForcedApproval = currentTask?.status === 'running';
    const existingOutput = (currentTask?.output as Record<string, unknown> | null) ?? {};
    await supabase.from('agent_tasks').update({
      status: needsForcedApproval ? 'awaiting_approval' : currentTask?.status,
      tool_calls: toolCallLog,
      output: needsForcedApproval
        ? { ...existingOutput, agentMessage: finalText, warning: 'request_approval was not called' }
        : { ...existingOutput, agentMessage: finalText },
    }).eq('id', taskId);

    return jsonResponse({ ok: true, taskId, message: finalText }, 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    console.error('agent-offers error:', message);
    // Best-effort: Task auf failed setzen damit der UI-Flow den Fehler sieht.
    if (taskId && supabase) {
      try {
        await supabase.from('agent_tasks').update({
          status: 'failed',
          error: message,
        }).eq('id', taskId);
      } catch (updateErr) {
        console.error('agent-offers: could not mark task failed:', updateErr);
      }
    }
    return jsonResponse({ ok: false, error: 'internal error' }, 500);
  }
});

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
