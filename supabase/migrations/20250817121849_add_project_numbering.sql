-- Add project numbering system with format YYYY-NNNN

-- Add project_number column to projects table if it doesn't exist
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS project_number VARCHAR(10) UNIQUE;

-- Create an index for faster lookups
CREATE INDEX IF NOT EXISTS idx_projects_project_number ON public.projects(project_number);

-- Create a sequence table to track the last number for each year
CREATE TABLE IF NOT EXISTS public.project_sequences (
    year INTEGER PRIMARY KEY,
    last_number INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Function to generate the next project number
CREATE OR REPLACE FUNCTION generate_project_number()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    current_year INTEGER;
    next_number INTEGER;
    formatted_number TEXT;
BEGIN
    -- Get current year
    current_year := EXTRACT(YEAR FROM NOW());
    
    -- Get or create the sequence for current year
    INSERT INTO project_sequences (year, last_number)
    VALUES (current_year, 0)
    ON CONFLICT (year) DO NOTHING;
    
    -- Get and increment the next number atomically
    UPDATE project_sequences
    SET last_number = last_number + 1,
        updated_at = NOW()
    WHERE year = current_year
    RETURNING last_number INTO next_number;
    
    -- Format as YYYY-NNNN (e.g., 2025-0001)
    formatted_number := current_year::TEXT || '-' || LPAD(next_number::TEXT, 4, '0');
    
    RETURN formatted_number;
END;
$$;

-- Trigger to automatically set project_number on insert
CREATE OR REPLACE FUNCTION set_project_number()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Only set if project_number is NULL
    IF NEW.project_number IS NULL THEN
        NEW.project_number := generate_project_number();
    END IF;
    RETURN NEW;
END;
$$;

-- Create trigger for new projects
DROP TRIGGER IF EXISTS trigger_set_project_number ON public.projects;
CREATE TRIGGER trigger_set_project_number
    BEFORE INSERT ON public.projects
    FOR EACH ROW
    EXECUTE FUNCTION set_project_number();

-- Update existing projects with project numbers
DO $$
DECLARE
    proj RECORD;
    counter INTEGER := 1;
    current_year INTEGER;
BEGIN
    current_year := EXTRACT(YEAR FROM NOW());
    
    -- Initialize the sequence for existing projects
    INSERT INTO project_sequences (year, last_number)
    VALUES (current_year, 0)
    ON CONFLICT (year) DO NOTHING;
    
    -- Update existing projects without project_number
    FOR proj IN 
        SELECT id 
        FROM public.projects 
        WHERE project_number IS NULL 
        ORDER BY created_at
    LOOP
        UPDATE public.projects
        SET project_number = current_year::TEXT || '-' || LPAD(counter::TEXT, 4, '0')
        WHERE id = proj.id;
        
        counter := counter + 1;
    END LOOP;
    
    -- Update the sequence to reflect the last used number
    IF counter > 1 THEN
        UPDATE project_sequences
        SET last_number = counter - 1,
            updated_at = NOW()
        WHERE year = current_year;
    END IF;
END $$;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.project_sequences TO authenticated;
GRANT EXECUTE ON FUNCTION generate_project_number() TO authenticated;
GRANT EXECUTE ON FUNCTION set_project_number() TO authenticated;