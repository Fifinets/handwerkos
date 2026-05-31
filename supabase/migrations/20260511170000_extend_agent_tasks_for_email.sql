-- Extend agent_tasks CHECK constraints to support email-action-pipeline (P3).
-- See docs/superpowers/specs/2026-05-11-email-action-pipeline-design.md

ALTER TABLE public.agent_tasks DROP CONSTRAINT agent_tasks_agent_type_check;
ALTER TABLE public.agent_tasks ADD  CONSTRAINT agent_tasks_agent_type_check
  CHECK (agent_type IN ('offers', 'invoices', 'planning', 'materials', 'invoices_inbound'));

ALTER TABLE public.agent_tasks DROP CONSTRAINT agent_tasks_trigger_type_check;
ALTER TABLE public.agent_tasks ADD  CONSTRAINT agent_tasks_trigger_type_check
  CHECK (trigger_type IN ('user', 'heartbeat', 'email'));
