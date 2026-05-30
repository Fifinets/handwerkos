# Agent-Engine Phase 1: Backend-MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Backend-MVP der Agent-Engine — eine User-Nachricht ("Erstelle Angebot für Müller, Zählertausch + 3 Steckdosen") wird klassifiziert, an `agent-offers` geroutet, dort wird ein Angebots-Entwurf in `offers` angelegt und der Task auf `awaiting_approval` gesetzt. End-to-End via curl testbar.

**Architecture:** Zwei Supabase Edge Functions (Deno). `agent-router` klassifiziert User-Intent via Anthropic API (Sonnet 4.6) und dispatcht via `supabase.functions.invoke()` an den passenden Spezialagenten. `agent-offers` ist der erste Agent — agentic loop mit Anthropic tool-use, jeder Tool-Call schreibt einen Audit-Eintrag in `agent_tasks.tool_calls`. Ergebnis ist immer ein Entwurf in `offers` (status='draft', `created_by_agent=true`) plus `agent_tasks.status='awaiting_approval'` — die finale Aktion (Senden) erfolgt erst nach UI-Freigabe (Phase 2).

**Tech Stack:** Deno (Edge Functions), `@anthropic-ai/sdk@0.27+` (via esm.sh), `@supabase/supabase-js@2`, Postgres + pgvector. Tests: Deno's eingebauter Test-Runner für Pure-Logic-Helper, `curl` + SQL-Verification via Supabase MCP für Integrationstests.

**Spec:** Siehe HandwerkOS — KI Agent Engine in der ersten User-Nachricht dieser Session (Phase 1, Schritte 1-4). Nicht in Scope für diesen Plan: Frontend (Hook, Chat-UI, Approval-Card, KI-Badge), weitere Agents (invoices/planning/materials), pg_cron Heartbeats.

**Pre-Requisites verifiziert:**
- Postgres-Funktion `public.user_has_company_access(uuid)` existiert ([20250813120003_add_rls_policies.sql](supabase/migrations/20250813120003_add_rls_policies.sql))
- Tabelle `offers` mit `offer_items`, `offer_targets` ([20260202_create_offer_module.sql](supabase/migrations/20260202_create_offer_module.sql))
- Migration für `agent_tasks` bereits geschrieben ([20260427000001_create_agent_tasks.sql](supabase/migrations/20260427000001_create_agent_tasks.sql)) — wird in Task 1 angewandt

**Env-Vars (Supabase Edge Functions):** `ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (alle bereits in Supabase-Projekt gesetzt — siehe Memory)

---

## File Structure

**Migrations (already written, applies in Task 1):**
- `supabase/migrations/20260427000001_create_agent_tasks.sql`

**Edge Functions:**
- `supabase/functions/_shared/anthropic.ts` — Anthropic-Client-Factory (env-driven)
- `supabase/functions/_shared/supabase.ts` — Service-Role-Client-Factory
- `supabase/functions/_shared/types.ts` — Shared TypeScript types (AgentType, TaskStatus, IntentClassification, ToolCallLog)
- `supabase/functions/_shared/intent.ts` — Pure Intent-Parser (parseIntentJSON validiert + sanitized)
- `supabase/functions/_shared/intent.test.ts` — Deno-Test für Intent-Parser
- `supabase/functions/agent-router/index.ts` — Router-Handler
- `supabase/functions/agent-offers/index.ts` — Offers-Agent-Handler
- `supabase/functions/agent-offers/tools.ts` — Tool-Definitionen + executeTool-Dispatcher
- `supabase/functions/agent-offers/tools.test.ts` — Deno-Test für Tool-Dispatcher (mit Supabase-Mock)

**Smoke-Test-Skript:**
- `scripts/agent-smoke-test.sh` — `curl`-basierter End-to-End-Smoke-Test

**Reasoning:** `_shared/` ist Supabase-Konvention für Edge-Function-Shared-Code. Pure-Logic-Module (`intent.ts`, `tools.ts`) sind Deno-test-bar ohne externe Dependencies (Anthropic-Mock + Supabase-Mock). Die Handler-Files (`index.ts`) sind dünn — sie orchestrieren nur, Tests laufen via Smoke-Test gegen die deployten Functions.

---

## Task 1: Migration applien und verifizieren

**Files:**
- Apply: `supabase/migrations/20260427000001_create_agent_tasks.sql` (schon vorhanden, nur applien)

- [ ] **Step 1: Migration-Datei reviewen**

Öffne `supabase/migrations/20260427000001_create_agent_tasks.sql` und prüfe:
- Tabelle hat alle 13 Spalten (id, company_id, agent_type, trigger_type, status, input, intent, tool_calls, output, error, approved_at, approved_by, created_at)
- 3 RLS-Policies (SELECT/INSERT/UPDATE) via `user_has_company_access(company_id)`
- KEINE DELETE-Policy + Trigger `agent_tasks_no_delete`
- 2 Indizes
- 3 ALTER TABLE für offers/invoices/orders mit `created_by_agent` + `agent_task_id`
- `ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_tasks`

Wenn alles korrekt ist: weiter. Wenn nicht: zuerst Migration korrigieren.

- [ ] **Step 2: Migration auf Remote-DB anwenden**

Verwende den Supabase MCP-Tool `mcp__plugin_supabase_supabase__apply_migration`:
```
project_id: qgwhkjrhndeoskrxewpb
name: create_agent_tasks
query: <kompletter Inhalt der Migration-Datei>
```

Expected: Tool-Response zeigt `success: true` ohne Fehler.

- [ ] **Step 3: Schema verifizieren**

Verwende `mcp__plugin_supabase_supabase__execute_sql` mit:
```sql
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'agent_tasks'
ORDER BY ordinal_position;
```
Expected: 13 Zeilen, `id` mit default `gen_random_uuid()`, `tool_calls` mit default `'[]'::jsonb`, `created_at` mit default `now()`.

- [ ] **Step 4: RLS und Trigger verifizieren**

```sql
-- RLS aktiviert?
SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'agent_tasks';
-- Expected: relrowsecurity = true

