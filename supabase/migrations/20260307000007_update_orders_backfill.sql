-- Migration 1.7: orders_backfill

-- 1. Neue Spalten anlegen
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS offer_id UUID REFERENCES public.offers(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- 2. Keine automatische Migration von quote_id zu offer_id möglich,
-- da quotes von offers abgelöst wurden und alte Daten keine 1:1 Zuordnung haben.
-- Legacy-Aufträge (die noch an quote_id hängen) erhalten NULL in offer_id/project_id.
