-- Customer notes / communication history
CREATE TABLE IF NOT EXISTS customer_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES employees(id),
  note_type TEXT NOT NULL DEFAULT 'note'
    CHECK (note_type IN ('note', 'call', 'email', 'meeting', 'follow_up')),
  title TEXT,
  content TEXT NOT NULL,
  -- Follow-up fields
  follow_up_date DATE,
  follow_up_done BOOLEAN DEFAULT false,
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes (idempotent)
CREATE INDEX IF NOT EXISTS idx_customer_notes_customer ON customer_notes(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_notes_company ON customer_notes(company_id);
CREATE INDEX IF NOT EXISTS idx_customer_notes_follow_up ON customer_notes(follow_up_date)
  WHERE follow_up_done = false;

-- RLS
ALTER TABLE customer_notes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'customer_notes_company_access') THEN
    CREATE POLICY "customer_notes_company_access" ON customer_notes
      FOR ALL USING (
        company_id IN (
          SELECT company_id FROM profiles WHERE id = auth.uid()
        )
      );
  END IF;
END $$;