-- Policies?
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'agent_tasks';
-- Expected: 3 Zeilen — SELECT, INSERT, UPDATE (KEIN DELETE!)

-- Trigger?
SELECT tgname FROM pg_trigger WHERE tgrelid = 'public.agent_tasks'::regclass AND NOT tgisinternal;
-- Expected: agent_tasks_no_delete

-- Realtime?
SELECT pubname, tablename FROM pg_publication_tables WHERE tablename = 'agent_tasks';
-- Expected: 1 Zeile mit pubname = supabase_realtime
```

- [ ] **Step 5: Markierungs-Spalten in offers/invoices/orders verifizieren**

```sql
SELECT
  table_name,
  column_name,
  data_type,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('offers', 'invoices', 'orders')
  AND column_name IN ('created_by_agent', 'agent_task_id')
ORDER BY table_name, column_name;
```
Expected: 6 Zeilen (3 Tabellen × 2 Spalten). `created_by_agent` mit default `false`, `agent_task_id` nullable mit FK auf `agent_tasks.id`.

- [ ] **Step 6: GoBD-Trigger funktional testen**

```sql
-- Test-Insert (mit existierender company_id — erst eine holen)
WITH test_company AS (SELECT id FROM companies LIMIT 1)
INSERT INTO agent_tasks (company_id, agent_type, trigger_type, input)
SELECT id, 'offers', 'user', '{"test": true}'::jsonb FROM test_company
RETURNING id;

-- Versuch zu löschen (muss fehlschlagen!)
DELETE FROM agent_tasks WHERE input->>'test' = 'true';
-- Expected: ERROR: agent_tasks ist append-only (GoBD-Compliance)

-- Aufräumen via UPDATE (nicht DELETE):
UPDATE agent_tasks SET status = 'failed', error = 'test cleanup' WHERE input->>'test' = 'true';
```

- [ ] **Step 7: Migration committen**

```bash
git add supabase/migrations/20260427000001_create_agent_tasks.sql
git commit -m "feat(agents): agent_tasks Tabelle + Markierungs-Spalten in offers/invoices/orders

- Append-only Log via DELETE-Trigger (GoBD)
- RLS via user_has_company_access(company_id)
- Realtime publication aktiv für Live-Chat-Updates
- created_by_agent/agent_task_id in offers, invoices, orders"
```

---

## Task 2: Shared utilities — Types und Client-Factories

**Files:**
- Create: `supabase/functions/_shared/types.ts`
- Create: `supabase/functions/_shared/anthropic.ts`
- Create: `supabase/functions/_shared/supabase.ts`

- [ ] **Step 1: Shared Types schreiben**

Erstelle `supabase/functions/_shared/types.ts`:

```typescript
// Shared types für die Agent-Engine.
// Werte synchron mit der DB-CHECK-Constraints in agent_tasks halten.

export type AgentType = 'offers' | 'invoices' | 'planning' | 'materials';
export type TriggerType = 'user' | 'heartbeat';
export type TaskStatus = 'pending' | 'running' | 'awaiting_approval' | 'done' | 'failed';

export interface IntentClassification {
  agent: AgentType;
  action: string;
  entities: Record<string, unknown>;
}

export interface ToolCallLog {
  tool: string;
  input: Record<string, unknown>;
  output: unknown;
  ts: string; // ISO 8601
}

export interface AgentTaskRow {
  id: string;
  company_id: string;
  agent_type: AgentType;
  trigger_type: TriggerType;
  status: TaskStatus;
  input: Record<string, unknown>;
  intent: IntentClassification | null;
  tool_calls: ToolCallLog[];
  output: Record<string, unknown> | null;
  error: string | null;
  approved_at: string | null;
  approved_by: string | null;
  created_at: string;
}

export interface RouterRequestUser {
  trigger?: 'user';
  message: string;
  companyId: string;
  userId: string;
}

export interface RouterRequestHeartbeat {
  trigger: 'heartbeat';
  agent: AgentType;
  action: string;
  payload?: Record<string, unknown>;
  companyId: string;
}

export type RouterRequest = RouterRequestUser | RouterRequestHeartbeat;

