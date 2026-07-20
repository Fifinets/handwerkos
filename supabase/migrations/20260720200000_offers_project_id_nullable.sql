-- Offers may exist without a project (docs/ARCHITECTURE_RULES.md).
--
-- 20260307000008_harden_constraints set offers.project_id to NOT NULL together
-- with invoices and orders. For offers that is wrong: an offer is written long
-- before a project exists, and create_offer_with_targets does not supply a
-- project_id at all — so on any freshly migrated database (local, staging, CI)
-- creating an offer fails with a not-null violation.
--
-- On the production database the constraint was already dropped manually, but
-- without a migration, so the repo never reflected it. This migration records
-- that change so every environment converges on the same schema.
--
-- Deliberately narrow: invoices.project_id and orders.project_id keep their
-- NOT NULL, because those documents are always created from an existing project.

ALTER TABLE public.offers
  ALTER COLUMN project_id DROP NOT NULL;
