-- Allow accepted offers to become the workflow origin of projects.
-- The offer acceptance RPC writes workflow_origin_type = 'offer', while the
-- older workflow-chain migration only allowed 'order'.
ALTER TABLE public.projects
  DROP CONSTRAINT IF EXISTS projects_workflow_origin_type_check;

ALTER TABLE public.projects
  ADD CONSTRAINT projects_workflow_origin_type_check
  CHECK (
    workflow_origin_type IS NULL
    OR workflow_origin_type IN ('order', 'offer')
  );
