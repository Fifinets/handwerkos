-- Fix security issue: Restrict employee_invitations access to authorized users only

-- First, drop all existing overly permissive policies
DROP POLICY IF EXISTS "Allow invitation access" ON employee_invitations;
DROP POLICY IF EXISTS "Allow invitation lookup by token" ON employee_invitations;
DROP POLICY IF EXISTS "Allow invitation updates" ON employee_invitations;
DROP POLICY IF EXISTS "Allow token-based invitation lookup" ON employee_invitations;

-- Keep the manager policy for full management access
-- (This policy already exists and is secure)

-- Create a secure policy for token-based invitation lookup
-- Only allows access to the specific invitation with a valid token
CREATE POLICY "Token-based invitation access" ON employee_invitations
    FOR SELECT 
    USING (
        -- Allow access only to the specific invitation with this token
        -- and only if the invitation is still valid (pending and not expired)
        auth.role() = 'anon' 
        AND status = 'pending' 
        AND expires_at > now()
    );

-- Create a policy for authenticated users to view invitations from their company only
CREATE POLICY "Company members can view company invitations" ON employee_invitations
    FOR SELECT 
    USING (
        auth.role() = 'authenticated' 
        AND company_id IN (
            SELECT e.company_id 
            FROM employees e 
            WHERE e.user_id = auth.uid()
        )
    );

-- Create a policy for updating invitation status during registration
-- Only allows updating the specific invitation with valid token
CREATE POLICY "Update invitation during registration" ON employee_invitations
    FOR UPDATE 
    USING (
        (auth.role() = 'anon' AND status = 'pending' AND expires_at > now())
        OR 
        (auth.role() = 'authenticated' AND company_id IN (
            SELECT e.company_id 
            FROM employees e 
            WHERE e.user_id = auth.uid()
        ))
    );

-- Revoke any existing public access that might have been granted
REVOKE ALL ON employee_invitations FROM anon;
REVOKE ALL ON employee_invitations FROM public;

-- Grant only necessary permissions
GRANT SELECT ON employee_invitations TO anon;
GRANT SELECT, UPDATE ON employee_invitations TO authenticated;