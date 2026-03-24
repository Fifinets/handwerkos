-- Add sent_at column to offers table
ALTER TABLE offers ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;

-- Backfill existing sent offers with updated_at as approximation
UPDATE offers SET sent_at = updated_at WHERE status = 'sent' AND sent_at IS NULL;
