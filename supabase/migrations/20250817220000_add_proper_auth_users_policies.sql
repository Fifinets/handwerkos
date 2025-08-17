-- Add proper RLS policies for auth.users table to allow email confirmation
-- This ensures Supabase's internal auth system can update users while maintaining security

-- Enable RLS on auth.users (if not already enabled)
ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;

-- Policy 1: Users can read and update their own record
DROP POLICY IF EXISTS "Users can manage own record" ON auth.users;
CREATE POLICY "Users can manage own record" ON auth.users
  FOR ALL
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Policy 2: Allow service role (Supabase internal) to manage all users
-- This is crucial for email confirmation, password resets, etc.
DROP POLICY IF EXISTS "Service role can manage users" ON auth.users;
CREATE POLICY "Service role can manage users" ON auth.users
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Policy 3: Allow anon users to update during authentication flows
-- This is needed for email confirmation when user isn't logged in yet
DROP POLICY IF EXISTS "Allow auth flow updates" ON auth.users;
CREATE POLICY "Allow auth flow updates" ON auth.users
  FOR UPDATE
  USING (
    auth.role() = 'anon' 
    AND (
      -- Allow updating email_confirmed_at during email confirmation
      current_setting('request.jwt.claims', true)::json->>'aud' = 'authenticated'
      OR current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
    )
  );

-- Ensure necessary permissions are granted
GRANT SELECT, UPDATE ON auth.users TO authenticated;
GRANT SELECT, UPDATE ON auth.users TO anon;
GRANT ALL ON auth.users TO service_role;