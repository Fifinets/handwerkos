-- Fix Row Level Security for customers table
-- Current policies are too restrictive, preventing customer creation

-- First, let's see what policies exist
-- SELECT schemaname, tablename, policyname, roles, cmd, qual FROM pg_policies WHERE tablename = 'customers';

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Managers can manage all customers" ON public.customers;
DROP POLICY IF EXISTS "Employees can view customers" ON public.customers;

-- Create more permissive policies that allow authenticated users to manage customers
-- Allow authenticated users to insert customers
CREATE POLICY "Authenticated users can insert customers" 
  ON public.customers 
  FOR INSERT 
  TO authenticated
  WITH CHECK (true);

-- Allow authenticated users to view customers  
CREATE POLICY "Authenticated users can view customers" 
  ON public.customers 
  FOR SELECT 
  TO authenticated
  USING (true);

-- Allow authenticated users to update customers
CREATE POLICY "Authenticated users can update customers" 
  ON public.customers 
  FOR UPDATE 
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Allow authenticated users to delete customers
CREATE POLICY "Authenticated users can delete customers" 
  ON public.customers 
  FOR DELETE 
  TO authenticated
  USING (true);

-- Optional: If you want to keep role-based restrictions, use this instead:
-- But first make sure users have the proper roles assigned

/*
-- Role-based policies (uncomment and use instead if you have proper role management)
CREATE POLICY "Managers and employees can manage customers" 
  ON public.customers 
  FOR ALL 
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('manager', 'employee')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('manager', 'employee')
    )
  );
*/