-- Material Management System Tables

-- 1. Materials Master Table
CREATE TABLE IF NOT EXISTS materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  unit VARCHAR(50) NOT NULL, -- Stk, m, kg, l, etc.
  current_stock DECIMAL(10,2) DEFAULT 0,
  min_stock DECIMAL(10,2) DEFAULT 0,
  max_stock DECIMAL(10,2) DEFAULT 0,
  unit_price DECIMAL(10,2) DEFAULT 0,
  supplier_id UUID REFERENCES suppliers(id),
  supplier_article_number VARCHAR(100),
  storage_location VARCHAR(255),
  barcode VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

-- 2. Suppliers Table (if not exists)
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  contact_person VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(50),
  address TEXT,
  tax_number VARCHAR(100),
  payment_terms INTEGER DEFAULT 30, -- Days
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- 3. Material Purchase Orders
CREATE TABLE IF NOT EXISTS material_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  order_number VARCHAR(100) UNIQUE NOT NULL,
  supplier_id UUID REFERENCES suppliers(id),
  order_date DATE NOT NULL,
  expected_delivery_date DATE,
  actual_delivery_date DATE,
  status VARCHAR(50) DEFAULT 'draft', -- draft, sent, confirmed, delivered, cancelled
  total_amount DECIMAL(10,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 4. Material Order Items
CREATE TABLE IF NOT EXISTS material_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES material_orders(id) ON DELETE CASCADE,
  material_id UUID REFERENCES materials(id),
  quantity_ordered DECIMAL(10,2) NOT NULL,
  quantity_delivered DECIMAL(10,2) DEFAULT 0,
  unit_price DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(10,2) GENERATED ALWAYS AS (quantity_ordered * unit_price) STORED,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 5. Material Stock Movements (Inventory tracking)
CREATE TABLE IF NOT EXISTS material_stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id UUID REFERENCES materials(id) ON DELETE CASCADE,
  movement_type VARCHAR(50) NOT NULL, -- 'in', 'out', 'adjustment', 'transfer'
  reference_type VARCHAR(50), -- 'purchase', 'project_usage', 'waste', 'adjustment', 'return'
  reference_id UUID, -- Can reference project_id, order_id, etc.
  quantity DECIMAL(10,2) NOT NULL, -- Positive for IN, Negative for OUT
  unit_price DECIMAL(10,2),
  reason TEXT,
  employee_id UUID REFERENCES employees(id),
  project_id UUID REFERENCES projects(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- 6. Project Material Assignments (What materials are assigned to projects)
CREATE TABLE IF NOT EXISTS project_material_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  material_id UUID REFERENCES materials(id) ON DELETE CASCADE,
  assigned_quantity DECIMAL(10,2) NOT NULL,
  used_quantity DECIMAL(10,2) DEFAULT 0,
  assigned_by UUID REFERENCES auth.users(id),
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  notes TEXT,
  UNIQUE(project_id, material_id)
);

-- 7. Employee Material Usage (Track who used what material on which project)
CREATE TABLE IF NOT EXISTS employee_material_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  material_id UUID REFERENCES materials(id) ON DELETE CASCADE,
  quantity_used DECIMAL(10,2) NOT NULL,
  usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_materials_company_id ON materials(company_id);
CREATE INDEX IF NOT EXISTS idx_materials_category ON materials(category);
CREATE INDEX IF NOT EXISTS idx_materials_supplier_id ON materials(supplier_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_material_id ON material_stock_movements(material_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created_at ON material_stock_movements(created_at);
CREATE INDEX IF NOT EXISTS idx_project_material_assignments_project_id ON project_material_assignments(project_id);
CREATE INDEX IF NOT EXISTS idx_employee_usage_project_material ON employee_material_usage(project_id, material_id);

-- Functions to update material stock automatically
CREATE OR REPLACE FUNCTION update_material_stock() 
RETURNS TRIGGER AS $$
BEGIN
  -- Update current stock when stock movement is added
  UPDATE materials 
  SET current_stock = current_stock + NEW.quantity,
      updated_at = now()
  WHERE id = NEW.material_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to update project material usage
CREATE OR REPLACE FUNCTION update_project_material_usage() 
RETURNS TRIGGER AS $$
BEGIN
  -- Update used quantity in project assignments
  UPDATE project_material_assignments 
  SET used_quantity = used_quantity + NEW.quantity_used
  WHERE project_id = NEW.project_id AND material_id = NEW.material_id;
  
  -- Create stock movement record
  INSERT INTO material_stock_movements (
    material_id, 
    movement_type, 
    reference_type, 
    reference_id, 
    quantity, 
    employee_id, 
    project_id,
    created_by
  ) VALUES (
    NEW.material_id,
    'out',
    'project_usage',
    NEW.project_id,
    -NEW.quantity_used, -- Negative because it's outgoing
    NEW.employee_id,
    NEW.project_id,
    NEW.created_by
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate total order amount
CREATE OR REPLACE FUNCTION update_order_total() 
RETURNS TRIGGER AS $$
BEGIN
  UPDATE material_orders 
  SET total_amount = (
    SELECT COALESCE(SUM(total_price), 0)
    FROM material_order_items 
    WHERE order_id = COALESCE(NEW.order_id, OLD.order_id)
  ),
  updated_at = now()
  WHERE id = COALESCE(NEW.order_id, OLD.order_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Triggers
DROP TRIGGER IF EXISTS trigger_update_material_stock ON material_stock_movements;
CREATE TRIGGER trigger_update_material_stock
  AFTER INSERT ON material_stock_movements
  FOR EACH ROW
  EXECUTE FUNCTION update_material_stock();

DROP TRIGGER IF EXISTS trigger_update_project_material_usage ON employee_material_usage;
CREATE TRIGGER trigger_update_project_material_usage
  AFTER INSERT ON employee_material_usage
  FOR EACH ROW
  EXECUTE FUNCTION update_project_material_usage();

DROP TRIGGER IF EXISTS trigger_update_order_total_insert ON material_order_items;
CREATE TRIGGER trigger_update_order_total_insert
  AFTER INSERT ON material_order_items
  FOR EACH ROW
  EXECUTE FUNCTION update_order_total();

DROP TRIGGER IF EXISTS trigger_update_order_total_update ON material_order_items;
CREATE TRIGGER trigger_update_order_total_update
  AFTER UPDATE ON material_order_items
  FOR EACH ROW
  EXECUTE FUNCTION update_order_total();

DROP TRIGGER IF EXISTS trigger_update_order_total_delete ON material_order_items;
CREATE TRIGGER trigger_update_order_total_delete
  AFTER DELETE ON material_order_items
  FOR EACH ROW
  EXECUTE FUNCTION update_order_total();

-- Row Level Security (RLS)
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_material_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_material_usage ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view materials from their company" ON materials
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM employees WHERE user_id = auth.uid()
      UNION
      SELECT id FROM companies WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage materials in their company" ON materials
  FOR ALL USING (
    company_id IN (
      SELECT company_id FROM employees WHERE user_id = auth.uid()
      UNION
      SELECT id FROM companies WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can view suppliers from their company" ON suppliers
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM employees WHERE user_id = auth.uid()
      UNION
      SELECT id FROM companies WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage suppliers in their company" ON suppliers
  FOR ALL USING (
    company_id IN (
      SELECT company_id FROM employees WHERE user_id = auth.uid()
      UNION
      SELECT id FROM companies WHERE owner_id = auth.uid()
    )
  );

-- Similar policies for other tables
CREATE POLICY "Users can access material orders from their company" ON material_orders
  FOR ALL USING (
    company_id IN (
      SELECT company_id FROM employees WHERE user_id = auth.uid()
      UNION
      SELECT id FROM companies WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can access order items from their company" ON material_order_items
  FOR ALL USING (
    order_id IN (
      SELECT id FROM material_orders WHERE company_id IN (
        SELECT company_id FROM employees WHERE user_id = auth.uid()
        UNION
        SELECT id FROM companies WHERE owner_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can access stock movements from their company" ON material_stock_movements
  FOR ALL USING (
    material_id IN (
      SELECT id FROM materials WHERE company_id IN (
        SELECT company_id FROM employees WHERE user_id = auth.uid()
        UNION
        SELECT id FROM companies WHERE owner_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can access project material assignments" ON project_material_assignments
  FOR ALL USING (
    project_id IN (
      SELECT id FROM projects WHERE company_id IN (
        SELECT company_id FROM employees WHERE user_id = auth.uid()
        UNION
        SELECT id FROM companies WHERE owner_id = auth.uid()
      )
    )
  );

CREATE POLICY "Employees can record their material usage" ON employee_material_usage
  FOR ALL USING (
    employee_id IN (
      SELECT id FROM employees WHERE user_id = auth.uid()
    )
    OR
    project_id IN (
      SELECT id FROM projects WHERE company_id IN (
        SELECT company_id FROM employees WHERE user_id = auth.uid()
        UNION
        SELECT id FROM companies WHERE owner_id = auth.uid()
      )
    )
  );

-- Insert some sample data
INSERT INTO suppliers (company_id, name, contact_person, email, phone, address) VALUES
  ((SELECT id FROM companies WHERE name = 'Demo Company' LIMIT 1), 'ElektroGroßhandel GmbH', 'Thomas Müller', 'mueller@elektro-gh.de', '+49 30 12345678', 'Industriestr. 123, 10115 Berlin'),
  ((SELECT id FROM companies WHERE name = 'Demo Company' LIMIT 1), 'Jung Vertrieb', 'Sandra Weber', 'weber@jung.de', '+49 30 87654321', 'Elektronikweg 456, 10117 Berlin'),
  ((SELECT id FROM companies WHERE name = 'Demo Company' LIMIT 1), 'Hager Vertrieb', 'Michael Schmidt', 'schmidt@hager.com', '+49 30 11223344', 'Schaltweg 789, 10119 Berlin')
ON CONFLICT DO NOTHING;

-- Insert sample materials
INSERT INTO materials (company_id, name, description, category, unit, current_stock, min_stock, max_stock, unit_price, supplier_id) VALUES
  ((SELECT id FROM companies WHERE name = 'Demo Company' LIMIT 1), 'Kabel NYM-J 3x1,5 mm²', 'Installationsleitung NYM-J 3x1,5 mm²', 'Kabel & Leitungen', 'm', 150, 100, 500, 1.25, (SELECT id FROM suppliers WHERE name = 'ElektroGroßhandel GmbH' LIMIT 1)),
  ((SELECT id FROM companies WHERE name = 'Demo Company' LIMIT 1), 'Schalter Jung LS990', 'Wechselschalter Jung LS990 reinweiß', 'Installationsmaterial', 'Stk', 25, 50, 200, 8.90, (SELECT id FROM suppliers WHERE name = 'Jung Vertrieb' LIMIT 1)),
  ((SELECT id FROM companies WHERE name = 'Demo Company' LIMIT 1), 'Sicherungsautomat B16A', 'Leitungsschutzschalter B16A 1-polig', 'Schaltgeräte', 'Stk', 75, 30, 150, 12.50, (SELECT id FROM suppliers WHERE name = 'Hager Vertrieb' LIMIT 1)),
  ((SELECT id FROM companies WHERE name = 'Demo Company' LIMIT 1), 'Kabel YCYM 5x1,5 mm²', 'Steuerleitung YCYM 5x1,5 mm²', 'Kabel & Leitungen', 'm', 5, 25, 200, 2.80, (SELECT id FROM suppliers WHERE name = 'ElektroGroßhandel GmbH' LIMIT 1))
ON CONFLICT DO NOTHING;