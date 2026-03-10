-- Add hourly_wage column to employees table if it doesn't exist
DO $$ 
BEGIN
    -- Add hourly_wage column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'employees' 
        AND column_name = 'hourly_wage'
    ) THEN
        ALTER TABLE employees ADD COLUMN hourly_wage DECIMAL(10,2) DEFAULT 0.00;
        COMMENT ON COLUMN employees.hourly_wage IS 'Hourly wage rate in Euro';
    END IF;
    
    -- Also add contact_info if needed for future use (optional)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'employees' 
        AND column_name = 'contact_info'
    ) THEN
        ALTER TABLE employees ADD COLUMN contact_info TEXT;
        COMMENT ON COLUMN employees.contact_info IS 'Additional contact information';
    END IF;
END $$;