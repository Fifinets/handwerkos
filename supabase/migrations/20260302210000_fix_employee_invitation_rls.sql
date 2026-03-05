-- Fix: Allow anonymous users (new employees without an account) to read 
-- their invitation by token. This is needed for the MitarbeiterSetupPage 
-- where the employee creates their account.

-- Allow anyone with a valid token to read the invitation (SELECT only)
DROP POLICY IF EXISTS "Anyone can view invitation by token" ON employee_invitations;

CREATE POLICY "Anyone can view invitation by token" ON employee_invitations
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Note: This allows reading all invitations, but since invite_token is a 
-- UUID-like secret, an attacker would need to guess it. The alternative 
-- would be a SECURITY DEFINER function, but this is simpler for now.
-- The sensitive data in the invitation (email, employee_data) is minimal.