export interface AgentInvocation {
  taskId: string;
  action: string;
  payload: Record<string, unknown>;
}
```

- [ ] **Step 2: Anthropic-Client-Factory**

Erstelle `supabase/functions/_shared/anthropic.ts`:

```typescript
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
```

- [ ] **Step 3: Supabase-Client-Factory**

Erstelle `supabase/functions/_shared/supabase.ts`:

```typescript
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export function createServiceRoleClient(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) {
    throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY env vars are missing');
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type { SupabaseClient };
```

- [ ] **Step 4: Type-Check der drei Files**

```bash
deno check supabase/functions/_shared/types.ts
deno check supabase/functions/_shared/anthropic.ts
deno check supabase/functions/_shared/supabase.ts
```
Expected: keine Fehler.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/
git commit -m "feat(agents): shared types + Anthropic/Supabase client factories"
```

---

## Task 3: Intent-Parser (Pure-Logic, TDD)

**Files:**
- Create: `supabase/functions/_shared/intent.ts`
- Create: `supabase/functions/_shared/intent.test.ts`

**Background:** Die Anthropic-Antwort beim Klassifizieren ist ein JSON-String, eingebettet in `content[0].text`. Wir brauchen einen robusten Parser, der:
1. JSON aus Text extrahiert (auch wenn Anthropic Markdown-Code-Fences hinzufügt)
2. Validiert dass `agent` ein erlaubter Wert ist
3. Bei Validierungsfehlern eine klare Exception wirft

- [ ] **Step 1: Failing Test schreiben**

Erstelle `supabase/functions/_shared/intent.test.ts`:

```typescript
import { assertEquals, assertThrows } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { parseIntentResponse } from './intent.ts';

Deno.test('parseIntentResponse: parses valid JSON', () => {
  const raw = '{"agent":"offers","action":"create","entities":{"customer":"Müller"}}';
  const result = parseIntentResponse(raw);
  assertEquals(result.agent, 'offers');
  assertEquals(result.action, 'create');
  assertEquals(result.entities.customer, 'Müller');
});

Deno.test('parseIntentResponse: strips markdown code fences', () => {
  const raw = '```json\n{"agent":"invoices","action":"check_overdue","entities":{}}\n```';
  const result = parseIntentResponse(raw);
  assertEquals(result.agent, 'invoices');
});

Deno.test('parseIntentResponse: strips plain code fences', () => {
  const raw = '```\n{"agent":"planning","action":"daily_briefing","entities":{}}\n```';
  const result = parseIntentResponse(raw);
  assertEquals(result.agent, 'planning');
});

Deno.test('parseIntentResponse: throws on invalid JSON', () => {
  assertThrows(
    () => parseIntentResponse('this is not json'),
    Error,
    'Intent classification did not return valid JSON',
  );
});

Deno.test('parseIntentResponse: throws on unknown agent', () => {
  const raw = '{"agent":"hacker","action":"create","entities":{}}';
  assertThrows(
    () => parseIntentResponse(raw),
    Error,
    'Unknown agent type',
  );
});

Deno.test('parseIntentResponse: throws on missing action', () => {
  const raw = '{"agent":"offers","entities":{}}';
  assertThrows(
    () => parseIntentResponse(raw),
    Error,
    'Missing required field: action',
  );
});

Deno.test('parseIntentResponse: defaults entities to empty object', () => {
  const raw = '{"agent":"offers","action":"create"}';
  const result = parseIntentResponse(raw);
  assertEquals(result.entities, {});
});
```

- [ ] **Step 2: Test laufen lassen — muss fehlschlagen**

```bash
deno test supabase/functions/_shared/intent.test.ts
```
Expected: alle Tests fehlschlagen mit "Module not found" für `./intent.ts`.

- [ ] **Step 3: Minimale Implementation schreiben**

Erstelle `supabase/functions/_shared/intent.ts`:

```typescript
import type { AgentType, IntentClassification } from './types.ts';

const VALID_AGENTS: ReadonlySet<AgentType> = new Set(['offers', 'invoices', 'planning', 'materials']);

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

  const entities = (obj.entities && typeof obj.entities === 'object')
    ? obj.entities as Record<string, unknown>
    : {};

  return {
    agent: obj.agent as AgentType,
    action: obj.action,
    entities,
  };
}
```

- [ ] **Step 4: Tests laufen lassen — alle grün**

```bash
deno test supabase/functions/_shared/intent.test.ts
```
Expected: 7 passed, 0 failed.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/intent.ts supabase/functions/_shared/intent.test.ts
git commit -m "feat(agents): robust intent JSON parser with code-fence stripping + validation"
```

---

## Task 4: agent-router Edge Function

**Files:**
- Create: `supabase/functions/agent-router/index.ts`

**Background:** Der Router hat zwei Pfade:
1. **Heartbeat** — Trigger ist explicit. Direkt dispatchen ohne LLM-Call.
2. **User** — Anthropic klassifiziert die Nachricht via `parseIntentResponse`.

In beiden Fällen: einen `agent_tasks`-Eintrag anlegen (Status `running`), dann via `supabase.functions.invoke()` den Spezialagenten asynchron starten. Die Response an den Caller enthält `taskId` + dispatched agent.

- [ ] **Step 1: Skeleton schreiben**

Erstelle `supabase/functions/agent-router/index.ts`:

```typescript
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
```

- [ ] **Step 2: Type-Check**

```bash
deno check supabase/functions/agent-router/index.ts
```
Expected: keine Fehler.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/agent-router/index.ts
git commit -m "feat(agents): agent-router Edge Function — intent classification + dispatch"
```

---

## Task 5: agent-offers Tools (Pure-Logic, TDD wo möglich)

**Files:**
- Create: `supabase/functions/agent-offers/tools.ts`
- Create: `supabase/functions/agent-offers/tools.test.ts`

**Background:** Vier Tools:
1. `get_customer(name)` — sucht Kunde via ilike auf `customers.company_name` ODER `customers.contact_person`
2. `get_wuerth_prices(items[])` — gibt Mock-Preise zurück (echte API kommt in Phase 4)
3. `create_offer(...)` — schreibt eine Zeile in `offers` + N Zeilen in `offer_items`. Setzt `created_by_agent=true`, `agent_task_id=<taskId>`, `status='draft'`
4. `request_approval(taskId, offerId, preview)` — updatet `agent_tasks.status='awaiting_approval'` + `output={offerId, preview}`

Wir testen via Deno-Mock-Pattern — Tools nehmen einen "client-like" Parameter, Tests injizieren ein Fake-Objekt.

- [ ] **Step 1: Tool-Schemas + Failing Test schreiben**

Erstelle `supabase/functions/agent-offers/tools.test.ts`:

```typescript
import { assertEquals, assertExists } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { executeTool, TOOL_SCHEMAS } from './tools.ts';

// Minimaler Fake-Client der die Methoden aufzeichnet
function createFakeSupabase() {
  const calls: Array<{ table: string; op: string; args: unknown }> = [];
  return {
    calls,
    from(table: string) {
      return {
        select() {
          return {
            ilike(_col: string, val: string) {
              calls.push({ table, op: 'select_ilike', args: val });
              return {
                limit() { return this; },
                single: () => Promise.resolve({
                  data: { id: 'cust-1', company_name: 'Müller GmbH', email: 'm@m.de' },
                  error: null,
                }),
                maybeSingle: () => Promise.resolve({
                  data: { id: 'cust-1', company_name: 'Müller GmbH', email: 'm@m.de' },
                  error: null,
                }),
              };
            },
          };
        },
        insert(args: unknown) {
          calls.push({ table, op: 'insert', args });
          return {
            select() {
              return {
                single: () => Promise.resolve({
                  data: { id: `${table}-new-id` },
                  error: null,
                }),
              };
            },
          };
        },
        update(args: unknown) {
          calls.push({ table, op: 'update', args });
          return {
            eq: () => Promise.resolve({ error: null }),
          };
        },
      };
    },
  };
}

Deno.test('TOOL_SCHEMAS exposes all four tools', () => {
  const names = TOOL_SCHEMAS.map((t) => t.name);
  assertEquals(names.sort(), ['create_offer', 'get_customer', 'get_wuerth_prices', 'request_approval']);
});

Deno.test('executeTool: get_customer queries customers and returns row', async () => {
  const fake = createFakeSupabase();
  // deno-lint-ignore no-explicit-any
  const result = await executeTool('get_customer', { name: 'Müller' }, fake as any, 'task-1', 'comp-1');
  // deno-lint-ignore no-explicit-any
  assertEquals((result as any).id, 'cust-1');
  assertEquals(fake.calls[0].table, 'customers');
  assertEquals(fake.calls[0].op, 'select_ilike');
});

Deno.test('executeTool: get_wuerth_prices returns mock prices for each item', async () => {
  const fake = createFakeSupabase();
  // deno-lint-ignore no-explicit-any
  const result = await executeTool(
    'get_wuerth_prices',
    { items: ['NYM 3x1.5', 'Steckdose'] },
    fake as any,
    'task-1',
    'comp-1',
  );
  // deno-lint-ignore no-explicit-any
  const prices = result as any[];
  assertEquals(prices.length, 2);
  assertExists(prices[0].preis);
  assertEquals(prices[0].einheit, 'Stk');
});

Deno.test('executeTool: create_offer inserts into offers and offer_items', async () => {
  const fake = createFakeSupabase();
  // deno-lint-ignore no-explicit-any
  const result = await executeTool(
    'create_offer',
    {
      customerId: 'cust-1',
      customerName: 'Müller GmbH',
      projectName: 'Zählertausch',
      positionen: [
        { beschreibung: 'Zählertausch', menge: 1, einheit: 'Pauschal', einzelpreis: 450 },
        { beschreibung: 'Steckdose', menge: 3, einheit: 'Stk', einzelpreis: 35 },
      ],
    },
    fake as any,
    'task-1',
    'comp-1',
  );
  // deno-lint-ignore no-explicit-any
  const r = result as any;
  assertEquals(r.offerId, 'offers-new-id');
  assertEquals(r.gesamtNetto, 450 + 3 * 35);
  // 1 offers insert + 2 offer_items inserts
  const inserts = fake.calls.filter((c) => c.op === 'insert');
  assertEquals(inserts.length, 3);
  assertEquals(inserts[0].table, 'offers');
  assertEquals(inserts[1].table, 'offer_items');
  assertEquals(inserts[2].table, 'offer_items');
});

Deno.test('executeTool: request_approval updates agent_tasks status', async () => {
  const fake = createFakeSupabase();
  // deno-lint-ignore no-explicit-any
  const result = await executeTool(
    'request_approval',
    {
      taskId: 'task-1',
      offerId: 'offers-new-id',
      preview: { customer: 'Müller GmbH', total: 555 },
    },
    fake as any,
    'task-1',
    'comp-1',
  );
  // deno-lint-ignore no-explicit-any
  assertEquals((result as any).success, true);
  const updates = fake.calls.filter((c) => c.op === 'update');
  assertEquals(updates.length, 1);
  assertEquals(updates[0].table, 'agent_tasks');
});

Deno.test('executeTool: unknown tool returns error object', async () => {
  const fake = createFakeSupabase();
  // deno-lint-ignore no-explicit-any
  const result = await executeTool('does_not_exist', {}, fake as any, 'task-1', 'comp-1');
  // deno-lint-ignore no-explicit-any
  assertExists((result as any).error);
});
```

- [ ] **Step 2: Tests laufen — müssen fehlschlagen**

```bash
deno test supabase/functions/agent-offers/tools.test.ts
```
Expected: alle Tests fehlschlagen mit "Module not found".

- [ ] **Step 3: Tools-Implementation schreiben**

Erstelle `supabase/functions/agent-offers/tools.ts`:

```typescript
import type Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.27.0';
import type { SupabaseClient } from '../_shared/supabase.ts';

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
    description: 'Aktuelle Materialpreise von Würth abrufen (aktuell Mock — echte API kommt später).',
    input_schema: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: { type: 'string' },
          description: 'Liste von Materialien (z.B. "NYM 3x1.5", "Steckdose Schuko")',
        },
      },
      required: ['items'],
    },
  },
  {
    name: 'create_offer',
    description: 'Angebot als Entwurf anlegen. Wird IMMER mit status=draft erstellt — Versand erfolgt nur nach request_approval und User-Bestätigung.',
    input_schema: {
      type: 'object',
      properties: {
        customerId: { type: 'string' },
        customerName: { type: 'string' },
        projectName: { type: 'string', description: 'Kurzbezeichnung des Projekts (z.B. "Zählertausch")' },
        projectLocation: { type: 'string' },
        positionen: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              beschreibung: { type: 'string' },
              menge: { type: 'number' },
              einheit: { type: 'string', description: 'z.B. Stk, h, m, Pauschal' },
              einzelpreis: { type: 'number', description: 'Netto pro Einheit in EUR' },
              itemType: {
                type: 'string',
                enum: ['labor', 'material', 'lump_sum', 'other'],
                description: 'Standardwert: labor',
              },
            },
            required: ['beschreibung', 'menge', 'einheit', 'einzelpreis'],
          },
        },
        gueltigBis: { type: 'string', description: 'ISO date string, optional' },
      },
      required: ['customerId', 'customerName', 'projectName', 'positionen'],
    },
  },
  {
    name: 'request_approval',
    description: 'Freigabe beim Elektromeister anfragen. Setzt agent_tasks.status auf awaiting_approval und speichert eine Vorschau. Muss IMMER aufgerufen werden bevor der Agent fertig ist.',
    input_schema: {
      type: 'object',
      properties: {
        taskId: { type: 'string' },
        offerId: { type: 'string' },
        preview: {
          type: 'object',
          description: 'Vorschau für den User: customer, items, total, etc.',
        },
      },
      required: ['taskId', 'offerId', 'preview'],
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
    default:
      return { error: `Unbekanntes Tool: ${name}` };
  }
}

async function getCustomer(supabase: SupabaseClient, companyId: string, name: string) {
  // Suche zuerst in company_name, dann fallback auf contact_person
  const { data, error } = await supabase
    .from('customers')
    .select('id, company_name, contact_person, email, phone, address, city, zip_code')
    .ilike('company_name', `%${name}%`)
    .limit(1)
    .maybeSingle();
  if (error) return { error: error.message };
  if (data) return data;

  const fallback = await supabase
    .from('customers')
    .select('id, company_name, contact_person, email, phone, address, city, zip_code')
    .ilike('contact_person', `%${name}%`)
    .limit(1)
    .maybeSingle();
  return fallback.data ?? { error: `Kein Kunde gefunden für "${name}"` };
}

function getWuerthPrices(items: string[]) {
  // TODO: echte Würth-API integrieren (Phase 4)
  return items.map((item) => ({
    bezeichnung: item,
    preis: Math.round(Math.random() * 50 + 10),
    einheit: 'Stk',
  }));
}

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
  const vatRate = 19.0;
  const offerNumber = `KI-${Date.now()}`;

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

  // offer_items
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

  return { offerId: offer.id, offerNumber, gesamtNetto, gesamtBrutto: gesamtNetto * (1 + vatRate / 100) };
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
```

- [ ] **Step 4: Tests laufen — alle grün**

```bash
deno test supabase/functions/agent-offers/tools.test.ts
```
Expected: 6 passed, 0 failed.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/agent-offers/tools.ts supabase/functions/agent-offers/tools.test.ts
git commit -m "feat(agents): agent-offers tools (get_customer, get_wuerth_prices, create_offer, request_approval)"
```

---

## Task 6: agent-offers Edge Function (Agentic Loop)

**Files:**
- Create: `supabase/functions/agent-offers/index.ts`

**Background:** Der Agent läuft in einer while-Schleife: Anthropic-Call → wenn `stop_reason === 'tool_use'`, führe Tools aus, häng `tool_result`-Blöcke an die Messages und loope. Sonst: fertig.

**Limit:** Maximal 10 Iterationen — Schutz gegen runaway loops bei Halluzinationen.

- [ ] **Step 1: Handler schreiben**

Erstelle `supabase/functions/agent-offers/index.ts`:

```typescript
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createServiceRoleClient } from '../_shared/supabase.ts';
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
  try {
    const { taskId, action, payload } = (await req.json()) as AgentRequest;
    const supabase = createServiceRoleClient();

    // companyId aus dem Task laden (Source of Truth — nicht aus Payload vertrauen)
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
      // Loop limit erreicht
      await supabase.from('agent_tasks').update({
        status: 'failed',
        error: `MAX_ITERATIONS (${MAX_ITERATIONS}) erreicht ohne final response`,
        tool_calls: toolCallLog,
      }).eq('id', taskId);
      return new Response(JSON.stringify({ ok: false, taskId }), { status: 500 });
    }

    // Wenn request_approval aufgerufen wurde, ist status bereits 'awaiting_approval'.
    // Falls nicht (Agent hat's vergessen), trotzdem als awaiting_approval markieren mit Hinweis.
    const { data: currentTask } = await supabase
      .from('agent_tasks')
      .select('status, output')
      .eq('id', taskId)
      .single();

    const needsForcedApproval = currentTask?.status === 'running';
    await supabase.from('agent_tasks').update({
      status: needsForcedApproval ? 'awaiting_approval' : currentTask?.status,
      tool_calls: toolCallLog,
      output: needsForcedApproval
        ? { ...((currentTask?.output as object) ?? {}), agentMessage: finalText, warning: 'request_approval was not called' }
        : { ...((currentTask?.output as object) ?? {}), agentMessage: finalText },
    }).eq('id', taskId);

    return new Response(JSON.stringify({ ok: true, taskId, message: finalText }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('agent-offers error:', message);
    // Best-effort: Fehler in den Task schreiben
    try {
      const supabase = createServiceRoleClient();
      const body = await req.clone().json().catch(() => ({}));
      // deno-lint-ignore no-explicit-any
      const taskId = (body as any).taskId;
      if (taskId) {
        await supabase.from('agent_tasks').update({
          status: 'failed',
          error: message,
        }).eq('id', taskId);
      }
    } catch { /* ignore */ }
    return new Response(JSON.stringify({ ok: false, error: message }), { status: 500 });
  }
});
```

- [ ] **Step 2: Type-Check**

```bash
deno check supabase/functions/agent-offers/index.ts
```
Expected: keine Fehler.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/agent-offers/index.ts
git commit -m "feat(agents): agent-offers Edge Function — agentic loop with tool-use"
```

