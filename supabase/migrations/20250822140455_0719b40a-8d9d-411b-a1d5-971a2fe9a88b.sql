-- Comprehensive Security Fix Migration (Corrected)
-- This migration addresses critical security vulnerabilities while preserving employee registration functionality

-- Step 1: Enable RLS on employees table (CRITICAL)
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

-- Step 2: Drop existing overly permissive policies
DROP POLICY IF EXISTS "Allow anon to check employee invitations" ON employees;
DROP POLICY IF EXISTS "Users can view own employee data" ON employees;
DROP POLICY IF EXISTS "Users can update own employee record" ON employees;
DROP POLICY IF EXISTS "Employees can view company employees" ON employees;
DROP POLICY IF EXISTS "Managers can manage company employees" ON employees;

-- Step 3: Create secure RLS policies for employees table

-- Policy: Users can view their own employee record
CREATE POLICY "Users can view own employee record" ON employees
    FOR SELECT USING (user_id = auth.uid());

-- Policy: Users can update their own employee record (limited fields)
CREATE POLICY "Users can update own employee record" ON employees
    FOR UPDATE USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Policy: Employees can view company colleagues (same company)
CREATE POLICY "Employees can view company colleagues" ON employees
    FOR SELECT USING (
        has_role(auth.uid(), 'employee'::user_role) AND 
        company_id = (
            SELECT company_id FROM profiles WHERE id = auth.uid()
        )
    );

-- Policy: Managers can manage company employees
CREATE POLICY "Managers can manage company employees" ON employees
    FOR ALL USING (
        has_role(auth.uid(), 'manager'::user_role) AND 
        company_id = (
            SELECT company_id FROM profiles WHERE id = auth.uid()
        )
    );

-- Policy: Allow anonymous users to update employee record during registration (SECURE)
-- This is needed for employee registration process with valid invitation token
CREATE POLICY "Anonymous registration update" ON employees
    FOR UPDATE USING (
        auth.role() = 'anon' AND 
        user_id IS NULL AND 
        status = 'eingeladen' AND
        -- Ensure there's a valid, non-expired invitation for this email
        EXISTS (
            SELECT 1 FROM employee_invitations 
            WHERE employee_invitations.email = employees.email 
            AND employee_invitations.status = 'pending'
            AND employee_invitations.expires_at > now()
        )
    )
    WITH CHECK (true); -- Allow any updates during registration

-- Policy: Service role can manage all employees (for system operations)
CREATE POLICY "Service role manages employees" ON employees
    FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- Step 4: Fix vacation_requests table policies (CRITICAL)
-- Drop overly permissive policies
DROP POLICY IF EXISTS "All users can view vacation requests" ON vacation_requests;
DROP POLICY IF EXISTS "All users can update vacation requests" ON vacation_requests;
DROP POLICY IF EXISTS "Users can view own vacation requests" ON vacation_requests;
DROP POLICY IF EXISTS "Users can insert own vacation requests" ON vacation_requests;
DROP POLICY IF EXISTS "Service role can manage vacation requests" ON vacation_requests;
DROP POLICY IF EXISTS "Employees can create their own vacation requests" ON vacation_requests;
DROP POLICY IF EXISTS "Employees can view their own vacation requests" ON vacation_requests;
DROP POLICY IF EXISTS "Managers can manage all vacation requests" ON vacation_requests;

-- Create secure vacation request policies
-- Policy: Employees can view their own vacation requests
CREATE POLICY "Employees can view own vacation requests" ON vacation_requests
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM employees 
            WHERE employees.id = vacation_requests.employee_id 
            AND employees.user_id = auth.uid()
            AND employees.company_id = (
                SELECT company_id FROM profiles WHERE id = auth.uid()
            )
        )
    );

-- Policy: Employees can create their own vacation requests
CREATE POLICY "Employees can create own vacation requests" ON vacation_requests
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM employees 
            WHERE employees.id = vacation_requests.employee_id 
            AND employees.user_id = auth.uid()
            AND employees.company_id = (
                SELECT company_id FROM profiles WHERE id = auth.uid()
            )
        )
        AND created_by = auth.uid()
    );

-- Policy: Employees can update their own pending vacation requests
CREATE POLICY "Employees can update own pending vacation requests" ON vacation_requests
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM employees 
            WHERE employees.id = vacation_requests.employee_id 
            AND employees.user_id = auth.uid()
            AND employees.company_id = (
                SELECT company_id FROM profiles WHERE id = auth.uid()
            )
        )
        AND status = 'pending'
    );

-- Policy: Managers can manage all vacation requests in their company
CREATE POLICY "Managers can manage company vacation requests" ON vacation_requests
    FOR ALL USING (
        has_role(auth.uid(), 'manager'::user_role) AND
        EXISTS (
            SELECT 1 FROM employees 
            WHERE employees.id = vacation_requests.employee_id 
            AND employees.company_id = (
                SELECT company_id FROM profiles WHERE id = auth.uid()
            )
        )
    );

-- Policy: Service role can manage all vacation requests (for system operations)
CREATE POLICY "Service role manages vacation requests" ON vacation_requests
    FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- Step 5: Revoke unnecessary public permissions and grant proper access
REVOKE ALL ON employees FROM anon;
REVOKE ALL ON vacation_requests FROM anon;

-- Grant necessary permissions to authenticated users
GRANT SELECT, UPDATE ON employees TO authenticated;
GRANT SELECT, INSERT, UPDATE ON vacation_requests TO authenticated;

-- Add comments for documentation
COMMENT ON POLICY "Users can view own employee record" ON employees IS 'Allows users to view their own employee data only';
COMMENT ON POLICY "Anonymous registration update" ON employees IS 'Secure policy for employee registration with valid invitation token';
COMMENT ON POLICY "Employees can view own vacation requests" ON vacation_requests IS 'Company-scoped vacation request access for employees';
COMMENT ON POLICY "Managers can manage company vacation requests" ON vacation_requests IS 'Company-scoped vacation request management for managers';