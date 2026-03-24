# Angebots-Modul Verbesserungen - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add workflow indicators, follow-up system, and remove legacy quotes from the Angebots-Modul.

**Architecture:** Three independent streams: (1) New UI components for workflow visualization, (2) Nachfass-System with DB migration + filter + dashboard KPI, (3) Legacy quotes cleanup across ~10 files. Stream 3 should be done first to avoid building on dead code.

**Tech Stack:** React, TypeScript, Supabase (Postgres), TanStack Query, Recharts, Tailwind CSS, Lucide icons, shadcn/ui

**Spec:** `docs/superpowers/specs/2026-03-24-angebot-modul-verbesserungen-design.md`

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `src/components/offers/OfferWorkflowDots.tsx` | Mini dot-stepper showing offer status in list rows |
| `src/components/offers/OfferFlowTimeline.tsx` | Full horizontal timeline for accepted offers (shows linked project + invoice) |
| `supabase/migrations/XXXXXX_add_sent_at_to_offers.sql` | Migration adding `sent_at` column |

### Files to Modify
| File | Changes |
|------|---------|
| `src/services/offerService.ts` | Add `sent_at` to `sendOffer()` |
| `src/components/OfferModuleV2.tsx` | + WorkflowDots column, + Nachfass badge, + Nachfassen filter, + URL param |
| `src/pages/offers/OfferEditorPage.tsx` | + OfferFlowTimeline banner |
| `src/components/DashboardStatsWithKpis.tsx` | quotes→offers query, + Nachfassen KPI |
| `src/services/WorkflowService.ts` | Remove quote methods, update types |
| `src/hooks/useApi.ts` | Remove all useQuote* hooks |
| `src/services/index.ts` | Remove quoteService re-export |
| `src/components/DocumentModule.tsx` | Remove quote imports/usage |
| `src/services/customerService.ts` | quotes→offers reference |
| `src/services/eventBus.ts` | Remove all quote event types and functional references (~7 locations) |
| `src/types/offer.ts` | Add `project_id` and `sent_at` to OfferSchema |

### Files to Delete
| File | Reason |
|------|--------|
| `src/services/quoteService.ts` | Replaced by offerService |
| `src/components/AddQuoteDialog.tsx` | Replaced by OfferCreationWizard |
| `src/components/QuoteActions.tsx` | Replaced by Offer workflow |

---

## Task 1: Legacy `quotes` Cleanup - Services

Remove quote references from service layer first since other files depend on them.

**Files:**
- Modify: `src/services/index.ts`
- Modify: `src/services/WorkflowService.ts`
- Modify: `src/services/customerService.ts`
- Modify: `src/services/eventBus.ts`
- Delete: `src/services/quoteService.ts`

- [ ] **Step 1: Build check before changes**

Run: `npx tsc --noEmit 2>&1 | head -20`
Note current state of type errors (if any) so we know what's new vs pre-existing.

- [ ] **Step 2: Remove quoteService re-export from index.ts**

In `src/services/index.ts`, find and remove the line that exports `quoteService` / `QuoteService`. Keep all other exports.

- [ ] **Step 3: Clean up WorkflowService.ts**

In `src/services/WorkflowService.ts`:

1. Remove the `createOrderFromQuote()` method (Lines ~39-118) entirely
2. Remove the `getPendingQuotes()` method (Lines ~444-452) entirely
3. In `getDashboardCriticalData()` (Lines ~410-442): Remove the `pendingQuotes` call and its entry in the return object. Replace with a query on `offers` table:
```typescript
// Replace quotes query with offers
const { data: pendingOffers } = await supabase
  .from('offers')
  .select('*, customers:customer_id(company_name)')
  .eq('status', 'sent')
  .order('created_at', { ascending: false });
```
4. Update `WorkflowStep.type` from `'quote' | 'order' | 'project' | 'invoice'` to `'offer' | 'order' | 'project' | 'invoice'`
5. Update `WorkflowChain.currentStep` from `'quote'` to `'offer'`

- [ ] **Step 4: Clean up customerService.ts**

In `src/services/customerService.ts`:
1. In `deleteCustomer()` (~lines 199-211): **Remove** the `quotes` table check entirely (do NOT replace with offers - an offers check already exists at ~lines 213-225)
2. `getCustomerQuotes()` method (~lines 357-367): **Remove** the entire method. Search for callers first with `grep -r "getCustomerQuotes" src/` - if any callers exist, replace them with offerService queries.

