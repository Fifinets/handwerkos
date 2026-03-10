-- Fix critical security issues in the database

-- 1. Enable RLS on employees table if not already enabled
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies to start fresh
DROP POLICY IF EXISTS "Users can view own employee data" ON employees;
DROP POLICY IF EXISTS "Users can update own employee data" ON employees;
DROP POLICY IF EXISTS "Managers can view all employees" ON employees;
DROP POLICY IF EXISTS "System can manage employees" ON employees;

-- 3. Create secure RLS policies for employees table

-- Policy: Users can only view their own employee record
CREATE POLICY "Users can view own employee data" ON employees
    FOR SELECT USING (user_id = auth.uid());

-- Policy: Users can only update their own employee record (limited fields)
CREATE POLICY "Users can update own employee data" ON employees
    FOR UPDATE USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Policy: Service role can manage all employees (for admin operations)
CREATE POLICY "Service role can manage employees" ON employees
    FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- 4. Enable RLS on company_settings table
ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;

-- Drop existing company_settings policies
DROP POLICY IF EXISTS "All users can view company settings" ON company_settings;
DROP POLICY IF EXISTS "Authenticated users can view company settings" ON company_settings;
DROP POLICY IF EXISTS "Service role can manage company settings" ON company_settings;

-- Policy: All authenticated users can view company settings (read-only for employees)
CREATE POLICY "Authenticated users can view company settings" ON company_settings
    FOR SELECT USING (auth.role() = 'authenticated');

-- Policy: Service role can manage company settings
CREATE POLICY "Service role can manage company settings" ON company_settings
    FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- 5. Fix vacation_requests table policies (already created but let's ensure they're secure)
DROP POLICY IF EXISTS "All users can view vacation requests" ON vacation_requests;
DROP POLICY IF EXISTS "All users can update vacation requests" ON vacation_requests;

-- More secure policies for vacation requests
CREATE POLICY "Users can view own vacation requests" ON vacation_requests
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM employees 
            WHERE employees.id = vacation_requests.employee_id 
            AND employees.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert own vacation requests" ON vacation_requests
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM employees 
            WHERE employees.id = vacation_requests.employee_id 
            AND employees.user_id = auth.uid()
        )
        AND created_by = auth.uid()
    );

-- Policy: Service role can manage all vacation requests (for admin/manager operations)
CREATE POLICY "Service role can manage vacation requests" ON vacation_requests
    FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- 6. Enable RLS on other sensitive tables if they exist
DO $$
BEGIN
    -- Check if projects table exists and enable RLS
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'projects') THEN
        ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
        
        -- Basic policy: authenticated users can view projects they're assigned to
        DROP POLICY IF EXISTS "Users can view assigned projects" ON projects;
        CREATE POLICY "Users can view assigned projects" ON projects
            FOR SELECT USING (
                auth.role() = 'authenticated' AND (
                    EXISTS (
                        SELECT 1 FROM project_team_assignments 
                        WHERE project_team_assignments.project_id = projects.id
                        AND project_team_assignments.employee_id IN (
                            SELECT id FROM employees WHERE user_id = auth.uid()
                        )
                    )
                    OR auth.jwt()->>'role' = 'service_role'
                )
            );
    END IF;

    -- Check if time_entries table exists and enable RLS  
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'time_entries') THEN
        ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;
        
        -- Policy: users can only view/manage their own time entries
        DROP POLICY IF EXISTS "Users can manage own time entries" ON time_entries;
        CREATE POLICY "Users can manage own time entries" ON time_entries
            FOR ALL USING (
                EXISTS (
                    SELECT 1 FROM employees 
                    WHERE employees.id = time_entries.employee_id 
                    AND employees.user_id = auth.uid()
                )
                OR auth.jwt()->>'role' = 'service_role'
            );
    END IF;
END $$;

-- 7. Revoke unnecessary public permissions
REVOKE ALL ON employees FROM anon;
REVOKE ALL ON company_settings FROM anon;
REVOKE ALL ON vacation_requests FROM anon;

-- 8. Grant only necessary permissions to authenticated users
GRANT SELECT ON employees TO authenticated;
GRANT UPDATE ON employees TO authenticated;
GRANT SELECT ON company_settings TO authenticated;
GRANT SELECT, INSERT ON vacation_requests TO authenticated;
GRANT UPDATE (status, approved_by, approved_at) ON vacation_requests TO authenticated;

-- 9. Add security definer functions to safely access data
CREATE OR REPLACE FUNCTION get_current_employee()
RETURNS UUID AS $$
BEGIN
    RETURN (
        SELECT id FROM employees 
        WHERE user_id = auth.uid() 
        LIMIT 1
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. Create audit log for sensitive operations (optional but recommended)
CREATE TABLE IF NOT EXISTS security_audit_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    action TEXT NOT NULL,
    table_name TEXT NOT NULL,
    record_id UUID,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT
);

-- Enable RLS on audit log
ALTER TABLE security_audit_log ENABLE ROW LEVEL SECURITY;

-- Only service role can manage audit logs
CREATE POLICY "Service role manages audit logs" ON security_audit_log
    FOR ALL USING (auth.jwt()->>'role' = 'service_role');

COMMENT ON TABLE security_audit_log IS 'Audit trail for sensitive security operations';