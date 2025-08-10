-- Add budget column to projects table
ALTER TABLE projects ADD COLUMN budget DECIMAL(10,2) DEFAULT 0;

-- Add progress_percentage column to projects table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'projects' AND column_name = 'progress_percentage'
  ) THEN
    ALTER TABLE projects ADD COLUMN progress_percentage INTEGER DEFAULT 0;
  END IF;
END $$;

-- Update existing projects with budget from description field
UPDATE projects
SET budget = CASE 
  WHEN description ~ '\[BUDGET:(\d+\.?\d*)\]' THEN
    (regexp_match(description, '\[BUDGET:(\d+\.?\d*)\]'))[1]::DECIMAL(10,2)
  ELSE 
    0
END
WHERE budget IS NULL OR budget = 0;

-- Add comment for documentation
COMMENT ON COLUMN projects.budget IS 'Project budget in EUR';
COMMENT ON COLUMN projects.progress_percentage IS 'Project completion percentage (0-100)';