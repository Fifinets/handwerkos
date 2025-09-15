-- Add default_break_start_time to company_settings table
ALTER TABLE company_settings
ADD COLUMN IF NOT EXISTS default_break_start_time TIME DEFAULT '12:00:00';

-- Add comment for documentation
COMMENT ON COLUMN company_settings.default_break_start_time IS 'Default time when lunch break starts (e.g., 12:00)';

-- Update existing rows with default value
UPDATE company_settings
SET default_break_start_time = '12:00:00'
WHERE default_break_start_time IS NULL;