- [ ] **Step 5: Clean up eventBus.ts (extensive - ~7 locations)**

In `src/services/eventBus.ts`, remove ALL quote-specific code:
1. Remove 6 quote event types from EventType union: `QUOTE_CREATED`, `QUOTE_UPDATED`, `QUOTE_SENT`, `QUOTE_ACCEPTED`, `QUOTE_REJECTED`, `QUOTE_DELETED`
2. Remove `ORDER_CREATED_FROM_QUOTE` from EventType union
3. In `shouldLogToAudit()`: Remove `QUOTE_SENT`, `QUOTE_ACCEPTED`, `QUOTE_REJECTED` cases
4. In `extractAuditData()`: Remove `QUOTE_ACCEPTED`, `QUOTE_REJECTED` cases
5. In `mapEventToAuditAction()`: Remove `QUOTE_SENT`, `QUOTE_ACCEPTED`, `QUOTE_REJECTED` cases
6. In `extractTableName()`: Remove `if (event.startsWith('QUOTE_')) return 'quotes';`
7. In `triggerWorkflowAutomations()`: Remove `QUOTE_ACCEPTED` handling

- [ ] **Step 6: Delete quoteService.ts**

Delete file: `src/services/quoteService.ts`

- [ ] **Step 7: Verify build**

Run: `npx tsc --noEmit 2>&1 | head -40`
Expect: Errors in files that still import from quoteService (useApi.ts, DocumentModule.tsx, etc.) - these will be fixed in Task 2.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "refactor: remove legacy quoteService and quotes references from services"
```

---

## Task 2: Legacy `quotes` Cleanup - Hooks & Components

Remove quote hooks and component references.

**Files:**
- Modify: `src/hooks/useApi.ts`
- Modify: `src/components/DocumentModule.tsx`
- Modify: `src/components/DashboardStatsWithKpis.tsx`
- Delete: `src/components/AddQuoteDialog.tsx`
- Delete: `src/components/QuoteActions.tsx`

- [ ] **Step 1: Remove quote hooks from useApi.ts**

In `src/hooks/useApi.ts`:
1. Remove the import of `quoteService` / `QuoteService` (around Line 43 area - search for `quoteService`)
2. Remove ALL useQuote* hooks: `useQuotes`, `useQuote`, `useCreateQuote`, `useUpdateQuote`, `useSendQuote`, `useAcceptQuote`, `useRejectQuote`, `useQuoteStats`
3. Search for `quote` (case-insensitive) to make sure nothing is missed

- [ ] **Step 2: Clean up DocumentModule.tsx**

In `src/components/DocumentModule.tsx`:
1. Remove imports: `useQuotes`, `useCreateQuote`, `useUpdateQuote` (Lines ~23-29)
2. Remove all quote-related hook calls and state
3. Remove any quote-related JSX sections
4. If the entire component becomes empty/useless, leave it as a shell that just renders the remaining non-quote content

- [ ] **Step 3: Update DashboardStatsWithKpis.tsx quotes query**

In `src/components/DashboardStatsWithKpis.tsx`:
Find the quotes query (Lines ~95-99):
```typescript
// OLD
const { data: quotesData } = await supabase
  .from('quotes')
  .select('id, status')
  .eq('company_id', companyId)
  .eq('status', 'versendet');
```
Replace with:
```typescript
// NEW
const { data: offersData } = await supabase
  .from('offers')
  .select('id, status')
  .eq('company_id', companyId)
  .eq('status', 'sent');
```
Update the KPI card that shows "Offene Angebote" to use `offersData` instead of `quotesData`.

- [ ] **Step 4: Delete AddQuoteDialog.tsx and QuoteActions.tsx**

Delete files:
- `src/components/AddQuoteDialog.tsx`
- `src/components/QuoteActions.tsx`

- [ ] **Step 5: Search for remaining quote references**

Run: `grep -ri "quote" src/ --include="*.ts" --include="*.tsx" -l`
Verify only non-problematic references remain (e.g., offer types that mention `quote` as a workflow origin, comments, etc.)

- [ ] **Step 6: Full build check**

Run: `npx tsc --noEmit 2>&1 | head -40`
Expect: No new errors related to quotes. Pre-existing errors may still show.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor: remove legacy quote hooks, components, and dashboard query"
```

