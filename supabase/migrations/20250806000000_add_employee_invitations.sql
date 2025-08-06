-- Create employee_invitations table for managing invitations
CREATE TABLE IF NOT EXISTS employee_invitations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL,
  invited_by uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  invite_token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  employee_data jsonb,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add RLS policies for employee_invitations
ALTER TABLE employee_invitations ENABLE ROW LEVEL SECURITY;

-- Managers can create and manage invitations for their company
CREATE POLICY "Managers can manage company invitations" ON employee_invitations
  FOR ALL USING (
    company_id IN (
      SELECT p.company_id FROM profiles p 
      JOIN user_roles ur ON ur.user_id = p.id 
      WHERE p.id = auth.uid() AND ur.role = 'manager'
    )
  );

-- Allow invited users to view their own invitations by email
CREATE POLICY "Users can view invitations sent to their email" ON employee_invitations
  FOR SELECT USING (
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- Function to clean up expired invitations
CREATE OR REPLACE FUNCTION cleanup_expired_invitations()
RETURNS void AS $$
BEGIN
  UPDATE employee_invitations 
  SET status = 'expired' 
  WHERE expires_at < now() AND status = 'pending';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_employee_invitations_token ON employee_invitations(invite_token);
CREATE INDEX IF NOT EXISTS idx_employee_invitations_email ON employee_invitations(email);
CREATE INDEX IF NOT EXISTS idx_employee_invitations_company ON employee_invitations(company_id);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_employee_invitations_updated_at
    BEFORE UPDATE ON employee_invitations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();