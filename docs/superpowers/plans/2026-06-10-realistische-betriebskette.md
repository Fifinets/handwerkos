# Realistische Betriebskette Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the realistic Handwerksbetrieb flow `Angebot -> Projekt -> Baustelle -> Nachtragshinweis -> Rechnung` safer by carrying accepted-offer baselines into project risk logic and by showing real material usage in margin checks.

**Architecture:** Keep this slice schema-compatible with the current `projects` table by deriving project baselines from accepted offers and offer targets. Persist the intended DB behavior in a Supabase migration so internal and public offer acceptance create linked projects with workflow metadata, budget, dates, and baseline notes.

**Tech Stack:** React, TypeScript, Supabase, Vitest, Vite.

---

### Task 1: Dashboard Baseline From Accepted Offers

**Files:**
- Modify: `src/lib/dashboardInsights.ts`
- Modify: `src/lib/__tests__/dashboardInsights.test.ts`

- [ ] **Step 1: Write failing tests**

Add tests that pass accepted offer targets and material usage into `createDashboardInsights`. The expected behavior is:
- planned hours come from accepted offer targets before falling back to project description
- budget comes from accepted offer net total before falling back to project budget
- material usage adds to actual project costs

- [ ] **Step 2: Run tests to verify failure**

Run: `npm run test -- --run src/lib/__tests__/dashboardInsights.test.ts`
Expected: FAIL because `acceptedOffers` and `materialUsage` are not part of the insight input yet.

- [ ] **Step 3: Implement minimal dashboard logic**

Add `DashboardAcceptedOffer` and `DashboardMaterialUsage` input types. Resolve a project baseline by matching `acceptedOffers.project_id` and reading the first related `offer_targets` object. Add material usage cost as `quantity * unit_price` to actual costs.

- [ ] **Step 4: Run tests to verify pass**

Run: `npm run test -- --run src/lib/__tests__/dashboardInsights.test.ts`
Expected: PASS.

### Task 2: Dashboard Data Loading

**Files:**
- Modify: `src/components/ExecutiveDashboardV2.tsx`

- [ ] **Step 1: Load accepted offers and material usage**

Add parallel Supabase queries:
- accepted offers with `project_id`, `snapshot_net_total`, `offer_targets(...)`
- `employee_material_usage` with `project_id`, `quantity`, `unit_price`

- [ ] **Step 2: Pass data into insights**

Map Supabase rows to the dashboard insight input shape. Keep pending offers query unchanged for existing KPIs.

- [ ] **Step 3: Run dashboard tests/build**

Run: `npm run test -- --run src/lib/__tests__/dashboardInsights.test.ts`
Run: `npm run build`
Expected: both exit 0.

### Task 3: Offer Acceptance DB Contract

**Files:**
- Create: `supabase/migrations/20260610120000_offer_project_baseline.sql`

- [ ] **Step 1: Add migration**

Create or replace `accept_offer_and_create_project` and `accept_public_offer`. Both functions must:
- read offer and `offer_targets`
- create a project with `status = 'beauftragt'`
- set `budget` from `snapshot_net_total` or target revenue
- set `start_date`, `end_date`, `work_start_date`, `work_end_date` from target dates
- set `workflow_origin_type = 'offer'` and `workflow_origin_id = offer.id`
- write baseline markers into `projects.description`
- update the offer to `accepted`, locked, and linked to the new project

- [ ] **Step 2: TypeScript safety check**

Run: `npm run build`
Expected: exit 0. SQL is not compiled locally here, but the migration must be syntax-reviewable and use existing columns only.

### Task 4: Browser Smoke Check

**Files:**
- No source edits expected.

- [ ] **Step 1: Ensure localhost runs**

Run: `npm run dev -- --host 127.0.0.1`
Open: `http://localhost:8080/`
Expected: app shell renders without a blank screen.

- [ ] **Step 2: Final status**

Run: `git status --short`
Expected: only intended plan, source, test, and migration files changed plus existing untracked `.superpowers` runtime state.