---

## Task 3: Database Migration - `sent_at` Column

Add `sent_at` field to offers table for reliable follow-up tracking.

**Files:**
- Create: `supabase/migrations/XXXXXX_add_sent_at_to_offers.sql`
- Modify: `src/services/offerService.ts`

- [ ] **Step 1: Apply the migration via Supabase MCP**

Use the Supabase MCP `apply_migration` tool:

```sql
-- Add sent_at column to offers table
ALTER TABLE offers ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;

-- Backfill existing sent offers with updated_at as approximation
UPDATE offers SET sent_at = updated_at WHERE status = 'sent' AND sent_at IS NULL;
```

- [ ] **Step 2: Also save migration file locally**

Create file `supabase/migrations/20260324000000_add_sent_at_to_offers.sql` with the same SQL for version control.

- [ ] **Step 3: Update sendOffer() in offerService.ts**

In `src/services/offerService.ts`, find the `sendOffer()` method (Lines ~490-527). Change the update call from:
```typescript
const { data: sentOffer, error } = await supabase
  .from('offers')
  .update({ status: 'sent' })
  .eq('id', id)
  .select()
  .single();
```
To:
```typescript
const { data: sentOffer, error } = await supabase
  .from('offers')
  .update({ status: 'sent', sent_at: new Date().toISOString() })
  .eq('id', id)
  .select()
  .single();
```

- [ ] **Step 4: Verify migration**

Use Supabase MCP `execute_sql`:
```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'offers' AND column_name = 'sent_at';
```
Expect: 1 row with `sent_at` / `timestamp with time zone`

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add sent_at column to offers for follow-up tracking"
```

---

## Task 3b: Extend OfferSchema with `sent_at` and `project_id`

Add the new/existing DB columns to the TypeScript types so all subsequent tasks have type-safe access.

**Files:**
- Modify: `src/types/offer.ts`

- [ ] **Step 1: Add `sent_at` and `project_id` to OfferSchema**

In `src/types/offer.ts`, find the `OfferSchema = z.object({...})` definition. Add these fields:

```typescript
sent_at: z.string().nullable().optional(),
project_id: z.string().uuid().nullable().optional(),
```

Place them near the other timestamp/status fields (e.g., near `accepted_at`).

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit 2>&1 | head -10`
Expect: No new errors.

- [ ] **Step 3: Commit**

```bash
git add src/types/offer.ts
git commit -m "feat: add sent_at and project_id to Offer type schema"
```

---

## Task 4: OfferWorkflowDots Component

Create the mini workflow dot-stepper for the offer list.

**Files:**
- Create: `src/components/offers/OfferWorkflowDots.tsx`

- [ ] **Step 1: Create OfferWorkflowDots component**

Create `src/components/offers/OfferWorkflowDots.tsx`:

```tsx
import { Check, X, Clock, Minus } from 'lucide-react';
import { OfferStatus } from '@/types/offer';
import { cn } from '@/lib/utils';

interface OfferWorkflowDotsProps {
  status: OfferStatus;
}

// Steps: Entwurf → Versendet → Angenommen/Abgelehnt
const STEPS = ['draft', 'sent', 'accepted'] as const;

function getStepState(stepIndex: number, status: OfferStatus) {
  const statusIndex = STEPS.indexOf(status as typeof STEPS[number]);

  if (status === 'rejected') {
    if (stepIndex < 2) return 'completed';
    if (stepIndex === 2) return 'rejected';
  }
  if (status === 'expired') {
    if (stepIndex < 1) return 'completed';
    if (stepIndex === 1) return 'expired';
    return 'future';
  }
  if (status === 'cancelled') {
    return stepIndex === 0 ? 'cancelled' : 'future';
  }
  if (stepIndex < statusIndex) return 'completed';
  if (stepIndex === statusIndex) return 'current';
  return 'future';
}

const DOT_STYLES = {
  completed: 'bg-emerald-500 text-white',
  current: 'bg-blue-500 text-white ring-2 ring-blue-200',
  future: 'bg-slate-200 text-slate-400',
  rejected: 'bg-red-500 text-white',
  expired: 'bg-orange-500 text-white',
  cancelled: 'bg-slate-400 text-white',
};

const STEP_LABELS = ['Entwurf', 'Versendet', 'Angenommen'];

export function OfferWorkflowDots({ status }: OfferWorkflowDotsProps) {
  return (
    <div className="flex items-center gap-1">
      {STEPS.map((step, index) => {
        const state = getStepState(index, status);
        return (
          <div key={step} className="flex items-center">
            <div
              className={cn(
                'w-5 h-5 rounded-full flex items-center justify-center',
                DOT_STYLES[state]
              )}
              title={
                state === 'rejected' ? 'Abgelehnt' :
                state === 'expired' ? 'Abgelaufen' :
                state === 'cancelled' ? 'Storniert' :
                STEP_LABELS[index]
              }
            >
              {state === 'completed' && <Check className="h-3 w-3" />}
              {state === 'current' && <span className="w-2 h-2 bg-white rounded-full" />}
              {state === 'rejected' && <X className="h-3 w-3" />}
              {state === 'expired' && <Clock className="h-3 w-3" />}
              {state === 'cancelled' && <Minus className="h-3 w-3" />}
            </div>
            {index < STEPS.length - 1 && (
              <div className={cn(
                'w-3 h-0.5 mx-0.5',
                state === 'completed' ? 'bg-emerald-400' : 'bg-slate-200'
              )} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default OfferWorkflowDots;
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit src/components/offers/OfferWorkflowDots.tsx 2>&1 | head -10`

