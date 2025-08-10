-- Ensure projects table has budget column and other missing columns
-- This migration is safe to run multiple times due to IF NOT EXISTS

-- Add missing columns to projects table if they don't exist
DO $$
BEGIN
    -- Check if budget column exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'budget') THEN
        ALTER TABLE projects ADD COLUMN budget DECIMAL(12,2) DEFAULT 0.00;
        RAISE NOTICE 'Added budget column to projects table';
    END IF;
    
    -- Check if progress_percentage column exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'progress_percentage') THEN
        ALTER TABLE projects ADD COLUMN progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100);
        RAISE NOTICE 'Added progress_percentage column to projects table';
    END IF;
    
    -- Check if material_costs column exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'material_costs') THEN
        ALTER TABLE projects ADD COLUMN material_costs DECIMAL(12,2) DEFAULT 0.00;
        RAISE NOTICE 'Added material_costs column to projects table';
    END IF;
    
    -- Check if labor_costs column exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'labor_costs') THEN
        ALTER TABLE projects ADD COLUMN labor_costs DECIMAL(12,2) DEFAULT 0.00;
        RAISE NOTICE 'Added labor_costs column to projects table';
    END IF;

    -- Check if company_id column exists (for RLS)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'company_id') THEN
        ALTER TABLE projects ADD COLUMN company_id UUID REFERENCES companies(id);
        RAISE NOTICE 'Added company_id column to projects table';
    END IF;
END$$;

-- Create or update indexes
CREATE INDEX IF NOT EXISTS idx_projects_budget ON projects(budget);
CREATE INDEX IF NOT EXISTS idx_projects_company_id ON projects(company_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);

-- Log current schema
DO $$
DECLARE
    col_record RECORD;
BEGIN
    RAISE NOTICE 'Current projects table columns:';
    FOR col_record IN 
        SELECT column_name, data_type, is_nullable, column_default 
        FROM information_schema.columns 
        WHERE table_name = 'projects' 
        ORDER BY ordinal_position
    LOOP
        RAISE NOTICE '- %: % (nullable: %, default: %)', 
            col_record.column_name, 
            col_record.data_type, 
            col_record.is_nullable, 
            col_record.column_default;
    END LOOP;
END$$;