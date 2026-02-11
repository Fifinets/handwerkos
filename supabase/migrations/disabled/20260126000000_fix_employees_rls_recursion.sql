-- ============================================================================
-- FIX: Infinite recursion in employees RLS policies
-- ============================================================================
-- Problem: Policies for employees table call functions that query employees
-- Solution: Use user_roles table instead (no recursion)
-- ============================================================================

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Managers can manage company employees" ON public.employees;
DROP POLICY IF EXISTS "Employees can view company employees" ON public.employees;
DROP POLICY IF EXISTS "Managers can manage employees" ON public.employees;
DROP POLICY IF EXISTS "Employees can view other employees" ON public.employees;

-- Create new non-recursive policies using user_roles table directly
-- INSERT: Managers can insert employees into their company
CREATE POLICY "employees_insert_manager" ON public.employees
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'manager'
    )
    AND company_id = (
      SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid()
    )
  );

-- SELECT: Users can view employees from their company
CREATE POLICY "employees_select_company" ON public.employees
  FOR SELECT
  USING (
    company_id = (
      SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid()
    )
  );

-- UPDATE: Managers can update employees in their company
CREATE POLICY "employees_update_manager" ON public.employees
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'manager'
    )
    AND company_id = (
      SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid()
    )
  )
  WITH CHECK (
    company_id = (
      SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid()
    )
  );

-- DELETE: Managers can delete employees in their company
CREATE POLICY "employees_delete_manager" ON public.employees
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'manager'
    )
    AND company_id = (
      SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid()
    )
  );

-- Employees can update their own record
CREATE POLICY "employees_update_self" ON public.employees
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