- [ ] **Step 3: Commit**

```bash
git add src/components/offers/OfferWorkflowDots.tsx
git commit -m "feat: add OfferWorkflowDots component for offer list"
```

---

## Task 5: Integrate OfferWorkflowDots into OfferModuleV2

Add the dots column to the offer list table.

**Files:**
- Modify: `src/components/OfferModuleV2.tsx`

- [ ] **Step 1: Add import**

At the top of `src/components/OfferModuleV2.tsx`, add:
```typescript
import { OfferWorkflowDots } from '@/components/offers/OfferWorkflowDots';
```

- [ ] **Step 2: Add column header**

In the table header section (around Lines 436-444), add a new `<th>` for "Flow" between the Status column and Actions column:
```tsx
<th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase">Flow</th>
```

- [ ] **Step 3: Add column cell**

In the table row rendering (around Lines 447-556), add the corresponding `<td>` in the same position:
```tsx
<td className="py-3 px-4">
  <OfferWorkflowDots status={offer.status} />
</td>
```

- [ ] **Step 4: Visual check**

Run the dev server and verify the dots appear in the offer list. Check all statuses look correct.

- [ ] **Step 5: Commit**

```bash
git add src/components/OfferModuleV2.tsx
git commit -m "feat: integrate OfferWorkflowDots into offer list table"
```

---

## Task 6: OfferFlowTimeline Component

Create the full timeline for accepted offers showing Angebot → Projekt → Rechnung.

**Files:**
- Create: `src/components/offers/OfferFlowTimeline.tsx`

- [ ] **Step 1: Create OfferFlowTimeline component**

Create `src/components/offers/OfferFlowTimeline.tsx`:

