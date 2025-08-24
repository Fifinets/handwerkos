-- Temporarily disable RLS on projects table for debugging
-- This will help us see if the issue is with RLS policies or data

-- Disable RLS temporarily to test if projects are visible
ALTER TABLE public.projects DISABLE ROW LEVEL SECURITY;

-- This migration should be reverted after testing
-- Re-enable with: ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;