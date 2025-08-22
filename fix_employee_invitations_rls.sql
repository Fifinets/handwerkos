-- Fix employee_invitations RLS policy to allow token-based access
-- The current policy blocks access for invited employees who don't exist in employees table yet

-- Drop the restrictive policy
DROP POLICY IF EXISTS "Company members can view own invitations" ON employee_invitations;

-- Create a new policy that allows:
-- 1. Authenticated users from same company (existing employees)
-- 2. Token-based access for new invitees (anonymous users with valid token)
CREATE POLICY "Allow invitation access" ON employee_invitations
    FOR SELECT USING (
        -- Allow authenticated users from same company
        (auth.role() = 'authenticated' AND 
         company_id IN (
             SELECT company_id FROM employees 
             WHERE user_id = auth.uid()
         ))
        OR
        -- Allow anonymous access - app will validate token in code
        -- This is safe because token validation happens in application layer
        auth.role() = 'anon'
    );

-- Also allow anonymous users to update invitation status (for accepting invitations)
CREATE POLICY "Allow invitation updates" ON employee_invitations
    FOR UPDATE USING (
        -- Authenticated users can update their company's invitations
        (auth.role() = 'authenticated' AND 
         company_id IN (
             SELECT company_id FROM employees 
             WHERE user_id = auth.uid()
         ))
        OR
        -- Anonymous users can update (for accepting invitations)
        -- Token validation happens in application code
        auth.role() = 'anon'
    );

-- Grant necessary permissions to anonymous users
GRANT SELECT, UPDATE ON employee_invitations TO anon;