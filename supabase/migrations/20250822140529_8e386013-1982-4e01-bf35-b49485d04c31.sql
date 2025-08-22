-- Critical Security Fix Migration (Targeted)
-- Fix only the most critical security vulnerabilities

-- Step 1: Enable RLS on employees table (CRITICAL)
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

-- Step 2: Drop existing problematic policies on employees
DROP POLICY IF EXISTS "Allow anon to check employee invitations" ON employees;
DROP POLICY IF EXISTS "Users can view own employee data" ON employees;
DROP POLICY IF EXISTS "Users can update own employee record" ON employees;
DROP POLICY IF EXISTS "Employees can view company employees" ON employees;
DROP POLICY IF EXISTS "Managers can manage company employees" ON employees;

-- Step 3: Create secure RLS policies for employees table
-- Policy: Users can view their own employee record
CREATE POLICY "Users can view own employee record" ON employees
    FOR SELECT USING (user_id = auth.uid());

-- Policy: Users can update their own employee record
CREATE POLICY "Users can update own employee record" ON employees
    FOR UPDATE USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Policy: Employees can view company colleagues (same company only)
CREATE POLICY "Employees can view company colleagues" ON employees
    FOR SELECT USING (
        has_role(auth.uid(), 'employee'::user_role) AND 
        company_id = (
            SELECT company_id FROM profiles WHERE id = auth.uid()
        )
    );

-- Policy: Managers can manage company employees (same company only)
CREATE POLICY "Managers can manage company employees" ON employees
    FOR ALL USING (
        has_role(auth.uid(), 'manager'::user_role) AND 
        company_id = (
            SELECT company_id FROM profiles WHERE id = auth.uid()
        )
    );

-- Policy: Allow anonymous registration updates (secure)
CREATE POLICY "Anonymous registration update" ON employees
    FOR UPDATE USING (
        auth.role() = 'anon' AND 
        user_id IS NULL AND 
        status = 'eingeladen' AND
        EXISTS (
            SELECT 1 FROM employee_invitations 
            WHERE employee_invitations.email = employees.email 
            AND employee_invitations.status = 'pending'
            AND employee_invitations.expires_at > now()
        )
    );

-- Policy: Service role for system operations
CREATE POLICY "Service role manages employees" ON employees
    FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- Step 4: Revoke problematic anonymous access
REVOKE ALL ON employees FROM anon;
REVOKE ALL ON vacation_requests FROM anon;

-- Grant proper authenticated access
GRANT SELECT, UPDATE ON employees TO authenticated;
GRANT SELECT, INSERT, UPDATE ON vacation_requests TO authenticated;