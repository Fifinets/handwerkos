// supabase/functions/process-ai-queue/index.ts
//
// Worker for the ai_processing_queue table.
//
// Triggered by a Supabase cron job (suggested: every 2-5 minutes). On each run,
// it claims up to BATCH_SIZE pending items (atomic UPDATE that race-safely
// transitions status 'pending' -> 'processing'), dispatches each to the right
// handler based on operation_type, and writes the outcome back to the row.
//
// On transient failures: increment attempts, set status back to 'pending' if
// attempts < max_attempts, otherwise mark as 'failed' with error_message.
// On permanent failures (e.g. unknown operation_type): mark 'failed' immediately.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

import {
  dispatchHandler,
  NotImplementedError,
  PermanentError,
  QueueItem,
} from './lib/handlers.ts';

const BATCH_SIZE = 20;
// Items stuck in 'processing' longer than this are assumed dead (worker
// crashed or hit the edge function timeout) and get reset to 'pending'.
const STUCK_THRESHOLD_MINUTES = 15;

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RunSummary {
  success: boolean;
  processed: number;
  completed: number;
  failed: number;
  retried: number;
  recovered: number;
  errors: Array<{ item_id: string; error: string }>;
  message?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Recover items stuck in 'processing' from previous crashed runs.
    const recovered = await recoverStuckItems(supabase);

    const claimedItems = await claimPendingItems(supabase, BATCH_SIZE);

    if (claimedItems.length === 0) {
      return jsonResponse({
        success: true,
        processed: 0,
        completed: 0,
        failed: 0,
        retried: 0,
        recovered,
        errors: [],
        message: 'No pending items',
      });
    }

    const summary: RunSummary = {
      success: true,
      processed: claimedItems.length,
      completed: 0,
      failed: 0,
      retried: 0,
      recovered,
      errors: [],
    };

    // Process items sequentially. Embedding API calls can be parallelised later
    // if throughput matters; sequential keeps error handling simple and avoids
    // OpenAI rate-limit spikes when the queue is large.
    for (const item of claimedItems) {
      const outcome = await processItem(supabase, item);
      if (outcome.status === 'completed') summary.completed++;
      else if (outcome.status === 'failed') {
        summary.failed++;
        summary.errors.push({ item_id: item.id, error: outcome.error ?? 'unknown' });
      } else if (outcome.status === 'pending') {
        summary.retried++;
        summary.errors.push({ item_id: item.id, error: outcome.error ?? 'unknown (retrying)' });
      }
    }

    return jsonResponse(summary);
  } catch (err) {
    console.error('process-ai-queue fatal error:', err);
    return jsonResponse(
      { success: false, error: (err as Error).message },
      500,
    );
  }
});

/**
 * Reset items stuck in 'processing' state back to 'pending'.
 *
 * Edge functions can be killed mid-execution (timeout, OOM, deploy). Items
 * claimed by a dead worker would sit in 'processing' forever otherwise.
 * Anything claimed more than STUCK_THRESHOLD_MINUTES ago is assumed dead.
 *
 * Note: attempts has already been incremented at claim time, so this just
 * undoes the status transition — it does NOT give the item a fresh retry
 * budget. If it stays stuck repeatedly, attempts will hit max_attempts and
 * it will be marked failed on the next process attempt.
 */
async function recoverStuckItems(supabase: SupabaseClient): Promise<number> {
  const threshold = new Date(
    Date.now() - STUCK_THRESHOLD_MINUTES * 60 * 1000,
  ).toISOString();

  const { data, error } = await supabase
    .from('ai_processing_queue')
    .update({ status: 'pending', started_at: null })
    .eq('status', 'processing')
    .lt('started_at', threshold)
    .select('id');

  if (error) {
    console.error(`Failed to recover stuck items: ${error.message}`);
    return 0;
  }

  const count = data?.length ?? 0;
  if (count > 0) {
    console.log(`Recovered ${count} stuck queue item(s) from previous run`);
  }
  return count;
}

/**
 * Claim a batch of pending items by transitioning their status to 'processing'.
 *
 * Race-safety: we update WHERE id = X AND status = 'pending'. If another worker
 * already claimed the row, the update affects 0 rows and we skip it. Each
 * claim is its own statement, so the worst case is that this run claims fewer
 * than `limit` items — never that two workers process the same row.
 */
async function claimPendingItems(
  supabase: SupabaseClient,
  limit: number,
): Promise<QueueItem[]> {
  const nowIso = new Date().toISOString();

  const { data: candidates, error: selectError } = await supabase
    .from('ai_processing_queue')
    .select('id, attempts, max_attempts')
    .eq('status', 'pending')
    .lte('scheduled_for', nowIso)
    .order('priority', { ascending: true })
    .order('scheduled_for', { ascending: true })
    .limit(limit);

  if (selectError) {
    throw new Error(`Failed to load pending queue items: ${selectError.message}`);
  }

  if (!candidates || candidates.length === 0) return [];

  const claimed: QueueItem[] = [];

  for (const candidate of candidates) {
    // Skip items that have already exhausted retries (defensive — they should
    // have been marked 'failed' already, but a stale row could slip through).
    if (candidate.attempts >= candidate.max_attempts) continue;

    const { data: row, error: updateError } = await supabase
      .from('ai_processing_queue')
      .update({
        status: 'processing',
        started_at: nowIso,
        attempts: candidate.attempts + 1,
      })
      .eq('id', candidate.id)
      .eq('status', 'pending') // race-safe guard
      .select('*')
      .maybeSingle();

    if (updateError) {
      console.error(`Failed to claim queue item ${candidate.id}: ${updateError.message}`);
      continue;
    }

    if (row) claimed.push(row as QueueItem);
  }

  return claimed;
}

interface ProcessOutcome {
  status: 'completed' | 'failed' | 'pending';
  error?: string;
}

async function processItem(
  supabase: SupabaseClient,
  item: QueueItem,
): Promise<ProcessOutcome> {
  try {
    const { result_data } = await dispatchHandler(supabase, item);

    const { error } = await supabase
      .from('ai_processing_queue')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        result_data,
        error_message: null,
      })
      .eq('id', item.id);

    if (error) {
      console.error(`Failed to mark item ${item.id} completed: ${error.message}`);
      return { status: 'failed', error: error.message };
    }

    return { status: 'completed' };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    // Permanent failure: NotImplemented or schema violation — don't retry.
    const permanent =
      err instanceof NotImplementedError || err instanceof PermanentError;

    const shouldRetry = !permanent && item.attempts < item.max_attempts;
    const newStatus = shouldRetry ? 'pending' : 'failed';

    const update: Record<string, unknown> = {
      status: newStatus,
      error_message: message,
    };

    // When retrying, clear started_at so the next worker doesn't see a stale
    // claim. completed_at only gets set on success.
    if (shouldRetry) {
      update.started_at = null;
    } else {
      update.completed_at = new Date().toISOString();
    }

    const { error: persistError } = await supabase
      .from('ai_processing_queue')
      .update(update)
      .eq('id', item.id);

    if (persistError) {
      console.error(
        `Failed to persist failure for item ${item.id}: ${persistError.message}. Original error: ${message}`,
      );
    }

    return { status: newStatus, error: message };
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
