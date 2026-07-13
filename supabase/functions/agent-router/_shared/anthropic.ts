import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.27.0';

export const ANTHROPIC_MODEL = 'claude-sonnet-4-6';

export function createAnthropicClient(): Anthropic {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY env var is missing');
  }
  return new Anthropic({ apiKey });
}

export type { Anthropic };
