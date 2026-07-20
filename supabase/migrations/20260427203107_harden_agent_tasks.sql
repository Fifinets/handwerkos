-- ============================================================
-- Hardening: agent_tasks GoBD-Compliance + Advisor-Cleanliness
--
-- Folge-Migration zu 20260427000001. Adressiert Code-Review-Findings:
-- I-1: TRUNCATE umgeht den DELETE-Trigger
-- I-2: prevent_agent_task_delete fehlt SET search_path
-- M-1: tool_calls sollte als JSON-Array geprüft sein
-- ============================================================

-- I-2: search_path explizit setzen (Supabase advisor: function_search_path_mutable)
CREATE OR REPLACE FUNCTION public.prevent_agent_task_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  RAISE EXCEPTION 'agent_tasks ist append-only (GoBD-Compliance) — DELETE nicht erlaubt';
END;
$$;

-- I-1: TRUNCATE-Schutz (statement-level trigger — row-level fires nicht bei TRUNCATE)
CREATE OR REPLACE FUNCTION public.prevent_agent_task_truncate()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  RAISE EXCEPTION 'agent_tasks ist append-only (GoBD-Compliance) — TRUNCATE nicht erlaubt';
END;
$$;

CREATE TRIGGER agent_tasks_no_truncate
  BEFORE TRUNCATE ON public.agent_tasks
  EXECUTE FUNCTION public.prevent_agent_task_truncate();

-- M-1: tool_calls muss ein JSON-Array sein (Defense gegen Application-Bugs)
ALTER TABLE public.agent_tasks
  ADD CONSTRAINT agent_tasks_tool_calls_is_array
  CHECK (jsonb_typeof(tool_calls) = 'array');
