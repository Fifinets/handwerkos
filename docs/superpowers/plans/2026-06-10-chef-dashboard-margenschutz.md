# Chef-Dashboard Margenschutz Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Git-backed HandwerkOS dashboard focus on project margin protection for Elektro/PV managers.

**Architecture:** Add a pure TypeScript insight helper that evaluates existing project, work-hour, time-entry, and invoice data. Render the results in `ExecutiveDashboardV2`, which is the active manager dashboard route in the Git repo.

**Tech Stack:** React 18, Vite, TypeScript, Supabase JS, shadcn/ui, Tailwind CSS, lucide-react, Vitest.

---

### Product Focus

HandwerkOS should not start as another broad Handwerker suite. The strongest wedge is:

> HandwerkOS shows Elektro/PV companies whether each project is still profitable and which addenda or invoices are being missed.

### First Dashboard Slice

- Critical project count: budget, hours, or deadline risk.
- Open addenda count: field notes that mention additional work.
- Ready-to-invoice count: completed projects without a non-cancelled invoice.
- Missing-calculation count: active projects without budget or planned hours.
- Risk list: top projects with signals and recommended next action.

### Current Data Assumptions

- Planned hours can temporarily be parsed from `projects.description` via `planned_hours: 32`, `planstunden: 32`, or `geplante_stunden: 32`.
- Budget comes from `projects.budget`.
- Current actual cost comes from `projects.labor_costs + projects.material_costs`.
- Hours come from `project_work_hours` plus completed `time_entries`.
- Invoice readiness uses `invoices.project_id`.

### Open Clarifications

- Add first-class fields for planned hours, planned material cost, sale price, and target margin.
- Decide whether addenda need a dedicated table or should first be derived from daily reports/time notes.
- Normalize project status values across German display labels and internal snake_case values.
- Define a default internal hourly cost for early margin estimates.
