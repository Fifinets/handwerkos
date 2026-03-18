-- Vacation columns on employees
ALTER TABLE employees ADD COLUMN IF NOT EXISTS vacation_days_total INT DEFAULT 30;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS vacation_days_used INT DEFAULT 0;

-- Vacation requests table
CREATE TABLE IF NOT EXISTS vacation_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  employee_id UUID NOT NULL REFERENCES employees(id),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days_requested INT NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_by UUID REFERENCES employees(id),
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_vacation_requests_employee ON vacation_requests(employee_id, start_date DESC);
CREATE INDEX IF NOT EXISTS idx_vacation_requests_company ON vacation_requests(company_id, status);

-- RLS
ALTER TABLE vacation_requests ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'vacation_requests_company_access' AND tablename = 'vacation_requests') THEN
    CREATE POLICY "vacation_requests_company_access" ON vacation_requests
      FOR ALL USING (
        company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
      );
  END IF;
END $$;
