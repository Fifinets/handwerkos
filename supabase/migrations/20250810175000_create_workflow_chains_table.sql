-- Create workflow_chains table for tracking complete business workflows
-- This table links quotes → orders → projects → invoices in a chain

CREATE TABLE IF NOT EXISTS workflow_chains (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_id uuid REFERENCES quotes(id) ON DELETE SET NULL,
  order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  invoice_id uuid REFERENCES invoices(id) ON DELETE SET NULL,
  current_step text NOT NULL CHECK (current_step IN ('quote', 'order', 'project', 'invoice')),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add workflow origin/target tracking to existing tables
ALTER TABLE quotes 
ADD COLUMN IF NOT EXISTS workflow_target_type text CHECK (workflow_target_type IN ('order', 'project', 'invoice')),
ADD COLUMN IF NOT EXISTS workflow_target_id uuid;

ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS workflow_origin_type text CHECK (workflow_origin_type IN ('quote')),
ADD COLUMN IF NOT EXISTS workflow_origin_id uuid,
ADD COLUMN IF NOT EXISTS workflow_target_type text CHECK (workflow_target_type IN ('project', 'invoice')),
ADD COLUMN IF NOT EXISTS workflow_target_id uuid;

ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS workflow_origin_type text CHECK (workflow_origin_type IN ('order')),
ADD COLUMN IF NOT EXISTS workflow_origin_id uuid,
ADD COLUMN IF NOT EXISTS workflow_target_type text CHECK (workflow_target_type IN ('invoice')),
ADD COLUMN IF NOT EXISTS workflow_target_id uuid;

ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS workflow_origin_type text CHECK (workflow_origin_type IN ('project')),
ADD COLUMN IF NOT EXISTS workflow_origin_id uuid;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_workflow_chains_quote_id ON workflow_chains(quote_id);
CREATE INDEX IF NOT EXISTS idx_workflow_chains_order_id ON workflow_chains(order_id);
CREATE INDEX IF NOT EXISTS idx_workflow_chains_project_id ON workflow_chains(project_id);
CREATE INDEX IF NOT EXISTS idx_workflow_chains_invoice_id ON workflow_chains(invoice_id);
CREATE INDEX IF NOT EXISTS idx_workflow_chains_customer_id ON workflow_chains(customer_id);
CREATE INDEX IF NOT EXISTS idx_workflow_chains_current_step ON workflow_chains(current_step);

-- RLS policies for workflow_chains
ALTER TABLE workflow_chains ENABLE ROW LEVEL SECURITY;

-- Allow users to see workflow chains for their company's customers
CREATE POLICY "Users can view their company's workflow chains" ON workflow_chains
FOR SELECT USING (
  customer_id IN (
    SELECT c.id FROM customers c
    JOIN profiles p ON p.company_id = c.company_id
    WHERE p.id = auth.uid()
  )
);

-- Allow users to create workflow chains for their company's customers
CREATE POLICY "Users can create workflow chains for their company" ON workflow_chains
FOR INSERT WITH CHECK (
  customer_id IN (
    SELECT c.id FROM customers c
    JOIN profiles p ON p.company_id = c.company_id
    WHERE p.id = auth.uid()
  )
);

-- Allow users to update workflow chains for their company's customers
CREATE POLICY "Users can update their company's workflow chains" ON workflow_chains
FOR UPDATE USING (
  customer_id IN (
    SELECT c.id FROM customers c
    JOIN profiles p ON p.company_id = c.company_id
    WHERE p.id = auth.uid()
  )
);

-- Allow users to delete workflow chains for their company's customers
CREATE POLICY "Users can delete their company's workflow chains" ON workflow_chains
FOR DELETE USING (
  customer_id IN (
    SELECT c.id FROM customers c
    JOIN profiles p ON p.company_id = c.company_id
    WHERE p.id = auth.uid()
  )
);

-- Add trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_workflow_chains_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_workflow_chains_updated_at
  BEFORE UPDATE ON workflow_chains
  FOR EACH ROW
  EXECUTE FUNCTION update_workflow_chains_updated_at();