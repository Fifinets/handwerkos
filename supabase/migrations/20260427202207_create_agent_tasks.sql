-- ============================================================
-- AI Agent Engine: agent_tasks Tabelle + Agent-Markierungen
--
-- Phase 1, Schritt 1 & 2 der Agent-Engine-Implementierung.
-- Append-only Log aller Agent-Aktionen für GoBD-Compliance.
-- ============================================================

-- 1. agent_tasks Tabelle
CREATE TABLE public.agent_tasks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  agent_type      TEXT NOT NULL CHECK (agent_type IN ('offers', 'invoices', 'planning', 'materials')),
  trigger_type    TEXT NOT NULL CHECK (trigger_type IN ('user', 'heartbeat')),
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'running', 'awaiting_approval', 'done', 'failed')),
  input           JSONB NOT NULL,
  intent          JSONB,
  tool_calls      JSONB NOT NULL DEFAULT '[]'::jsonb,
  output          JSONB,
  error           TEXT,
  approved_at     TIMESTAMPTZ,
  approved_by     UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.agent_tasks IS
  'Append-only Log aller KI-Agent-Aufgaben (GoBD-pflichtig). DELETE ist via Trigger gesperrt.';

-- 2. RLS — Pattern wie in offers/invoices: user_has_company_access()
ALTER TABLE public.agent_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company users can view own agent tasks"
  ON public.agent_tasks
  FOR SELECT
  TO authenticated
  USING (public.user_has_company_access(company_id));

CREATE POLICY "Company users can insert agent tasks"
  ON public.agent_tasks
  FOR INSERT
  TO authenticated
  WITH CHECK (public.user_has_company_access(company_id));

CREATE POLICY "Company users can update own agent tasks"
  ON public.agent_tasks
  FOR UPDATE
  TO authenticated
  USING (public.user_has_company_access(company_id))
  WITH CHECK (public.user_has_company_access(company_id));

-- KEINE DELETE-Policy → standardmäßig durch RLS blockiert für authenticated.
-- Zusätzlich Trigger als Defense-in-Depth (auch gegen service_role):
CREATE OR REPLACE FUNCTION public.prevent_agent_task_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'agent_tasks ist append-only (GoBD-Compliance) — DELETE nicht erlaubt';
END;
$$;

CREATE TRIGGER agent_tasks_no_delete
  BEFORE DELETE ON public.agent_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_agent_task_delete();

-- 3. Indizes für Polling und Realtime-Subscriptions
CREATE INDEX agent_tasks_status_company_idx
  ON public.agent_tasks(company_id, status, created_at DESC);

CREATE INDEX agent_tasks_company_created_idx
  ON public.agent_tasks(company_id, created_at DESC);

-- 4. Markierungs-Spalten in bestehenden Haupttabellen
--    created_by_agent: unterscheidet Agent- von Formular-Erstellung
--    agent_task_id:    Rückverweis auf den Agent-Task (für Audit-Trail)
ALTER TABLE public.offers
  ADD COLUMN IF NOT EXISTS created_by_agent BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS agent_task_id    UUID REFERENCES public.agent_tasks(id);

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS created_by_agent BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS agent_task_id    UUID REFERENCES public.agent_tasks(id);

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS created_by_agent BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS agent_task_id    UUID REFERENCES public.agent_tasks(id);

-- 5. Realtime aktivieren für Live-Updates im Chat-UI
ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_tasks;
