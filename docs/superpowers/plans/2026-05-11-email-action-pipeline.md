# Email-Action-Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bridge `classify-email` to the existing `agent-router` system so in-scope emails (Anfrage / Auftrag / Rechnung, confidence ≥ 0.6) automatically generate review-ready suggestions in `agent_tasks`.

**Architecture:** Synchronous invoke at the end of `classify-email` triggers `agent-router` with a new `trigger_type='email'`. agent-router does direct (non-LLM) mapping to one of three handlers: `agent-offers` for Anfragen (LLM + RAG), `agent-planning` for Aufträge (deterministic + LLM confirmation), `process-email-invoice` (new wrapper) for Rechnungen (deterministic + OCR). All outputs land in `agent_tasks` with `status='awaiting_approval'` for manual review via a new UI dialog.

**Tech Stack:** Deno-based Supabase Edge Functions, TypeScript, Anthropic Claude Sonnet 4.6 (existing `_shared/anthropic.ts`), Supabase JS Client 2.x, OpenAI text-embedding-3-small (existing `process-ai-queue`), React + Vitest + Testing Library.

**Pre-requisites before any task:**
1. **`npm install`** must have been run in the worktree (otherwise vitest can't start: `jsdom` missing).
2. **Spec reference:** [`docs/superpowers/specs/2026-05-11-email-action-pipeline-design.md`](../specs/2026-05-11-email-action-pipeline-design.md). Read it before starting.
3. **Supabase MCP** must be available for edge function deploys (CLI is not installed locally).
4. **Service-role JWT** for testing direct edge function invocations — get via `mcp__plugin_supabase_supabase__get_publishable_keys` if anon key suffices, or via Supabase dashboard for the service-role key.

---

## Phase 0 — Repository Hygiene

### Task 0.1: Pull existing agent-* edge functions into the repo

Currently `agent-router`, `agent-offers`, `agent-invoices`, `agent-planning`, `agent-materials` only exist on Supabase. Modifying them blind risks losing changes. One-time sync into git.

**Files:**
- Create: `supabase/functions/agent-router/index.ts`
- Create: `supabase/functions/agent-router/_shared/supabase.ts`
- Create: `supabase/functions/agent-router/_shared/anthropic.ts`
- Create: `supabase/functions/agent-router/_shared/intent.ts`
- Create: `supabase/functions/agent-router/_shared/types.ts`
- Create: `supabase/functions/agent-offers/index.ts`
- Create: `supabase/functions/agent-offers/tools.ts`
- Create: `supabase/functions/agent-offers/_shared/*` (same files as router)
- Create: `supabase/functions/agent-planning/index.ts`
- Create: `supabase/functions/agent-planning/tools.ts` (if exists on server)
- Create: `supabase/functions/agent-planning/_shared/*`
- Create: `supabase/functions/agent-invoices/index.ts`
- Create: `supabase/functions/agent-invoices/tools.ts`
- Create: `supabase/functions/agent-invoices/_shared/*`

- [ ] **Step 1: Pull agent-router via MCP**

Use the `mcp__plugin_supabase_supabase__get_edge_function` tool with `function_slug='agent-router'` and `project_id='qgwhkjrhndeoskrxewpb'`. The response contains a `files[]` array. Write each file's `content` to its real path under `supabase/functions/agent-router/`. The MCP encodes paths like `user_fn_..._3/source/index.ts` and `user_fn_..._3/_shared/supabase.ts` — strip the `user_fn_..._N/` prefix and the optional `source/` segment when saving.

- [ ] **Step 2: Pull agent-offers, agent-planning, agent-invoices, agent-materials the same way**

Repeat the MCP call for each slug. Same prefix stripping.

- [ ] **Step 3: Verify file structure on disk**

Run:
```bash
ls supabase/functions/agent-router/
ls supabase/functions/agent-router/_shared/
ls supabase/functions/agent-offers/
```
Expected: `index.ts` in each function folder, `_shared/` with `supabase.ts`, `anthropic.ts`, `intent.ts`, `types.ts`.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/agent-router supabase/functions/agent-offers supabase/functions/agent-invoices supabase/functions/agent-planning supabase/functions/agent-materials
git commit -m "chore(agents): sync deployed agent-* edge functions into repo"
```

---

## Phase 1 — Bridge Foundation

The Bridge has two halves: agent-router learns to accept email-triggered dispatches, and classify-email starts invoking agent-router after classification. We build the receiver first, then the caller, because that lets us test agent-router manually before touching the live email flow.

### Task 1.1: agent-router — extend with `trigger='email'` handler

**Files:**
- Modify: `supabase/functions/agent-router/index.ts`

- [ ] **Step 1: Read current agent-router/index.ts**

Open and re-read the file pulled in Task 0.1. You will find:
- `serve()` handler that branches on `body.trigger === 'heartbeat'` vs user.
- `dispatchAgent()` that creates an `agent_tasks` row and invokes `agent-${agentType}`.
- `INTENT_SYSTEM_PROMPT` and `classifyIntent()` for user-triggered LLM intent classification.
- `VALID_AGENTS = new Set<AgentType>(['offers', 'invoices', 'planning', 'materials'])`.

You will **add** a third branch for `body.trigger === 'email'`. You will **not** call any LLM in this branch — the category is already known.

- [ ] **Step 2: Add the EMAIL_CATEGORY_MAPPING constant**

Add this near the top of the file, after the `VALID_AGENTS` declaration:

```typescript
type EmailCategory = 'Anfrage' | 'Auftrag' | 'Rechnung';

interface EmailDispatchTarget {
  agentType: AgentType | 'invoices_inbound';
  action: string;
  // If functionSlug is set, agent-router invokes that function directly
  // instead of agent-${agentType}. Used for non-LLM handlers.
  functionSlug?: string;
}

const EMAIL_CATEGORY_MAPPING: Record<EmailCategory, EmailDispatchTarget> = {
  Anfrage:  { agentType: 'offers',           action: 'draft_quote_from_email' },
  Auftrag:  { agentType: 'planning',         action: 'link_to_existing_order' },
  Rechnung: { agentType: 'invoices_inbound', action: 'process_inbound_invoice_email',
              functionSlug: 'process-email-invoice' },
};

const SUPPORTED_EMAIL_CATEGORIES = Object.keys(EMAIL_CATEGORY_MAPPING) as EmailCategory[];
```

- [ ] **Step 3: Add the `isValidEmailBody` type guard**

Below the existing `isValidUserBody`:

```typescript
interface EmailTriggerBody {
  trigger: 'email';
  emailId: string;
  category: EmailCategory;
  companyId: string;
  extractedData?: Record<string, unknown>;
}

function isValidEmailBody(body: unknown): body is EmailTriggerBody {
  if (!body || typeof body !== 'object') return false;
  const b = body as Record<string, unknown>;
  if (b.trigger !== 'email') return false;
  if (typeof b.emailId !== 'string' || b.emailId.length === 0) return false;
  if (typeof b.companyId !== 'string' || b.companyId.length === 0) return false;
  if (typeof b.category !== 'string') return false;
  if (!SUPPORTED_EMAIL_CATEGORIES.includes(b.category as EmailCategory)) return false;
  return true;
}
```

- [ ] **Step 4: Add the email branch in `serve()`**

Inside `serve()`, after the existing `if (body.trigger === 'heartbeat')` block and BEFORE the user-message logic, add:

```typescript
if (body.trigger === 'email') {
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!serviceRoleKey || jwt !== serviceRoleKey) {
    return jsonResponse({ error: 'email trigger requires service-role authorization' }, 403);
  }
  if (!isValidEmailBody(body)) {
    return jsonResponse({ error: 'invalid email body — emailId, category, companyId required' }, 400);
  }
  const target = EMAIL_CATEGORY_MAPPING[body.category];
  const payload = {
    emailId: body.emailId,
    category: body.category,
    extractedData: body.extractedData ?? {},
  };
  const result = await dispatchAgent(
    supabase,
    target.agentType as AgentType,
    target.action,
    payload,
    body.companyId,
    'email' as TriggerType,
    null,
    target.functionSlug,
  );
  return jsonResponse(result, 200);
}
```

- [ ] **Step 5: Extend `dispatchAgent` to accept optional `functionSlug`**

Modify the existing `dispatchAgent` signature and the invoke line. Replace the function signature:

```typescript
async function dispatchAgent(
  supabase: ReturnType<typeof createServiceRoleClient>,
  agentType: AgentType | 'invoices_inbound',
  action: string,
  payload: Record<string, unknown>,
  companyId: string,
  triggerType: TriggerType,
  intent: IntentClassification | null,
  functionSlug?: string,
) {
```

And replace the invoke line:

```typescript
const targetSlug = functionSlug ?? `agent-${agentType}`;
const { error: invokeErr } = await supabase.functions.invoke(targetSlug, {
  body: { taskId, action, payload },
});
```

Adjust the error message just below to reference `targetSlug` instead of `agent-${agentType}`.

- [ ] **Step 6: Extend `TriggerType` in `_shared/types.ts`**

Open `supabase/functions/agent-router/_shared/types.ts`. The existing `TriggerType` is `'user' | 'heartbeat'`. Add `'email'`:

```typescript
export type TriggerType = 'user' | 'heartbeat' | 'email';
```

- [ ] **Step 7: Deploy via MCP**

Use `mcp__plugin_supabase_supabase__deploy_edge_function`:
- project_id: `qgwhkjrhndeoskrxewpb`
- name: `agent-router`
- entrypoint_path: `index.ts`
- verify_jwt: `true`
- files: array of all `index.ts` + `_shared/*.ts` files with current content

- [ ] **Step 8: Smoke-test the new branch with curl**

Get the service-role key from Supabase dashboard (Settings → API → service_role). DO NOT commit this key. Then:

```bash
SERVICE_KEY='<service-role-jwt>'
COMPANY_ID='<your-company-uuid>'  # SELECT id FROM companies LIMIT 1;

curl -s -X POST 'https://qgwhkjrhndeoskrxewpb.supabase.co/functions/v1/agent-router' \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H 'Content-Type: application/json' \
  -d "{\"trigger\":\"email\",\"emailId\":\"00000000-0000-0000-0000-000000000001\",\"category\":\"Anfrage\",\"companyId\":\"$COMPANY_ID\"}"
```

Expected: `{"taskId":"...","agent":"offers","action":"draft_quote_from_email"}` and an `agent_tasks` row with `status='running'` (will fail downstream because agent-offers doesn't know the action yet — that's fine, expected).

Verify in SQL:
```sql
SELECT id, agent_type, trigger_type, status, input, error 
FROM agent_tasks 
ORDER BY created_at DESC LIMIT 1;
```

- [ ] **Step 9: Negative tests**

Same curl with `category="Spam"` should return HTTP 400. With wrong auth: 403. With missing emailId: 400. Verify each.

- [ ] **Step 10: Commit**

```bash
git add supabase/functions/agent-router
git commit -m "feat(agent-router): add trigger='email' branch with category mapping"
```

---

### Task 1.2: classify-email — idempotency guard + bridge invoke

**Files:**
- Modify: `supabase/functions/classify-email/index.ts`

- [ ] **Step 1: Read current classify-email/index.ts**

Re-read the file. Note the flow: parses body, calls OpenAI, writes results to `emails` table at the end with `ai_category_id`, `ai_confidence`, `ai_extracted_data`. Returns response.

- [ ] **Step 2: Add idempotency guard at the start**

Right after parsing `{ emailId, ... }`, before the OpenAI call, add:

```typescript
// Atomic claim: only this run gets to classify. If another instance
// is already classifying or has finished, exit silently.
const { data: claimed, error: claimError } = await supabase
  .from('emails')
  .update({ processing_status: 'classifying' })
  .eq('id', emailId)
  .eq('processing_status', 'pending')
  .select('id')
  .maybeSingle();

if (claimError) {
  console.error('classify-email claim error:', claimError);
  return new Response(JSON.stringify({ error: 'claim failed', detail: claimError.message }), {
    status: 500,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

if (!claimed) {
  console.log(`classify-email: email ${emailId} not in 'pending' state, skipping`);
  return new Response(JSON.stringify({ skipped: true, reason: 'not pending' }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
```

- [ ] **Step 3: Add the bridge invoke at the end**

After the existing block that writes `ai_category_id`, `ai_confidence`, `ai_extracted_data` to the email row, but before the final response, add:

```typescript
// Bridge into agent-router for in-scope categories with high confidence.
// Spec: docs/superpowers/specs/2026-05-11-email-action-pipeline-design.md
const SUPPORTED = new Set(['Anfrage', 'Auftrag', 'Rechnung']);
const confidence = typeof classification.confidence === 'number' ? classification.confidence : 0;
const category = classification.category;

let newStatus: string;
if (confidence < 0.6) {
  newStatus = 'needs_review';
} else if (!SUPPORTED.has(category)) {
  newStatus = 'out_of_scope';
} else {
  newStatus = 'dispatched';
}

await supabase.from('emails').update({ processing_status: newStatus }).eq('id', emailId);

if (newStatus === 'dispatched') {
  // Fetch company_id for this email - we need it for agent-router dispatch.
  const { data: emailRow } = await supabase
    .from('emails')
    .select('company_id')
    .eq('id', emailId)
    .single();

  if (emailRow?.company_id) {
    const { error: invokeError } = await supabase.functions.invoke('agent-router', {
      body: {
        trigger: 'email',
        emailId,
        category,
        companyId: emailRow.company_id,
        extractedData: classification.extractedData ?? {},
      },
    });

    if (invokeError) {
      console.error('classify-email: agent-router dispatch failed:', invokeError);
      await supabase
        .from('emails')
        .update({ processing_status: 'dispatch_failed' })
        .eq('id', emailId);
    }
  } else {
    console.error(`classify-email: email ${emailId} has no company_id, cannot dispatch`);
    await supabase
      .from('emails')
      .update({ processing_status: 'dispatch_failed' })
      .eq('id', emailId);
  }
}
```

- [ ] **Step 4: Verify the Supabase client used here has service-role privileges**

The bridge invoke uses the service-role auth implicitly because `supabase.functions.invoke` from inside an edge function carries the function's own JWT (service-role when triggered server-side). However, `classify-email` is currently called from the frontend with the user's JWT (see `Authorization: req.headers.get('Authorization')` at the top of the file). 

This means `supabase.functions.invoke('agent-router', ...)` would forward the user's JWT, but agent-router's `trigger='email'` branch requires service-role. Fix this by creating a **separate** service-role client just for the dispatch call:

Add near the top of the function body, after the existing `supabase` client is created:

```typescript
const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);
```

Then use `supabaseAdmin.functions.invoke('agent-router', ...)` in the bridge block (not `supabase`). All other reads/writes in the function keep using the original user-context `supabase`.

- [ ] **Step 5: Deploy via MCP**

Use `mcp__plugin_supabase_supabase__deploy_edge_function`:
- project_id: `qgwhkjrhndeoskrxewpb`
- name: `classify-email`
- entrypoint_path: `index.ts`
- verify_jwt: `true`
- files: just `index.ts` with new content

- [ ] **Step 6: End-to-end smoke test**

In SQL, find an unprocessed email or insert a test one:
```sql
-- Find a pending email
SELECT id, subject, processing_status FROM emails WHERE processing_status = 'pending' LIMIT 1;

-- OR insert a test email (replace COMPANY_ID with your company UUID)
INSERT INTO emails (company_id, subject, sender_email, recipient_email, content, processing_status)
VALUES ('<COMPANY_ID>', 'Anfrage Steckdosen Wohnzimmer', 
        'test@example.com', 'info@yourdomain.com',
        'Hallo, ich benötige 3 Steckdosen im Wohnzimmer. Termin nächste Woche?',
        'pending')
RETURNING id;
```

Trigger classify-email manually:
```bash
ANON_KEY='<anon-jwt-from-publishable-keys>'
EMAIL_ID='<id-from-above>'

curl -s -X POST 'https://qgwhkjrhndeoskrxewpb.supabase.co/functions/v1/classify-email' \
  -H "Authorization: Bearer $ANON_KEY" \
  -H 'Content-Type: application/json' \
  -d "{\"emailId\":\"$EMAIL_ID\",\"subject\":\"Anfrage Steckdosen Wohnzimmer\",\"content\":\"Hallo, ich benötige 3 Steckdosen.\",\"senderEmail\":\"test@example.com\",\"senderName\":\"Test\"}"
```

Verify in SQL:
```sql
SELECT id, processing_status, ai_confidence, ai_category_id FROM emails WHERE id = '<EMAIL_ID>';
SELECT id, agent_type, trigger_type, status, input FROM agent_tasks ORDER BY created_at DESC LIMIT 1;
```

Expected:
- `emails.processing_status = 'dispatched'`
- `ai_confidence ≥ 0.6` (typically 0.8-0.95 for clear Anfragen)
- One `agent_tasks` row with `agent_type='offers'`, `trigger_type='email'`, `status='running'` or `'failed'` (failure expected — agent-offers doesn't know the action yet).

- [ ] **Step 7: Idempotency test**

Trigger classify-email a second time with the same `emailId`. Expected response: `{"skipped":true,"reason":"not pending"}` (because processing_status is now 'dispatched', not 'pending').

- [ ] **Step 8: Commit**

```bash
git add supabase/functions/classify-email/index.ts
git commit -m "feat(classify-email): idempotency guard + agent-router bridge"
```

---

## Phase 2 — Rechnung Handler (`process-email-invoice` Wrapper)

The Rechnung path is the simplest because it's deterministic — load attachment, OCR, match, store. No LLM. Implement this first to validate the agent-router → handler dispatch end-to-end before tackling LLM-driven handlers.

### Task 2.1: New `process-email-invoice` edge function

**Files:**
- Create: `supabase/functions/process-email-invoice/index.ts`

- [ ] **Step 1: Inspect the email_attachments schema**

Run this SQL via MCP to understand attachment storage:
```sql
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_schema='public' AND table_name='email_attachments' 
ORDER BY ordinal_position;
```

Note the column names (likely `id`, `email_id`, `filename`, `mime_type`, `storage_path` or `content_base64`, etc.). The exact loading mechanism (storage bucket vs inline base64) determines what `process-email-invoice` does in Step 3.

- [ ] **Step 2: Create the file with handler skeleton**

```typescript
// supabase/functions/process-email-invoice/index.ts
//
// Wrapper for inbound invoice emails. Invoked by agent-router when an
// email is classified as 'Rechnung'. Loads the first PDF/image attachment,
// converts to base64, delegates extraction to process-invoice-ocr, then
// does deterministic supplier+order matching. Writes the suggestion to
// agent_tasks.output for human review.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface InvokeBody {
  taskId: string;
  action: string;
  payload: {
    emailId: string;
    category?: string;
    extractedData?: Record<string, unknown>;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) {
    return jsonResponse({ error: 'missing authorization' }, 401);
  }
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!serviceRoleKey || auth.substring(7) !== serviceRoleKey) {
    return jsonResponse({ error: 'service-role required' }, 403);
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    serviceRoleKey,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  let taskId = '';
  try {
    const body = (await req.json()) as InvokeBody;
    if (typeof body.taskId !== 'string' || body.taskId.length === 0) {
      return jsonResponse({ error: 'taskId required' }, 400);
    }
    taskId = body.taskId;
    const emailId = body.payload?.emailId;
    if (typeof emailId !== 'string' || emailId.length === 0) {
      throw new Error('payload.emailId required');
    }

    const result = await processInboundInvoice(supabase, emailId);
    await markCompleted(supabase, taskId, result, emailId);
    return jsonResponse({ ok: true, taskId }, 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown';
    console.error('process-email-invoice error:', message);
    if (taskId) await markFailed(supabase, taskId, message);
    return jsonResponse({ ok: false, error: message }, 500);
  }
});

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function markCompleted(
  supabase: SupabaseClient,
  taskId: string,
  preview: Record<string, unknown>,
  emailId: string,
) {
  await supabase.from('agent_tasks').update({
    status: 'awaiting_approval',
    output: { action: 'process_inbound_invoice_email', preview },
  }).eq('id', taskId);
  await supabase.from('emails').update({
    processing_status: 'awaiting_approval',
  }).eq('id', emailId);
}

async function markFailed(supabase: SupabaseClient, taskId: string, error: string) {
  await supabase.from('agent_tasks').update({ status: 'failed', error }).eq('id', taskId);
  // Also bump emails.processing_status — fetch the email_id from the task input.
  const { data: task } = await supabase
    .from('agent_tasks').select('input').eq('id', taskId).maybeSingle();
  const emailId = (task?.input as Record<string, unknown> | null)?.emailId;
  if (typeof emailId === 'string') {
    await supabase.from('emails').update({
      processing_status: 'needs_review',
    }).eq('id', emailId);
  }
}
```

- [ ] **Step 3: Implement `processInboundInvoice`**

This is the core logic. Append to the same file:

```typescript
async function processInboundInvoice(supabase: SupabaseClient, emailId: string) {
  // 1. Load first PDF/image attachment for this email.
  const { data: attachments, error: attError } = await supabase
    .from('email_attachments')
    .select('*')
    .eq('email_id', emailId)
    .order('created_at', { ascending: true });

  if (attError) throw new Error(`load attachments failed: ${attError.message}`);

  const eligible = (attachments ?? []).find((a) => {
    const mt = (a.mime_type as string | undefined) ?? '';
    return mt === 'application/pdf' || mt.startsWith('image/');
  });

  if (!eligible) {
    throw new Error('Rechnung ohne Anhang — kein PDF oder Bild gefunden');
  }

  // 2. Get attachment binary as base64.
  //    EDIT: adjust this step based on Task 2.1 Step 1 schema findings.
  //    If attachments are inline (e.g. content_base64 column): use it directly.
  //    If stored in storage bucket: download via supabase.storage.
  const base64Image = await loadAttachmentBase64(supabase, eligible);

  // 3. Delegate OCR.
  const { data: ocrData, error: ocrErr } = await supabase.functions.invoke(
    'process-invoice-ocr',
    { body: { base64Image } },
  );
  if (ocrErr) throw new Error(`OCR failed: ${ocrErr.message}`);
  if (!ocrData || typeof ocrData !== 'object') throw new Error('OCR returned no data');

  // 4. Supplier matching (best-effort, deterministic).
  const supplierMatch = await matchSupplier(supabase, ocrData);

  // 5. Order matching (best-effort, requires supplier match).
  const orderMatch = supplierMatch.id
    ? await matchOrder(supabase, supplierMatch.id, ocrData)
    : { id: null, confidence: 0 };

  return {
    ocr_data: ocrData,
    supplier_match: supplierMatch,
    order_match: orderMatch,
    suggested_action: 'create_supplier_invoice',
  };
}

async function loadAttachmentBase64(
  supabase: SupabaseClient,
  attachment: Record<string, unknown>,
): Promise<string> {
  // Branch based on actual schema discovered in Step 1.
  // Common pattern 1: storage_path column
  const storagePath = attachment.storage_path as string | undefined;
  if (storagePath) {
    const { data: blob, error } = await supabase.storage
      .from('email-attachments')
      .download(storagePath);
    if (error || !blob) throw new Error(`download attachment: ${error?.message}`);
    const buffer = await blob.arrayBuffer();
    return base64FromArrayBuffer(buffer);
  }
  // Common pattern 2: inline content_base64
  const inline = attachment.content_base64 as string | undefined;
  if (inline) return inline;
  // Common pattern 3: content_url
  const url = attachment.content_url as string | undefined;
  if (url) {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`fetch attachment URL ${resp.status}`);
    const buffer = await resp.arrayBuffer();
    return base64FromArrayBuffer(buffer);
  }
  throw new Error('email_attachment has no storage_path, content_base64, or content_url');
}

function base64FromArrayBuffer(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

interface MatchResult { id: string | null; confidence: number; }

async function matchSupplier(
  supabase: SupabaseClient,
  ocrData: Record<string, unknown>,
): Promise<MatchResult> {
  const name = typeof ocrData.supplierName === 'string' ? ocrData.supplierName : null;
  const vatId = typeof ocrData.supplierVatId === 'string' ? ocrData.supplierVatId : null;

  if (vatId) {
    const { data } = await supabase
      .from('suppliers').select('id').eq('vat_id', vatId).maybeSingle();
    if (data?.id) return { id: data.id, confidence: 0.99 };
  }
  if (name) {
    const { data } = await supabase
      .from('suppliers').select('id').ilike('name', `%${name}%`).maybeSingle();
    if (data?.id) return { id: data.id, confidence: 0.75 };
  }
  return { id: null, confidence: 0 };
}

async function matchOrder(
  supabase: SupabaseClient,
  supplierId: string,
  ocrData: Record<string, unknown>,
): Promise<MatchResult> {
  const total = typeof ocrData.totalAmount === 'number' ? ocrData.totalAmount : null;
  if (total === null) return { id: null, confidence: 0 };

  // 5% tolerance band on totalAmount
  const min = total * 0.95;
  const max = total * 1.05;
  const { data } = await supabase
    .from('orders')
    .select('id, total_amount')
    .eq('supplier_id', supplierId)
    .gte('total_amount', min)
    .lte('total_amount', max)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (data?.id) return { id: data.id, confidence: 0.8 };
  return { id: null, confidence: 0 };
}
```

- [ ] **Step 4: Deploy via MCP**

```
mcp__plugin_supabase_supabase__deploy_edge_function
  project_id: qgwhkjrhndeoskrxewpb
  name: process-email-invoice
  entrypoint_path: index.ts
  verify_jwt: true
  files: [{ name: 'index.ts', content: <full file content> }]
```

- [ ] **Step 5: Verify schema assumptions**

Run:
```sql
SELECT column_name FROM information_schema.columns
WHERE table_schema='public' AND table_name='suppliers'
  AND column_name IN ('id','name','vat_id');

SELECT column_name FROM information_schema.columns
WHERE table_schema='public' AND table_name='orders'
  AND column_name IN ('id','supplier_id','total_amount');
```
If any column is missing or named differently, edit the matching queries in `matchSupplier` / `matchOrder` and re-deploy.

- [ ] **Step 6: End-to-end test (real Rechnung email)**

Find a real inbound invoice in the emails table (or use a synthetic one). Trigger classify-email:

```bash
curl -s -X POST 'https://qgwhkjrhndeoskrxewpb.supabase.co/functions/v1/classify-email' \
  -H "Authorization: Bearer $ANON_KEY" -H 'Content-Type: application/json' \
  -d '{"emailId":"<RECHNUNG_EMAIL_ID>","subject":"Rechnung Nr. 2026-R-042","content":"Rechnung beigefügt","senderEmail":"buchhaltung@lieferant.de"}'
```

Verify:
```sql
SELECT e.processing_status, t.status, t.output, t.error
FROM emails e
LEFT JOIN agent_tasks t ON t.input->>'emailId' = e.id::text
WHERE e.id = '<RECHNUNG_EMAIL_ID>'
ORDER BY t.created_at DESC LIMIT 1;
```

Expected: `processing_status='awaiting_approval'`, `agent_tasks.status='awaiting_approval'`, `output.preview` contains `ocr_data`, `supplier_match`, `order_match`.

- [ ] **Step 7: Test the no-attachment failure path**

Pick an email classified as Rechnung but without attachments (or insert one). Trigger classify-email. Expected: `agent_tasks.status='failed'` with `error LIKE '%ohne Anhang%'`, `emails.processing_status='needs_review'`.

- [ ] **Step 8: Commit**

```bash
git add supabase/functions/process-email-invoice
git commit -m "feat(invoices): add process-email-invoice wrapper for inbound invoice OCR"
```

---

## Phase 3 — Anfrage Handler (`agent-offers` Action)

This is the most complex handler — it uses Claude + RAG and must avoid hallucinating prices.

### Task 3.1: Add `draft_quote_from_email` tools to agent-offers

**Files:**
- Modify: `supabase/functions/agent-offers/tools.ts`

- [ ] **Step 1: Read current agent-offers/tools.ts**

You pulled this in Task 0.1. Understand the existing tool pattern (Anthropic.Tool schema + `executeTool` switch). All new tools must follow the same shape.

- [ ] **Step 2: Add tool schemas for the new action**

Append to `TOOL_SCHEMAS`:

```typescript
{
  name: 'load_email_for_quote',
  description: 'Lädt eine eingehende Anfrage-E-Mail mit allen relevanten Feldern für die Angebots-Erstellung. Nutzt emailId aus dem Task-Input.',
  input_schema: {
    type: 'object',
    properties: { emailId: { type: 'string' } },
    required: ['emailId'],
  },
},
{
  name: 'find_similar_projects',
  description: 'Sucht ähnliche vergangene Angebote und Projekte via RAG (Vector-Similarity) basierend auf dem Email-Inhalt. WICHTIG: gibt source_quote_id / source_project_id pro Treffer zurück — diese MÜSSEN in der Position-Skizze zitiert werden.',
  input_schema: {
    type: 'object',
    properties: {
      queryText: { type: 'string', description: 'Der zu durchsuchende Text (typisch: Email-Content + Subject)' },
      limit: { type: 'integer', minimum: 1, maximum: 10, description: 'Max Anzahl Treffer (Standard: 5)' },
    },
    required: ['queryText'],
  },
},
{
  name: 'match_customer',
  description: 'Findet einen bestehenden Kunden anhand Email-Adresse oder Name.',
  input_schema: {
    type: 'object',
    properties: {
      senderEmail: { type: 'string' },
      senderName: { type: 'string' },
    },
    required: ['senderEmail'],
  },
},
{
  name: 'save_quote_draft',
  description: 'Speichert den finalen Antwort-Entwurf + Position-Skizze in agent_tasks.output und setzt status=awaiting_approval. Aufrufen nach allen anderen Schritten. NIEMALS Preise erfinden — nur Werte aus find_similar_projects-Resultaten übernehmen.',
  input_schema: {
    type: 'object',
    properties: {
      taskId: { type: 'string' },
      reply_draft: { type: 'string', description: 'Höflicher deutscher Antwort-Entwurf an den Kunden.' },
      positions_sketch: {
        type: 'array',
        description: 'Vorgeschlagene Positionen. JEDE muss eine source_quote_id oder source_project_id haben.',
        items: {
          type: 'object',
          properties: {
            description: { type: 'string' },
            suggested_qty: { type: 'number' },
            source_quote_id: { type: 'string' },
            source_project_id: { type: 'string' },
            source_price_note: { type: 'string', description: 'Z.B. "letztes Projekt: 45€/Stk"' },
          },
          required: ['description', 'suggested_qty'],
        },
      },
      customer_match: {
        type: 'object',
        properties: {
          customer_id: { type: 'string' },
          confidence: { type: 'number' },
        },
      },
      missing_info: {
        type: 'array',
        items: { type: 'string' },
        description: 'Offene Fragen die der Elektromeister selbst beantworten muss.',
      },
    },
    required: ['taskId', 'reply_draft', 'positions_sketch'],
  },
},
```

- [ ] **Step 3: Implement `executeTool` cases**

In the `executeTool` switch statement, add cases:

```typescript
case 'load_email_for_quote':
  return await loadEmailForQuote(supabase, companyId, input);
case 'find_similar_projects':
  return await findSimilarProjects(supabase, companyId, input);
case 'match_customer':
  return await matchCustomer(supabase, companyId, input);
case 'save_quote_draft':
  return await saveQuoteDraft(supabase, taskId, input);
```

- [ ] **Step 4: Implement `loadEmailForQuote`**

Add to the same file:

```typescript
async function loadEmailForQuote(
  supabase: SupabaseClient,
  companyId: string,
  input: Record<string, unknown>,
) {
  const emailId = String(input.emailId ?? '');
  if (!emailId) return { error: 'emailId required' };
  const { data, error } = await supabase
    .from('emails')
    .select('id, subject, sender_email, sender_name, content, ai_extracted_data, ai_summary')
    .eq('id', emailId)
    .eq('company_id', companyId)
    .maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: 'email not found or not in this company' };
  return data;
}
```

- [ ] **Step 5: Implement `findSimilarProjects`**

This is the RAG call. Append:

```typescript
async function findSimilarProjects(
  supabase: SupabaseClient,
  companyId: string,
  input: Record<string, unknown>,
) {
  const queryText = String(input.queryText ?? '');
  const limit = typeof input.limit === 'number' ? input.limit : 5;
  if (!queryText) return { error: 'queryText required' };

  // Generate embedding for the query (same model as process-ai-queue).
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) return { error: 'OPENAI_API_KEY not configured' };

  const embResp = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: queryText.substring(0, 30000),
      dimensions: 1536,
    }),
  });
  if (!embResp.ok) return { error: `embedding API ${embResp.status}` };
  const embJson = await embResp.json();
  const queryEmbedding = embJson.data?.[0]?.embedding as number[] | undefined;
  if (!queryEmbedding) return { error: 'no embedding in response' };

  // Call the existing search_ai_index RPC (defined in migration 20250813120002).
  const { data, error } = await supabase.rpc('search_ai_index', {
    query_embedding: `[${queryEmbedding.join(',')}]`,
    ref_types: ['quotes', 'projects'],
    company_id_filter: companyId,
    limit_results: limit,
  });
  if (error) return { error: error.message };
  return { results: data ?? [] };
}
```

- [ ] **Step 6: Implement `matchCustomer`**

Append:

```typescript
async function matchCustomer(
  supabase: SupabaseClient,
  companyId: string,
  input: Record<string, unknown>,
) {
  const email = typeof input.senderEmail === 'string' ? input.senderEmail : '';
  const name = typeof input.senderName === 'string' ? input.senderName : '';
  if (!email && !name) return { error: 'senderEmail or senderName required' };

  // Try email first (highest confidence).
  if (email) {
    const { data } = await supabase
      .from('customers')
      .select('id, name, email')
      .eq('company_id', companyId)
      .eq('email', email)
      .maybeSingle();
    if (data?.id) return { customer_id: data.id, name: data.name, confidence: 0.95 };
  }
  if (name) {
    const { data } = await supabase
      .from('customers')
      .select('id, name, email')
      .eq('company_id', companyId)
      .ilike('name', `%${name}%`)
      .maybeSingle();
    if (data?.id) return { customer_id: data.id, name: data.name, confidence: 0.6 };
  }
  return { customer_id: null, confidence: 0 };
}
```

- [ ] **Step 7: Implement `saveQuoteDraft`**

Append:

```typescript
async function saveQuoteDraft(
  supabase: SupabaseClient,
  taskId: string,
  input: Record<string, unknown>,
) {
  const reply_draft = String(input.reply_draft ?? '');
  const positions_sketch = Array.isArray(input.positions_sketch) ? input.positions_sketch : [];
  if (!reply_draft) return { error: 'reply_draft required' };

  // Guardrail: every position must reference a source.
  const unsourced = positions_sketch.filter((p: Record<string, unknown>) =>
    !p.source_quote_id && !p.source_project_id
  );
  if (unsourced.length > 0) {
    return {
      error: `${unsourced.length} position(s) without source_quote_id/source_project_id — refusing to save invented prices`,
    };
  }

  const { error } = await supabase.from('agent_tasks').update({
    status: 'awaiting_approval',
    output: {
      action: 'draft_quote_from_email',
      preview: {
        reply_draft,
        positions_sketch,
        customer_match: input.customer_match ?? null,
        missing_info: input.missing_info ?? [],
      },
    },
  }).eq('id', taskId);

  if (error) return { error: error.message };

  // Find the email and bump its status too.
  const { data: task } = await supabase
    .from('agent_tasks').select('input').eq('id', taskId).maybeSingle();
  const emailId = (task?.input as Record<string, unknown> | null)?.emailId;
  if (typeof emailId === 'string') {
    await supabase.from('emails').update({
      processing_status: 'awaiting_approval',
    }).eq('id', emailId);
  }
  return { success: true };
}
```

- [ ] **Step 8: Commit (without deploying yet — Task 3.2 will modify the same Function)**

```bash
git add supabase/functions/agent-offers/tools.ts
git commit -m "feat(agent-offers): add tools for draft_quote_from_email action"
```

---

### Task 3.2: Wire the new action into agent-offers system prompt and dispatch

**Files:**
- Modify: `supabase/functions/agent-offers/index.ts`

- [ ] **Step 1: Read current agent-offers/index.ts**

Match the pattern from `agent-invoices/index.ts`. Look for the `SYSTEM_PROMPT` constant and the `serve()` handler.

- [ ] **Step 2: Add an action-specific system prompt**

The existing system prompt covers user-triggered Angebots-Anfragen. For email-triggered drafts, we need stricter rules (no invented prices). Add a new constant near the existing `SYSTEM_PROMPT`:

```typescript
const EMAIL_DRAFT_SYSTEM_PROMPT = `Du bist der Angebots-Agent für HandwerkOS. Du bearbeitest eine eingehende Anfrage-E-Mail eines potentiellen Kunden.

ARBEITSWEISE — strikt einhalten:
1. Rufe load_email_for_quote(emailId) — lädt Subject, Content, sender, ai_extracted_data.
2. Rufe find_similar_projects(queryText) mit Email-Inhalt — gibt 0-5 ähnliche Angebote/Projekte.
3. Rufe match_customer(senderEmail, senderName) — findet bestehenden Kunden oder gibt null zurück.
4. Erstelle einen höflichen deutschen Antwort-Entwurf (kein Versand!).
5. Erstelle eine Position-Skizze NUR aus find_similar_projects-Resultaten — JEDE Position MUSS source_quote_id oder source_project_id setzen.
6. Rufe save_quote_draft(...) am Ende.

VERBOTE:
- NIEMALS Preise erfinden. Nur Preise aus find_similar_projects zitieren.
- Bei 0 RAG-Resultaten: positions_sketch=[], missing_info enthält "Keine vergleichbaren Projekte gefunden — manuell kalkulieren".
- Keine Markdown-Tabellen oder Listen in reply_draft.

EINGABE:
Das User-Message-Format ist: "Aktion: draft_quote_from_email. Details: {emailId: '...'}". Extrahiere emailId aus dem JSON.

AUSGABE:
Genau ein save_quote_draft-Call am Ende, danach kurze deutsche Erfolgsmeldung wie "Angebots-Entwurf für [Kunde] vorbereitet — wartet auf Freigabe."`;
```

- [ ] **Step 3: Branch on `action` in the serve handler**

Find the line in the existing `serve()` where the system prompt is selected. It's currently a single constant. Replace with a dispatch:

```typescript
const action = body.action;
const systemPrompt = action === 'draft_quote_from_email'
  ? EMAIL_DRAFT_SYSTEM_PROMPT
  : SYSTEM_PROMPT;
```

Use `systemPrompt` in the `anthropic.messages.create({ system: systemPrompt, ... })` call instead of the constant.

- [ ] **Step 4: Make the email-triggered userInput pass through emailId**

In the existing `userInput` construction, check what gets sent to Claude when triggered from email. The payload has `{ emailId, category, extractedData }`. Ensure the `payload.emailId` and `category` end up in the user message so Claude can call `load_email_for_quote(emailId)`. The current pattern:

```typescript
const userInput = payload.originalMessage
  ?? `Aktion: ${action}. Details: ${JSON.stringify(payload.entities ?? {})}`;
```

Update to also forward emailId for email actions:

```typescript
const userInput = payload.originalMessage ?? (
  action === 'draft_quote_from_email'
    ? `Aktion: ${action}. Details: ${JSON.stringify({ emailId: payload.emailId, category: payload.category, extractedData: payload.extractedData })}`
    : `Aktion: ${action}. Details: ${JSON.stringify(payload.entities ?? {})}`
);
```

- [ ] **Step 5: Deploy via MCP**

```
mcp__plugin_supabase_supabase__deploy_edge_function
  project_id: qgwhkjrhndeoskrxewpb
  name: agent-offers
  entrypoint_path: index.ts
  verify_jwt: true
  files: [
    { name: 'index.ts', content: <new content> },
    { name: 'tools.ts', content: <content from Task 3.1> },
    { name: '_shared/supabase.ts', content: <copied from existing> },
    { name: '_shared/anthropic.ts', content: <copied from existing> },
    { name: '_shared/types.ts', content: <copied from existing> },
    ... any other _shared files agent-offers already had
  ]
```

- [ ] **Step 6: End-to-end test — real Anfrage email**

Insert a clear test Anfrage email:

```sql
INSERT INTO emails (company_id, subject, sender_email, sender_name, content, processing_status)
VALUES ('<COMPANY_ID>', 'Anfrage: Steckdosen im Wohnzimmer',
        'mueller@example.com', 'Hans Müller', 
        'Hallo, ich bräuchte 3 Steckdosen im Wohnzimmer installiert. Wann hätten Sie Zeit?',
        'pending')
RETURNING id;
```

Trigger classify-email (it cascades into agent-router → agent-offers):

```bash
curl -s -X POST 'https://qgwhkjrhndeoskrxewpb.supabase.co/functions/v1/classify-email' \
  -H "Authorization: Bearer $ANON_KEY" -H 'Content-Type: application/json' \
  -d '{"emailId":"<NEW_ID>","subject":"Anfrage: Steckdosen","content":"3 Steckdosen Wohnzimmer","senderEmail":"mueller@example.com","senderName":"Hans Müller"}'
```

Wait ~30s (LLM time), then verify:

```sql
SELECT 
  e.processing_status AS email_status,
  t.status AS task_status,
  t.output->'preview'->>'reply_draft' AS reply_excerpt,
  jsonb_array_length(coalesce(t.output->'preview'->'positions_sketch', '[]'::jsonb)) AS position_count,
  t.output->'preview'->'positions_sketch'->0->>'source_quote_id' AS first_source_id,
  t.tool_calls
FROM emails e
LEFT JOIN agent_tasks t ON t.input->>'emailId' = e.id::text
WHERE e.id = '<NEW_ID>'
ORDER BY t.created_at DESC LIMIT 1;
```

Expected:
- `email_status='awaiting_approval'`
- `task_status='awaiting_approval'`
- `reply_excerpt` is a German polite reply (not empty)
- `position_count ≥ 0` — if existing similar projects in ai_index, expect 1-3
- if `position_count > 0`: `first_source_id` is NOT NULL (guardrail working)
- `tool_calls` shows the sequence: load_email_for_quote → find_similar_projects → match_customer → save_quote_draft

- [ ] **Step 7: Test the guardrail (manually)**

Use SQL to invoke save_quote_draft with a position missing source_quote_id and verify the tool returns an error. This validates the no-invented-prices rule.

```sql
-- Get a task id you've already processed (don't run on a real awaiting task):
SELECT id FROM agent_tasks ORDER BY created_at DESC LIMIT 1;
```

Then via a Supabase Studio "Edge Functions test" or curl, invoke `agent-offers` directly with a payload that tries to save_quote_draft without source IDs. Expected: tool returns `{ error: "N position(s) without source_quote_id/source_project_id..." }`.

- [ ] **Step 8: Commit**

```bash
git add supabase/functions/agent-offers/index.ts
git commit -m "feat(agent-offers): wire draft_quote_from_email action with no-invented-prices guardrail"
```

---

## Phase 4 — Auftrag Handler (`agent-planning` Action)

Deterministic order matching with a small LLM call for the confirmation draft. Pattern mirrors agent-offers but simpler.

### Task 4.1: Add `link_to_existing_order` tools to agent-planning

**Files:**
- Modify: `supabase/functions/agent-planning/tools.ts` (or create if it doesn't exist)
- Modify: `supabase/functions/agent-planning/index.ts`

- [ ] **Step 1: Read current agent-planning/index.ts and tools.ts**

Check the existing structure. If `tools.ts` doesn't exist, agent-planning may currently use inline tool definitions in `index.ts`. Follow whichever pattern is there.

- [ ] **Step 2: Add tool schemas**

In `tools.ts` (or wherever the schemas live):

```typescript
{
  name: 'load_email_for_link',
  description: 'Lädt eine eingehende Auftragsbestätigungs-Email mit Customer-Match.',
  input_schema: {
    type: 'object',
    properties: { emailId: { type: 'string' } },
    required: ['emailId'],
  },
},
{
  name: 'find_matching_order',
  description: 'Sucht eine bestehende Bestellung dieses Kunden basierend auf Stichworten und Zeitraum (letzte 30 Tage).',
  input_schema: {
    type: 'object',
    properties: {
      customerId: { type: 'string' },
      keywords: { type: 'array', items: { type: 'string' } },
    },
    required: ['customerId'],
  },
},
{
  name: 'save_order_link_proposal',
  description: 'Speichert link_proposal + confirmation_draft in agent_tasks.output. Aufrufen am Ende.',
  input_schema: {
    type: 'object',
    properties: {
      taskId: { type: 'string' },
      link_proposal: {
        type: 'object',
        properties: {
          email_id: { type: 'string' },
          order_id: { type: 'string' },
          confidence: { type: 'number' },
        },
      },
      confirmation_draft: { type: 'string' },
      missing_info: { type: 'array', items: { type: 'string' } },
    },
    required: ['taskId', 'confirmation_draft'],
  },
},
```

- [ ] **Step 3: Implement the three handlers**

```typescript
async function loadEmailForLink(supabase, companyId, input) {
  const emailId = String(input.emailId ?? '');
  const { data, error } = await supabase
    .from('emails')
    .select('id, subject, sender_email, sender_name, content, customer_id, ai_extracted_data')
    .eq('id', emailId)
    .eq('company_id', companyId)
    .maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: 'email not found' };
  return data;
}

async function findMatchingOrder(supabase, companyId, input) {
  const customerId = String(input.customerId ?? '');
  const keywords = Array.isArray(input.keywords) ? input.keywords : [];
  if (!customerId) return { error: 'customerId required' };
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  let q = supabase
    .from('orders')
    .select('id, order_number, description, created_at, status')
    .eq('company_id', companyId)
    .eq('customer_id', customerId)
    .gte('created_at', thirtyDaysAgo)
    .order('created_at', { ascending: false })
    .limit(5);
  const { data, error } = await q;
  if (error) return { error: error.message };
  // Deterministic keyword scoring
  const scored = (data ?? []).map((o) => {
    const text = `${o.description ?? ''}`.toLowerCase();
    const hits = keywords.filter((k) => text.includes(String(k).toLowerCase())).length;
    return { ...o, _score: hits };
  }).sort((a, b) => b._score - a._score);
  return { orders: scored };
}

async function saveOrderLinkProposal(supabase, taskId, input) {
  const { error } = await supabase.from('agent_tasks').update({
    status: 'awaiting_approval',
    output: {
      action: 'link_to_existing_order',
      preview: {
        link_proposal: input.link_proposal ?? null,
        confirmation_draft: input.confirmation_draft,
        missing_info: input.missing_info ?? [],
      },
    },
  }).eq('id', taskId);
  if (error) return { error: error.message };
  // Bump email status
  const { data: task } = await supabase
    .from('agent_tasks').select('input').eq('id', taskId).maybeSingle();
  const emailId = (task?.input as Record<string, unknown> | null)?.emailId;
  if (typeof emailId === 'string') {
    await supabase.from('emails').update({
      processing_status: 'awaiting_approval',
    }).eq('id', emailId);
  }
  return { success: true };
}
```

Add the three cases to `executeTool` switch.

- [ ] **Step 4: Add system prompt branch in index.ts**

```typescript
const LINK_ORDER_SYSTEM_PROMPT = `Du bist der Planungs-Agent für HandwerkOS. Du bearbeitest eine eingehende Auftragsbestätigungs-E-Mail.

ARBEITSWEISE — strikt einhalten:
1. Rufe load_email_for_link(emailId).
2. Wenn customer_id vorhanden: find_matching_order(customerId, keywords aus subject+content).
3. Bei Match-Treffer (score > 0): erstelle link_proposal mit confidence = min(0.5 + 0.15*score, 1.0).
4. Erstelle einen kurzen höflichen Bestätigungs-Entwurf auf Deutsch (1-2 Sätze, keine Listen, keine Markdown).
5. Rufe save_order_link_proposal(...) am Ende.

Bei kein customer_id ODER kein Match: link_proposal=null, missing_info enthält "Bezugs-Auftrag unklar — bitte manuell zuordnen".

AUSGABE-FORMAT:
Eine kurze deutsche Aussage in einer Zeile, z.B. "Auftragsbestätigung für Müller (Order #1234) vorbereitet."`;
```

Branch in serve():

```typescript
const systemPrompt = action === 'link_to_existing_order'
  ? LINK_ORDER_SYSTEM_PROMPT
  : SYSTEM_PROMPT;
```

- [ ] **Step 5: Pass emailId through userInput like in Task 3.2 Step 4**

Same pattern — when `action === 'link_to_existing_order'`, include `emailId`, `category`, `extractedData` in the user message.

- [ ] **Step 6: Deploy**

Deploy `agent-planning` via MCP with all files (index.ts, tools.ts, _shared/*).

- [ ] **Step 7: End-to-end test — Auftrag email**

Insert a test Auftrag email referencing a customer that has a recent order:

```sql
-- Find a customer with a recent order
SELECT c.id AS customer_id, c.email, o.id AS order_id 
FROM customers c
JOIN orders o ON o.customer_id = c.id
WHERE c.company_id = '<COMPANY_ID>' AND o.created_at > now() - interval '30 days'
LIMIT 1;

-- Insert Auftrag email
INSERT INTO emails (company_id, subject, sender_email, sender_name, content, processing_status)
VALUES ('<COMPANY_ID>', 'Auftragsbestätigung Steckdosen Wohnzimmer',
        '<customer_email>', '<customer_name>',
        'Hallo, ich bestätige den Auftrag für die Steckdosen im Wohnzimmer wie besprochen.',
        'pending')
RETURNING id;
```

Trigger classify-email, then verify:

```sql
SELECT 
  e.processing_status,
  t.status,
  t.output->'preview'->>'confirmation_draft' AS confirmation,
  t.output->'preview'->'link_proposal'->>'order_id' AS linked_order,
  t.tool_calls
FROM emails e
LEFT JOIN agent_tasks t ON t.input->>'emailId' = e.id::text
WHERE e.id = '<NEW_ID>'
ORDER BY t.created_at DESC LIMIT 1;
```

Expected: `linked_order` is NOT NULL when customer has matching recent orders.

- [ ] **Step 8: Commit**

```bash
git add supabase/functions/agent-planning
git commit -m "feat(agent-planning): wire link_to_existing_order action"
```

---

## Phase 5 — Frontend Review UI

Now Filip can see suggestions and decide. Standard React + Vitest TDD.

### Task 5.1: `useAgentSuggestions` hook with tests

**Files:**
- Create: `src/hooks/useAgentSuggestions.ts`
- Create: `src/hooks/useAgentSuggestions.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/hooks/useAgentSuggestions.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';

const mockFromChain = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  is: vi.fn().mockReturnThis(),
  in: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
};

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => mockFromChain),
  },
}));

import { useAgentSuggestions } from './useAgentSuggestions';

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useAgentSuggestions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFromChain.order.mockResolvedValue({ data: [], error: null });
  });

  it('queries agent_tasks filtered to awaiting_approval and approved_at IS NULL', async () => {
    const { result } = renderHook(() => useAgentSuggestions('email-123'), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockFromChain.select).toHaveBeenCalled();
    expect(mockFromChain.eq).toHaveBeenCalledWith('status', 'awaiting_approval');
    expect(mockFromChain.is).toHaveBeenCalledWith('approved_at', null);
  });

  it('returns the suggestions array', async () => {
    const fake = [{ id: 'task-1', agent_type: 'offers', output: { action: 'draft_quote_from_email', preview: {} } }];
    mockFromChain.order.mockResolvedValueOnce({ data: fake, error: null });
    const { result } = renderHook(() => useAgentSuggestions('email-123'), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.suggestions).toEqual(fake);
  });

  it('returns empty array on error', async () => {
    mockFromChain.order.mockResolvedValueOnce({ data: null, error: { message: 'db err' } });
    const { result } = renderHook(() => useAgentSuggestions('email-123'), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.suggestions).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test, expect failure**

```bash
npx vitest run src/hooks/useAgentSuggestions.test.ts
```
Expected: `Cannot find module './useAgentSuggestions'`.

- [ ] **Step 3: Implement the hook**

Create `src/hooks/useAgentSuggestions.ts`:

```typescript
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AgentSuggestion {
  id: string;
  agent_type: string;
  status: string;
  output: {
    action: string;
    preview: Record<string, unknown>;
  } | null;
  created_at: string;
}

export function useAgentSuggestions(emailId: string | undefined) {
  const query = useQuery({
    queryKey: ['agent-suggestions', emailId],
    enabled: !!emailId,
    queryFn: async (): Promise<AgentSuggestion[]> => {
      if (!emailId) return [];
      const { data, error } = await supabase
        .from('agent_tasks')
        .select('id, agent_type, status, output, created_at, input')
        .eq('status', 'awaiting_approval')
        .is('approved_at', null)
        .order('created_at', { ascending: false });
      if (error) {
        console.error('useAgentSuggestions error:', error);
        return [];
      }
      // Filter client-side for emailId (JSONB input.emailId).
      return (data ?? []).filter((t) => {
        const input = t.input as { emailId?: string } | null;
        return input?.emailId === emailId;
      });
    },
  });

  return {
    suggestions: query.data ?? [],
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}
```

- [ ] **Step 4: Run test, expect pass**

```bash
npx vitest run src/hooks/useAgentSuggestions.test.ts
```
Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useAgentSuggestions.ts src/hooks/useAgentSuggestions.test.ts
git commit -m "feat(emails): useAgentSuggestions hook for pending agent_tasks"
```

---

### Task 5.2: `AgentSuggestionBadge` component

**Files:**
- Create: `src/components/emails/AgentSuggestionBadge.tsx`

- [ ] **Step 1: Implement**

```typescript
import { Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useAgentSuggestions } from '@/hooks/useAgentSuggestions';

interface Props {
  emailId: string;
  onClick: () => void;
}

export function AgentSuggestionBadge({ emailId, onClick }: Props) {
  const { suggestions, isLoading } = useAgentSuggestions(emailId);
  if (isLoading || suggestions.length === 0) return null;

  return (
    <Badge
      variant="secondary"
      className="cursor-pointer hover:bg-primary/10 gap-1"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <Sparkles className="h-3 w-3" />
      {suggestions.length === 1 ? 'Vorschlag' : `${suggestions.length} Vorschläge`}
    </Badge>
  );
}
```

- [ ] **Step 2: Verify it type-checks**

```bash
npx tsc --noEmit 2>&1 | grep AgentSuggestionBadge
```
Expected: no output (no errors).

- [ ] **Step 3: Commit**

```bash
git add src/components/emails/AgentSuggestionBadge.tsx
git commit -m "feat(emails): AgentSuggestionBadge component"
```

---

### Task 5.3: `AgentSuggestionReviewDialog` with tests

This is the biggest UI piece. Renders different content based on suggestion type (Anfrage/Auftrag/Rechnung). For MVP we keep it simple: structured display of preview fields, three buttons (Senden / Bearbeiten / Verwerfen).

**Files:**
- Create: `src/components/emails/AgentSuggestionReviewDialog.tsx`
- Create: `src/components/emails/AgentSuggestionReviewDialog.test.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AgentSuggestionReviewDialog } from './AgentSuggestionReviewDialog';

const updateChain = { eq: vi.fn() };
const invokeMock = vi.fn().mockResolvedValue({ data: { ok: true }, error: null });

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({ update: vi.fn(() => updateChain) })),
    functions: { invoke: invokeMock },
  },
}));

const sampleAnfrage = {
  id: 'task-1',
  agent_type: 'offers',
  status: 'awaiting_approval',
  output: {
    action: 'draft_quote_from_email',
    preview: {
      reply_draft: 'Sehr geehrter Herr Müller, vielen Dank...',
      positions_sketch: [
        { description: 'Steckdose installieren', suggested_qty: 3, source_quote_id: 'q-1' },
      ],
      customer_match: { customer_id: 'c-1', confidence: 0.9 },
      missing_info: ['Bestandsinstallation vorhanden?'],
    },
  },
};

describe('AgentSuggestionReviewDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateChain.eq.mockResolvedValue({ data: null, error: null });
  });

  it('renders reply_draft and positions for an Anfrage suggestion', () => {
    render(<AgentSuggestionReviewDialog suggestion={sampleAnfrage as any} open={true} onClose={() => {}} emailId="e-1" />);
    expect(screen.getByText(/Sehr geehrter Herr Müller/)).toBeInTheDocument();
    expect(screen.getByText(/Steckdose installieren/)).toBeInTheDocument();
    expect(screen.getByText(/Bestandsinstallation vorhanden/)).toBeInTheDocument();
  });

  it('on "Senden" click: invokes send-email-reply then marks task done', async () => {
    const onClose = vi.fn();
    render(<AgentSuggestionReviewDialog suggestion={sampleAnfrage as any} open={true} onClose={onClose} emailId="e-1" />);
    fireEvent.click(screen.getByRole('button', { name: /senden/i }));
    await waitFor(() => expect(invokeMock).toHaveBeenCalledWith('send-email-reply', expect.any(Object)));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('on "Verwerfen" click: marks task done without invoking send', async () => {
    const onClose = vi.fn();
    render(<AgentSuggestionReviewDialog suggestion={sampleAnfrage as any} open={true} onClose={onClose} emailId="e-1" />);
    fireEvent.click(screen.getByRole('button', { name: /verwerfen/i }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(invokeMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test, expect failure**

```bash
npx vitest run src/components/emails/AgentSuggestionReviewDialog.test.tsx
```
Expected: `Cannot find module './AgentSuggestionReviewDialog'`.

- [ ] **Step 3: Implement the dialog**

```typescript
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { AgentSuggestion } from '@/hooks/useAgentSuggestions';

interface Props {
  suggestion: AgentSuggestion;
  emailId: string;
  open: boolean;
  onClose: () => void;
}

export function AgentSuggestionReviewDialog({ suggestion, emailId, open, onClose }: Props) {
  const preview = (suggestion.output?.preview ?? {}) as Record<string, any>;
  const [replyDraft, setReplyDraft] = useState<string>(preview.reply_draft ?? preview.confirmation_draft ?? '');
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  const action = suggestion.output?.action ?? '';

  async function markTaskDone(reason?: string) {
    await supabase.from('agent_tasks').update({
      status: 'done',
      approved_at: new Date().toISOString(),
      output: { ...(suggestion.output ?? {}), user_decision: reason ?? 'approved' },
    }).eq('id', suggestion.id);
    await supabase.from('emails').update({
      processing_status: 'completed',
    }).eq('id', emailId);
  }

  async function handleSend() {
    setBusy(true);
    try {
      const { error } = await supabase.functions.invoke('send-email-reply', {
        body: { emailId, body: replyDraft },
      });
      if (error) throw new Error(error.message);
      await markTaskDone('sent');
      toast({ title: 'Antwort gesendet', description: 'Vorschlag wurde abgeschickt.' });
      onClose();
    } catch (err) {
      toast({
        title: 'Fehler beim Senden',
        description: err instanceof Error ? err.message : 'Unbekannt',
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleReject() {
    setBusy(true);
    try {
      await markTaskDone('rejected');
      toast({ title: 'Verworfen', description: 'Vorschlag wurde nicht versendet.' });
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>KI-Vorschlag: {actionLabel(action)}</DialogTitle>
        </DialogHeader>

        {/* Customer match (Anfrage/Auftrag) */}
        {preview.customer_match && (
          <div className="text-sm">
            <strong>Kunde:</strong>{' '}
            {preview.customer_match.customer_id
              ? <Badge variant="default">erkannt (Confidence {preview.customer_match.confidence})</Badge>
              : <Badge variant="outline">neuer Kunde</Badge>}
          </div>
        )}

        {/* Link proposal (Auftrag) */}
        {preview.link_proposal?.order_id && (
          <div className="text-sm">
            <strong>Bezug:</strong>{' '}
            <Badge variant="default">Auftrag #{preview.link_proposal.order_id.slice(0, 8)}</Badge>
          </div>
        )}

        {/* OCR data (Rechnung) */}
        {preview.ocr_data && (
          <div className="space-y-1 text-sm">
            <div><strong>Lieferant:</strong> {preview.ocr_data.supplierName}</div>
            <div><strong>Rechnungsnr:</strong> {preview.ocr_data.invoiceNumber}</div>
            <div><strong>Betrag:</strong> {preview.ocr_data.totalAmount} €</div>
            {preview.supplier_match?.id && (
              <div><strong>Match:</strong> <Badge>Lieferant erkannt</Badge></div>
            )}
          </div>
        )}

        {/* Reply / Confirmation draft */}
        {(preview.reply_draft || preview.confirmation_draft) && (
          <div>
            <label className="text-sm font-medium">Antwort-Entwurf (editierbar):</label>
            <Textarea
              value={replyDraft}
              onChange={(e) => setReplyDraft(e.target.value)}
              rows={8}
              className="mt-1"
            />
          </div>
        )}

        {/* Positions sketch (Anfrage) */}
        {Array.isArray(preview.positions_sketch) && preview.positions_sketch.length > 0 && (
          <div>
            <strong className="text-sm">Positions-Skizze:</strong>
            <ul className="mt-1 text-sm space-y-1">
              {preview.positions_sketch.map((p: any, i: number) => (
                <li key={i} className="border-l-2 border-primary pl-2">
                  {p.suggested_qty}× {p.description}
                  {p.source_price_note && <span className="text-muted-foreground"> — {p.source_price_note}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Missing info */}
        {Array.isArray(preview.missing_info) && preview.missing_info.length > 0 && (
          <div className="text-sm text-amber-600">
            <strong>Offene Fragen:</strong>
            <ul className="list-disc list-inside">
              {preview.missing_info.map((q: string, i: number) => <li key={i}>{q}</li>)}
            </ul>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleReject} disabled={busy}>
            Verwerfen
          </Button>
          {(preview.reply_draft || preview.confirmation_draft) && (
            <Button onClick={handleSend} disabled={busy}>
              Senden
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function actionLabel(action: string): string {
  switch (action) {
    case 'draft_quote_from_email': return 'Angebots-Skizze';
    case 'link_to_existing_order': return 'Auftragsbestätigung';
    case 'process_inbound_invoice_email': return 'Eingangsrechnung';
    default: return action;
  }
}
```

- [ ] **Step 4: Run test, expect pass**

```bash
npx vitest run src/components/emails/AgentSuggestionReviewDialog.test.tsx
```
Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/emails/AgentSuggestionReviewDialog.tsx src/components/emails/AgentSuggestionReviewDialog.test.tsx
git commit -m "feat(emails): AgentSuggestionReviewDialog with send/reject actions"
```

---

### Task 5.4: Integrate Badge + Dialog into EmailList

**Files:**
- Modify: `src/components/emails/EmailList.tsx` (or whichever existing component renders the email list — verify by `grep -l 'emails' src/components/emails/`)

- [ ] **Step 1: Locate the email row component**

```bash
ls src/components/emails/
```
Find the file that renders individual emails in a list. Likely `EmailList.tsx`, `EmailItem.tsx`, or similar.

- [ ] **Step 2: Add Badge to each row**

In the row render JSX, near the existing subject/sender display, add:

```typescript
import { AgentSuggestionBadge } from './AgentSuggestionBadge';
import { AgentSuggestionReviewDialog } from './AgentSuggestionReviewDialog';
import { useAgentSuggestions } from '@/hooks/useAgentSuggestions';
import { useState } from 'react';

// Inside the row component:
const [dialogOpenForTaskId, setDialogOpenForTaskId] = useState<string | null>(null);
const { suggestions } = useAgentSuggestions(email.id);

// In the row JSX, near the subject:
<AgentSuggestionBadge
  emailId={email.id}
  onClick={() => setDialogOpenForTaskId(suggestions[0]?.id ?? null)}
/>

// At the end of the row:
{dialogOpenForTaskId && suggestions.find((s) => s.id === dialogOpenForTaskId) && (
  <AgentSuggestionReviewDialog
    suggestion={suggestions.find((s) => s.id === dialogOpenForTaskId)!}
    emailId={email.id}
    open={!!dialogOpenForTaskId}
    onClose={() => setDialogOpenForTaskId(null)}
  />
)}
```

- [ ] **Step 3: Verify type-check**

```bash
npx tsc --noEmit 2>&1 | grep -E "(AgentSuggestion|EmailList)" | head -5
```
Expected: no output.

- [ ] **Step 4: Manually verify in browser**

Run dev server (`npm run dev` if not already running), navigate to the Email section, find an email with a pending agent_task. You should see the Badge. Click it → Dialog opens → Senden/Verwerfen buttons work.

- [ ] **Step 5: Commit**

```bash
git add src/components/emails/EmailList.tsx
git commit -m "feat(emails): show AgentSuggestionBadge + dialog in email list"
```

---

## Phase 6 — End-to-End Manual Verification

### Task 6.1: Run the 8-step manual checklist from the spec

The spec's Section 5.4 lists 8 manual tests. Execute them all and document results.

- [ ] **Step 1: Test 1 — Anfrage with high confidence**

Insert / pick an Anfrage email with clear content. Trigger classify-email. Expected:
- agent-offers runs → reply_draft + positions_sketch with min. 1 source_quote_id present
- agent_tasks.status='awaiting_approval'

- [ ] **Step 2: Test 2 — Anfrage without RAG match**

Insert an Anfrage about a topic with no historical projects. Expected:
- positions_sketch=[]
- missing_info contains "Keine vergleichbaren Projekte"

- [ ] **Step 3: Test 3 — Low-confidence email**

Manually craft a vague/ambiguous email, low confidence expected. Expected: `processing_status='needs_review'`, no agent_task.

- [ ] **Step 4: Test 4 — Spam email**

Use a clearly spam-looking content. Expected: `processing_status='out_of_scope'`, no agent_task.

- [ ] **Step 5: Test 5 — Rechnung with PDF**

Insert email with a PDF attachment (or use a real one). Expected: agent_tasks.output.preview.ocr_data populated.

- [ ] **Step 6: Test 6 — Rechnung without attachment**

Email classified as Rechnung but no attachment. Expected: status='failed', email status='needs_review'.

- [ ] **Step 7: Test 7 — UI flow**

In browser, find a pending suggestion. Badge visible → click → Dialog → click Senden → verify `agent_tasks.status='done'`, `approved_at` set, and `emails.processing_status='completed'`.

- [ ] **Step 8: Test 8 — Retry**

For an email with `processing_status='dispatch_failed'`, click a future "Retry" button (or manually re-invoke classify-email). Expected: new agent_task created; old one stays as `status='failed'` (history preserved).

- [ ] **Step 9: Final commit (test results doc)**

After all tests passed, optionally write a brief test-results.md and commit:

```bash
# Optional: document results
git add docs/superpowers/plans/2026-05-11-email-action-pipeline.md
git commit -m "docs: mark email-action-pipeline plan as complete"
```

---

## Done

After Phase 6 all tests pass, the pipeline is production-ready. The cron schedule for `process-ai-queue` (deployed earlier) ensures embeddings stay fresh, so RAG quality improves over time without further action.

**Out of scope (future work — see spec section "Future Work"):**
- Support/Reklamation as 4th category.
- Cron-based auto-retry for `dispatch_failed`.
- Pending-approvals counter in the UI dashboard.
- Token-cost tracking UI.
- Forwarded-email filter.
- Thread-context lookup for reply mails.
