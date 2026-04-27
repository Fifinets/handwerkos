import type { AgentType, IntentClassification } from './types.ts';

const VALID_AGENTS: ReadonlySet<AgentType> = new Set(['offers', 'invoices', 'planning', 'materials']);

// CODE_FENCE_RE is anchored — it requires the fenced block to be the entire trimmed input.
// LLM responses with surrounding prose will fail JSON.parse and throw. This is intentional:
// the system prompt instructs Anthropic to return JSON only, and loud failures are GoBD-auditable.
const CODE_FENCE_RE = /^```(?:json)?\s*\n?([\s\S]*?)\n?```$/;

export function parseIntentResponse(rawText: string): IntentClassification {
  const trimmed = rawText.trim();
  const fenceMatch = trimmed.match(CODE_FENCE_RE);
  const jsonString = fenceMatch ? fenceMatch[1].trim() : trimmed;

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    throw new Error(`Intent classification did not return valid JSON. Got: ${rawText.slice(0, 200)}`);
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Intent classification did not return valid JSON');
  }

  const obj = parsed as Record<string, unknown>;

  if (typeof obj.agent !== 'string' || !VALID_AGENTS.has(obj.agent as AgentType)) {
    throw new Error(`Unknown agent type: ${String(obj.agent)}`);
  }

  if (typeof obj.action !== 'string' || obj.action.length === 0) {
    throw new Error('Missing required field: action');
  }

  const entitiesRaw = obj.entities;
  const entities = (entitiesRaw && typeof entitiesRaw === 'object' && !Array.isArray(entitiesRaw))
    ? entitiesRaw as Record<string, unknown>
    : {};

  return {
    agent: obj.agent as AgentType,
    action: obj.action,
    entities,
  };
}
