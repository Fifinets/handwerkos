// OpenAI Embeddings helper for HandwerkOS AI Queue Processor
// Uses text-embedding-3-small with 1536 dimensions to match ai_index schema

export interface EmbeddingResult {
  embedding: number[];
  tokens_used: number;
  model: string;
}

const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 1536;
// text-embedding-3-small has 8191 token limit; ~4 chars/token gives a safe upper bound
const MAX_INPUT_CHARS = 30000;

export async function createEmbedding(text: string): Promise<EmbeddingResult> {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  const cleanText = text.trim();
  if (cleanText.length === 0) {
    throw new Error('Cannot create embedding for empty text');
  }

  // Truncate to avoid token-limit errors
  const input = cleanText.length > MAX_INPUT_CHARS
    ? cleanText.substring(0, MAX_INPUT_CHARS)
    : cleanText;

  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input,
      dimensions: EMBEDDING_DIMENSIONS,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`OpenAI embeddings API error (${response.status}): ${errorBody}`);
  }

  const data = await response.json();

  if (!data.data?.[0]?.embedding) {
    throw new Error('OpenAI response missing embedding data');
  }

  return {
    embedding: data.data[0].embedding,
    tokens_used: data.usage?.total_tokens ?? 0,
    model: EMBEDDING_MODEL,
  };
}

/**
 * Convert a number array into the string format pgvector expects: "[1.0,2.0,3.0]"
 * The Supabase JS client serializes plain arrays as JSON, but the vector type
 * needs the bracketed string form.
 */
export function toPgVector(embedding: number[]): string {
  return `[${embedding.join(',')}]`;
}