```tsx
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Offer } from '@/types/offer';
import { Check, ArrowRight, FileText, FolderKanban, Receipt, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

interface OfferFlowTimelineProps {
  offer: Offer;
}

interface FlowStep {
  label: string;
  icon: React.ReactNode;
  date?: string;
  status: 'completed' | 'active' | 'future' | 'error';
  documentName?: string;
  linkTo?: string;
}

export function OfferFlowTimeline({ offer }: OfferFlowTimelineProps) {
  // Only show for accepted offers
  if (offer.status !== 'accepted') return null;

  const projectId = offer.project_id;

  // Load linked project
  const { data: project } = useQuery({
    queryKey: ['offer-flow-project', projectId],
    queryFn: async () => {
      if (!projectId) return null;
      const { data, error } = await supabase
        .from('projects')
        .select('id, name, status, workflow_target_type, workflow_target_id, created_at')
        .eq('id', projectId)
        .single();
      if (error) return null;
      return data;
    },
    enabled: !!projectId,
    staleTime: 30_000,
  });

  // Load linked invoice (if project has one)
  const invoiceId = project?.workflow_target_type === 'invoice' ? project.workflow_target_id : null;
  const { data: invoice } = useQuery({
    queryKey: ['offer-flow-invoice', invoiceId],
    queryFn: async () => {
      if (!invoiceId) return null;
      const { data, error } = await supabase
        .from('invoices')
        .select('id, invoice_number, status, created_at')
        .eq('id', invoiceId)
        .single();
      if (error) return null;
      return data;
    },
    enabled: !!invoiceId,
    staleTime: 30_000,
  });

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return undefined;
    try {
      return format(new Date(dateStr), 'dd.MM.yy', { locale: de });
    } catch {
      return undefined;
    }
  };

  // Build steps
  const steps: FlowStep[] = [
    {
      label: 'Angebot',
      icon: <FileText className="h-4 w-4" />,
      date: formatDate(offer.accepted_at || offer.updated_at),
      status: 'completed',
      documentName: offer.offer_number,
    },
  ];

  if (!projectId) {
    steps.push({
      label: 'Projekt',
      icon: <AlertCircle className="h-4 w-4" />,
      status: 'error',
      documentName: 'Nicht verknüpft',
    });
  } else if (project) {
    const projectCompleted = project.status === 'abgeschlossen';
    steps.push({
      label: 'Projekt',
      icon: <FolderKanban className="h-4 w-4" />,
      date: formatDate(project.created_at),
      status: projectCompleted ? 'completed' : 'active',
      documentName: project.name,
    });

    if (invoice) {
      steps.push({
        label: 'Rechnung',
        icon: <Receipt className="h-4 w-4" />,
        date: formatDate(invoice.created_at),
        status: invoice.status === 'paid' ? 'completed' : 'active',
        documentName: invoice.invoice_number,
      });
    } else {
      steps.push({
        label: 'Rechnung',
        icon: <Receipt className="h-4 w-4" />,
        status: 'future',
      });
    }
  } else {
    // Project ID exists but hasn't loaded yet - show loading state
    steps.push(
      { label: 'Projekt', icon: <FolderKanban className="h-4 w-4" />, status: 'future' },
      { label: 'Rechnung', icon: <Receipt className="h-4 w-4" />, status: 'future' }
    );
  }

  const STEP_STYLES = {
    completed: 'bg-emerald-100 border-emerald-300 text-emerald-700',
    active: 'bg-blue-100 border-blue-300 text-blue-700',
    future: 'bg-slate-50 border-slate-200 text-slate-400',
    error: 'bg-amber-50 border-amber-200 text-amber-600',
  };

  return (
    <div className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg mb-4">
      <span className="text-xs font-medium text-slate-500 mr-2">Flow:</span>
      {steps.map((step, index) => (
        <div key={step.label} className="flex items-center">
          <div className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded-md border text-sm',
            STEP_STYLES[step.status]
          )}>
            {step.status === 'completed' ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              step.icon
            )}
            <div className="flex flex-col">
              <span className="font-medium text-xs">{step.label}</span>
              {step.documentName && (
                <span className="text-[10px] opacity-75">{step.documentName}</span>
              )}
            </div>
            {step.date && (
              <span className="text-[10px] opacity-60 ml-1">{step.date}</span>
            )}
          </div>
          {index < steps.length - 1 && (
            <ArrowRight className="h-4 w-4 text-slate-300 mx-1 flex-shrink-0" />
          )}
        </div>
      ))}
    </div>
  );
}

export default OfferFlowTimeline;
```

