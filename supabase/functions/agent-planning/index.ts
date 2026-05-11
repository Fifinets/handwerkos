import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createServiceRoleClient, type SupabaseClient } from '../_shared/supabase.ts';
import { createAnthropicClient, ANTHROPIC_MODEL, type Anthropic } from '../_shared/anthropic.ts';
import { TOOL_SCHEMAS, executeTool } from './tools.ts';
import type { ToolCallLog } from '../_shared/types.ts';

const MAX_ITERATIONS = 10;
const SYSTEM_PROMPT = `Du bist der Planungs-Agent für HandwerkOS.
Mutationen (create_appointment) IMMER über request_approval. Read-only Tools direkt 'done'.
Antwort: GENAU EINE kurze Zeile, keine Tabellen/Listen.`;

interface AgentRequest { taskId: string; action: string; payload: { originalMessage?: string; entities?: Record<string, unknown>; userId?: string; [k: string]: unknown; }; }

serve(async (req) => {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return jsonResponse({ error: 'missing authorization' }, 401);
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!serviceRoleKey || authHeader.substring(7) !== serviceRoleKey) return jsonResponse({ error: 'service-role required' }, 403);

  let taskId: string | null = null;
  let supabase: SupabaseClient | null = null;
  try {
    const body = (await req.json()) as AgentRequest;
    if (typeof body.taskId !== 'string' || body.taskId.length === 0) return jsonResponse({ error: 'invalid body' }, 400);
    taskId = body.taskId;
    const { action, payload } = body;
    supabase = createServiceRoleClient();

    const { data: taskRow, error: taskErr } = await supabase.from('agent_tasks').select('company_id').eq('id', taskId).single();
    if (taskErr || !taskRow) throw new Error(`Task ${taskId} nicht gefunden`);
    const companyId = taskRow.company_id as string;

    const anthropic = createAnthropicClient();
    const toolCallLog: ToolCallLog[] = [];
    const userInput = payload.originalMessage ?? `Aktion: ${action}. Details: ${JSON.stringify(payload.entities ?? {})}`;
    const messages: Anthropic.MessageParam[] = [{ role: 'user', content: `${userInput}\n\n[System: taskId=${taskId}]` }];
    let finalText: string | null = null;

    for (let i = 0; i < MAX_ITERATIONS; i++) {
      const response = await anthropic.messages.create({ model: ANTHROPIC_MODEL, max_tokens: 2000, system: SYSTEM_PROMPT, tools: TOOL_SCHEMAS, messages });
      if (response.stop_reason !== 'tool_use') {
        const textBlock = response.content.find((b) => b.type === 'text');
        finalText = textBlock && textBlock.type === 'text' ? textBlock.text : '';
        break;
      }
      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const block of response.content) {
        if (block.type !== 'tool_use') continue;
        const result = await executeTool(block.name, block.input as Record<string, unknown>, supabase, taskId, companyId);
        toolCallLog.push({ tool: block.name, input: block.input as Record<string, unknown>, output: result, ts: new Date().toISOString() });
        toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(result) });
      }
      messages.push({ role: 'assistant', content: response.content });
      messages.push({ role: 'user', content: toolResults });
    }

    if (finalText === null) {
      await supabase.from('agent_tasks').update({ status: 'failed', error: `MAX_ITERATIONS reached`, tool_calls: toolCallLog }).eq('id', taskId);
      return jsonResponse({ ok: false, taskId }, 500);
    }

    const { data: currentTask } = await supabase.from('agent_tasks').select('status, output').eq('id', taskId).single();
    const isStillRunning = currentTask?.status === 'running';
    const hadMutation = toolCallLog.some((c) => c.tool === 'create_appointment');
    const existingOutput = (currentTask?.output as Record<string, unknown> | null) ?? {};
    let nextStatus: string = currentTask?.status ?? 'awaiting_approval';
    let warning: string | undefined;
    if (isStillRunning) {
      if (hadMutation) { nextStatus = 'awaiting_approval'; warning = 'request_approval was not called'; }
      else { nextStatus = 'done'; }
    }
    await supabase.from('agent_tasks').update({
      status: nextStatus, tool_calls: toolCallLog,
      output: { ...existingOutput, agentMessage: finalText, ...(warning ? { warning } : {}) },
    }).eq('id', taskId);

    return jsonResponse({ ok: true, taskId, message: finalText }, 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    console.error('agent-planning error:', message);
    if (taskId && supabase) {
      try { await supabase.from('agent_tasks').update({ status: 'failed', error: message }).eq('id', taskId); } catch { /* ignore */ }
    }
    return jsonResponse({ ok: false, error: 'internal error' }, 500);
  }
});

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
