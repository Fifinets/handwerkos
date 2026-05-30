// Operation handlers for ai_processing_queue items
// One handler per operation_type. Each returns the data we want to persist in
// result_data when the item succeeds.

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { createEmbedding, toPgVector } from './embeddings.ts';

export interface QueueItem {
  id: string;
  operation_type: 'index_content' | 'generate_estimate' | 'create_schedule' | 'extract_intent';
  entity_type: string;
  entity_id: string;
  input_data: Record<string, unknown>;
  priority: number;
  status: string;
  attempts: number;
  max_attempts: number;
  company_id: string | null;
}

export interface HandlerResult {
  result_data: Record<string, unknown>;
}

/**
 * Handler for operation_type='index_content'.
 *
 * Reads content from input_data.content, creates an OpenAI embedding,
 * and upserts the (ref_type, ref_id) row in ai_index.
 *
 * The DB schema has no UNIQUE(ref_type, ref_id) constraint, so we do a
 * read-then-write upsert. Acceptable because each entity is normally only
 * indexed by one worker at a time (atomic claim in the dispatcher prevents
 * concurrent re-indexing of the same item).
 */
export async function handleIndexContent(
  supabase: SupabaseClient,
  item: QueueItem,
): Promise<HandlerResult> {
  const content = item.input_data?.content;
  if (typeof content !== 'string' || content.trim().length === 0) {
    throw new PermanentError(
      `input_data.content is missing or empty for queue item ${item.id}`,
    );
  }

  const { embedding, tokens_used, model } = await createEmbedding(content);
  const vectorString = toPgVector(embedding);
  const nowIso = new Date().toISOString();

  // Look for an existing index row for this entity
  const { data: existing, error: selectError } = await supabase
    .from('ai_index')
    .select('id')
    .eq('ref_type', item.entity_type)
    .eq('ref_id', item.entity_id)
    .maybeSingle();

  if (selectError) {
    throw new Error(`Failed to query ai_index: ${selectError.message}`);
  }

  if (existing) {
    const { error: updateError } = await supabase
      .from('ai_index')
      .update({
        content_text: content,
        embedding: vectorString,
        indexed_at: nowIso,
        updated_at: nowIso,
        metadata: { model, tokens_used },
      })
      .eq('id', existing.id);

    if (updateError) {
      throw new Error(`Failed to update ai_index row ${existing.id}: ${updateError.message}`);
    }

    return {
      result_data: {
        action: 'updated',
        ai_index_id: existing.id,
        tokens_used,
        model,
      },
    };
  }

  const { data: inserted, error: insertError } = await supabase
    .from('ai_index')
    .insert({
      ref_type: item.entity_type,
      ref_id: item.entity_id,
      content_text: content,
      embedding: vectorString,
      company_id: item.company_id,
      metadata: { model, tokens_used },
    })
    .select('id')
    .single();

  if (insertError) {
    throw new Error(`Failed to insert ai_index row: ${insertError.message}`);
  }

  return {
    result_data: {
      action: 'inserted',
      ai_index_id: inserted.id,
      tokens_used,
      model,
    },
  };
}

/**
 * Dispatcher: routes a claimed queue item to the correct handler based on
 * operation_type. Operations not yet implemented throw a "NotImplemented"
 * error so the dispatcher can mark them as permanently failed rather than
 * retrying forever.
 */
export async function dispatchHandler(
  supabase: SupabaseClient,
  item: QueueItem,
): Promise<HandlerResult> {
  switch (item.operation_type) {
    case 'index_content':
      return handleIndexContent(supabase, item);

    case 'generate_estimate':
    case 'create_schedule':
    case 'extract_intent':
      throw new NotImplementedError(
        `operation_type '${item.operation_type}' is not yet implemented in process-ai-queue`,
      );

    default:
      throw new NotImplementedError(
        `Unknown operation_type '${item.operation_type}' for queue item ${item.id}`,
      );
  }
}

/**
 * Marker error class. The dispatcher uses instanceof checks to decide whether
 * to retry (transient) or fail permanently (not implemented / unknown op).
 */
export class NotImplementedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotImplementedError';
  }
}

/**
 * Thrown when a queue item can never succeed without intervention — e.g.
 * missing required fields in input_data, or referenced entity no longer exists.
 * The dispatcher marks these as 'failed' immediately without retrying.
 */
export class PermanentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PermanentError';
  }
}