**NOTE:** The spec mentions "Klick auf Schritt navigiert zum verknüpften Dokument". This is **deferred** to a follow-up iteration. The `FlowStep` interface has a `linkTo` property prepared but click handlers are not yet wired. The current version is display-only.

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit src/components/offers/OfferFlowTimeline.tsx 2>&1 | head -10`

- [ ] **Step 3: Commit**

```bash
git add src/components/offers/OfferFlowTimeline.tsx
git commit -m "feat: add OfferFlowTimeline component for cross-module flow"
```

---

## Task 7: Integrate OfferFlowTimeline into OfferEditorPage

Add the timeline banner to the offer editor.

**Files:**
- Modify: `src/pages/offers/OfferEditorPage.tsx`

- [ ] **Step 1: Add import**

At the top of `src/pages/offers/OfferEditorPage.tsx`, add:
```typescript
import { OfferFlowTimeline } from '@/components/offers/OfferFlowTimeline';
```

- [ ] **Step 2: Add timeline above the form**

Find the main content area (around Line 371-376, after the locked warning banner area). Add the timeline right before the main header:

```tsx
{offer && <OfferFlowTimeline offer={offer as any} />}
```

Place it above the header section so it acts as a banner.

- [ ] **Step 3: Visual check**

Open an accepted offer in the editor and verify the timeline displays correctly with Angebot → Projekt → Rechnung flow.

- [ ] **Step 4: Commit**

```bash
git add src/pages/offers/OfferEditorPage.tsx
git commit -m "feat: integrate OfferFlowTimeline into offer editor page"
```

---

## Task 8: Nachfass-Badge in OfferModuleV2

Add follow-up badges to offer rows.

**Files:**
- Modify: `src/components/OfferModuleV2.tsx`

- [ ] **Step 1: Add follow-up helper function**

Add this helper function inside or above the component in `OfferModuleV2.tsx`:

```typescript
function getNachfassBadge(offer: { status: string; sent_at?: string | null; valid_until?: string | null }) {
  if (offer.status !== 'sent') return null;
  if (!offer.sent_at) return null;
  const sentAt = offer.sent_at;

  // Check if expired
  if (offer.valid_until && new Date(offer.valid_until) < new Date()) return null;

  const daysSinceSent = Math.floor(
    (Date.now() - new Date(sentAt).getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysSinceSent < 7) return null;

  return {
    days: daysSinceSent,
    severity: daysSinceSent >= 14 ? 'high' : 'medium',
  };
}
```

- [ ] **Step 2: Render the badge in offer rows**

In the table row, next to the customer name cell, add:

```tsx
{(() => {
  const nachfass = getNachfassBadge(offer);
  if (!nachfass) return null;
  return (
    <Badge
      variant="outline"
      className={cn(
        'ml-2 text-[10px] font-medium',
        nachfass.severity === 'high'
          ? 'bg-orange-100 text-orange-700 border-orange-200'
          : 'bg-yellow-100 text-yellow-700 border-yellow-200'
      )}
    >
      Nachfassen · {nachfass.days}d
    </Badge>
  );
})()}
```

- [ ] **Step 3: Ensure `sent_at` is included in the Supabase query**

Check the offers loading query/hook. The `sent_at` field should be included in the select. If using `select('*')`, it's already included. If using specific fields, add `sent_at`.

- [ ] **Step 4: Visual check**

Create or find a sent offer older than 7 days. Verify the yellow/orange badge appears.

- [ ] **Step 5: Commit**

```bash
git add src/components/OfferModuleV2.tsx
git commit -m "feat: add Nachfass badge to offer list rows"
```

---

## Task 9: Nachfassen Filter + URL Parameter

Add the "Nachfassen" filter toggle and URL parameter support.

**Files:**
- Modify: `src/components/OfferModuleV2.tsx`

- [ ] **Step 1: Add URL parameter reading**

At the top of the component, add:
```typescript
import { useSearchParams } from 'react-router-dom';
```

Inside the component, add:
```typescript
const [searchParams, setSearchParams] = useSearchParams();
const [nachfassenFilter, setNachfassenFilter] = useState(
  searchParams.get('filter') === 'nachfassen'
);
```

- [ ] **Step 2: Add useMemo import and filter logic**

First, ensure `useMemo` is imported. In the React import at the top, add `useMemo` if not already present:
```typescript
import React, { useState, useMemo } from 'react';
```

**IMPORTANT:** The component already has a `filteredOffers` variable (~line 108) for search filtering. Do NOT replace it. Instead, chain the Nachfassen filter BEFORE the existing search filter. Find where `filteredOffers` is defined and modify it:

```typescript
// Apply Nachfassen filter first, then existing search filter
const nachfassenFilteredOffers = useMemo(() => {
  if (!nachfassenFilter) return offers;
  return offers.filter(offer => getNachfassBadge(offer) !== null);
}, [offers, nachfassenFilter]);

// Existing search filter - change its input from `offers` to `nachfassenFilteredOffers`
const filteredOffers = nachfassenFilteredOffers.filter(offer => {
  // ... existing search logic stays the same
});
```

- [ ] **Step 3: Add filter toggle button**

In the toolbar section (around Lines 383-396), add a toggle button:

```tsx
<Button
  variant={nachfassenFilter ? 'default' : 'outline'}
  size="sm"
  onClick={() => {
    const next = !nachfassenFilter;
    setNachfassenFilter(next);
    if (next) {
      searchParams.set('filter', 'nachfassen');
    } else {
      searchParams.delete('filter');
    }
    setSearchParams(searchParams, { replace: true });
  }}
  className={cn(
    nachfassenFilter && 'bg-orange-500 hover:bg-orange-600'
  )}
>
  <Bell className="h-4 w-4 mr-1" />
  Nachfassen
  {nachfassenCount > 0 && (
    <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0">
      {nachfassenCount}
    </Badge>
  )}
</Button>
```

Add `Bell` to the lucide-react imports. Calculate `nachfassenCount`:
```typescript
const nachfassenCount = useMemo(() =>
  offers.filter(o => getNachfassBadge(o) !== null).length,
  [offers]
);
```

- [ ] **Step 4: Visual check**

Navigate to offers page with `?filter=nachfassen` in URL. Verify filter activates automatically and shows only follow-up offers.

- [ ] **Step 5: Commit**

```bash
git add src/components/OfferModuleV2.tsx
git commit -m "feat: add Nachfassen filter toggle with URL parameter support"
```

---

## Task 10: Dashboard Nachfassen KPI

Add the follow-up KPI card to the main dashboard.

**Files:**
- Modify: `src/components/DashboardStatsWithKpis.tsx`

- [ ] **Step 1: Add Nachfassen query**

In the data-loading function of `DashboardStatsWithKpis.tsx`, add a new query:

```typescript
const { data: nachfassenData } = await supabase
  .from('offers')
  .select('id', { count: 'exact' })
  .eq('company_id', companyId)
  .eq('status', 'sent')
  .not('sent_at', 'is', null)
  .lt('sent_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
  .or('valid_until.is.null,valid_until.gte.' + new Date().toISOString().split('T')[0]);
```

Store the count in state.

- [ ] **Step 2: Add KPI card**

In the KPI cards grid (Lines ~192-247), add a new card:

```tsx
<div
  className="bg-white rounded-xl border border-slate-200 p-4 cursor-pointer hover:border-orange-300 transition-colors"
  onClick={() => onNavigate?.('offers?filter=nachfassen')}
>
  <div className="flex items-center justify-between">
    <div>
      <p className="text-xs text-slate-500">Nachfassen</p>
      <p className="text-2xl font-bold text-orange-600">{nachfassenCount}</p>
      <p className="text-xs text-slate-400">Angebote offen &gt;7d</p>
    </div>
    <div className="h-10 w-10 rounded-lg bg-orange-100 flex items-center justify-center">
      <Bell className="h-5 w-5 text-orange-600" />
    </div>
  </div>
</div>
```

Add `Bell` to lucide imports. **NOTE:** This component uses `onNavigate` callback prop (not `useNavigate` from react-router). Check how the parent handles the callback - it may need to be updated to support URL params like `?filter=nachfassen`. If the parent uses `setActiveModule(moduleId)`, update it to parse the query param and pass it through.

- [ ] **Step 3: Visual check**

Open the main dashboard. Verify the Nachfassen KPI card shows. Click it and verify it navigates to offers with filter active.

- [ ] **Step 4: Commit**

```bash
git add src/components/DashboardStatsWithKpis.tsx
git commit -m "feat: add Nachfassen KPI card to dashboard"
```

---

## Task 11: Final Verification & Cleanup

**Files:** All modified files

- [ ] **Step 1: Full build check**

Run: `npx tsc --noEmit 2>&1 | head -40`
Expect: No new type errors.

- [ ] **Step 2: Search for remaining quote references**

Run: `grep -ri "from.*quotes\b" src/ --include="*.ts" --include="*.tsx" -l`
Verify no files still query the `quotes` table directly.

- [ ] **Step 3: Dev server test**

Run: `npm run dev`
Manually test:
1. Offer list: Workflow dots visible for all statuses
2. Offer list: Nachfass badge visible on sent offers >7 days
3. Offer list: Nachfassen filter button works
4. Offer editor: Flow timeline shows for accepted offers
5. Dashboard: Nachfassen KPI card shows and links correctly
6. No console errors related to quotes

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete Angebots-Modul improvements - workflow indicators, follow-up system, quotes cleanup"
```
