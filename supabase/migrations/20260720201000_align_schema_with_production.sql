-- Bring the migration chain in line with the production database.
--
-- Between March and June several schema changes were applied directly to the
-- production database without a migration. A fresh `supabase db reset` therefore
-- produced a schema that differed from production in ways that break code:
-- accept_offer_and_create_project fails locally because projects.start_date is
-- NOT NULL there but nullable in production, and company_settings is missing the
-- bank columns the invoice PDF reads.
--
-- Every statement below is a no-op against production (that is the point — it
-- records what is already true there) and only changes freshly migrated
-- databases: local, CI and any future staging environment.
--
-- Verified column by column against the live schema on 2026-07-20; after this
-- migration the per-table nullability and column sets match exactly.

-- ---------------------------------------------------------------------------
-- 1. projects: start_date is optional in production.
--    accept_offer_and_create_project (20260610120000) passes
--    offer_targets.target_start_date straight through, and that is nullable —
--    so with NOT NULL, accepting an offer without a planned start date fails.
-- ---------------------------------------------------------------------------
ALTER TABLE public.projects
  ALTER COLUMN start_date DROP NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. projects: two columns that only exist in production.
--    project_type carries a default, so existing inserts keep working.
-- ---------------------------------------------------------------------------
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS project_type TEXT NOT NULL DEFAULT 'projektauftrag',
  ADD COLUMN IF NOT EXISTS work_calendar_event_id UUID;

-- ---------------------------------------------------------------------------
-- 3. company_settings: bank details, read by invoice/offer PDF generation.
-- ---------------------------------------------------------------------------
ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS bank_name           TEXT,
  ADD COLUMN IF NOT EXISTS bank_iban           TEXT,
  ADD COLUMN IF NOT EXISTS bank_bic            TEXT,
  ADD COLUMN IF NOT EXISTS bank_account_holder TEXT;

-- ---------------------------------------------------------------------------
-- 4. Legacy quotes remnants, already dropped in production.
--    docs/ARCHITECTURE_RULES.md: offers/offer_id replace quotes/quote_id, which
--    is read-only legacy. No application code reads these columns (checked
--    across src/ — the only quote_id hits are an unrelated JSON field and the
--    legacy type declarations).
-- ---------------------------------------------------------------------------
ALTER TABLE public.invoices        DROP COLUMN IF EXISTS quote_id;
ALTER TABLE public.invoices        DROP COLUMN IF EXISTS amount;
ALTER TABLE public.orders          DROP COLUMN IF EXISTS quote_id;
ALTER TABLE public.workflow_chains DROP COLUMN IF EXISTS quote_id;

-- ---------------------------------------------------------------------------
-- 5. delivery notes: production is stricter than the repo on five columns.
--    All five carry a default, so backfilling before SET NOT NULL cannot fail
--    and existing rows are unaffected.
-- ---------------------------------------------------------------------------
UPDATE public.delivery_note_items SET created_at = now()  WHERE created_at IS NULL;
UPDATE public.delivery_note_items SET sort_order = 0      WHERE sort_order IS NULL;
UPDATE public.delivery_notes      SET break_minutes = 0   WHERE break_minutes IS NULL;
UPDATE public.delivery_notes      SET created_at = now()  WHERE created_at IS NULL;
UPDATE public.delivery_notes      SET updated_at = now()  WHERE updated_at IS NULL;

ALTER TABLE public.delivery_note_items
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN sort_order SET DEFAULT 0,
  ALTER COLUMN sort_order SET NOT NULL;

ALTER TABLE public.delivery_notes
  ALTER COLUMN break_minutes SET DEFAULT 0,
  ALTER COLUMN break_minutes SET NOT NULL,
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN updated_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET NOT NULL;
