-- Ensure projects table has budget column
-- This migration ensures the budget column exists and is properly configured

-- Add budget column if it doesn't exist
DO $$
BEGIN
    -- Check if budget column exists, if not add it
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'projects' 
        AND column_name = 'budget'
    ) THEN
        ALTER TABLE projects ADD COLUMN budget DECIMAL(10,2) DEFAULT 0;
        RAISE NOTICE 'Added budget column to projects table';
    ELSE
        RAISE NOTICE 'Budget column already exists in projects table';
    END IF;

    -- Ensure the column is not null (set default for existing null values)
    UPDATE projects SET budget = 0 WHERE budget IS NULL;
    
    RAISE NOTICE 'Budget column setup completed';
END $$;

-- Create an index on budget for better performance
CREATE INDEX IF NOT EXISTS idx_projects_budget ON projects(budget);

-- Update RLS policies to include budget column access
-- (The existing RLS policies should already cover this, but let's be explicit)

-- Verify the changes
DO $$
DECLARE
    col_exists boolean;
BEGIN
    SELECT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'projects' 
        AND column_name = 'budget'
    ) INTO col_exists;
    
    IF col_exists THEN
        RAISE NOTICE 'SUCCESS: Budget column is now available in projects table';
    ELSE
        RAISE EXCEPTION 'FAILED: Budget column could not be created';
    END IF;
END $$;