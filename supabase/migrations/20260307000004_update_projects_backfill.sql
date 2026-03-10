-- ============================================================
-- Phase 1.4: Update projects backfill
-- Add project_site_id and status mapping
-- ============================================================

ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS project_site_id UUID REFERENCES public.project_sites(id) ON DELETE SET NULL;

-- Status-Mapping (Backfill): Mappt alte deutsche Status-Werte irreversibel auf das englische Enum
UPDATE public.projects
SET status = CASE
  WHEN status IN ('anfrage', 'geplant', 'besichtigung') THEN 'planned'
  WHEN status IN ('in_bearbeitung', 'in_progress') THEN 'active'
  WHEN status IN ('abgeschlossen', 'completed') THEN 'completed'
  WHEN status IN ('storniert', 'abgebrochen', 'cancelled') THEN 'cancelled'
  ELSE 'planned'
END;
