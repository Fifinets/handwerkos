-- 1. New appointment columns on projects
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS besichtigung_date DATE,
  ADD COLUMN IF NOT EXISTS besichtigung_time_start TIME,
  ADD COLUMN IF NOT EXISTS besichtigung_time_end TIME,
  ADD COLUMN IF NOT EXISTS besichtigung_employee_id UUID REFERENCES employees(id),
  ADD COLUMN IF NOT EXISTS besichtigung_calendar_event_id UUID,
  ADD COLUMN IF NOT EXISTS work_start_date DATE,
  ADD COLUMN IF NOT EXISTS work_end_date DATE,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- 2. Link calendar_events to projects
ALTER TABLE calendar_events
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id);

-- 3. FK for besichtigung_calendar_event_id (after calendar_events.project_id exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'projects_besichtigung_calendar_event_id_fkey'
  ) THEN
    ALTER TABLE projects
      ADD CONSTRAINT projects_besichtigung_calendar_event_id_fkey
      FOREIGN KEY (besichtigung_calendar_event_id) REFERENCES calendar_events(id);
  END IF;
END $$;

-- 4. Migrate status data: geplant → beauftragt
UPDATE projects SET status = 'beauftragt' WHERE status = 'geplant';
UPDATE projects SET status = 'in_bearbeitung' WHERE status = 'in_planung';
UPDATE projects SET status = 'abgeschlossen' WHERE status = 'abnahme';

-- 5. Back-fill completed_at for existing completed projects
UPDATE projects SET completed_at = updated_at WHERE status = 'abgeschlossen' AND completed_at IS NULL;

-- 6. Index for calendar event project lookups
CREATE INDEX IF NOT EXISTS idx_calendar_events_project ON calendar_events(project_id);
