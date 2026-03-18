-- Restore projects.location column that was incorrectly dropped in 20260307000008
-- Many components depend on this column (MobileTimeTracker, LocationBasedTimeTracking, etc.)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS location TEXT;
