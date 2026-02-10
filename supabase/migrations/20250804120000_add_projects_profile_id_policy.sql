-- Add profile_id column referencing profiles table
ALTER TABLE public.projects
  ADD COLUMN profile_id uuid REFERENCES public.profiles(id);

-- Ensure RLS is enabled (no-op if already enabled)
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Policy to allow users to access only their own projects
CREATE POLICY "Users can manage their projects"
ON public.projects
FOR ALL
USING (auth.uid() = profile_id)
WITH CHECK (auth.uid() = profile_id);
