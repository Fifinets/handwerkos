-- Fix MobileEmployeeApp data storage issues
-- Create missing project_comments table and fix sync functions

-- Create project_comments table
CREATE TABLE IF NOT EXISTS project_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  comment TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for project_comments
ALTER TABLE project_comments ENABLE ROW LEVEL SECURITY;

-- Create policy for project_comments
CREATE POLICY "Users can view comments for their company projects" ON project_comments
  FOR SELECT USING (
    project_id IN (
      SELECT p.id FROM projects p
      JOIN profiles pr ON p.company_id = pr.company_id
      WHERE pr.id = auth.uid()
    )
  );

CREATE POLICY "Users can manage comments for their company projects" ON project_comments
  FOR ALL USING (
    project_id IN (
      SELECT p.id FROM projects p
      JOIN profiles pr ON p.company_id = pr.company_id
      WHERE pr.id = auth.uid()
    )
  );

-- Add indexes for better performance  
CREATE INDEX IF NOT EXISTS idx_project_comments_project_id ON project_comments(project_id);
CREATE INDEX IF NOT EXISTS idx_project_comments_created_at ON project_comments(created_at);

-- Update project_documents table to support mobile app uploads
ALTER TABLE project_documents ADD COLUMN IF NOT EXISTS metadata JSONB;

-- Fix document types to include mobile app types
ALTER TABLE project_documents 
DROP CONSTRAINT IF EXISTS project_documents_document_type_check;

ALTER TABLE project_documents 
ADD CONSTRAINT project_documents_document_type_check 
CHECK (document_type IN ('contract', 'blueprint', 'quote', 'invoice', 'report', 'image', 'photo', 'receipt', 'other'));

-- Create view for easier access to assigned projects with team info
CREATE OR REPLACE VIEW employee_assigned_projects AS
SELECT 
  p.*,
  pta.role as employee_role,
  pta.hourly_rate as employee_hourly_rate,
  pta.is_active as assignment_active
FROM projects p
JOIN project_team_assignments pta ON p.id = pta.project_id
WHERE pta.is_active = true;

-- Grant access to the view
GRANT SELECT ON employee_assigned_projects TO authenticated;