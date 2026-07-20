-- Fix I3: Restrict notification INSERT to own user_id only
DROP POLICY IF EXISTS "Service role can insert notifications" ON notifications;
CREATE POLICY "Users can insert own notifications"
  ON notifications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Fix I4: Remove overly permissive SELECT on push tokens
DROP POLICY IF EXISTS "Service role can read all tokens" ON employee_push_tokens;
