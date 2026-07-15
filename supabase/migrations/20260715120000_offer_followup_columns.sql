-- Nachfass-Merker für Angebote (Spec: docs/superpowers/specs/2026-07-15-offer-followup-design.md)
-- Metadaten, kein Beleginhalt: sent_at bleibt "erstmals versendet".
ALTER TABLE public.offers
  ADD COLUMN IF NOT EXISTS last_followup_at timestamptz,
  ADD COLUMN IF NOT EXISTS followup_count integer NOT NULL DEFAULT 0;
