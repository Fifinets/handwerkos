-- Add web_profile and legal_profile to sites table for isolated MVP data storage
ALTER TABLE sites 
ADD COLUMN IF NOT EXISTS web_profile JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS legal_profile JSONB DEFAULT '{}'::jsonb;
