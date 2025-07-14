-- Fix company settings RLS policies and data integrity

-- First, ensure all company_settings have proper company_id linking
UPDATE company_settings 
SET company_id = (
  SELECT company_id 
  FROM profiles 
  WHERE email = company_settings.company_email 
  AND profiles.company_id IS NOT NULL
  LIMIT 1
)
WHERE company_id IS NULL AND company_email IS NOT NULL;

-- Drop existing RLS policies for company_settings
DROP POLICY IF EXISTS "Employees can view company settings" ON company_settings;
DROP POLICY IF EXISTS "Managers can manage company settings" ON company_settings;

-- Create improved RLS policies that are more robust
CREATE POLICY "Managers can manage their company settings" 
ON company_settings 
FOR ALL 
USING (
  has_role(auth.uid(), 'manager'::user_role) AND 
  (
    -- Direct company_id match
    company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()) OR
    -- Fallback: match by email if company_id is missing
    (company_id IS NULL AND company_email = (SELECT email FROM profiles WHERE id = auth.uid())) OR
    -- Additional fallback: if user is manager and settings are active
    (is_active = true AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND profiles.email = company_settings.company_email))
  )
);

CREATE POLICY "Employees can view their company settings" 
ON company_settings 
FOR SELECT 
USING (
  has_role(auth.uid(), 'employee'::user_role) AND 
  (
    -- Direct company_id match
    company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()) OR
    -- Fallback: match by email if company_id is missing  
    (company_id IS NULL AND company_email = (SELECT email FROM profiles WHERE id = auth.uid()))
  )
);

-- Ensure there's always at least one active company setting per company
INSERT INTO company_settings (
  company_name,
  company_email,
  is_active,
  company_id
)
SELECT 
  COALESCE(p.company_name, 'Meine Firma'),
  p.email,
  true,
  p.company_id
FROM profiles p
LEFT JOIN company_settings cs ON cs.company_id = p.company_id
WHERE cs.id IS NULL AND p.company_id IS NOT NULL
ON CONFLICT DO NOTHING;