---

## Task 7: Edge Functions deployen

**Files:**
- Deploy: `agent-router`, `agent-offers`

- [ ] **Step 1: agent-router deployen**

Verwende `mcp__plugin_supabase_supabase__deploy_edge_function`:
```
project_id: qgwhkjrhndeoskrxewpb
name: agent-router
files: [
  { name: "index.ts", content: <Inhalt von supabase/functions/agent-router/index.ts> },
  { name: "../_shared/supabase.ts", content: <Inhalt von _shared/supabase.ts> },
  { name: "../_shared/anthropic.ts", content: <Inhalt von _shared/anthropic.ts> },
  { name: "../_shared/intent.ts", content: <Inhalt von _shared/intent.ts> },
  { name: "../_shared/types.ts", content: <Inhalt von _shared/types.ts> }
]
```
Expected: deployment success ohne Fehler.

- [ ] **Step 2: agent-offers deployen**

```
project_id: qgwhkjrhndeoskrxewpb
name: agent-offers
files: [
  { name: "index.ts", content: <Inhalt von supabase/functions/agent-offers/index.ts> },
  { name: "tools.ts", content: <Inhalt von supabase/functions/agent-offers/tools.ts> },
  { name: "../_shared/supabase.ts", content: <Inhalt> },
  { name: "../_shared/anthropic.ts", content: <Inhalt> },
  { name: "../_shared/types.ts", content: <Inhalt> }
]
```

