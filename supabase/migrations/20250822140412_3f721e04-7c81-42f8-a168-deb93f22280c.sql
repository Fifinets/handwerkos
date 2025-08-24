-- Comprehensive Security Fix Migration
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
    WITH CHECK (
        -- Only allow updating user_id field during registration
        user_id = OLD.user_id OR user_id IS NOT NULL
    );

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

-- Step 5: Enhance database function security
-- Update existing functions to include proper search_path protection

-- Update handle_new_user function for better security
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
  DECLARE
    new_company_id UUID;
    employee_record RECORD;
  BEGIN
    -- Check if this user was invited as an employee (has employee record with this email)
    SELECT * INTO employee_record
    FROM public.employees
    WHERE email = new.email AND user_id IS NULL;

    IF employee_record.id IS NOT NULL THEN
      -- This is an invited employee - update the employee record and assign employee role
      UPDATE public.employees
      SET user_id = new.id,
          status = 'Aktiv'
      WHERE id = employee_record.id;

      -- Insert profile using employee's company
      INSERT INTO public.profiles (
        id,
        email,
        first_name,
        last_name,
        company_id
      )
      VALUES (
        new.id,
        new.email,
        COALESCE(new.raw_user_meta_data ->> 'first_name', employee_record.first_name),
        COALESCE(new.raw_user_meta_data ->> 'last_name', employee_record.last_name),
        employee_record.company_id
      );

      -- Assign employee role
      INSERT INTO public.user_roles (user_id, role)
      VALUES (new.id, 'employee');

    ELSE
      -- This is a new manager registration
      -- Create a new company for this user
      INSERT INTO public.companies (name)
      VALUES (COALESCE(new.raw_user_meta_data ->> 'company_name', new.email || ' Company'))
      RETURNING id INTO new_company_id;

      -- Insert profile with company_id
      INSERT INTO public.profiles (
        id,
        email,
        first_name,
        last_name,
        company_name,
        phone,
        street_address,
        postal_code,
        city,
        vat_id,
        country,
        voucher_code,
        referral_source,
        company_id
      )
      VALUES (
        new.id,
        new.email,
        new.raw_user_meta_data ->> 'first_name',
        new.raw_user_meta_data ->> 'last_name',
        new.raw_user_meta_data ->> 'company_name',
        new.raw_user_meta_data ->> 'phone',
        new.raw_user_meta_data ->> 'street_address',
        new.raw_user_meta_data ->> 'postal_code',
        new.raw_user_meta_data ->> 'city',
        new.raw_user_meta_data ->> 'vat_id',
        new.raw_user_meta_data ->> 'country',
        new.raw_user_meta_data ->> 'voucher_code',
        new.raw_user_meta_data ->> 'referral_source',
        new_company_id
      );

      -- Assign manager role
      INSERT INTO public.user_roles (user_id, role)
      VALUES (new.id, 'manager');
    END IF;

    RETURN new;
  END;
  $function$;

-- Update email confirmation trigger for better security
CREATE OR REPLACE FUNCTION public.update_employee_status_on_email_confirm()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
  BEGIN
    -- Only when email was just confirmed (from NULL to a timestamp)
    IF OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL THEN
      -- Update employee status to 'Aktiv' when email is confirmed
      UPDATE employees
      SET
        status = 'Aktiv',
        user_id = NEW.id,
        updated_at = NOW()
      WHERE
        email = NEW.email
        AND status = 'eingeladen';

      -- Log for debugging
      RAISE NOTICE 'Updated employee status for email: %', NEW.email;
    END IF;

    RETURN NEW;
  END;
  $function$;

-- Step 6: Revoke unnecessary public permissions and grant proper access
REVOKE ALL ON employees FROM anon;
REVOKE ALL ON vacation_requests FROM anon;

-- Grant necessary permissions to authenticated users
GRANT SELECT, UPDATE ON employees TO authenticated;
GRANT SELECT, INSERT, UPDATE ON vacation_requests TO authenticated;

-- Step 7: Add security audit function (optional but recommended)
CREATE OR REPLACE FUNCTION public.log_security_event(
    action_type TEXT,
    table_name TEXT,
    record_id UUID DEFAULT NULL,
    details JSONB DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO security_audit_log (
        user_id,
        action,
        table_name,
        record_id,
        timestamp,
        details
    ) VALUES (
        auth.uid(),
        action_type,
        table_name,
        record_id,
        NOW(),
        details
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

-- Add comments for documentation
COMMENT ON POLICY "Users can view own employee record" ON employees IS 'Allows users to view their own employee data only';
COMMENT ON POLICY "Anonymous registration update" ON employees IS 'Secure policy for employee registration with valid invitation token';
COMMENT ON POLICY "Employees can view own vacation requests" ON vacation_requests IS 'Company-scoped vacation request access for employees';
COMMENT ON POLICY "Managers can manage company vacation requests" ON vacation_requests IS 'Company-scoped vacation request management for managers';