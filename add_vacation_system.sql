-- Add default_vacation_days column to company_settings table
ALTER TABLE company_settings 
ADD COLUMN default_vacation_days INTEGER DEFAULT 25;

-- Update existing company_settings records with default value
UPDATE company_settings 
SET default_vacation_days = 25 
WHERE default_vacation_days IS NULL;

-- Add vacation tracking columns to employees table
ALTER TABLE employees 
ADD COLUMN vacation_days_total INTEGER DEFAULT 25,
ADD COLUMN vacation_days_used INTEGER DEFAULT 0;

-- Update existing employees with default vacation days from company settings
UPDATE employees 
SET vacation_days_total = (
  SELECT COALESCE(default_vacation_days, 25) 
  FROM company_settings 
  LIMIT 1
)
WHERE vacation_days_total IS NULL;

-- Create vacation_requests table
CREATE TABLE IF NOT EXISTS vacation_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    days_requested INTEGER NOT NULL,
    request_type VARCHAR(20) NOT NULL DEFAULT 'vacation' CHECK (request_type IN ('vacation', 'sick', 'personal')),
    reason TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    approved_by UUID REFERENCES auth.users(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_vacation_requests_employee_id ON vacation_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_vacation_requests_status ON vacation_requests(status);
CREATE INDEX IF NOT EXISTS idx_vacation_requests_start_date ON vacation_requests(start_date);

-- Create function to increment vacation days used
CREATE OR REPLACE FUNCTION increment_vacation_days_used(employee_id_param UUID, days_to_add INTEGER)
RETURNS VOID AS $$
BEGIN
    UPDATE employees 
    SET vacation_days_used = COALESCE(vacation_days_used, 0) + days_to_add,
        updated_at = NOW()
    WHERE id = employee_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable RLS (Row Level Security) on vacation_requests table
ALTER TABLE vacation_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Employees can view their own vacation requests
CREATE POLICY "Employees can view own vacation requests" ON vacation_requests
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM employees 
            WHERE employees.id = vacation_requests.employee_id 
            AND employees.user_id = auth.uid()
        )
    );

-- RLS Policy: Employees can insert their own vacation requests
CREATE POLICY "Employees can insert own vacation requests" ON vacation_requests
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM employees 
            WHERE employees.id = vacation_requests.employee_id 
            AND employees.user_id = auth.uid()
        )
        AND created_by = auth.uid()
    );

-- RLS Policy: Managers and admins can view all vacation requests
CREATE POLICY "Managers can view all vacation requests" ON vacation_requests
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM employees 
            WHERE employees.user_id = auth.uid() 
            AND employees.role IN ('manager', 'admin')
        )
    );

-- RLS Policy: Managers and admins can update vacation request status
CREATE POLICY "Managers can update vacation requests" ON vacation_requests
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM employees 
            WHERE employees.user_id = auth.uid() 
            AND employees.role IN ('manager', 'admin')
        )
    );

-- Create trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_vacation_requests_updated_at
    BEFORE UPDATE ON vacation_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Grant necessary permissions
GRANT SELECT, INSERT ON vacation_requests TO authenticated;
GRANT UPDATE (status, approved_by, approved_at) ON vacation_requests TO authenticated;
GRANT EXECUTE ON FUNCTION increment_vacation_days_used TO authenticated;

-- Add some helpful comments
COMMENT ON TABLE vacation_requests IS 'Stores vacation and leave requests from employees';
COMMENT ON COLUMN vacation_requests.request_type IS 'Type of request: vacation, sick, or personal';
COMMENT ON COLUMN vacation_requests.status IS 'Status of the request: pending, approved, or rejected';
COMMENT ON COLUMN vacation_requests.days_requested IS 'Number of days requested for this leave';
COMMENT ON FUNCTION increment_vacation_days_used IS 'Safely increments vacation days used for an employee';