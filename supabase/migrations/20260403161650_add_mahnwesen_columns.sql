-- Mahnstufen auf Rechnungen
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS reminder_level integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_reminder_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_count integer DEFAULT 0;

-- Mahnwesen-Einstellungen
ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS auto_reminders_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS reminder_days_1 integer DEFAULT 3,
  ADD COLUMN IF NOT EXISTS reminder_days_2 integer DEFAULT 14,
  ADD COLUMN IF NOT EXISTS reminder_days_3 integer DEFAULT 28;
