# Nachtragsworkflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a realistic addendum flow for HandwerkOS: detected or manual extra work becomes a project addendum, approved addendums are visible in the dashboard, and approved uninvoiced addendums can be pulled into a project invoice.

**Architecture:** Add `project_addendums` as a first-class Supabase table with status tracking. Keep calculation rules in a small TypeScript helper so dashboard and invoice UI share the same status semantics.

**Tech Stack:** React, TypeScript, Supabase migrations, Vitest, Vite.

---

### Task 1: Addendum Status Core

**Files:**
- Create: `src/lib/projectAddendums.ts`
- Create: `src/lib/__tests__/projectAddendums.test.ts`

- [ ] **Step 1: Write failing tests**

Test that addendums with `detected`, `draft`, `pending_customer`, or `approved` count as open while `rejected` and `invoiced` do not. Test that only approved addendums without `invoice_id` become invoice items.

- [ ] **Step 2: Run tests**

Run: `npm run test -- --run src/lib/__tests__/projectAddendums.test.ts`
Expected: FAIL because helper file does not exist yet.

- [ ] **Step 3: Implement helper**

Export `getOpenAddendumCount`, `getInvoiceableAddendums`, and `toInvoiceLine`.

### Task 2: Database Contract

**Files:**
- Create: `supabase/migrations/20260610123000_project_addendums.sql`

- [ ] **Step 1: Create table**

Create `project_addendums` with company/project/customer links, description, quantity, unit, unit_price, amount_net, vat_rate, status, source fields, customer approval fields, invoice link, and timestamps.

- [ ] **Step 2: Add RLS**

Allow authenticated users with company access to select/insert/update addendums.

### Task 3: Dashboard Integration

**Files:**
- Modify: `src/lib/dashboardInsights.ts`
- Modify: `src/lib/__tests__/dashboardInsights.test.ts`
- Modify: `src/components/ExecutiveDashboardV2.tsx`

- [ ] **Step 1: Dashboard uses persisted addendums**

`openAddendumCount` should include persisted open addendums and text-detected addendum signals without double counting per project.

- [ ] **Step 2: Load project_addendums**

Load addendums for the company and pass them into `createDashboardInsights`.

### Task 4: Invoice Dialog Integration

**Files:**
- Modify: `src/components/CreateInvoiceFromProjectDialog.tsx`

- [ ] **Step 1: Load approved uninvoiced addendums**

Query `project_addendums` by project where status is `approved` and `invoice_id` is null.

- [ ] **Step 2: Include in invoice selection**

Render a "Nachträge" card, select all by default, include in totals, insert invoice document items, and update included addendums to `invoiced` with `invoice_id`.

### Task 5: Verification

**Files:**
- No source edits expected.

- [ ] **Step 1: Run focused tests**

Run:
- `npm run test -- --run src/lib/__tests__/projectAddendums.test.ts`
- `npm run test -- --run src/lib/__tests__/dashboardInsights.test.ts`

- [ ] **Step 2: Run production build**

Run: `npm run build`

- [ ] **Step 3: Browser smoke**

Open `http://localhost:8080/` and verify the app shell renders.