- [ ] **Step 3: Beide Functions in der Liste verifizieren**

`mcp__plugin_supabase_supabase__list_edge_functions` mit `project_id: qgwhkjrhndeoskrxewpb`.
Expected: `agent-router` und `agent-offers` erscheinen mit aktuellem Deployment-Datum.

- [ ] **Step 4: Env-Vars prüfen**

Verifiziere via Test-Aufruf in Step 5 (separate env-var-Liste-API gibt's nicht — Aufruf-Fehler offenbart fehlende Vars).

---

## Task 8: End-to-End-Smoke-Test

**Files:**
- Create: `scripts/agent-smoke-test.sh`

**Background:** Wir rufen den Router mit einer realistischen User-Nachricht an, beobachten die `agent_tasks`-Zeile und das resultierende `offers`-Eintrag.

- [ ] **Step 1: Smoke-Test-Skript schreiben**

Erstelle `scripts/agent-smoke-test.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

# Required env:
#   SUPABASE_URL          (https://qgwhkjrhndeoskrxewpb.supabase.co)
#   SUPABASE_ANON_KEY     (für Auth-Header)
#   SMOKE_USER_JWT        (JWT eines Test-Users, dessen profile.company_id eine Test-Company ist)
#   SMOKE_COMPANY_ID
#   SMOKE_USER_ID

if [[ -z "${SUPABASE_URL:-}" || -z "${SMOKE_USER_JWT:-}" || -z "${SMOKE_COMPANY_ID:-}" || -z "${SMOKE_USER_ID:-}" ]]; then
  echo "Missing required env. See top of script."
  exit 1
fi

echo "→ Calling agent-router with user message..."
RESPONSE=$(curl -sS -X POST "$SUPABASE_URL/functions/v1/agent-router" \
  -H "Authorization: Bearer $SMOKE_USER_JWT" \
  -H "Content-Type: application/json" \
  -d "{\"message\":\"Erstelle Angebot für Müller, Zählertausch + 3 Steckdosen\",\"companyId\":\"$SMOKE_COMPANY_ID\",\"userId\":\"$SMOKE_USER_ID\"}")

echo "Response: $RESPONSE"
TASK_ID=$(echo "$RESPONSE" | grep -oE '"taskId":"[^"]+"' | cut -d'"' -f4)

if [[ -z "$TASK_ID" ]]; then
  echo "FAIL: kein taskId in Response"
  exit 1
fi

echo "→ Task created: $TASK_ID. Warte 15s auf Agent-Completion..."
sleep 15

echo "→ Skript-Ende. Verifiziere via SQL:"
echo "   SELECT status, agent_type, jsonb_array_length(tool_calls) AS tool_count, output FROM agent_tasks WHERE id = '$TASK_ID';"
echo "   SELECT id, offer_number, status, customer_name, project_name, snapshot_net_total FROM offers WHERE agent_task_id = '$TASK_ID';"
```

```bash
chmod +x scripts/agent-smoke-test.sh
```

- [ ] **Step 2: Test-Daten in DB sicherstellen**

Via `mcp__plugin_supabase_supabase__execute_sql` einen existierenden Test-Kunden bzw. eine Test-Company prüfen:
```sql
-- Existiert ein Kunde "Müller" für irgendeine Company?
SELECT id, company_id, company_name FROM customers WHERE company_name ILIKE '%müller%' LIMIT 5;
```

Falls kein passender Kunde existiert: einen anlegen (manuell oder hier via SQL für Test):
```sql
INSERT INTO customers (company_id, company_name, contact_person, email)
SELECT id, 'Müller GmbH (Test)', 'Hans Müller', 'hans@mueller-test.de' FROM companies LIMIT 1
ON CONFLICT DO NOTHING;
```

- [ ] **Step 3: Heartbeat-Pfad smoke-testen (ohne LLM)**

Direkt mit curl gegen den Router:
```bash
curl -sS -X POST "$SUPABASE_URL/functions/v1/agent-router" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"trigger\":\"heartbeat\",\"agent\":\"offers\",\"action\":\"noop\",\"companyId\":\"$SMOKE_COMPANY_ID\"}"
```
Expected: `{"taskId":"...","agent":"offers","action":"noop"}`

Verifizieren:
```sql
SELECT id, status, trigger_type, agent_type FROM agent_tasks WHERE trigger_type = 'heartbeat' ORDER BY created_at DESC LIMIT 1;
```
Expected: 1 Zeile, status entweder `running` oder `awaiting_approval`/`failed` (je nachdem was der Agent macht — der wird mit action=noop und keinem originalMessage vermutlich kurz antworten und request_approval skippen → das gibt status='awaiting_approval' mit warning).

- [ ] **Step 4: User-Pfad mit echter Anthropic-Klassifikation testen**

```bash
./scripts/agent-smoke-test.sh
```

Dann SQL:
```sql
SELECT
  at.id,
  at.status,
  at.agent_type,
  at.intent,
  jsonb_array_length(at.tool_calls) AS tool_count,
  at.output->>'agentMessage' AS message,
  at.error
FROM agent_tasks at
WHERE at.id = '<TASK_ID-aus-Skript>';

SELECT
  o.id, o.offer_number, o.status, o.customer_name, o.project_name,
  o.created_by_agent, o.snapshot_net_total,
  (SELECT count(*) FROM offer_items WHERE offer_id = o.id) AS item_count
FROM offers o
WHERE o.agent_task_id = '<TASK_ID>';
```

Expected:
- `agent_tasks.status = 'awaiting_approval'`
- `agent_tasks.intent.agent = 'offers'`
- `tool_count >= 3` (mindestens get_customer, create_offer, request_approval)
- `offers.created_by_agent = true`
- `offers.status = 'draft'`
- `item_count >= 1`

- [ ] **Step 5: Edge-Function-Logs reviewen**

`mcp__plugin_supabase_supabase__get_logs` mit `project_id: qgwhkjrhndeoskrxewpb`, `service: edge-function`.
Schau nach Errors/Warnings. Saubere Tasks haben keine error-Zeilen.

- [ ] **Step 6: Smoke-Test-Skript committen**

```bash
git add scripts/agent-smoke-test.sh
git commit -m "test(agents): end-to-end smoke test script for agent-router + agent-offers"
```

---

## Task 9: Plan abschließen + Handoff

- [ ] **Step 1: Plan-Datei selbst aktualisieren**

Markiere alle Checkboxen oben als `[x]` (alle Tasks erledigt).

- [ ] **Step 2: Worktree-Branch fertig stellen**

```bash
git log --oneline -10
```
Expected: 7-9 frische Commits ab Task 1.

- [ ] **Step 3: Pull Request öffnen**

Sobald Tests grün und Smoke-Tests durchlaufen sind:
```bash
git push -u origin claude/naughty-nash-c67e4f
gh pr create --title "feat(agents): Phase 1 — Backend-MVP der KI-Agent-Engine" --body "$(cat <<'EOF'
## Summary
- Migration: `agent_tasks` Tabelle (append-only via DELETE-Trigger, GoBD-konform) + `created_by_agent`/`agent_task_id` in `offers`/`invoices`/`orders`
- Edge Function `agent-router`: Intent-Klassifikation via Anthropic Sonnet 4.6, Dispatch an Spezialagenten
- Edge Function `agent-offers`: Agentic loop mit 4 Tools (get_customer, get_wuerth_prices, create_offer, request_approval)
- Realtime-Subscription für `agent_tasks` aktiviert (für Phase-2-Frontend)

## Test plan
- [ ] Migration applied auf Remote-DB ohne Fehler
- [ ] DELETE auf `agent_tasks` blockiert (verifizier mit explizitem Test-Insert + Delete-Versuch)
- [ ] `deno test` grün für intent.ts und tools.ts
- [ ] Smoke-Test `scripts/agent-smoke-test.sh` läuft durch
- [ ] User-Nachricht erzeugt `offers`-Eintrag mit `created_by_agent=true`, `status='draft'`
- [ ] Heartbeat-Pfad funktioniert ohne LLM-Call

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 4: Phase-2-Plan ankündigen**

Phase 2 (Frontend) ist eigener Plan. Nicht in diesem PR. Stichworte für nächsten Plan:
- `useAgentChat` Hook (Realtime-Subscription auf `agent_tasks`)
- `AgentChatView` Komponente (neuer Sidebar-Tab in [AppSidebarV2.tsx:38](src/components/AppSidebarV2.tsx))
- `ApprovalCard` Komponente (im Chat, mit "Freigeben & senden"-Button)
- KI-Badge in `OfferModuleV2` und `InvoiceModuleV2` Listen

---

## Out of Scope (separate Pläne)

- **Phase 2: Frontend-Integration** — `useAgentChat`, `AgentChatView`, `ApprovalCard`, KI-Badge
- **Phase 3.1: Weitere Agents** — `agent-invoices` (Mahnungen), `agent-planning` (Termine), `agent-materials` (Bestellung)
- **Phase 3.2: Heartbeat-Automation** — pg_cron-Jobs für `mahnungen-check` (Mo–Fr 08:00) und `terminreminder` (Mo–Fr 06:00)
- **Phase 4: Würth/Sonepar-API** — echte Material-Preise statt Mock
- **Approve-Action im Backend** — sobald User in der UI freigibt, muss eine separate `agent-approve` Edge Function das eigentliche Senden machen (E-Mail via Resend etc.). Aktuell ist `request_approval` nur ein Status-Toggle ohne weitere Aktion.

---

## Verification Checklist (Self-Review)

**Spec coverage:**
- ✅ `agent_tasks` Tabelle mit allen Spalten aus Spec → Task 1
- ✅ DELETE-Schutz für GoBD → Task 1, Step 6 testet
- ✅ `created_by_agent` + `agent_task_id` in `offers`/`invoices`/`orders` → Task 1
- ✅ Realtime-Publication → Task 1
- ✅ `agent-router` mit Heartbeat- und User-Pfad → Task 4
- ✅ Intent-JSON-Parser robust gegen Code-Fences → Task 3
- ✅ `agent-offers` mit allen 4 Tools aus Spec → Task 5
- ✅ Agentic loop mit Iteration-Limit → Task 6
- ✅ End-to-End-Smoke-Test → Task 8

**Bewusste Abweichungen vom Original-Spec:**
- Tabellennamen englisch (`offers` statt `angebote`) — vom User in dieser Session bestätigt
- Modell `claude-sonnet-4-6` statt `claude-sonnet-4-5-20251001` — neueres Modell verfügbar
- `tool_calls` als `JSONB DEFAULT '[]'::jsonb` statt `JSONB[]` — Postgres-idiomatisch
- `MAX_ITERATIONS = 10` als Schutz gegen runaway loops (Spec hatte kein Limit)
- `executeTool` nimmt `companyId` als Parameter (Sicherheit: nicht aus LLM-Input vertrauen)
- agent-offers lädt `companyId` aus dem Task-Row, nicht aus dem Payload (Hardening)
- Smoke-Test verifiziert auch den Fall dass `request_approval` vergessen wird (Forced-Approval-Pfad)
