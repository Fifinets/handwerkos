-- Add hourly wage to employees table
ALTER TABLE employees ADD COLUMN IF NOT EXISTS hourly_wage DECIMAL(10,2) DEFAULT 0.00;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS role_description TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS contact_info TEXT;

-- Add project financial tracking
ALTER TABLE projects ADD COLUMN IF NOT EXISTS budget DECIMAL(12,2) DEFAULT 0.00;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS material_costs DECIMAL(12,2) DEFAULT 0.00;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS labor_costs DECIMAL(12,2) DEFAULT 0.00;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS status_color VARCHAR(10) DEFAULT 'green' CHECK (status_color IN ('green', 'yellow', 'red'));
ALTER TABLE projects ADD COLUMN IF NOT EXISTS next_milestone TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS milestone_date DATE;

-- Create project materials table
CREATE TABLE IF NOT EXISTS project_materials (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  quantity INTEGER DEFAULT 1,
  unit VARCHAR(50) DEFAULT 'Stk',
  unit_price DECIMAL(10,2) DEFAULT 0.00,
  total_price DECIMAL(10,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  status VARCHAR(20) DEFAULT 'planned' CHECK (status IN ('planned', 'ordered', 'delivered', 'installed', 'cancelled')),
  supplier VARCHAR(255),
  order_date DATE,
  delivery_date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create project milestones table
CREATE TABLE IF NOT EXISTS project_milestones (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  due_date DATE NOT NULL,
  completed_date DATE,
  is_completed BOOLEAN DEFAULT false,
  priority VARCHAR(10) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  assigned_to UUID REFERENCES employees(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create project documents table
CREATE TABLE IF NOT EXISTS project_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500),
  file_url TEXT,
  document_type VARCHAR(50) DEFAULT 'other' CHECK (document_type IN ('contract', 'blueprint', 'quote', 'invoice', 'report', 'image', 'other')),
  file_size BIGINT,
  mime_type VARCHAR(100),
  uploaded_by UUID REFERENCES employees(id),
  is_favorite BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create project team assignments table
CREATE TABLE IF NOT EXISTS project_team_assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  role VARCHAR(100) DEFAULT 'team_member',
  hourly_rate DECIMAL(10,2),
  hours_budgeted DECIMAL(8,2) DEFAULT 0.00,
  hours_actual DECIMAL(8,2) DEFAULT 0.00,
  responsibilities TEXT[],
  start_date DATE,
  end_date DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(project_id, employee_id)
);

-- Add RLS policies
ALTER TABLE project_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_team_assignments ENABLE ROW LEVEL SECURITY;

-- Policies for project_materials
CREATE POLICY "Users can view materials for their company projects" ON project_materials
  FOR SELECT USING (
    project_id IN (
      SELECT p.id FROM projects p
      JOIN profiles pr ON p.company_id = pr.company_id
      WHERE pr.id = auth.uid()
    )
  );

CREATE POLICY "Users can manage materials for their company projects" ON project_materials
  FOR ALL USING (
    project_id IN (
      SELECT p.id FROM projects p
      JOIN profiles pr ON p.company_id = pr.company_id
      WHERE pr.id = auth.uid()
    )
  );

-- Policies for project_milestones
CREATE POLICY "Users can view milestones for their company projects" ON project_milestones
  FOR SELECT USING (
    project_id IN (
      SELECT p.id FROM projects p
      JOIN profiles pr ON p.company_id = pr.company_id
      WHERE pr.id = auth.uid()
    )
  );

CREATE POLICY "Users can manage milestones for their company projects" ON project_milestones
  FOR ALL USING (
    project_id IN (
      SELECT p.id FROM projects p
      JOIN profiles pr ON p.company_id = pr.company_id
      WHERE pr.id = auth.uid()
    )
  );

-- Policies for project_documents
CREATE POLICY "Users can view documents for their company projects" ON project_documents
  FOR SELECT USING (
    project_id IN (
      SELECT p.id FROM projects p
      JOIN profiles pr ON p.company_id = pr.company_id
      WHERE pr.id = auth.uid()
    )
  );

CREATE POLICY "Users can manage documents for their company projects" ON project_documents
  FOR ALL USING (
    project_id IN (
      SELECT p.id FROM projects p
      JOIN profiles pr ON p.company_id = pr.company_id
      WHERE pr.id = auth.uid()
    )
  );

-- Policies for project_team_assignments
CREATE POLICY "Users can view team assignments for their company projects" ON project_team_assignments
  FOR SELECT USING (
    project_id IN (
      SELECT p.id FROM projects p
      JOIN profiles pr ON p.company_id = pr.company_id
      WHERE pr.id = auth.uid()
    )
  );

CREATE POLICY "Users can manage team assignments for their company projects" ON project_team_assignments
  FOR ALL USING (
    project_id IN (
      SELECT p.id FROM projects p
      JOIN profiles pr ON p.company_id = pr.company_id
      WHERE pr.id = auth.uid()
    )
  );

-- Create functions for automatic cost calculation
CREATE OR REPLACE FUNCTION calculate_project_labor_costs(project_id_param UUID)
RETURNS DECIMAL(12,2) AS $$
DECLARE
  total_labor_cost DECIMAL(12,2) := 0;
BEGIN
  SELECT COALESCE(SUM(pta.hourly_rate * pta.hours_actual), 0)
  INTO total_labor_cost
  FROM project_team_assignments pta
  WHERE pta.project_id = project_id_param AND pta.is_active = true;
  
  RETURN total_labor_cost;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION calculate_project_material_costs(project_id_param UUID)
RETURNS DECIMAL(12,2) AS $$
DECLARE
  total_material_cost DECIMAL(12,2) := 0;
BEGIN
  SELECT COALESCE(SUM(pm.total_price), 0)
  INTO total_material_cost
  FROM project_materials pm
  WHERE pm.project_id = project_id_param;
  
  RETURN total_material_cost;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update project costs when materials or team assignments change
CREATE OR REPLACE FUNCTION update_project_costs()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE projects 
  SET 
    material_costs = calculate_project_material_costs(NEW.project_id),
    labor_costs = calculate_project_labor_costs(NEW.project_id),
    updated_at = NOW()
  WHERE id = NEW.project_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
CREATE TRIGGER update_project_costs_on_material_change
  AFTER INSERT OR UPDATE OR DELETE ON project_materials
  FOR EACH ROW EXECUTE FUNCTION update_project_costs();

CREATE TRIGGER update_project_costs_on_team_change
  AFTER INSERT OR UPDATE OR DELETE ON project_team_assignments
  FOR EACH ROW EXECUTE FUNCTION update_project_costs();