-- Final Security Enhancement Migration
-- Address remaining security linter warnings

-- Fix: Add proper search_path to functions that are missing it
ALTER FUNCTION public.generate_order_number() SET search_path = '';
ALTER FUNCTION public.set_order_number() SET search_path = '';
ALTER FUNCTION public.generate_quote_number() SET search_path = '';
ALTER FUNCTION public.generate_invoice_number() SET search_path = '';
ALTER FUNCTION public.set_quote_number() SET search_path = '';
ALTER FUNCTION public.set_invoice_number() SET search_path = '';
ALTER FUNCTION public.validate_email_content(text) SET search_path = '';
ALTER FUNCTION public.sanitize_text_input(text) SET search_path = '';
ALTER FUNCTION public.cleanup_expired_invitations() SET search_path = '';
ALTER FUNCTION public.update_updated_at_column() SET search_path = '';
ALTER FUNCTION public.get_next_number(text, uuid) SET search_path = '';
ALTER FUNCTION public.set_customer_company() SET search_path = '';
ALTER FUNCTION public.increment_vacation_days_used(uuid, integer) SET search_path = '';

-- Check if project_team_members needs RLS policies (INFO warning fix)
-- Enable RLS if not already enabled
ALTER TABLE project_team_members ENABLE ROW LEVEL SECURITY;

-- Add policies for project_team_members
CREATE POLICY "Employees can view project team members" ON project_team_members
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM projects p
            JOIN profiles prof ON prof.company_id = p.company_id
            WHERE p.id = project_team_members.project_id
            AND prof.id = auth.uid()
        )
    );

CREATE POLICY "Managers can manage project team members" ON project_team_members
    FOR ALL USING (
        has_role(auth.uid(), 'manager'::user_role) AND
        EXISTS (
            SELECT 1 FROM projects p
            JOIN profiles prof ON prof.company_id = p.company_id
            WHERE p.id = project_team_members.project_id
            AND prof.id = auth.uid()
        )
    );

-- Grant necessary permissions
GRANT SELECT ON project_team_members TO authenticated;
GRANT INSERT, UPDATE, DELETE ON project_team_members TO authenticated;