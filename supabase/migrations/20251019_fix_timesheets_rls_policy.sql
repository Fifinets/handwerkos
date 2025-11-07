-- Fix timesheets RLS policy to allow INSERT
-- The original policy only had USING which doesn't work for INSERT
-- INSERT requires WITH CHECK clause

-- Drop the incorrect policy
DROP POLICY IF EXISTS "Users can manage timesheets for their company" ON public.timesheets;

-- Create correct policies with WITH CHECK for INSERT
CREATE POLICY "Users can insert timesheets for their company" ON public.timesheets
  FOR INSERT
  WITH CHECK (public.user_has_company_access(company_id));

CREATE POLICY "Users can update timesheets for their company" ON public.timesheets
  FOR UPDATE
  USING (public.user_has_company_access(company_id))
  WITH CHECK (public.user_has_company_access(company_id));

CREATE POLICY "Users can delete timesheets for their company" ON public.timesheets
  FOR DELETE
  USING (public.user_has_company_access(company_id));
